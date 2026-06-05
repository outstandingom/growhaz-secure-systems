/**
 * OnChainRegistryHub — single component that bundles all reusable on-chain
 * registry UIs behind tabs. Drop into Profile and Blockchain page.
 *
 * The "Demo" tabs (Process / Users / Wallets) are backed by Supabase tables
 * so we can showcase the full flow without paying gas on every interaction.
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WalletGate } from "./WalletGate";
import { AuthorizationManager } from "./AuthorizationManager";
import { AccessControlManager } from "./AccessControlManager";
import { ProcessManagerCard } from "./ProcessManagerCard";
import { StepsPanel } from "./StepsPanel";
import { TimelineViewer } from "./TimelineViewer";
import { UniversalSearch } from "./UniversalSearch";
import { DemoProcessFlow } from "./DemoProcessFlow";
import { DemoUserRegistry } from "./DemoUserRegistry";
import { DemoChainWallets } from "./DemoChainWallets";
import { Network } from "lucide-react";

export function OnChainRegistryHub({ defaultTab = "demo-process" }: { defaultTab?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">On-Chain Registries</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">Polygon Amoy</span>
      </div>

      {/* Demo tabs are NOT wallet-gated — they only use Supabase */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-9 w-full">
          <TabsTrigger value="demo-process">Process</TabsTrigger>
          <TabsTrigger value="demo-users">Users</TabsTrigger>
          <TabsTrigger value="demo-wallets">Wallets</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="chain-process">Chain Proc.</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="org">Org Auth</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="demo-process" className="pt-3"><DemoProcessFlow /></TabsContent>
        <TabsContent value="demo-users" className="pt-3"><DemoUserRegistry /></TabsContent>
        <TabsContent value="demo-wallets" className="pt-3"><DemoChainWallets /></TabsContent>

        <TabsContent value="search" className="pt-3"><WalletGate><UniversalSearch /></WalletGate></TabsContent>
        <TabsContent value="chain-process" className="pt-3"><WalletGate><ProcessManagerCard /></WalletGate></TabsContent>
        <TabsContent value="steps" className="pt-3"><WalletGate><StepsPanel /></WalletGate></TabsContent>
        <TabsContent value="access" className="pt-3"><WalletGate><AccessControlManager /></WalletGate></TabsContent>
        <TabsContent value="org" className="pt-3"><WalletGate><AuthorizationManager /></WalletGate></TabsContent>
        <TabsContent value="timeline" className="pt-3"><WalletGate><TimelineViewer title="Recent on-chain timeline (all entities)" /></WalletGate></TabsContent>
      </Tabs>
    </div>
  );
}
