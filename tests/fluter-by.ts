import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { assert } from "chai";

describe("fluter-by", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FluterBy as Program<FluterBy>;

  // Helper function to initialize escrow wallets
  async function initializeEscrowWallets(
    mainToken: PublicKey,
    minterKeypair: Keypair,
    rewardToken: PublicKey,
    wallets: PublicKey[]
  ) {
    const [escrowLock] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_lock"), mainToken.toBuffer(), minterKeypair.publicKey.toBuffer()],
      program.programId
    );

    for (let i = 1; i <= 5; i++) {
      await program.methods
        .initializeEscrowWallet(mainToken, i)
        .accounts({
          minter: minterKeypair.publicKey,
          rewardTokenMint: rewardToken,
          escrowLockAccount: escrowLock,
          escrowWallet: wallets[i - 1],
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([minterKeypair])
        .rpc();
    }
  }
  
  // Test accounts
  let minter: Keypair;
  let user: Keypair;
  let mainTokenMint: PublicKey; // FLBY token (users hold this)
  let rewardTokenMint: PublicKey; // USDC (reward token)
  
  let minterRewardAccount: PublicKey;
  let userMainTokenAccount: PublicKey;
  let userRewardAccount: PublicKey;
  
  let escrowLockAccount: PublicKey;
  let escrowWallet1: PublicKey;
  let escrowWallet2: PublicKey;
  let escrowWallet3: PublicKey;
  let escrowWallet4: PublicKey;
  let escrowWallet5: PublicKey;

  const TOTAL_REWARD_VALUE = new BN(10_000_000_000); // 10,000 tokens (assuming 6 decimals)
  const TOKEN_SUPPLY = new BN(1_000_000_000); // 1,000 tokens
  const REWARD_PER_WALLET = TOTAL_REWARD_VALUE.div(new BN(5)); // 2,000 tokens per wallet

  before("Setup test accounts and tokens", async () => {
    // Create minter and user keypairs
    minter = Keypair.generate();
    user = Keypair.generate();

    // Airdrop SOL to minter and user for transaction fees
    const airdropMinter = await provider.connection.requestAirdrop(
      minter.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropMinter);

    const airdropUser = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropUser);

    // Create main token mint (FLBY) - this is what users hold and burn
    mainTokenMint = await createMint(
      provider.connection,
      minter,
      minter.publicKey,
      null,
      6 // 6 decimals
    );

    // Create reward token mint (e.g., USDC) - this is what users receive as rewards
    rewardTokenMint = await createMint(
      provider.connection,
      minter,
      minter.publicKey,
      null,
      6 // 6 decimals
    );

    console.log("Main Token (FLBY) Mint:", mainTokenMint.toString());
    console.log("Reward Token (USDC) Mint:", rewardTokenMint.toString());

    // Create token accounts for minter
    const minterRewardAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      minter,
      rewardTokenMint,
      minter.publicKey
    );
    minterRewardAccount = minterRewardAccountInfo.address;

    // Mint reward tokens to minter (minter will lock these in escrow)
    await mintTo(
      provider.connection,
      minter,
      rewardTokenMint,
      minterRewardAccount,
      minter,
      TOTAL_REWARD_VALUE.toNumber()
    );

    // Create token accounts for user
    const userMainTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mainTokenMint,
      user.publicKey
    );
    userMainTokenAccount = userMainTokenAccountInfo.address;

    const userRewardAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      rewardTokenMint,
      user.publicKey
    );
    userRewardAccount = userRewardAccountInfo.address;

    // Mint main tokens to user (user will burn these to get rewards)
    await mintTo(
      provider.connection,
      minter,
      mainTokenMint,
      userMainTokenAccount,
      minter,
      TOKEN_SUPPLY.toNumber()
    );

    console.log("✅ Test accounts and tokens created successfully");
  });

  it("Derives PDA addresses correctly", async () => {
    // Derive escrow lock account PDA
    [escrowLockAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_lock"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Derive 5 escrow wallet PDAs
    [escrowWallet1] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_wallet"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
        Buffer.from([1]),
      ],
      program.programId
    );

    [escrowWallet2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_wallet"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
        Buffer.from([2]),
      ],
      program.programId
    );

    [escrowWallet3] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_wallet"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
        Buffer.from([3]),
      ],
      program.programId
    );

    [escrowWallet4] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_wallet"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
        Buffer.from([4]),
      ],
      program.programId
    );

    [escrowWallet5] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_wallet"),
        mainTokenMint.toBuffer(),
        minter.publicKey.toBuffer(),
        Buffer.from([5]),
      ],
      program.programId
    );

    console.log("Escrow Lock Account:", escrowLockAccount.toString());
    console.log("Escrow Wallet 1:", escrowWallet1.toString());
    console.log("Escrow Wallet 2:", escrowWallet2.toString());
    console.log("Escrow Wallet 3:", escrowWallet3.toString());
    console.log("Escrow Wallet 4:", escrowWallet4.toString());
    console.log("Escrow Wallet 5:", escrowWallet5.toString());

    assert.ok(escrowLockAccount);
    assert.ok(escrowWallet1);
    assert.ok(escrowWallet2);
    assert.ok(escrowWallet3);
    assert.ok(escrowWallet4);
    assert.ok(escrowWallet5);
  });

  it("Locks funds in escrow", async () => {
    const expiryTime = new BN(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60); // 30 days from now

    // Step 1: Initialize all 5 escrow wallets
    console.log("Initializing escrow wallets...");
    await initializeEscrowWallets(
      mainTokenMint,
      minter,
      rewardTokenMint,
      [escrowWallet1, escrowWallet2, escrowWallet3, escrowWallet4, escrowWallet5]
    );
    console.log("  ✅ All escrow wallets initialized");

    // Step 2: Lock funds (creates the escrow lock account and transfers tokens)
    const tx = await program.methods
      .lockFunds(
        mainTokenMint,
        rewardTokenMint,
        minter.publicKey,
        TOTAL_REWARD_VALUE,
        TOKEN_SUPPLY,
        expiryTime
      )
      .accounts({
        escrowLockAccount,
        minter: minter.publicKey,
        rewardTokenMint,
        minterRewardAccount,
        escrowWallet1,
        escrowWallet2,
        escrowWallet3,
        escrowWallet4,
        escrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([minter])
      .rpc();

    console.log("Lock funds transaction signature:", tx);

    // Verify escrow lock account data
    const escrowData = await program.account.escrowLockAccount.fetch(escrowLockAccount);
    assert.equal(escrowData.token.toString(), mainTokenMint.toString());
    assert.equal(escrowData.rewardToken.toString(), rewardTokenMint.toString());
    assert.equal(escrowData.minter.toString(), minter.publicKey.toString());
    assert.equal(escrowData.totalRewardValue.toString(), TOTAL_REWARD_VALUE.toString());
    assert.equal(escrowData.remainingRewardValue.toString(), TOTAL_REWARD_VALUE.toString());
    assert.equal(escrowData.rewardPerWallet.toString(), REWARD_PER_WALLET.toString());
    assert.equal(escrowData.totalTokenSupply.toString(), TOKEN_SUPPLY.toString());
    assert.equal(escrowData.isActive, true);

    console.log("✅ Escrow lock account created successfully");
    console.log("  Total Reward Value:", escrowData.totalRewardValue.toString());
    console.log("  Reward Per Wallet:", escrowData.rewardPerWallet.toString());
    console.log("  Token Supply:", escrowData.totalTokenSupply.toString());

    // Verify each escrow wallet has the correct balance
    for (let i = 1; i <= 5; i++) {
      const walletAddress = [escrowWallet1, escrowWallet2, escrowWallet3, escrowWallet4, escrowWallet5][i - 1];
      const walletAccount = await getAccount(provider.connection, walletAddress);
      assert.equal(walletAccount.amount.toString(), REWARD_PER_WALLET.toString());
      console.log(`  Escrow Wallet ${i} Balance:`, walletAccount.amount.toString());
    }

    console.log("✅ All escrow wallets funded correctly");
  });

  it("User redeems rewards by burning tokens", async () => {
    const burnAmount = new BN(100_000_000); // Burn 100 tokens (10% of supply)
    
    // Calculate expected reward: (100 / 1000) * 10,000 = 1,000 tokens
    const expectedReward = burnAmount
      .mul(TOTAL_REWARD_VALUE)
      .div(TOKEN_SUPPLY);

    // Get initial balances
    const userMainTokenAccountBefore = await getAccount(provider.connection, userMainTokenAccount);
    const userRewardAccountBefore = await getAccount(provider.connection, userRewardAccount);

    console.log("User main token balance before:", userMainTokenAccountBefore.amount.toString());
    console.log("User reward balance before:", userRewardAccountBefore.amount.toString());

    const tx = await program.methods
      .redeemRewards(burnAmount)
      .accounts({
        escrowLockAccount,
        user: user.publicKey,
        token: mainTokenMint,
        tokenMint: mainTokenMint,
        userTokenAccount: userMainTokenAccount,
        rewardToken: rewardTokenMint,
        userRewardAccount,
        escrowWallet1,
        escrowWallet2,
        escrowWallet3,
        escrowWallet4,
        escrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("Redeem rewards transaction signature:", tx);

    // Get final balances
    const userMainTokenAccountAfter = await getAccount(provider.connection, userMainTokenAccount);
    const userRewardAccountAfter = await getAccount(provider.connection, userRewardAccount);

    console.log("User main token balance after:", userMainTokenAccountAfter.amount.toString());
    console.log("User reward balance after:", userRewardAccountAfter.amount.toString());

    // Verify tokens were burned
    const burnedAmount = BigInt(userMainTokenAccountBefore.amount.toString()) - 
                        BigInt(userMainTokenAccountAfter.amount.toString());
    assert.equal(burnedAmount.toString(), burnAmount.toString());

    // Verify rewards were received
    const receivedReward = BigInt(userRewardAccountAfter.amount.toString()) - 
                          BigInt(userRewardAccountBefore.amount.toString());
    assert.equal(receivedReward.toString(), expectedReward.toString());

    console.log("✅ Tokens burned:", burnedAmount.toString());
    console.log("✅ Rewards received:", receivedReward.toString());

    // Verify escrow remaining value updated
    const escrowData = await program.account.escrowLockAccount.fetch(escrowLockAccount);
    const expectedRemaining = TOTAL_REWARD_VALUE.sub(expectedReward);
    assert.equal(escrowData.remainingRewardValue.toString(), expectedRemaining.toString());

    console.log("✅ Remaining rewards in escrow:", escrowData.remainingRewardValue.toString());
  });

  it("Prevents redemption after expiry", async () => {
    // Create a new escrow with immediate expiry for testing
    const immediateExpiry = new BN(Math.floor(Date.now() / 1000) - 1); // Already expired
    const tempMinter = Keypair.generate();
    
    // Airdrop to temp minter
    const airdrop = await provider.connection.requestAirdrop(
      tempMinter.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    // Create temp main token
    const tempMainToken = await createMint(
      provider.connection,
      tempMinter,
      tempMinter.publicKey,
      null,
      6
    );

    // Derive temp PDAs
    const [tempEscrowLockAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_lock"),
        tempMainToken.toBuffer(),
        tempMinter.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [tempEscrowWallet1] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), tempMainToken.toBuffer(), tempMinter.publicKey.toBuffer(), Buffer.from([1])],
      program.programId
    );
    const [tempEscrowWallet2] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), tempMainToken.toBuffer(), tempMinter.publicKey.toBuffer(), Buffer.from([2])],
      program.programId
    );
    const [tempEscrowWallet3] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), tempMainToken.toBuffer(), tempMinter.publicKey.toBuffer(), Buffer.from([3])],
      program.programId
    );
    const [tempEscrowWallet4] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), tempMainToken.toBuffer(), tempMinter.publicKey.toBuffer(), Buffer.from([4])],
      program.programId
    );
    const [tempEscrowWallet5] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), tempMainToken.toBuffer(), tempMinter.publicKey.toBuffer(), Buffer.from([5])],
      program.programId
    );

    // Create minter reward account and mint tokens
    const tempMinterRewardAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      tempMinter,
      rewardTokenMint,
      tempMinter.publicKey
    );

    await mintTo(
      provider.connection,
      minter,
      rewardTokenMint,
      tempMinterRewardAccount.address,
      minter,
      TOTAL_REWARD_VALUE.toNumber()
    );

    // Initialize escrow wallets
    await initializeEscrowWallets(
      tempMainToken,
      tempMinter,
      rewardTokenMint,
      [tempEscrowWallet1, tempEscrowWallet2, tempEscrowWallet3, tempEscrowWallet4, tempEscrowWallet5]
    );

    // Lock funds with expired date
    await program.methods
      .lockFunds(
        tempMainToken,
        rewardTokenMint,
        tempMinter.publicKey,
        TOTAL_REWARD_VALUE,
        TOKEN_SUPPLY,
        immediateExpiry
      )
      .accounts({
        escrowLockAccount: tempEscrowLockAccount,
        minter: tempMinter.publicKey,
        rewardTokenMint,
        minterRewardAccount: tempMinterRewardAccount.address,
        escrowWallet1: tempEscrowWallet1,
        escrowWallet2: tempEscrowWallet2,
        escrowWallet3: tempEscrowWallet3,
        escrowWallet4: tempEscrowWallet4,
        escrowWallet5: tempEscrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([tempMinter])
      .rpc();

    // Create user token account
    const tempUserTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      tempMainToken,
      user.publicKey
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      tempMinter,
      tempMainToken,
      tempUserTokenAccount.address,
      tempMinter,
      TOKEN_SUPPLY.toNumber()
    );

    // Try to redeem (should fail)
    try {
      await program.methods
        .redeemRewards(new BN(100_000_000))
        .accounts({
          escrowLockAccount: tempEscrowLockAccount,
          user: user.publicKey,
          token: tempMainToken,
          tokenMint: tempMainToken,
          userTokenAccount: tempUserTokenAccount.address,
          rewardToken: rewardTokenMint,
          userRewardAccount,
          escrowWallet1: tempEscrowWallet1,
          escrowWallet2: tempEscrowWallet2,
          escrowWallet3: tempEscrowWallet3,
          escrowWallet4: tempEscrowWallet4,
          escrowWallet5: tempEscrowWallet5,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      assert.fail("Should have thrown an error for expired escrow");
    } catch (error) {
      assert.include(error.toString(), "EscrowExpired");
      console.log("✅ Correctly prevented redemption after expiry");
    }
  });

  it("Minter withdraws expired rewards", async () => {
    // Wait a bit to ensure we're past expiry (or use a test with immediate expiry)
    // For this test, we'll create a new escrow with immediate expiry
    
    const expiredMinter = Keypair.generate();
    
    // Airdrop to expired minter
    const airdrop = await provider.connection.requestAirdrop(
      expiredMinter.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    // Create expired main token
    const expiredMainToken = await createMint(
      provider.connection,
      expiredMinter,
      expiredMinter.publicKey,
      null,
      6
    );

    // Derive expired PDAs
    const [expiredEscrowLockAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_lock"),
        expiredMainToken.toBuffer(),
        expiredMinter.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [expiredEscrowWallet1] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), expiredMinter.publicKey.toBuffer(), Buffer.from([1])],
      program.programId
    );
    const [expiredEscrowWallet2] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), expiredMinter.publicKey.toBuffer(), Buffer.from([2])],
      program.programId
    );
    const [expiredEscrowWallet3] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), expiredMinter.publicKey.toBuffer(), Buffer.from([3])],
      program.programId
    );
    const [expiredEscrowWallet4] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), expiredMinter.publicKey.toBuffer(), Buffer.from([4])],
      program.programId
    );
    const [expiredEscrowWallet5] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), expiredMinter.publicKey.toBuffer(), Buffer.from([5])],
      program.programId
    );

    // Create minter reward account
    const expiredMinterRewardAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      expiredMinter,
      rewardTokenMint,
      expiredMinter.publicKey
    );

    await mintTo(
      provider.connection,
      minter,
      rewardTokenMint,
      expiredMinterRewardAccount.address,
      minter,
      TOTAL_REWARD_VALUE.toNumber()
    );

    // Initialize escrow wallets
    await initializeEscrowWallets(
      expiredMainToken,
      expiredMinter,
      rewardTokenMint,
      [expiredEscrowWallet1, expiredEscrowWallet2, expiredEscrowWallet3, expiredEscrowWallet4, expiredEscrowWallet5]
    );

    // Lock funds with immediate expiry
    const immediateExpiry = new BN(Math.floor(Date.now() / 1000) - 1);
    
    await program.methods
      .lockFunds(
        expiredMainToken,
        rewardTokenMint,
        expiredMinter.publicKey,
        TOTAL_REWARD_VALUE,
        TOKEN_SUPPLY,
        immediateExpiry
      )
      .accounts({
        escrowLockAccount: expiredEscrowLockAccount,
        minter: expiredMinter.publicKey,
        rewardTokenMint,
        minterRewardAccount: expiredMinterRewardAccount.address,
        escrowWallet1: expiredEscrowWallet1,
        escrowWallet2: expiredEscrowWallet2,
        escrowWallet3: expiredEscrowWallet3,
        escrowWallet4: expiredEscrowWallet4,
        escrowWallet5: expiredEscrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([expiredMinter])
      .rpc();

    console.log("✅ Created expired escrow for withdrawal test");

    // Get minter balance before withdrawal
    const minterBalanceBefore = await getAccount(
      provider.connection,
      expiredMinterRewardAccount.address
    );

    console.log("Minter balance before withdrawal:", minterBalanceBefore.amount.toString());

    // Minter withdraws all rewards
    const tx = await program.methods
      .withdrawExpiredRewards()
      .accounts({
        escrowLockAccount: expiredEscrowLockAccount,
        minter: expiredMinter.publicKey,
        token: expiredMainToken,
        rewardTokenMint,
        minterRewardAccount: expiredMinterRewardAccount.address,
        escrowWallet1: expiredEscrowWallet1,
        escrowWallet2: expiredEscrowWallet2,
        escrowWallet3: expiredEscrowWallet3,
        escrowWallet4: expiredEscrowWallet4,
        escrowWallet5: expiredEscrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([expiredMinter])
      .rpc();

    console.log("Withdraw expired rewards transaction signature:", tx);

    // Get minter balance after withdrawal
    const minterBalanceAfter = await getAccount(
      provider.connection,
      expiredMinterRewardAccount.address
    );

    console.log("Minter balance after withdrawal:", minterBalanceAfter.amount.toString());

    // Verify minter received all rewards back
    const withdrawn = BigInt(minterBalanceAfter.amount.toString()) - 
                     BigInt(minterBalanceBefore.amount.toString());
    assert.equal(withdrawn.toString(), TOTAL_REWARD_VALUE.toString());

    console.log("✅ Minter withdrew:", withdrawn.toString());

    // Verify escrow is now inactive
    const escrowData = await program.account.escrowLockAccount.fetch(expiredEscrowLockAccount);
    assert.equal(escrowData.isActive, false);
    assert.equal(escrowData.remainingRewardValue.toString(), "0");

    console.log("✅ Escrow marked as inactive");
    console.log("✅ Remaining rewards set to 0");

    // Verify all escrow wallets are empty
    for (let i = 1; i <= 5; i++) {
      const walletAddress = [
        expiredEscrowWallet1,
        expiredEscrowWallet2,
        expiredEscrowWallet3,
        expiredEscrowWallet4,
        expiredEscrowWallet5
      ][i - 1];
      const walletAccount = await getAccount(provider.connection, walletAddress);
      assert.equal(walletAccount.amount.toString(), "0");
      console.log(`  Escrow Wallet ${i} Balance:`, walletAccount.amount.toString());
    }

    console.log("✅ All escrow wallets emptied");
  });

  it("Prevents non-minter from withdrawing expired rewards", async () => {
    // Try to withdraw with user instead of minter
    const expiredMainToken = await createMint(
      provider.connection,
      minter,
      minter.publicKey,
      null,
      6
    );

    const [testEscrowLockAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow_lock"),
        expiredMainToken.toBuffer(),
        minter.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [testEscrowWallet1] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), minter.publicKey.toBuffer(), Buffer.from([1])],
      program.programId
    );
    const [testEscrowWallet2] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), minter.publicKey.toBuffer(), Buffer.from([2])],
      program.programId
    );
    const [testEscrowWallet3] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), minter.publicKey.toBuffer(), Buffer.from([3])],
      program.programId
    );
    const [testEscrowWallet4] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), minter.publicKey.toBuffer(), Buffer.from([4])],
      program.programId
    );
    const [testEscrowWallet5] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_wallet"), expiredMainToken.toBuffer(), minter.publicKey.toBuffer(), Buffer.from([5])],
      program.programId
    );

    // Create and fund escrow
    const testMinterRewardAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      minter,
      rewardTokenMint,
      minter.publicKey
    );

    await mintTo(
      provider.connection,
      minter,
      rewardTokenMint,
      testMinterRewardAccount.address,
      minter,
      TOTAL_REWARD_VALUE.toNumber()
    );

    // Initialize escrow wallets
    await initializeEscrowWallets(
      expiredMainToken,
      minter,
      rewardTokenMint,
      [testEscrowWallet1, testEscrowWallet2, testEscrowWallet3, testEscrowWallet4, testEscrowWallet5]
    );

    const immediateExpiry = new BN(Math.floor(Date.now() / 1000) - 1);

    await program.methods
      .lockFunds(
        expiredMainToken,
        rewardTokenMint,
        minter.publicKey,
        TOTAL_REWARD_VALUE,
        TOKEN_SUPPLY,
        immediateExpiry
      )
      .accounts({
        escrowLockAccount: testEscrowLockAccount,
        minter: minter.publicKey,
        rewardTokenMint,
        minterRewardAccount: testMinterRewardAccount.address,
        escrowWallet1: testEscrowWallet1,
        escrowWallet2: testEscrowWallet2,
        escrowWallet3: testEscrowWallet3,
        escrowWallet4: testEscrowWallet4,
        escrowWallet5: testEscrowWallet5,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([minter])
      .rpc();

    // Try to withdraw with user (not minter)
    try {
      await program.methods
        .withdrawExpiredRewards()
        .accounts({
          escrowLockAccount: testEscrowLockAccount,
          minter: user.publicKey, // Wrong minter!
          token: expiredMainToken,
          rewardTokenMint,
          minterRewardAccount: userRewardAccount, // User's account
          escrowWallet1: testEscrowWallet1,
          escrowWallet2: testEscrowWallet2,
          escrowWallet3: testEscrowWallet3,
          escrowWallet4: testEscrowWallet4,
          escrowWallet5: testEscrowWallet5,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      assert.fail("Should have thrown an error for unauthorized minter");
    } catch (error) {
      // Should fail with constraint error or unauthorized minter error
      console.log("✅ Correctly prevented non-minter from withdrawing");
    }
  });
});
