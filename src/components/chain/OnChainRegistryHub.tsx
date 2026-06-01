/**
 * OnChainRegistryHub — single component that bundles all reusable on-chain
 * registry UIs behind tabs. Drop into Profile and Blockchain page.
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WalletGate } from "./WalletGate";
import { AuthorizationManager } from "./AuthorizationManager";
import { AccessControlManager } from "./AccessControlManager";
import { ProcessManagerCard } from "./ProcessManagerCard";
import { TimelineViewer } from "./TimelineViewer";
import { UniversalSearch } from "./UniversalSearch";
import { Network } from "lucide-react";

export function OnChainRegistryHub({ defaultTab = "search" }: { defaultTab?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">On-Chain Registries</h2>
      </div>
      <WalletGate>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="process">Process</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="org">Org Auth</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="pt-3"><UniversalSearch /></TabsContent>
          <TabsContent value="process" className="pt-3"><ProcessManagerCard /></TabsContent>
          <TabsContent value="access" className="pt-3"><AccessControlManager /></TabsContent>
          <TabsContent value="org" className="pt-3"><AuthorizationManager /></TabsContent>
          <TabsContent value="timeline" className="pt-3"><TimelineViewer title="Recent on-chain timeline (all entities)" /></TabsContent>
        </Tabs>
      </WalletGate>
    </div>
  );
}
