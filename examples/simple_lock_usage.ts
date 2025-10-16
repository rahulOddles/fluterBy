import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";

// Simple usage example for lock_funds instruction
export class SimpleLockManager {
  private program: Program<FluterBy>;
  private provider: anchor.AnchorProvider;

  constructor(program: Program<FluterBy>, provider: anchor.AnchorProvider) {
    this.program = program;
    this.provider = provider;
  }

  /**
   * Lock funds for a mint, distributing equally across 5 escrow wallets
   */
  async lockFunds(
    mint: anchor.PublicKey,
    minter: anchor.PublicKey,
    value: number, // Total value to lock (in lamports for SOL)
    expiry: number, // Unix timestamp for expiry
    escrowWallets: anchor.PublicKey[] // Array of 5 escrow wallet addresses
  ): Promise<string> {
    // Validate we have exactly 5 escrow wallets
    if (escrowWallets.length !== 5) {
      throw new Error("Must provide exactly 5 escrow wallets");
    }

    // Validate value is divisible by 5
    if (value % 5 !== 0) {
      throw new Error("Value must be divisible by 5 for equal distribution");
    }

    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .lockFunds(
        mint,
        minter,
        new anchor.BN(value),
        new anchor.BN(expiry)
      )
      .accounts({
        escrowLockAccount: escrowLockPDA,
        minter: minter,
        mint: mint,
        escrowWallet1: escrowWallets[0],
        escrowWallet2: escrowWallets[1],
        escrowWallet3: escrowWallets[2],
        escrowWallet4: escrowWallets[3],
        escrowWallet5: escrowWallets[4],
        systemProgram: anchor.SystemProgram.programId,
      })
      .rpc();

    const valuePerWallet = value / 5;
    console.log("Funds locked successfully:", tx);
    console.log(`Mint: ${mint.toString()}`);
    console.log(`Minter: ${minter.toString()}`);
    console.log(`Total Value: ${value} lamports`);
    console.log(`Value per wallet: ${valuePerWallet} lamports`);
    console.log(`Expires at: ${new Date(expiry * 1000).toISOString()}`);
    console.log(`Distribution across 5 wallets:`);
    escrowWallets.forEach((wallet, index) => {
      console.log(`  Wallet ${index + 1}: ${wallet.toString()} - ${valuePerWallet} lamports`);
    });
    
    return tx;
  }

  /**
   * Get escrow lock account data
   */
  async getEscrowLockAccount(mint: anchor.PublicKey, minter: anchor.PublicKey) {
    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
      this.program.programId
    );

    try {
      return await this.program.account.escrowLockAccount.fetch(escrowLockPDA);
    } catch (error) {
      console.log("Escrow lock account not found");
      return null;
    }
  }

  /**
   * Check if escrow has expired
   */
  isEscrowExpired(expiresAt: number): boolean {
    return Date.now() / 1000 >= expiresAt;
  }
}

// Example usage
export async function exampleSimpleLock() {
  // Initialize provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const lockManager = new SimpleLockManager(program, provider);

  // Example parameters
  const mint = new anchor.PublicKey("YourMintPublicKey");
  const minter = provider.wallet.publicKey;
  const value = 1000000000; // 1 SOL in lamports (must be divisible by 5)
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now

  // 5 escrow wallets that will receive equal amounts
  const escrowWallets = [
    new anchor.PublicKey("EscrowWallet1PublicKey"),
    new anchor.PublicKey("EscrowWallet2PublicKey"),
    new anchor.PublicKey("EscrowWallet3PublicKey"),
    new anchor.PublicKey("EscrowWallet4PublicKey"),
    new anchor.PublicKey("EscrowWallet5PublicKey"),
  ];

  try {
    // Lock funds - will distribute 200,000,000 lamports (0.2 SOL) to each wallet
    const tx = await lockManager.lockFunds(
      mint,
      minter,
      value,
      expiry,
      escrowWallets
    );

    console.log("Transaction successful:", tx);

    // Get escrow lock account data
    const escrowData = await lockManager.getEscrowLockAccount(mint, minter);
    if (escrowData) {
      console.log("\nEscrow lock account data:", {
        mint: escrowData.mint.toString(),
        minter: escrowData.minter.toString(),
        totalValue: escrowData.totalValue.toString(),
        valuePerWallet: escrowData.valuePerWallet.toString(),
        expiresAt: new Date(escrowData.expiresAt.toNumber() * 1000).toISOString(),
        createdAt: new Date(escrowData.createdAt.toNumber() * 1000).toISOString(),
        isActive: escrowData.isActive,
        escrowWallets: escrowData.escrowWallets.map(w => w.toString()),
      });
    }

  } catch (error) {
    console.error("Error locking funds:", error);
  }
}

// Example with different minters and expiry times
export async function exampleMultipleLocks() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const lockManager = new SimpleLockManager(program, provider);

  // Different tokens with different minters and expiry times
  const examples = [
    {
      mint: new anchor.PublicKey("TokenAPublicKey"),
      minter: provider.wallet.publicKey,
      value: 1000000000, // 1 SOL
      expireTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      name: "Token A - 30 days"
    },
    {
      mint: new anchor.PublicKey("TokenBPublicKey"),
      minter: new anchor.PublicKey("DifferentMinterPublicKey"),
      value: 2000000000, // 2 SOL
      expireTime: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 days
      name: "Token B - 60 days"
    },
    {
      mint: new anchor.PublicKey("TokenCPublicKey"),
      minter: new anchor.PublicKey("AnotherMinterPublicKey"),
      value: 500000000, // 0.5 SOL
      expireTime: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      name: "Token C - 7 days"
    }
  ];

  for (const example of examples) {
    try {
      console.log(`\nLocking funds for ${example.name}...`);
      const tx = await lockManager.lockFunds(
        example.mint,
        example.minter,
        example.value,
        example.expireTime
      );
      console.log(`✅ ${example.name} locked successfully:`, tx);
    } catch (error) {
      console.error(`❌ Error locking ${example.name}:`, error);
    }
  }
}
