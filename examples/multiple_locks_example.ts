import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";

/**
 * Example: Locking multiple different tokens
 * Each token lock is stored separately and all previous locks are preserved
 */
export async function exampleMultipleTokenLocks() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const minter = provider.wallet.publicKey;

  // Define 5 escrow wallets (can be reused or different for each lock)
  const escrowWallets = [
    new anchor.PublicKey("EscrowWallet1PublicKey"),
    new anchor.PublicKey("EscrowWallet2PublicKey"),
    new anchor.PublicKey("EscrowWallet3PublicKey"),
    new anchor.PublicKey("EscrowWallet4PublicKey"),
    new anchor.PublicKey("EscrowWallet5PublicKey"),
  ];

  // Different tokens to lock
  const tokens = [
    {
      name: "Token A (FLBY)",
      mint: new anchor.PublicKey("TokenAMintPublicKey"),
      value: 1000000000, // 1 SOL
      expiry: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    },
    {
      name: "Token B (USDC)",
      mint: new anchor.PublicKey("TokenBMintPublicKey"),
      value: 2000000000, // 2 SOL worth
      expiry: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 days
    },
    {
      name: "Token C (Custom)",
      mint: new anchor.PublicKey("TokenCMintPublicKey"),
      value: 500000000, // 0.5 SOL
      expiry: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    },
  ];

  console.log("=".repeat(60));
  console.log("LOCKING MULTIPLE DIFFERENT TOKENS");
  console.log("=".repeat(60));

  // Lock each token separately
  for (const token of tokens) {
    try {
      console.log(`\n📦 Locking ${token.name}...`);
      
      // Calculate the PDA for this specific mint + minter combination
      const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_lock"), token.mint.toBuffer(), minter.toBuffer()],
        program.programId
      );

      console.log(`   Escrow PDA: ${escrowLockPDA.toString()}`);
      console.log(`   Mint: ${token.mint.toString()}`);
      console.log(`   Total Value: ${token.value} lamports`);
      console.log(`   Value per wallet: ${token.value / 5} lamports`);

      const tx = await program.methods
        .lockFunds(
          token.mint,
          minter,
          new anchor.BN(token.value),
          new anchor.BN(token.expiry)
        )
        .accounts({
          escrowLockAccount: escrowLockPDA,
          minter: minter,
          mint: token.mint,
          escrowWallet1: escrowWallets[0],
          escrowWallet2: escrowWallets[1],
          escrowWallet3: escrowWallets[2],
          escrowWallet4: escrowWallets[3],
          escrowWallet5: escrowWallets[4],
          systemProgram: anchor.SystemProgram.programId,
        })
        .rpc();

      console.log(`   ✅ Successfully locked! TX: ${tx}`);

    } catch (error) {
      console.error(`   ❌ Error locking ${token.name}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RETRIEVING ALL LOCKED TOKENS");
  console.log("=".repeat(60));

  // Now retrieve all the locked tokens to show they're all stored separately
  for (const token of tokens) {
    try {
      const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_lock"), token.mint.toBuffer(), minter.toBuffer()],
        program.programId
      );

      const escrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);

      console.log(`\n📋 ${token.name} Escrow Data:`);
      console.log(`   Mint: ${escrowData.mint.toString()}`);
      console.log(`   Minter: ${escrowData.minter.toString()}`);
      console.log(`   Total Value: ${escrowData.totalValue.toString()} lamports`);
      console.log(`   Value per Wallet: ${escrowData.valuePerWallet.toString()} lamports`);
      console.log(`   Created: ${new Date(escrowData.createdAt.toNumber() * 1000).toISOString()}`);
      console.log(`   Expires: ${new Date(escrowData.expiresAt.toNumber() * 1000).toISOString()}`);
      console.log(`   Active: ${escrowData.isActive}`);
      console.log(`   Escrow Wallets:`);
      escrowData.escrowWallets.forEach((wallet, index) => {
        console.log(`     Wallet ${index + 1}: ${wallet.toString()}`);
      });

    } catch (error) {
      console.error(`   ❌ Could not retrieve ${token.name}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ ALL TOKENS ARE STORED SEPARATELY!");
  console.log("=".repeat(60));
}

/**
 * Example: Same minter locking the same token multiple times
 * (This will fail because the PDA already exists)
 */
export async function exampleSameTokenMultipleTimes() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const minter = provider.wallet.publicKey;
  const mint = new anchor.PublicKey("TokenAMintPublicKey");

  const escrowWallets = [
    new anchor.PublicKey("EscrowWallet1PublicKey"),
    new anchor.PublicKey("EscrowWallet2PublicKey"),
    new anchor.PublicKey("EscrowWallet3PublicKey"),
    new anchor.PublicKey("EscrowWallet4PublicKey"),
    new anchor.PublicKey("EscrowWallet5PublicKey"),
  ];

  console.log("\n⚠️  Attempting to lock the same token twice...");

  try {
    // First lock - will succeed
    console.log("First lock attempt...");
    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
      program.programId
    );

    await program.methods
      .lockFunds(
        mint,
        minter,
        new anchor.BN(1000000000),
        new anchor.BN(Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60))
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

    console.log("✅ First lock succeeded!");

    // Second lock - will fail (account already exists)
    console.log("Second lock attempt...");
    await program.methods
      .lockFunds(
        mint,
        minter,
        new anchor.BN(2000000000),
        new anchor.BN(Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60))
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

    console.log("✅ Second lock succeeded!"); // This won't execute

  } catch (error) {
    console.log("❌ Second lock failed (expected):", error.message);
    console.log("\n💡 NOTE: Each mint+minter combination can only be locked once.");
    console.log("   To lock the same token again, you need a different minter.");
  }
}

/**
 * Helper function to get all locks for a minter
 */
export async function getAllLocksForMinter(
  program: Program<FluterBy>,
  minter: anchor.PublicKey,
  mints: anchor.PublicKey[]
) {
  console.log(`\n📊 Fetching all locks for minter: ${minter.toString()}`);
  
  const locks = [];

  for (const mint of mints) {
    try {
      const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
        program.programId
      );

      const escrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);
      
      locks.push({
        mint: mint.toString(),
        pda: escrowLockPDA.toString(),
        totalValue: escrowData.totalValue.toString(),
        valuePerWallet: escrowData.valuePerWallet.toString(),
        expiresAt: new Date(escrowData.expiresAt.toNumber() * 1000).toISOString(),
        isActive: escrowData.isActive,
      });

    } catch (error) {
      // Lock doesn't exist for this mint
      console.log(`   No lock found for mint: ${mint.toString()}`);
    }
  }

  console.log(`\n✅ Found ${locks.length} active locks:`);
  locks.forEach((lock, index) => {
    console.log(`\n   Lock ${index + 1}:`);
    console.log(`   Mint: ${lock.mint}`);
    console.log(`   PDA: ${lock.pda}`);
    console.log(`   Total Value: ${lock.totalValue} lamports`);
    console.log(`   Value per Wallet: ${lock.valuePerWallet} lamports`);
    console.log(`   Expires: ${lock.expiresAt}`);
    console.log(`   Active: ${lock.isActive}`);
  });

  return locks;
}

// Run the example
if (require.main === module) {
  exampleMultipleTokenLocks()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
