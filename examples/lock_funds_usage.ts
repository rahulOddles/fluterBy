import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";

// Example usage of the lock_funds instruction
export class FluterByLockManager {
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
    value: number, // Total value to distribute (in lamports for SOL)
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
      [Buffer.from("escrow_lock"), mint.toBuffer()],
      this.program.programId
    );

    const tx = await this.program.methods
      .lockFunds(
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

    console.log("Funds locked successfully:", tx);
    console.log(`Total value: ${value} lamports`);
    console.log(`Value per wallet: ${value / 5} lamports`);
    console.log(`Expires at: ${new Date(expiry * 1000).toISOString()}`);
    
    return tx;
  }

  /**
   * Get escrow lock account data
   */
  async getEscrowLockAccount(mint: anchor.PublicKey) {
    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mint.toBuffer()],
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

  /**
   * Calculate value per wallet for a given total value
   */
  calculateValuePerWallet(totalValue: number): number {
    if (totalValue % 5 !== 0) {
      throw new Error("Total value must be divisible by 5");
    }
    return totalValue / 5;
  }
}

// Example usage
export async function exampleLockFunds() {
  // Initialize provider and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const lockManager = new FluterByLockManager(program, provider);

  // Example parameters
  const mint = new anchor.PublicKey("YourMintPublicKey");
  const minter = provider.wallet.publicKey;
  const totalValue = 1000000000; // 1 SOL in lamports (must be divisible by 5)
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now

  // 5 escrow wallets (these would be your actual wallet addresses)
  const escrowWallets = [
    new anchor.PublicKey("EscrowWallet1PublicKey"),
    new anchor.PublicKey("EscrowWallet2PublicKey"),
    new anchor.PublicKey("EscrowWallet3PublicKey"),
    new anchor.PublicKey("EscrowWallet4PublicKey"),
    new anchor.PublicKey("EscrowWallet5PublicKey"),
  ];

  try {
    // Lock funds
    const tx = await lockManager.lockFunds(
      mint,
      minter,
      totalValue,
      expiry,
      escrowWallets
    );

    console.log("Transaction successful:", tx);

    // Get escrow lock account data
    const escrowData = await lockManager.getEscrowLockAccount(mint);
    if (escrowData) {
      console.log("Escrow lock account data:", {
        mint: escrowData.mint.toString(),
        minter: escrowData.minter.toString(),
        totalValue: escrowData.totalValue.toString(),
        valuePerWallet: escrowData.valuePerWallet.toString(),
        expiresAt: new Date(escrowData.expiresAt.toNumber() * 1000).toISOString(),
        isActive: escrowData.isActive,
      });
    }

  } catch (error) {
    console.error("Error locking funds:", error);
  }
}

// Utility function to create 5 escrow wallets
export function createEscrowWallets(): anchor.Keypair[] {
  const wallets: anchor.Keypair[] = [];
  for (let i = 0; i < 5; i++) {
    wallets.push(anchor.web3.Keypair.generate());
  }
  return wallets;
}
