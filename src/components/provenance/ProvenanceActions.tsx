/**
 * ProvenanceActions — owner-side blockchain provenance controls for one
 * document: register, add version, attest, revoke, supersede.
 * Every action is confirmed in the user's existing browser wallet on Arbitrum
 * and mirrored into the isolated provenance tables.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldCheck, Ban, GitBranch, Stamp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProvenance, deterministicHash } from "@/hooks/useProvenance";
import { PROVENANCE_NETWORK, PROVENANCE_REGISTRY_ADDRESS, txUrl } from "@/lib/provenanceConfig";

interface DocLike {
  id: string;
  document_name: string;
  document_type?: string | null;
  file_hash: string;
  content_hash: string;
  merkle_root?: string | null;
  knowledge_graph?: any;
  ipfs_url?: string | null;
  ipfs_cid?: string | null;
  tracking_id?: string | null;
}

export function ProvenanceActions({
  doc,
  userId,
  onChanged,
}: {
  doc: DocLike;
  userId: string;
  onChanged?: () => void;
}) {
  const p = useProvenance();
  const [record, setRecord] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [role, setRole] = useState("ISSUER");

  const recordId = record?.record_id || doc.tracking_id || `GH-${doc.id.slice(0, 8).toUpperCase()}`;

  const load = useCallback(async () => {
    const { data: rec } = await supabase
      .from("provenance_records")
      .select("*")
      .eq("document_id", doc.id)
      .maybeSingle();
    setRecord(rec);
    if (rec) {
      const { data: v } = await supabase
        .from("provenance_versions")
        .select("*")
        .eq("record_id", rec.record_id)
        .order("version", { ascending: true });
      setVersions(v || []);
    } else {
      setVersions([]);
    }
  }, [doc.id]);

  useEffect(() => {
    load();
  }, [load]);

  const hashes = useCallback(async () => {
    const semanticHash = doc.knowledge_graph
      ? await deterministicHash(doc.knowledge_graph)
      : "";
    return {
      fileHash: doc.file_hash,
      contentHash: doc.content_hash,
      merkleRoot: doc.merkle_root || doc.content_hash,
      semanticHash,
      metadataURI: doc.ipfs_url || (doc.ipfs_cid ? `ipfs://${doc.ipfs_cid}` : ""),
    };
  }, [doc]);

  const connect = async () => {
    try {
      setWallet(await p.connect());
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setPending(key);
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Blockchain action failed");
    } finally {
      setPending(null);
    }
  };

  const currentVersion = versions.length ? versions[versions.length - 1] : null;

  const register = () =>
    run("register", async () => {
      const h = await hashes();
      const actor = wallet || (await p.connect());
      const r = await p.registerRecord({ recordId, ...h });

      await supabase.from("provenance_records").insert({
        user_id: userId,
        document_id: doc.id,
        record_id: recordId,
        issuer_wallet: actor,
        current_version: 1,
        chain_network: PROVENANCE_NETWORK.key,
        contract_address: PROVENANCE_REGISTRY_ADDRESS,
      });
      await supabase.from("provenance_versions").insert({
        user_id: userId,
        record_id: recordId,
        version: 1,
        previous_version: null,
        file_hash: h.fileHash,
        content_hash: h.contentHash,
        merkle_root: h.merkleRoot,
        semantic_hash: h.semanticHash,
        actor_wallet: actor,
        issuer_wallet: actor,
        event_type: "REGISTERED",
        state: "ACTIVE",
        metadata_uri: h.metadataURI,
        chain_network: PROVENANCE_NETWORK.key,
        contract_address: PROVENANCE_REGISTRY_ADDRESS,
        tx_hash: r.txHash,
        block_hash: r.blockHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
        chain_timestamp: new Date().toISOString(),
      });
      await supabase.from("provenance_events").insert({
        user_id: userId,
        record_id: recordId,
        version: 1,
        event_type: "RecordRegistered",
        actor_wallet: actor,
        tx_hash: r.txHash,
        block_hash: r.blockHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
      });
      setWallet(actor);
      toast.success("Registered on Arbitrum as V1");
    });

  const addVersion = (eventType: "UPDATED" | "APPROVED" | "VERIFIED") =>
    run(eventType, async () => {
      const h = await hashes();
      const actor = wallet || (await p.connect());
      const r = await p.addVersion({ recordId, ...h, eventType });
      const next = (record?.current_version || versions.length) + 1;

      await supabase.from("provenance_versions").insert({
        user_id: userId,
        record_id: recordId,
        version: next,
        previous_version: next - 1,
        file_hash: h.fileHash,
        content_hash: h.contentHash,
        merkle_root: h.merkleRoot,
        semantic_hash: h.semanticHash,
        actor_wallet: actor,
        issuer_wallet: record?.issuer_wallet || actor,
        event_type: eventType,
        state: "ACTIVE",
        metadata_uri: h.metadataURI,
        chain_network: PROVENANCE_NETWORK.key,
        contract_address: PROVENANCE_REGISTRY_ADDRESS,
        tx_hash: r.txHash,
        block_hash: r.blockHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
        chain_timestamp: new Date().toISOString(),
      });
      if (next > 1) {
        await supabase
          .from("provenance_versions")
          .update({ state: "SUPERSEDED" })
          .eq("record_id", recordId)
          .eq("version", next - 1)
          .eq("state", "ACTIVE");
      }
      await supabase
        .from("provenance_records")
        .update({ current_version: next })
        .eq("record_id", recordId);
      await supabase.from("provenance_events").insert({
        user_id: userId,
        record_id: recordId,
        version: next,
        event_type: `VersionAdded:${eventType}`,
        actor_wallet: actor,
        tx_hash: r.txHash,
        block_hash: r.blockHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
      });
      setWallet(actor);
      toast.success(`V${next} recorded on Arbitrum`);
    });

  const attest = () =>
    run("attest", async () => {
      if (!currentVersion) throw new Error("Register the document first.");
      const actor = wallet || (await p.connect());
      const statement = `${role} attestation for ${recordId} V${currentVersion.version}`;
      const statementHash = await deterministicHash(statement);
      const r = await p.attestVersion({
        recordId,
        version: currentVersion.version,
        role,
        statementHash,
      });
      await supabase.from("provenance_attestations").insert({
        user_id: userId,
        record_id: recordId,
        version: currentVersion.version,
        actor_wallet: actor,
        role,
        statement,
        proof_hash: statementHash,
        tx_hash: r.txHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
      });
      await supabase.from("provenance_events").insert({
        user_id: userId,
        record_id: recordId,
        version: currentVersion.version,
        event_type: "VersionAttested",
        actor_wallet: actor,
        tx_hash: r.txHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
      });
      setWallet(actor);
      toast.success("Attestation recorded");
    });

  const revoke = () =>
    run("revoke", async () => {
      if (!currentVersion) throw new Error("Nothing to revoke.");
      const actor = wallet || (await p.connect());
      const reasonHash = await deterministicHash(`revoked:${recordId}:${currentVersion.version}`);
      const r = await p.revokeVersion({
        recordId,
        version: currentVersion.version,
        reasonHash,
      });
      await supabase
        .from("provenance_versions")
        .update({ state: "REVOKED" })
        .eq("record_id", recordId)
        .eq("version", currentVersion.version);
      await supabase.from("provenance_events").insert({
        user_id: userId,
        record_id: recordId,
        version: currentVersion.version,
        event_type: "VersionRevoked",
        actor_wallet: actor,
        tx_hash: r.txHash,
        block_number: r.blockNumber,
        explorer_url: txUrl(r.txHash),
      });
      setWallet(actor);
      toast.success("Version revoked (history preserved)");
    });

  if (!p.configured) {
    return (
      <div className="p-3 rounded-xl bg-card/50 border border-border text-xs text-muted-foreground">
        Arbitrum provenance registry is not configured yet. Deploy{" "}
        <code>ProvenanceRegistry.sol</code> to {PROVENANCE_NETWORK.name} and set{" "}
        <code>VITE_PROVENANCE_REGISTRY_ADDRESS</code>.
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-card/50 border border-border space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Arbitrum Provenance
        </span>
        <Badge variant="outline">{PROVENANCE_NETWORK.name}</Badge>
        {record && <code className="text-xs text-muted-foreground">{recordId}</code>}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={connect}
          disabled={!!wallet}
        >
          <Wallet className="w-4 h-4 mr-1" />
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect wallet"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {!record ? (
          <Button size="sm" onClick={register} disabled={pending !== null}>
            {pending === "register" ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-1" />
            )}
            Register on Arbitrum (V1)
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addVersion("UPDATED")}
              disabled={pending !== null}
            >
              {pending === "UPDATED" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <GitBranch className="w-4 h-4 mr-1" />
              )}
              Add version
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addVersion("APPROVED")}
              disabled={pending !== null}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addVersion("VERIFIED")}
              disabled={pending !== null}
            >
              Mark verified
            </Button>
            <div className="flex items-center gap-2">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISSUER">Issuer</SelectItem>
                  <SelectItem value="REGISTRAR">Registrar</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={attest} disabled={pending !== null}>
                {pending === "attest" ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Stamp className="w-4 h-4 mr-1" />
                )}
                Attest
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={revoke}
              disabled={pending !== null || currentVersion?.state === "REVOKED"}
            >
              {pending === "revoke" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-1" />
              )}
              Revoke current
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Only hashes and provenance metadata are written on-chain. The document itself always stays
        off-chain.
      </p>
    </div>
  );
}
