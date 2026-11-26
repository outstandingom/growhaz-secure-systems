import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Dna, 
  Network, 
  RefreshCw, 
  Layers, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ArrowRightLeft,
  ExternalLink,
  ShieldCheck,
  Server
} from "lucide-react";

export function DnaGraphitiLab() {
  const { toast } = useToast();
  const [backendUrl, setBackendUrl] = useState(
    (import.meta.env.VITE_DNA_BACKEND_URL as string) || "http://localhost:7860"
  );

  // Telemetry state
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [graphitiStatus, setGraphitiStatus] = useState<any>(null);
  const [shardingStats, setShardingStats] = useState<any>(null);

  // Test Console state
  const [testUserId, setTestUserId] = useState("om_uikey_admin");
  const [testMessage, setTestMessage] = useState(
    "I joined Growhaz as a Principal AI Architect working with Python, Neo4j and Arbitrum on Nov 2026."
  );
  const [testingRunning, setTestingRunning] = useState(false);
  const [dnaTestResult, setDnaTestResult] = useState<any>(null);
  const [graphitiTestResult, setGraphitiTestResult] = useState<any>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Graphiti search query
  const [searchQuery, setSearchQuery] = useState("Growhaz");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);

  const fetchTelemetry = async () => {
    setLoadingStatus(true);
    try {
      const cleanUrl = backendUrl.replace(/\/+$/, "");

      // 1. Fetch Graphiti status
      const gRes = await fetch(`${cleanUrl}/admin/graphiti/status`, { signal: AbortSignal.timeout(5000) });
      if (gRes.ok) {
        const gData = await gRes.json();
        setGraphitiStatus(gData);
      } else {
        setGraphitiStatus({ connected: false, error: `HTTP ${gRes.status}` });
      }

      // 2. Fetch Sharding stats
      const sRes = await fetch(`${cleanUrl}/admin/sharding/stats`, { signal: AbortSignal.timeout(5000) });
      if (sRes.ok) {
        const sData = await sRes.json();
        setShardingStats(sData);
      }
    } catch (err: any) {
      toast({
        title: "Backend Connection Notice",
        description: `Could not reach ${backendUrl}. Check that the backend is running.`,
        variant: "destructive"
      });
      setGraphitiStatus({ connected: false, error: err.message });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleRunDualTest = async () => {
    if (!testMessage.trim()) return;
    setTestingRunning(true);
    const cleanUrl = backendUrl.replace(/\/+$/, "");

    try {
      // 1. Test Sharded DNA Modal
      const dnaRes = await fetch(`${cleanUrl}/admin/sharding/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: testUserId,
          message: testMessage,
          relation_type: "dialogue_statement"
        })
      });
      if (dnaRes.ok) {
        const dnaData = await dnaRes.json();
        setDnaTestResult(dnaData);
      }

      // 2. Test Graphiti Temporal Ingestion
      const gRes = await fetch(`${cleanUrl}/admin/graphiti/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: testUserId,
          message: testMessage
        })
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        setGraphitiTestResult(gData.results);
      }

      toast({
        title: "Dual Test Completed",
        description: "Processed through DNA Shard & Graphiti Temporal Extractor."
      });
      fetchTelemetry();
    } catch (err: any) {
      toast({
        title: "Test Execution Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setTestingRunning(false);
    }
  };

  const handleSyncGraphitiToDna = async () => {
    setSyncing(true);
    const cleanUrl = backendUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${cleanUrl}/admin/graphiti/sync_to_dna`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(data.synced);
        toast({
          title: "Graphiti → DNA Modal Synchronized! 🧬",
          description: `Synced ${data.synced.entities_synced} entities & ${data.synced.relations_synced} relations.`
        });
        fetchTelemetry();
      }
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSearchGraphiti = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const cleanUrl = backendUrl.replace(/\/+$/, "");
    try {
      const res = await fetch(`${cleanUrl}/admin/graphiti/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results);
      }
    } catch (err: any) {
      toast({
        title: "Search Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Backend Config */}
      <Card className="border-primary/20 bg-card/60 backdrop-blur-sm">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-xl flex flex-wrap items-center gap-2">
                <Dna className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                <span>DNA Modal &amp; Graphiti Temporal Lab</span>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Admin Testing Only
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Shadow testing, episodic Graphiti extraction, and horizontal DNA sharding.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <Input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="Backend URL (e.g. https://dna-modal.onrender.com)"
                className="w-full sm:w-72 text-xs"
              />
              <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={fetchTelemetry} disabled={loadingStatus}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingStatus ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Graphiti Status */}
        <Card className="border-border/60 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="w-4 h-4 text-emerald-500" />
                Graphiti & Neo4j AuraDB
              </CardTitle>
              <Badge variant={graphitiStatus?.connected ? "default" : "secondary"}>
                {graphitiStatus?.mode || "Checking..."}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Console Link:</span>
              <a
                href="https://console.neo4j.io/"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-mono"
              >
                console.neo4j.io <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Graph Nodes:</span>
              <span className="font-semibold text-foreground">{graphitiStatus?.node_count ?? 0}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Temporal Edges:</span>
              <span className="font-semibold text-foreground">{graphitiStatus?.edge_count ?? 0}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Recorded Episodes:</span>
              <span className="font-semibold text-foreground">{graphitiStatus?.episode_count ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: DNA Memory Sharding Status */}
        <Card className="border-border/60 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                DNA Sharding Engine
              </CardTitle>
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                {shardingStats?.num_shards ?? 4} Shards Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Partitioned Tenants:</span>
              <span className="font-semibold text-foreground">{shardingStats?.total_tenants ?? 0} users</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Total Concepts:</span>
              <span className="font-semibold text-foreground">{shardingStats?.total_concepts ?? 0} atoms</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Total Relationships:</span>
              <span className="font-semibold text-foreground">{shardingStats?.total_relations ?? 0} triples</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Global Ontology Shard:</span>
              <span className="font-semibold text-foreground">{shardingStats?.global_shard?.concept_count ?? 0} shared</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Sync Action Card */}
        <Card className="border-border/60 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Train DNA Modal from Graphiti
            </CardTitle>
            <CardDescription className="text-xs">
              Ingests Neo4j temporal entities & relations into DNA Modal canonical memory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {syncResult && (
              <div className="p-2 rounded bg-muted/60 text-xs space-y-1">
                <div className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synced in {syncResult.duration_ms} ms
                </div>
                <div>Entities: {syncResult.entities_synced} | Relations: {syncResult.relations_synced}</div>
              </div>
            )}
            <Button
              size="sm"
              className="w-full"
              variant="default"
              onClick={handleSyncGraphitiToDna}
              disabled={syncing}
            >
              <ArrowRightLeft className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronizing..." : "Sync Graphiti → DNA Memory"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dual Test Lab Console */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Shadow Evaluation Console (Dual-Engine Execution)
          </CardTitle>
          <CardDescription className="text-xs">
            Test how a dialogue turn is partitioned across DNA Modal Shards vs. Graphiti Temporal Extraction without altering user-facing responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Test Tenant / User ID</label>
              <Input
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="e.g. user_101"
                className="text-xs"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Dialogue Message</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter message to test..."
                  className="text-xs flex-1 w-full"
                />
                <Button size="sm" className="w-full sm:w-auto shrink-0" onClick={handleRunDualTest} disabled={testingRunning}>
                  {testingRunning ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                  Run Dual Test
                </Button>
              </div>
            </div>
          </div>

          {/* Test Results Comparison Grid */}
          {(dnaTestResult || graphitiTestResult) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              {/* Left Column: DNA Modal Output */}
              <Card className="border-cyan-500/30 bg-cyan-950/10 min-w-0">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Dna className="w-4 h-4" /> DNA Modal (Sharded Tenant Shard)
                    </CardTitle>
                    {dnaTestResult && (
                      <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-300">
                        {dnaTestResult.routed_shard}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {dnaTestResult ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">Active User Facts:</span>
                        <pre className="mt-1 p-2 rounded bg-black/40 overflow-x-auto text-[11px] font-mono text-cyan-200">
                          {JSON.stringify(dnaTestResult.federated_query?.user_profile || {}, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Federated Shard Hits:</span>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Tenant Hits: {dnaTestResult.federated_query?.tenant_hits?.length ?? 0} | Global Reference Hits: {dnaTestResult.federated_query?.global_reference_hits?.length ?? 0}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground italic">No test run yet.</div>
                  )}
                </CardContent>
              </Card>

              {/* Right Column: Graphiti Temporal Output */}
              <Card className="border-emerald-500/30 bg-emerald-950/10 min-w-0">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Network className="w-4 h-4" /> Graphiti / Neo4j Temporal Extraction
                    </CardTitle>
                    {graphitiTestResult && (
                      <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-300">
                        Episode: {graphitiTestResult.episode_id?.slice(0, 10)}...
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  {graphitiTestResult ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">Extracted Entities ({graphitiTestResult.extracted_entities?.length || 0}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {graphitiTestResult.extracted_entities?.map((e: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {e.name} ({e.entity_type})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Extracted Temporal Relationships:</span>
                        <pre className="mt-1 p-2 rounded bg-black/40 overflow-x-auto text-[11px] font-mono text-emerald-200">
                          {JSON.stringify(graphitiTestResult.extracted_relations || [], null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground italic">No test run yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shards Table */}
      {shardingStats?.shards && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Horizontal Shard Partitions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
              <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Shard ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active Tenants</TableHead>
                  <TableHead>Concepts</TableHead>
                  <TableHead>Relationships</TableHead>
                  <TableHead>Assemblies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {shardingStats.shards.map((s: any) => (
                  <TableRow key={s.shard_id}>
                    <TableCell className="font-mono font-medium">{s.shard_id}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "outline"} className="text-[10px]">
                        {s.is_active ? "Active In-Memory" : "Standby (Disk)"}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.tenant_count}</TableCell>
                    <TableCell>{s.concept_count}</TableCell>
                    <TableCell>{s.relation_count}</TableCell>
                    <TableCell>{s.assembly_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphiti Search Query Explorer */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Graphiti Temporal Search Explorer
          </CardTitle>
          <CardDescription className="text-xs">
            Query temporal entity-relationship paths across cognitive memory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts (e.g. Growhaz, Python, Arbitrum)..."
              className="text-xs flex-1 w-full"
            />
            <Button size="sm" variant="outline" className="w-full sm:w-auto shrink-0" onClick={handleSearchGraphiti} disabled={searchLoading}>
              {searchLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Search className="w-3.5 h-3.5 mr-1" />}
              Search Graph
            </Button>
          </div>

          {searchResults && (
            <div className="space-y-2 pt-2 text-xs">
              <div className="text-muted-foreground font-medium">
                Found {searchResults.total_matches} elements for "{searchResults.query}":
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="p-2 rounded bg-muted/40">
                  <div className="font-semibold text-foreground mb-1">Entities:</div>
                  {searchResults.entities?.length ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {searchResults.entities.map((e: any, idx: number) => (
                        <li key={idx} className="font-mono text-[11px]">
                          {e.name} <span className="text-muted-foreground">({e.entity_type})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground italic">None found</div>
                  )}
                </div>
                <div className="p-2 rounded bg-muted/40">
                  <div className="font-semibold text-foreground mb-1">Relationships:</div>
                  {searchResults.relations?.length ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {searchResults.relations.map((r: any, idx: number) => (
                        <li key={idx} className="font-mono text-[11px]">
                          {r.source_id} → <span className="text-primary">{r.predicate}</span> → {r.target_id}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground italic">None found</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
