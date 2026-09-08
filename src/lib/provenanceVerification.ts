/**
 * Combines the EXISTING off-chain verification result (file / content /
 * merkle / knowledge-graph) with the registered blockchain provenance record.
 * Pure functions only — no side effects, no changes to the existing engine.
 */

export type ProvenanceVerdict =
  | "AUTHENTIC"
  | "SAFE_RE_EXPORT"
  | "TAMPERING_DETECTED"
  | "SEMANTIC_ANOMALY"
  | "REVOKED"
  | "SUPERSEDED"
  | "NOT_REGISTERED";

export interface ComputedHashes {
  fileHash?: string | null;
  contentHash?: string | null;
  merkleRoot?: string | null;
  semanticHash?: string | null;
}

export interface RegisteredVersion {
  version: number;
  state: string; // ACTIVE | REVOKED | SUPERSEDED
  fileHash?: string | null;
  contentHash?: string | null;
  merkleRoot?: string | null;
  semanticHash?: string | null;
}

export interface ProvenanceEvaluation {
  verdict: ProvenanceVerdict;
  label: string;
  explanation: string;
  fileHashMatch: boolean;
  contentHashMatch: boolean;
  merkleRootMatch: boolean;
  semanticHashMatch: boolean;
}

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function evaluateProvenance(
  computed: ComputedHashes,
  registered?: RegisteredVersion | null,
  opts?: { semanticAnomaly?: boolean }
): ProvenanceEvaluation {
  const fileHashMatch = eq(computed.fileHash, registered?.fileHash);
  const contentHashMatch = eq(computed.contentHash, registered?.contentHash);
  const merkleRootMatch = eq(computed.merkleRoot, registered?.merkleRoot);
  const semanticHashMatch = eq(computed.semanticHash, registered?.semanticHash);

  const base = { fileHashMatch, contentHashMatch, merkleRootMatch, semanticHashMatch };

  if (!registered) {
    return {
      ...base,
      verdict: "NOT_REGISTERED",
      label: "Not registered on blockchain",
      explanation: "No blockchain provenance record exists for this document yet.",
    };
  }

  if (registered.state === "REVOKED") {
    return {
      ...base,
      verdict: "REVOKED",
      label: "Revoked",
      explanation: `Version V${registered.version} has been revoked by its issuer. The history remains visible for audit.`,
    };
  }

  if (!contentHashMatch) {
    return {
      ...base,
      verdict: "TAMPERING_DETECTED",
      label: "Tampering detected",
      explanation:
        "The normalized document content does not match the content registered on the blockchain.",
    };
  }

  if (opts?.semanticAnomaly || (registered.semanticHash && !semanticHashMatch)) {
    return {
      ...base,
      verdict: "SEMANTIC_ANOMALY",
      label: "Semantic anomaly detected",
      explanation:
        "The document text matches, but its knowledge-graph relationships differ from the registered version.",
    };
  }

  if (registered.state === "SUPERSEDED") {
    return {
      ...base,
      verdict: "SUPERSEDED",
      label: "Superseded",
      explanation: `Version V${registered.version} is historically valid but has been replaced by a newer version.`,
    };
  }

  if (!fileHashMatch) {
    return {
      ...base,
      verdict: "SAFE_RE_EXPORT",
      label: "Safe re-export",
      explanation:
        "The binary file changed, but the normalized document content matches the registered content.",
    };
  }

  return {
    ...base,
    verdict: "AUTHENTIC",
    label: "Authentic",
    explanation:
      "File hash, content hash and Merkle root all match the record registered on Arbitrum.",
  };
}
