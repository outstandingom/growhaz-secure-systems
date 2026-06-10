// src/components/blockchain/BlockchainRegistration.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Wallet, Link2, Loader2, CheckCircle2, AlertTriangle,
  Copy, ExternalLink, User, Shield, Clock, Save, X, RefreshCw
} from 'lucide-react';
import { USER_REGISTRY_V2_ADDRESS, isUserRegistryV2Deployed } from '@/lib/userRegistryV2Contract';
import type { OnChainUser } from '@/hooks/useWeb3Wallet';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

interface BlockchainRegistrationProps {
  // Wallet state from hook
  walletAddress: string | null;
  walletType: string | null;
  onChainUser: OnChainUser | null;
  loadingOnChain: boolean;
  isConnecting: boolean;
  // Actions
  connectMetaMask: () => Promise<string>;
  disconnect: () => void;
  registerOrUpdateOnChain: (ipfsCid: string) => Promise<string>;
  refreshOnChainProfile: () => Promise<void>;
  // Additional user data
  userEmail: string;
  userProfile: {
    id: string;
    full_name: string;
    phone: string | null;
  } | null;
}

export function BlockchainRegistration({
  walletAddress,
  walletType,
  onChainUser,
  loadingOnChain,
  isConnecting,
  connectMetaMask,
  disconnect,
  registerOrUpdateOnChain,
  refreshOnChainProfile,
  userEmail,
  userProfile,
}: BlockchainRegistrationProps) {
  const [bcName, setBcName] = useState('');
  const [bcPhone, setBcPhone] = useState('');
  const [bcProfession, setBcProfession] = useState('');
  const [bcWork, setBcWork] = useState('');
  const [bcAge, setBcAge] = useState<number | ''>('');
  const [registering, setRegistering] = useState(false);
  const { toast } = useToast();

  // Pre-fill form when onChainUser already has IPFS data
  useEffect(() => {
    if (onChainUser?.fullIpfsData) {
      const data = onChainUser.fullIpfsData;
      setBcName(data.name || '');
      setBcPhone(data.phone || '');
      setBcProfession(data.profession || '');
      setBcWork(data.work || '');
      setBcAge(data.age || '');
    } else if (userProfile) {
      // fallback to local profile
      setBcName(userProfile.full_name);
      setBcPhone(userProfile.phone || '');
    }
  }, [onChainUser, userProfile]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Address copied to clipboard' });
  };

  const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  };

  const handleRegisterOrUpdate = async () => {
    if (!walletAddress || !userProfile) {
      toast({ title: 'Wallet Required', description: 'Please connect your wallet first', variant: 'destructive' });
      return;
    }
    if (!bcProfession.trim()) {
      toast({ title: 'Missing Field', description: 'Please enter your profession/role', variant: 'destructive' });
      return;
    }
    if (!bcAge || bcAge < 18) {
      toast({ title: 'Invalid Age', description: 'You must be at least 18 years old', variant: 'destructive' });
      return;
    }

    setRegistering(true);
    try {
      // 1. Upload profile to IPFS
      toast({ title: 'Step 1/3 — Uploading to IPFS', description: 'Pinning your profile to decentralized storage...' });
      const finalName = bcName.trim() || userProfile.full_name;
      const finalPhone = bcPhone.trim() || userProfile.phone || '';

      const profilePayload = {
        name: finalName,
        email: userEmail,
        emailHash: simpleHash(userEmail),
        phone: finalPhone,
        phoneHash: finalPhone ? simpleHash(finalPhone) : '',
        profession: bcProfession.trim(),
        work: bcWork.trim(),
        age: bcAge,
        skills: [],
        bio: '',
        wallet: walletAddress,
        walletType,
        registeredAt: new Date().toISOString(),
        version: 2
      };

      const profileJson = JSON.stringify(profilePayload, null, 2);
      const base64 = btoa(unescape(encodeURIComponent(profileJson)));

      const { data: pin, error: pinErr } = await supabase.functions.invoke('pinata-upload', {
        body: {
          fileBase64: base64,
          fileName: `profile-${walletAddress.slice(0, 8)}.json`,
          mimeType: 'application/json',
          metadata: { type: 'user-profile', wallet: walletAddress }
        }
      });

      if (pinErr) throw pinErr;
      if (pin?.error) throw new Error(pin.error);
      const ipfsCid = pin.cid;

      // 2. Register/Update on blockchain
      toast({ title: 'Step 2/3 — Confirm in Wallet', description: 'Please confirm the transaction in your wallet...' });
      const txHash = await registerOrUpdateOnChain(ipfsCid);

      // 3. Save to Supabase for indexing (optional)
      toast({ title: 'Step 3/3 — Saving to database', description: 'Recording registration...' });
      const { error: dbError } = await supabase.from('blockchain_user_registrations').insert({
        transaction_hash: txHash,
        block_hash: 'pending',
        block_number: 0,
        contract_address: USER_REGISTRY_V2_ADDRESS,
        wallet_address: walletAddress,
        ipfs_cid: ipfsCid,
        user_name: finalName,
        profession: bcProfession.trim(),
        phone_hash: finalPhone ? simpleHash(finalPhone) : '',
        event_type: onChainUser?.exists ? 'ProfileUpdated' : 'UserRegistered',
        on_chain_timestamp: Math.floor(Date.now() / 1000)
      });
      if (dbError) console.warn('Failed to save to Supabase:', dbError);

      toast({
        title: onChainUser?.exists ? '✅ Profile Updated!' : '✅ Blockchain Profile Created!',
        description: `TX: ${txHash.slice(0, 14)}... | IPFS: ${ipfsCid.slice(0, 12)}...`
      });

      // Refresh on-chain profile
      await refreshOnChainProfile();
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({ title: 'Registration Failed', description: error?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  if (!isUserRegistryV2Deployed()) return null;

  // Not connected
  if (!walletAddress) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-card/50">
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-primary" />
          Blockchain Registration
        </h4>
        <p className="text-xs text-muted-foreground mb-3">
          Register your profile on the blockchain for verifiable credentials.
        </p>
        <Button variant="hero" size="sm" className="w-full" onClick={connectMetaMask} disabled={isConnecting}>
          {isConnecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</> : <><Wallet className="w-4 h-4 mr-2" /> Connect MetaMask</>}
        </Button>
      </div>
    );
  }

  // Loading
  if (loadingOnChain) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-card/50 flex items-center justify-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Fetching blockchain profile...</span>
      </div>
    );
  }

  // Connected but not registered
  if (!onChainUser?.exists) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Complete Blockchain Registration</h3>
            <p className="text-xs text-muted-foreground">
              Wallet <code className="text-primary">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</code> — register your profile on-chain
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={disconnect} className="ml-auto"><X className="w-3 h-3" /></Button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5 mb-3">
          <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Full Name</Label><Input value={bcName} onChange={e => setBcName(e.target.value)} placeholder={userProfile?.full_name} className="bg-background/50 text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Phone</Label><Input value={bcPhone} onChange={e => setBcPhone(e.target.value)} placeholder={userProfile?.phone || 'Optional'} className="bg-background/50 text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Profession *</Label><Input value={bcProfession} onChange={e => setBcProfession(e.target.value)} placeholder="e.g. Developer" className="bg-background/50 text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Work / About</Label><Input value={bcWork} onChange={e => setBcWork(e.target.value)} placeholder="e.g. Full-stack dev" className="bg-background/50 text-sm h-8" /></div>
          <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Age (18+) *</Label><Input type="number" min="18" max="120" value={bcAge} onChange={e => setBcAge(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 28" className="bg-background/50 text-sm h-8" /></div>
        </div>

        <Button variant="hero" size="sm" className="w-full" onClick={handleRegisterOrUpdate} disabled={registering || !bcProfession.trim() || !bcAge}>
          {registering ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Registering...</> : <><Link2 className="w-3 h-3 mr-1.5" /> Register on Blockchain</>}
        </Button>
      </div>
    );
  }

  // Registered profile – display and update form
  const ipfsData = onChainUser.fullIpfsData;
  return (
    <div className="mb-8 p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-card to-primary/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Your Blockchain Profile</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refreshOnChainProfile} className="h-7 px-2"><RefreshCw className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" onClick={disconnect} className="h-7 px-2 text-destructive"><X className="w-3 h-3" /></Button>
            <a href={`https://gateway.pinata.cloud/ipfs/${onChainUser.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> IPFS</a>
            <a href={`${SEPOLIA_EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Etherscan</a>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mb-4">
          <div className="p-3 rounded-xl bg-card/60 border border-border"><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><User className="w-3 h-3" /> Name</span><p className="font-medium text-sm">{ipfsData?.name || bcName || userProfile?.full_name}</p></div>
          <div className="p-3 rounded-xl bg-card/60 border border-border"><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Shield className="w-3 h-3" /> Profession</span><p className="font-medium text-sm">{ipfsData?.profession || bcProfession || 'Not set'}</p></div>
          <div className="p-3 rounded-xl bg-card/60 border border-border"><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1">Age</span><p className="font-medium text-sm">{ipfsData?.age || bcAge || 'N/A'}</p></div>
          <div className="p-3 rounded-xl bg-card/60 border border-border"><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Registered</span><p className="font-medium text-sm">{new Date(onChainUser.updatedAt * 1000).toLocaleDateString()}</p></div>
          <div className="p-3 rounded-xl bg-card/60 border border-border"><span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1 mb-1"><Wallet className="w-3 h-3" /> Wallet</span><div className="flex items-center gap-1"><code className="font-mono text-xs truncate">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</code><button onClick={() => copyToClipboard(walletAddress)} className="text-muted-foreground hover:text-primary shrink-0"><Copy className="w-3 h-3" /></button></div></div>
        </div>

        <div className="p-3 rounded-xl bg-card/60 border border-border mb-4">
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1 mb-1"><Link2 className="w-3 h-3" /> IPFS CID</span>
          <div className="flex items-center gap-2"><code className="font-mono text-xs break-all flex-1">{onChainUser.ipfsCid}</code><button onClick={() => copyToClipboard(onChainUser.ipfsCid)} className="text-muted-foreground hover:text-primary shrink-0"><Copy className="w-3 h-3" /></button></div>
        </div>

        {/* Update Section */}
        <div className="border-t border-border/30 pt-4">
          <h4 className="text-sm font-semibold mb-3">Update Profile On-Chain</h4>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mb-3">
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Name</Label><Input value={bcName} onChange={e => setBcName(e.target.value)} placeholder={ipfsData?.name} className="bg-background/50 text-sm h-8" /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Phone</Label><Input value={bcPhone} onChange={e => setBcPhone(e.target.value)} placeholder={ipfsData?.phone} className="bg-background/50 text-sm h-8" /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Profession</Label><Input value={bcProfession} onChange={e => setBcProfession(e.target.value)} placeholder={ipfsData?.profession} className="bg-background/50 text-sm h-8" /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Work/About</Label><Input value={bcWork} onChange={e => setBcWork(e.target.value)} placeholder={ipfsData?.work} className="bg-background/50 text-sm h-8" /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Age</Label><Input type="number" min="18" max="120" value={bcAge} onChange={e => setBcAge(e.target.value ? Number(e.target.value) : '')} placeholder={ipfsData?.age?.toString()} className="bg-background/50 text-sm h-8" /></div>
          </div>
          <Button variant="hero" className="w-full" onClick={handleRegisterOrUpdate} disabled={registering || !bcProfession.trim() || !bcAge}>
            {registering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</> : <><Save className="w-4 h-4 mr-2" /> Update Blockchain Profile</>}
          </Button>
        </div>
      </div>
    </div>
  );
               }
