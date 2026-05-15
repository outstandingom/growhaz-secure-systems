import { supabase } from '../integrations/supabase/client';

// A simple utility to hash data using SHA-256 via the Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export interface DocumentVerificationData {
  documentId: string;
  documentHash: string;
  ownerId: string;
  verifiedAt: string;
}

export class Block {
  public index: number;
  public timestamp: string;
  public data: DocumentVerificationData | string; // 'string' is used for the Genesis block
  public previousHash: string;
  public hash: string;
  public nonce: number;

  constructor(index: number, timestamp: string, data: DocumentVerificationData | string, previousHash: string = '', hash: string = '', nonce: number = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = hash;
    this.nonce = nonce;
  }

  // Calculate the hash of this block based on its contents
  async calculateHash(): Promise<string> {
    return await sha256(
      this.index.toString() + 
      this.previousHash + 
      this.timestamp + 
      JSON.stringify(this.data) + 
      this.nonce.toString()
    );
  }

  // Basic Proof-of-Work to mine the block (can be adjusted by difficulty)
  async mineBlock(difficulty: number): Promise<void> {
    const target = Array(difficulty + 1).join("0");
    this.hash = await this.calculateHash();
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = await this.calculateHash();
    }
  }
}

export class SupabaseBlockchain {
  public difficulty: number;

  constructor() {
    this.difficulty = 2; // Set low for quick browser demonstrations
  }

  // Fetch the entire chain from Supabase
  async getChain(): Promise<Block[]> {
    const { data, error } = await supabase
      .from('blockchain_blocks')
      .select('*')
      .order('block_index', { ascending: true });

    if (error) {
      console.error("Error fetching blockchain:", error);
      return [];
    }

    return data.map(row => new Block(
      row.block_index,
      row.timestamp,
      row.data as any,
      row.previous_hash,
      row.hash,
      row.nonce
    ));
  }

  // Get the latest block in the chain directly from Supabase
  async getLatestBlock(): Promise<Block | null> {
    const { data, error } = await supabase
      .from('blockchain_blocks')
      .select('*')
      .order('block_index', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Table is empty, Genesis block hasn't been created via SQL migration yet
        console.warn("No blocks found in Supabase. Please ensure the SQL migration was pushed.");
        return null;
      }
      console.error("Error fetching latest block:", error);
      return null;
    }

    return new Block(
      data.block_index,
      data.timestamp,
      data.data as any,
      data.previous_hash,
      data.hash,
      data.nonce
    );
  }

  // Add a new document block to the chain and save to Supabase
  async addDocumentBlock(data: DocumentVerificationData): Promise<Block> {
    const latestBlock = await this.getLatestBlock();
    
    if (!latestBlock) {
      throw new Error("Cannot add block: Genesis block not found in Supabase.");
    }

    const newIndex = latestBlock.index + 1;
    const newTimestamp = new Date().toISOString();

    const newBlock = new Block(
      newIndex,
      newTimestamp,
      data,
      latestBlock.hash
    );

    // Run the Proof-of-Work algorithm locally in the browser
    console.log(`Mining block ${newIndex}...`);
    await newBlock.mineBlock(this.difficulty);

    // Save the mined block to Supabase
    const { error } = await supabase
      .from('blockchain_blocks')
      .insert({
        block_index: newBlock.index,
        timestamp: newBlock.timestamp,
        data: newBlock.data,
        previous_hash: newBlock.previousHash,
        hash: newBlock.hash,
        nonce: newBlock.nonce
      });

    if (error) {
      console.error("Failed to save block to Supabase:", error);
      throw error;
    }

    console.log(`Block ${newIndex} successfully mined and saved to Supabase!`, newBlock);
    return newBlock;
  }

  // Verify the integrity of the entire blockchain fetched from Supabase
  async isChainValid(): Promise<boolean> {
    const chain = await this.getChain();
    
    if (chain.length === 0) return false;

    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];

      // Verify the current block's hash is mathematically valid
      const recalculatedHash = await currentBlock.calculateHash();
      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      // Verify the current block properly points to the previous block
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }
}

// Export a singleton instance for use across the application
export const documentBlockchain = new SupabaseBlockchain();
