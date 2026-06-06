/**
 * OnChainRegistryHub — single component that bundles all reusable on-chain
 * registry UIs behind tabs. Drop into Profile and Blockchain page.
 *
 * Tabs (Sepolia testnet):
 *   • Register  — UserRegistryPanel  (on-chain identity)
 *   • Lookup    — DocumentNumberLookup (search by unique doc number)
 *   • Process   — ProcessManagerCard
 *   • Steps     — StepsPanel
 *   • Access    — AccessControlManager
 *   • Org Auth  — AuthorizationManager
 *   • Timeline  — TimelineViewer (global)
 *   • Demo      — Supabase-backed dry runs (no gas)
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WalletGate } from "./WalletGate";
import { UserRegistryPanel } from "./UserRegistryPanel";
import { DocumentNumberLookup } from "./DocumentNumberLookup";
import { AuthorizationManager } from "./AuthorizationManager";
import { AccessControlManager } from "./AccessControlManager";
import { ProcessManagerCard } from "./ProcessManagerCard";
import { StepsPanel } from "./StepsPanel";
import { TimelineViewer } from "./TimelineViewer";
import { DemoProcessFlow } from "./DemoProcessFlow";
import { DemoUserRegistry } from "./DemoUserRegistry";
import { DemoChainWallets } from "./DemoChainWallets";
import { Network } from "lucide-react";

export function OnChainRegistryHub({ defaultTab = "register" }: { defaultTab?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">On-Chain Registries</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">Ethereum Sepolia</span>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-9 w-full">
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="lookup">Lookup</TabsTrigger>
          <TabsTrigger value="process">Process</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="org">Org Auth</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="demo">Demo</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
        </TabsList>

        {/* Lookup is read-only — no wallet required */}
        <TabsContent value="lookup" className="pt-3"><DocumentNumberLookup /></TabsContent>
        <TabsContent value="timeline" className="pt-3"><TimelineViewer title="Recent on-chain timeline (all entities)" /></TabsContent>

        {/* Wallet-gated tabs */}
        <TabsContent value="register" className="pt-3"><WalletGate><UserRegistryPanel /></WalletGate></TabsContent>
        <TabsContent value="process" className="pt-3"><WalletGate><ProcessManagerCard /></WalletGate></TabsContent>
        <TabsContent value="steps" className="pt-3"><WalletGate><StepsPanel /></WalletGate></TabsContent>
        <TabsContent value="access" className="pt-3"><WalletGate><AccessControlManager /></WalletGate></TabsContent>
        <TabsContent value="org" className="pt-3"><WalletGate><AuthorizationManager /></WalletGate></TabsContent>

        {/* Supabase-backed demo (no gas) */}
        <TabsContent value="demo" className="pt-3 space-y-4">
          <DemoProcessFlow />
          <DemoUserRegistry />
        </TabsContent>
        <TabsContent value="wallets" className="pt-3"><DemoChainWallets /></TabsContent>
      </Tabs>
    </div>
  );
}
