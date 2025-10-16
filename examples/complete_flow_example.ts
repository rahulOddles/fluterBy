import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";

/**
 * Complete Flow Example: Lock Funds and Redeem Rewards
 * 
 * Flow:
 * 1. Minter locks reward tokens (e.g., USDC) in escrow for a main token (e.g., FLBY)
 * 2. Users hold the main token (FLBY)
 * 3. Users burn their main tokens to redeem proportional rewards (USDC)
 * 4. Rewards are distributed from the 5 escrow wallets
 */

export async function completeFlowExample() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const minter = provider.wallet.publicKey;

  // Define tokens
  const mainToken = new anchor.PublicKey("FLBY_TokenMintPublicKey"); // Main token (users hold this)
  const rewardToken = new anchor.PublicKey("USDC_TokenMintPublicKey"); // Reward token (USDC)

  // Define 5 escrow wallets that will hold the reward tokens
  const escrowWallets = [
    new anchor.PublicKey("EscrowWallet1PublicKey"),
    new anchor.PublicKey("EscrowWallet2PublicKey"),
    new anchor.PublicKey("EscrowWallet3PublicKey"),
    new anchor.PublicKey("EscrowWallet4PublicKey"),
    new anchor.PublicKey("EscrowWallet5PublicKey"),
  ];

  console.log("=".repeat(70));
  console.log("STEP 1: LOCK FUNDS (Minter)");
  console.log("=".repeat(70));

  // Step 1: Minter locks reward tokens
  const tokenSupply = 1000000; // 1M FLBY tokens total supply
  const rewardValue = 1000000000; // 1 SOL worth of USDC as rewards (200M per wallet)
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

  try {
    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mainToken.toBuffer(), minter.toBuffer()],
      program.programId
    );

    console.log(`\n📦 Locking Rewards...`);
    console.log(`   Main Token (FLBY): ${mainToken.toString()}`);
    console.log(`   Reward Token (USDC): ${rewardToken.toString()}`);
    console.log(`   Total Reward Value: ${rewardValue} (${rewardValue / 5} per wallet)`);
    console.log(`   Token Supply: ${tokenSupply}`);
    console.log(`   Expires: ${new Date(expiry * 1000).toISOString()}`);

    const lockTx = await program.methods
      .lockFunds(
        mainToken,
        rewardToken,
        minter,
        new anchor.BN(rewardValue),
        new anchor.BN(tokenSupply),
        new anchor.BN(expiry)
      )
      .accounts({
        escrowLockAccount: escrowLockPDA,
        minter: minter,
        token: mainToken,
        rewardToken: rewardToken,
        escrowWallet1: escrowWallets[0],
        escrowWallet2: escrowWallets[1],
        escrowWallet3: escrowWallets[2],
        escrowWallet4: escrowWallets[3],
        escrowWallet5: escrowWallets[4],
        systemProgram: anchor.SystemProgram.programId,
      })
      .rpc();

    console.log(`\n✅ Rewards Locked! TX: ${lockTx}`);
    console.log(`   Escrow PDA: ${escrowLockPDA.toString()}`);

    // Fetch and display escrow data
    const escrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);
    console.log(`\n📊 Escrow Data:`);
    console.log(`   Main Token: ${escrowData.token.toString()}`);
    console.log(`   Reward Token: ${escrowData.rewardToken.toString()}`);
    console.log(`   Total Reward Value: ${escrowData.totalRewardValue.toString()}`);
    console.log(`   Remaining Reward Value: ${escrowData.remainingRewardValue.toString()}`);
    console.log(`   Token Supply: ${escrowData.totalTokenSupply.toString()}`);
    console.log(`   Reward per Wallet: ${escrowData.rewardPerWallet.toString()}`);
    console.log(`   Active: ${escrowData.isActive}`);

  } catch (error) {
    console.error(`❌ Error locking funds:`, error);
    return;
  }

  console.log("\n" + "=".repeat(70));
  console.log("STEP 2: USERS REDEEM REWARDS (Burn Tokens)");
  console.log("=".repeat(70));

  // Step 2: Users burn their tokens to redeem rewards
  const users = [
    {
      name: "Alice",
      wallet: new anchor.PublicKey("AliceWalletPublicKey"),
      burnAmount: 100000, // Burns 100k FLBY tokens (10% of supply)
      expectedReward: (100000 / tokenSupply) * rewardValue, // 10% of rewards = 100M
    },
    {
      name: "Bob",
      wallet: new anchor.PublicKey("BobWalletPublicKey"),
      burnAmount: 50000, // Burns 50k FLBY tokens (5% of supply)
      expectedReward: (50000 / tokenSupply) * rewardValue, // 5% of rewards = 50M
    },
  ];

  for (const user of users) {
    try {
      console.log(`\n🔥 ${user.name} burning tokens...`);
      console.log(`   Burn Amount: ${user.burnAmount} FLBY`);
      console.log(`   Expected Reward: ${user.expectedReward} USDC`);

      const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_lock"), mainToken.toBuffer(), minter.toBuffer()],
        program.programId
      );

      // User's token accounts
      const userTokenAccount = new anchor.PublicKey(`${user.name}TokenAccountPublicKey`);
      const userRewardAccount = new anchor.PublicKey(`${user.name}RewardAccountPublicKey`);

      const redeemTx = await program.methods
        .redeemRewards(new anchor.BN(user.burnAmount))
        .accounts({
          escrowLockAccount: escrowLockPDA,
          user: user.wallet,
          token: mainToken,
          tokenMint: mainToken,
          userTokenAccount: userTokenAccount,
          rewardToken: rewardToken,
          userRewardAccount: userRewardAccount,
          escrowWallet1: escrowWallets[0],
          escrowWallet2: escrowWallets[1],
          escrowWallet3: escrowWallets[2],
          escrowWallet4: escrowWallets[3],
          escrowWallet5: escrowWallets[4],
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.SystemProgram.programId,
        })
        .rpc();

      console.log(`   ✅ Rewards Redeemed! TX: ${redeemTx}`);

      // Fetch updated escrow data
      const escrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);
      console.log(`   Remaining Rewards: ${escrowData.remainingRewardValue.toString()}`);

    } catch (error) {
      console.error(`   ❌ Error redeeming for ${user.name}:`, error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));

  try {
    const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mainToken.toBuffer(), minter.toBuffer()],
      program.programId
    );

    const finalEscrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);
    
    const totalRedeemed = finalEscrowData.totalRewardValue.toNumber() - 
                          finalEscrowData.remainingRewardValue.toNumber();
    const percentageRedeemed = (totalRedeemed / finalEscrowData.totalRewardValue.toNumber()) * 100;

    console.log(`\n📊 Final Escrow State:`);
    console.log(`   Total Reward Value: ${finalEscrowData.totalRewardValue.toString()}`);
    console.log(`   Remaining Reward Value: ${finalEscrowData.remainingRewardValue.toString()}`);
    console.log(`   Total Redeemed: ${totalRedeemed}`);
    console.log(`   Percentage Redeemed: ${percentageRedeemed.toFixed(2)}%`);
    console.log(`   Active: ${finalEscrowData.isActive}`);
    console.log(`   Expires: ${new Date(finalEscrowData.expiresAt.toNumber() * 1000).toISOString()}`);

  } catch (error) {
    console.error(`❌ Error fetching final state:`, error);
  }
}

/**
 * Example: Calculate reward for burning tokens
 */
export function calculateReward(
  burnAmount: number,
  totalTokenSupply: number,
  remainingRewardValue: number
): number {
  return Math.floor((burnAmount / totalTokenSupply) * remainingRewardValue);
}

/**
 * Example: Check if escrow has expired
 */
export function isEscrowExpired(expiresAt: number): boolean {
  return Date.now() / 1000 >= expiresAt;
}

/**
 * Example usage with real numbers
 */
export async function realWorldExample() {
  console.log("\n" + "=".repeat(70));
  console.log("REAL WORLD EXAMPLE");
  console.log("=".repeat(70));

  // Scenario: Launch FLBY token with USDC rewards
  const scenario = {
    mainToken: "FLBY",
    rewardToken: "USDC",
    totalSupply: 1000000, // 1M FLBY tokens
    totalRewards: 10000, // 10,000 USDC
    rewardPerWallet: 2000, // 2,000 USDC per wallet
  };

  console.log(`\n📋 Scenario:`);
  console.log(`   Main Token: ${scenario.mainToken}`);
  console.log(`   Reward Token: ${scenario.rewardToken}`);
  console.log(`   Total Supply: ${scenario.totalSupply.toLocaleString()} ${scenario.mainToken}`);
  console.log(`   Total Rewards: ${scenario.totalRewards.toLocaleString()} ${scenario.rewardToken}`);
  console.log(`   Reward per Wallet: ${scenario.rewardPerWallet.toLocaleString()} ${scenario.rewardToken}`);

  // Example redemptions
  const redemptions = [
    { user: "Alice", burnAmount: 100000, percentage: 10 },
    { user: "Bob", burnAmount: 50000, percentage: 5 },
    { user: "Charlie", burnAmount: 250000, percentage: 25 },
  ];

  console.log(`\n💰 Redemption Examples:`);
  let remainingRewards = scenario.totalRewards;

  for (const redemption of redemptions) {
    const reward = calculateReward(
      redemption.burnAmount,
      scenario.totalSupply,
      remainingRewards
    );
    remainingRewards -= reward;

    console.log(`\n   ${redemption.user}:`);
    console.log(`     Burns: ${redemption.burnAmount.toLocaleString()} ${scenario.mainToken} (${redemption.percentage}%)`);
    console.log(`     Receives: ${reward.toLocaleString()} ${scenario.rewardToken}`);
    console.log(`     Remaining Rewards: ${remainingRewards.toLocaleString()} ${scenario.rewardToken}`);
  }
}

// Run the example
if (require.main === module) {
  completeFlowExample()
    .then(() => realWorldExample())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

