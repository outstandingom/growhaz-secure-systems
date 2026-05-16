/**
 * blockchainIndexer.ts
 *
 * PURPOSE:
 *   Blockchain data cannot be "searched" — you can only call contract
 *   view functions if you already know the wallet/document ID.
 *   This module writes a Supabase-side index every time an on-chain
 *   transaction succeeds, so the rest of the app can do fast SQL
 *   queries by wallet_address, transaction_hash, or document_id.
 *
 * RULES:
 *   - Supabase is the INDEX only. The source-of-truth is the chain.
 *   - Never delete rows — they mirror immutable on-chain events.
 *   - All insert functions are "upsert on transaction_hash" so
 *     re-indexing is always safe/idempotent.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  USER_REGISTRY_ADDRESS,
  DOCUMENT_REGISTRY_ADDRESS,
  DOCUMENT_REGISTRY_V2_ADDRESS,
  DOCUMENT_ACCESS_CONTROL_ADDRESS,
  MERKLE_DOCUMENT_REGISTRY_ADDRESS,
} from '@/lib/contractConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UserRegistrationIndex {
  transaction_hash: string;
  block_hash: string;
  block_number: number;
  contract_address: string;
  wallet_address: string;
  ipfs_cid?: string;
  user_name?: string;
  profession?: string;
  phone_hash?: string;
  event_type: 'UserRegistered' | 'ProfileUpdated';
  on_chain_timestamp?: number;
}

export interface DocumentRegistryIndex {
  transaction_hash: string;
  block_hash: string;
  block_number: number;
  contract_address: string;
  wallet_address: string;
  document_id?: string;
  file_hash?: string;
  content_hash?: string;
  merkle_root?: string;
  ipfs_cid?: string;
  ipfs_metadata_cid?: string;
  ipfs_url?: string;
  document_name?: string;
  document_type?: string;
  issuer_name?: string;
  verified_document_id?: string;
  contract_version: 'v1' | 'v2';
  event_type: 'DocumentRegistered' | 'DocumentVerified';
  on_chain_timestamp?: number;
}

export interface AccessGrantIndex {
  transaction_hash: string;
  block_hash: string;
  block_number: number;
  contract_address: string;
  owner_wallet: string;
  viewer_wallet: string;
  document_id: string;
  expires_at?: number;
  is_active: boolean;
  event_type: 'AccessGranted' | 'AccessRevoked';
  on_chain_timestamp?: number;
}

export interface MerkleDocumentIndex {
  transaction_hash: string;
  block_hash: string;
  block_number: number;
  contract_address: string;
  wallet_address: string;
  merkle_root: string;
  file_hash?: string;
  content_hash?: string;
  total_chunks?: number;
  total_tokens?: number;
  ipfs_cid?: string;
  ipfs_metadata_cid?: string;
  ipfs_url?: string;
  document_name?: string;
  document_type?: string;
  issuer_name?: string;
  verified_document_id?: string;
  event_type: 'DocumentRegistered' | 'DocumentVerified';
  on_chain_timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE — Index functions (called right after tx.wait())
// ─────────────────────────────────────────────────────────────────────────────

/**
 * indexUserRegistration
 * Call this immediately after a successful registerUser() or updateProfile()
 * transaction. Pass the ethers TransactionReceipt and the args used.
 *
 * @example
 *   const receipt = await tx.wait();
 *   await indexUserRegistration({
 *     transaction_hash: receipt.hash,
 *     block_hash: receipt.blockHash,
 *     block_number: receipt.blockNumber,
 *     contract_address: USER_REGISTRY_ADDRESS,
 *     wallet_address: signerAddress,
 *     ipfs_cid,
 *     user_name: name,
 *     profession,
 *     phone_hash: phoneHash,
 *     event_type: 'UserRegistered',
 *   });
 */
export async function indexUserRegistration(data: UserRegistrationIndex): Promise<void> {
  const { error } = await supabase
    .from('blockchain_user_registrations')
    .upsert(
      {
        transaction_hash:   data.transaction_hash,
        block_hash:         data.block_hash,
        block_number:       data.block_number,
        contract_address:   data.contract_address ?? USER_REGISTRY_ADDRESS,
        wallet_address:     data.wallet_address.toLowerCase(),
        ipfs_cid:           data.ipfs_cid,
        user_name:          data.user_name,
        profession:         data.profession,
        phone_hash:         data.phone_hash,
        event_type:         data.event_type,
        on_chain_timestamp: data.on_chain_timestamp,
      },
      { onConflict: 'transaction_hash' }
    );

  if (error) {
    console.error('[blockchainIndexer] Failed to index user registration:', error);
  } else {
    console.log('[blockchainIndexer] ✓ User registration indexed:', data.transaction_hash);
  }
}

/**
 * indexDocumentRegistration
 * Call this after registerDocument() (V2) or verifyDocument() (V1) succeeds.
 */
export async function indexDocumentRegistration(data: DocumentRegistryIndex): Promise<void> {
  const { error } = await supabase
    .from('blockchain_document_registry')
    .upsert(
      {
        transaction_hash:     data.transaction_hash,
        block_hash:           data.block_hash,
        block_number:         data.block_number,
        contract_address:     data.contract_address ?? DOCUMENT_REGISTRY_V2_ADDRESS,
        wallet_address:       data.wallet_address.toLowerCase(),
        document_id:          data.document_id,
        file_hash:            data.file_hash,
        content_hash:         data.content_hash,
        merkle_root:          data.merkle_root,
        ipfs_cid:             data.ipfs_cid,
        ipfs_metadata_cid:    data.ipfs_metadata_cid,
        ipfs_url:             data.ipfs_url,
        document_name:        data.document_name,
        document_type:        data.document_type,
        issuer_name:          data.issuer_name,
        verified_document_id: data.verified_document_id,
        contract_version:     data.contract_version,
        event_type:           data.event_type,
        on_chain_timestamp:   data.on_chain_timestamp,
      },
      { onConflict: 'transaction_hash' }
    );

  if (error) {
    console.error('[blockchainIndexer] Failed to index document registration:', error);
  } else {
    console.log('[blockchainIndexer] ✓ Document registration indexed:', data.transaction_hash);
  }
}

/**
 * indexAccessGrant
 * Call this after grantAccess() or revokeAccess() succeeds.
 */
export async function indexAccessGrant(data: AccessGrantIndex): Promise<void> {
  const { error } = await supabase
    .from('blockchain_access_grants')
    .upsert(
      {
        transaction_hash:   data.transaction_hash,
        block_hash:         data.block_hash,
        block_number:       data.block_number,
        contract_address:   data.contract_address ?? DOCUMENT_ACCESS_CONTROL_ADDRESS,
        owner_wallet:       data.owner_wallet.toLowerCase(),
        viewer_wallet:      data.viewer_wallet.toLowerCase(),
        document_id:        data.document_id,
        expires_at:         data.expires_at,
        is_active:          data.is_active,
        event_type:         data.event_type,
        on_chain_timestamp: data.on_chain_timestamp,
      },
      { onConflict: 'transaction_hash' }
    );

  if (error) {
    console.error('[blockchainIndexer] Failed to index access grant:', error);
  } else {
    console.log('[blockchainIndexer] ✓ Access grant indexed:', data.transaction_hash);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ — Query functions (fast SQL lookups instead of chain scans)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getUserRegistrationByWallet
 * Fetch the latest indexed registration record for a wallet address.
 * Use this to quickly verify if a user is registered without calling the contract.
 */
export async function getUserRegistrationByWallet(
  walletAddress: string
): Promise<UserRegistrationIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_user_registrations')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getUserRegistrationByWallet error:', error);
    return null;
  }
  return data as UserRegistrationIndex | null;
}

/**
 * getUserRegistrationByTxHash
 * Look up a specific registration event by its transaction hash.
 */
export async function getUserRegistrationByTxHash(
  txHash: string
): Promise<UserRegistrationIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_user_registrations')
    .select('*')
    .eq('transaction_hash', txHash)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getUserRegistrationByTxHash error:', error);
    return null;
  }
  return data as UserRegistrationIndex | null;
}

/**
 * getDocumentsByWallet
 * Fetch all documents registered/verified by a given wallet.
 * Replaces a slow chain loop — O(1) SQL index query.
 */
export async function getDocumentsByWallet(
  walletAddress: string
): Promise<DocumentRegistryIndex[]> {
  const { data, error } = await supabase
    .from('blockchain_document_registry')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('block_number', { ascending: false });

  if (error) {
    console.error('[blockchainIndexer] getDocumentsByWallet error:', error);
    return [];
  }
  return (data ?? []) as DocumentRegistryIndex[];
}

/**
 * getDocumentByTxHash
 * Look up a specific document registration event by its transaction hash.
 */
export async function getDocumentByTxHash(
  txHash: string
): Promise<DocumentRegistryIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_document_registry')
    .select('*')
    .eq('transaction_hash', txHash)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getDocumentByTxHash error:', error);
    return null;
  }
  return data as DocumentRegistryIndex | null;
}

/**
 * getDocumentByFileHash
 * Look up a document by its SHA-256 file hash (for verification flow).
 */
export async function getDocumentByFileHash(
  fileHash: string
): Promise<DocumentRegistryIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_document_registry')
    .select('*')
    .eq('file_hash', fileHash)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getDocumentByFileHash error:', error);
    return null;
  }
  return data as DocumentRegistryIndex | null;
}

/**
 * getDocumentByIpfsCid
 * Look up a document by its IPFS content CID.
 */
export async function getDocumentByIpfsCid(
  cid: string
): Promise<DocumentRegistryIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_document_registry')
    .select('*')
    .eq('ipfs_cid', cid)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getDocumentByIpfsCid error:', error);
    return null;
  }
  return data as DocumentRegistryIndex | null;
}

/**
 * getAccessGrantsByDocument
 * Fetch all access grants for a specific document (both active and revoked).
 */
export async function getAccessGrantsByDocument(
  documentId: string
): Promise<AccessGrantIndex[]> {
  const { data, error } = await supabase
    .from('blockchain_access_grants')
    .select('*')
    .eq('document_id', documentId)
    .order('block_number', { ascending: false });

  if (error) {
    console.error('[blockchainIndexer] getAccessGrantsByDocument error:', error);
    return [];
  }
  return (data ?? []) as AccessGrantIndex[];
}

/**
 * getActiveAccessGrantsByViewer
 * Fetch all documents a given wallet currently has access to.
 */
export async function getActiveAccessGrantsByViewer(
  viewerWallet: string
): Promise<AccessGrantIndex[]> {
  const { data, error } = await supabase
    .from('blockchain_access_grants')
    .select('*')
    .eq('viewer_wallet', viewerWallet.toLowerCase())
    .eq('is_active', true)
    .order('block_number', { ascending: false });

  if (error) {
    console.error('[blockchainIndexer] getActiveAccessGrantsByViewer error:', error);
    return [];
  }
  return (data ?? []) as AccessGrantIndex[];
}

/**
 * getAccessGrantByTxHash
 * Look up a specific access grant event by its transaction hash.
 */
export async function getAccessGrantByTxHash(
  txHash: string
): Promise<AccessGrantIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_access_grants')
    .select('*')
    .eq('transaction_hash', txHash)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getAccessGrantByTxHash error:', error);
    return null;
  }
  return data as AccessGrantIndex | null;
}

/**
 * markAccessRevoked
 * When a revokeAccess() tx is confirmed, flip is_active = false for the
 * matching grant rows (matched by document_id + viewer_wallet).
 * Also inserts a new row for the revocation event itself.
 */
export async function markAccessRevoked(
  documentId: string,
  viewerWallet: string,
  revocationData: AccessGrantIndex
): Promise<void> {
  // 1. Insert the revocation event
  await indexAccessGrant(revocationData);

  // 2. Mark all prior grants for this doc+viewer as inactive
  const { error } = await supabase
    .from('blockchain_access_grants')
    .update({ is_active: false })
    .eq('document_id', documentId)
    .eq('viewer_wallet', viewerWallet.toLowerCase())
    .eq('event_type', 'AccessGranted');

  if (error) {
    console.error('[blockchainIndexer] markAccessRevoked update error:', error);
  } else {
    console.log('[blockchainIndexer] ✓ Access revoked in index for', viewerWallet, '→ doc:', documentId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Extract receipt fields for indexing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * extractReceiptFields
 * Converts an ethers.js TransactionReceipt into the common fields
 * needed for any of the index* functions above.
 *
 * @example
 *   const receipt = await tx.wait();
 *   const base = extractReceiptFields(receipt);
 *   await indexUserRegistration({ ...base, wallet_address, ipfs_cid, ... });
 */
export function extractReceiptFields(receipt: {
  hash: string;
  blockHash: string;
  blockNumber: number;
}) {
  return {
    transaction_hash: receipt.hash,
    block_hash:       receipt.blockHash,
    block_number:     receipt.blockNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MERKLE DOCUMENT INDEX — Write & Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * indexMerkleDocument
 * Call this after a successful MerkleDocumentRegistry.registerDocument() tx.
 */
export async function indexMerkleDocument(data: MerkleDocumentIndex): Promise<void> {
  const { error } = await supabase
    .from('blockchain_merkle_documents')
    .upsert(
      {
        transaction_hash:     data.transaction_hash,
        block_hash:           data.block_hash,
        block_number:         data.block_number,
        contract_address:     data.contract_address ?? MERKLE_DOCUMENT_REGISTRY_ADDRESS,
        wallet_address:       data.wallet_address.toLowerCase(),
        merkle_root:          data.merkle_root,
        file_hash:            data.file_hash,
        content_hash:         data.content_hash,
        total_chunks:         data.total_chunks,
        total_tokens:         data.total_tokens,
        ipfs_cid:             data.ipfs_cid,
        ipfs_metadata_cid:    data.ipfs_metadata_cid,
        ipfs_url:             data.ipfs_url,
        document_name:        data.document_name,
        document_type:        data.document_type,
        issuer_name:          data.issuer_name,
        verified_document_id: data.verified_document_id,
        event_type:           data.event_type,
        on_chain_timestamp:   data.on_chain_timestamp,
      },
      { onConflict: 'transaction_hash' }
    );

  if (error) {
    console.error('[blockchainIndexer] Failed to index merkle document:', error);
  } else {
    console.log('[blockchainIndexer] ✓ Merkle document indexed:', data.merkle_root);
  }
}

/**
 * getMerkleDocumentByRoot
 * Fast Supabase lookup by merkle_root.
 */
export async function getMerkleDocumentByRoot(
  merkleRoot: string
): Promise<MerkleDocumentIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_merkle_documents')
    .select('*')
    .eq('merkle_root', merkleRoot)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getMerkleDocumentByRoot error:', error);
    return null;
  }
  return data as MerkleDocumentIndex | null;
}

/**
 * getMerkleDocumentByFileHash
 * Fast Supabase lookup by file_hash.
 */
export async function getMerkleDocumentByFileHash(
  fileHash: string
): Promise<MerkleDocumentIndex | null> {
  const { data, error } = await supabase
    .from('blockchain_merkle_documents')
    .select('*')
    .eq('file_hash', fileHash)
    .order('block_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[blockchainIndexer] getMerkleDocumentByFileHash error:', error);
    return null;
  }
  return data as MerkleDocumentIndex | null;
}

/**
 * getMerkleDocumentsByWallet
 * All merkle documents registered by a wallet.
 */
export async function getMerkleDocumentsByWallet(
  walletAddress: string
): Promise<MerkleDocumentIndex[]> {
  const { data, error } = await supabase
    .from('blockchain_merkle_documents')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('block_number', { ascending: false });

  if (error) {
    console.error('[blockchainIndexer] getMerkleDocumentsByWallet error:', error);
    return [];
  }
  return (data ?? []) as MerkleDocumentIndex[];
}
