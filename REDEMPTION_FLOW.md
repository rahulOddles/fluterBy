# 🔥 Token Redemption Flow - Burn FLBY, Get Rewards!

## Overview

The `redeem_rewards` instruction allows users who hold FLBY tokens to burn them and receive proportional USDC rewards **BEFORE the expiry date**. After expiry, redemption is no longer possible.

## 📊 Complete Redemption Flow

```
User has: 100,000 FLBY tokens
Escrow has: 10,000 USDC (locked in 5 wallets)
Total FLBY supply: 1,000,000 tokens

User wants to burn all their FLBY:

Step 1: Calculate Reward
reward = (100,000 / 1,000,000) × 10,000 = 1,000 USDC

Step 2: Burn FLBY Tokens
User's 100,000 FLBY tokens → BURNED 🔥

Step 3: Transfer Rewards from 5 Escrow Wallets
Escrow Wallet 1: Transfer 200 USDC → User
Escrow Wallet 2: Transfer 200 USDC → User
Escrow Wallet 3: Transfer 200 USDC → User
Escrow Wallet 4: Transfer 200 USDC → User
Escrow Wallet 5: Transfer 200 USDC → User

User receives: 1,000 USDC ✅
```

## 🔐 How It Works

### Validation Checks

```rust
✅ Escrow must be active
✅ Current time < Expiry time (NOT expired!)
✅ User has enough FLBY tokens to burn
✅ Burn amount > 0
✅ Enough rewards remaining in escrow
```

### Proportional Reward Calculation

```rust
reward_amount = (burn_amount / total_token_supply) × remaining_reward_value

Example:
- Burn: 100,000 FLBY
- Total supply: 1,000,000 FLBY
- Remaining rewards: 10,000 USDC
- Reward: (100,000 / 1,000,000) × 10,000 = 1,000 USDC
```

### Token Transfers

#### 1. Burn FLBY Tokens
```rust
// User's FLBY tokens are permanently burned
token::burn(cpi_ctx, burn_amount)?;
```

#### 2. Transfer Rewards from 5 Wallets
```rust
// Reward is split equally across 5 escrow wallets
// Each wallet transfers their share to the user

reward_per_wallet = reward_amount / 5

Wallet 1 → User: reward_per_wallet
Wallet 2 → User: reward_per_wallet
Wallet 3 → User: reward_per_wallet
Wallet 4 → User: reward_per_wallet
Wallet 5 → User: reward_per_wallet
```

## 💰 Real-World Examples

### Example 1: Small Redemption (1% of supply)

```
Initial State:
- User FLBY: 10,000 tokens
- Total Supply: 1,000,000 tokens
- Escrow Rewards: 10,000 USDC (2,000 per wallet)

User burns 10,000 FLBY (1% of supply):

Calculation:
reward = (10,000 / 1,000,000) × 10,000 = 100 USDC
per_wallet = 100 / 5 = 20 USDC

Transfers:
Wallet 1: 20 USDC → User
Wallet 2: 20 USDC → User
Wallet 3: 20 USDC → User
Wallet 4: 20 USDC → User
Wallet 5: 20 USDC → User

Result:
✅ User's FLBY: 0 (burned)
✅ User's USDC: +100
✅ Remaining escrow: 9,900 USDC
```

### Example 2: Large Redemption (25% of supply)

```
Initial State:
- User FLBY: 250,000 tokens
- Total Supply: 1,000,000 tokens
- Escrow Rewards: 10,000 USDC

User burns 250,000 FLBY (25% of supply):

Calculation:
reward = (250,000 / 1,000,000) × 10,000 = 2,500 USDC
per_wallet = 2,500 / 5 = 500 USDC

Transfers:
Wallet 1: 500 USDC → User
Wallet 2: 500 USDC → User
Wallet 3: 500 USDC → User
Wallet 4: 500 USDC → User
Wallet 5: 500 USDC → User

Result:
✅ User's FLBY: 0 (burned)
✅ User's USDC: +2,500
✅ Remaining escrow: 7,500 USDC
```

### Example 3: Multiple Users Redeeming

```
Initial State:
- Total Supply: 1,000,000 FLBY
- Escrow Rewards: 10,000 USDC

User Alice burns 100,000 FLBY (10%):
→ Receives: 1,000 USDC
→ Remaining: 9,000 USDC

User Bob burns 50,000 FLBY (5%):
→ Receives: (50,000 / 1,000,000) × 9,000 = 450 USDC
→ Remaining: 8,550 USDC

User Charlie burns 200,000 FLBY (20%):
→ Receives: (200,000 / 1,000,000) × 8,550 = 1,710 USDC
→ Remaining: 6,840 USDC

All users successfully redeemed their rewards! ✅
```

## ⏰ Expiry Check - CRITICAL!

### Before Expiry: ✅ Redemption Allowed

```
Current Time: Day 15
Expiry Time: Day 30

Status: ✅ ACTIVE - Users can redeem

if (current_time < expiry_time) {
    // Redemption allowed
    burn_tokens();
    transfer_rewards();
}
```

### After Expiry: ❌ Redemption Blocked

```
Current Time: Day 35
Expiry Time: Day 30

Status: ❌ EXPIRED - Redemption blocked

if (current_time >= expiry_time) {
    return Error: EscrowExpired
}
```

## 🎯 Complete TypeScript Example

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

async function redeemRewards() {
  const program = anchor.workspace.FluterBy as Program<FluterBy>;
  const user = provider.wallet.publicKey;

  // Get the escrow PDA
  const [escrowLockPDA] = anchor.PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow_lock"),
      mainToken.toBuffer(),
      minter.toBuffer()
    ],
    program.programId
  );

  // Check if escrow has expired
  const escrowData = await program.account.escrowLockAccount.fetch(escrowLockPDA);
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime >= escrowData.expiresAt.toNumber()) {
    throw new Error("❌ Escrow has expired! Cannot redeem anymore.");
  }

  console.log("✅ Escrow is active. Redemption allowed!");

  // User wants to burn 100,000 FLBY tokens
  const burnAmount = new anchor.BN(100000);

  // Calculate expected reward
  const expectedReward = burnAmount
    .mul(escrowData.remainingRewardValue)
    .div(escrowData.totalTokenSupply);
  
  console.log(`Burning: ${burnAmount.toString()} FLBY`);
  console.log(`Expected reward: ${expectedReward.toString()} USDC`);

  // Call redeem_rewards
  const tx = await program.methods
    .redeemRewards(burnAmount)
    .accounts({
      escrowLockAccount: escrowLockPDA,
      user: user,
      token: mainToken,
      tokenMint: mainToken,
      userTokenAccount: userFlbyAccount,
      rewardToken: usdcMint,
      userRewardAccount: userUsdcAccount,
      escrowWallet1: escrowWallet1UsdcAccount,
      escrowWallet2: escrowWallet2UsdcAccount,
      escrowWallet3: escrowWallet3UsdcAccount,
      escrowWallet4: escrowWallet4UsdcAccount,
      escrowWallet5: escrowWallet5UsdcAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Redemption successful!", tx);

  // Verify balances
  const newUserFlby = await connection.getTokenAccountBalance(userFlbyAccount);
  const newUserUsdc = await connection.getTokenAccountBalance(userUsdcAccount);
  
  console.log(`New FLBY balance: ${newUserFlby.value.amount}`);
  console.log(`New USDC balance: ${newUserUsdc.value.amount}`);
}
```

## 📋 Summary

| Action | What Happens |
|--------|-------------|
| **Before Expiry** | ✅ Users can burn FLBY and get USDC |
| **User Burns FLBY** | Tokens permanently destroyed 🔥 |
| **Reward Calculated** | Proportional to burned amount |
| **Rewards Transferred** | From 5 escrow wallets to user |
| **Escrow Updated** | Remaining rewards decreased |
| **After Expiry** | ❌ Redemption blocked |

## ⚠️ Important Notes

### 1. Expiry is Enforced
```rust
require!(
    clock.unix_timestamp < escrow_lock_account.expires_at,
    FluterByError::EscrowExpired
);
```

### 2. Proportional Distribution
- Early redeemers get the same rate as late redeemers
- Rate is based on total supply, not current supply
- Fair for all users! ✅

### 3. Multiple Redemptions Possible
- Users can redeem multiple times (if they have tokens)
- Each redemption is independent
- Total rewards decrease after each redemption

### 4. Atomic Operation
- Burn and reward transfer happen together
- If any step fails, entire transaction reverts
- No partial redemptions possible

## 🚀 Quick Start

```bash
# Check expiry
const isExpired = Date.now() / 1000 >= escrowData.expiresAt.toNumber();

if (isExpired) {
  console.log("❌ Sorry, redemption period has ended");
} else {
  # Redeem rewards
  await program.methods
    .redeemRewards(burnAmount)
    .accounts({ ... })
    .rpc();
  
  console.log("✅ Successfully redeemed rewards!");
}
```

---

**Remember: You must redeem BEFORE the expiry date! After that, the escrow closes.** ⏰

