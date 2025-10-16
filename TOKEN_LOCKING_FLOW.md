# 🔐 Token Locking Flow - How It Works

## Overview

The `lock_funds` instruction actually **transfers reward tokens** from the minter's account to 5 escrow wallet accounts. This is a real on-chain transfer, not just recording data.

## 📊 Token Flow Diagram

```
Before Lock:
┌─────────────────────────────────────┐
│  Minter's Reward Token Account      │
│  Balance: 10,000 USDC               │
└─────────────────────────────────────┘

After Lock (lock_funds called with 10,000 USDC):
┌─────────────────────────────────────┐
│  Minter's Reward Token Account      │
│  Balance: 0 USDC                    │  ← All tokens transferred out
└─────────────────────────────────────┘
                 │
                 ├─→ Escrow Wallet 1: 2,000 USDC
                 ├─→ Escrow Wallet 2: 2,000 USDC
                 ├─→ Escrow Wallet 3: 2,000 USDC
                 ├─→ Escrow Wallet 4: 2,000 USDC
                 └─→ Escrow Wallet 5: 2,000 USDC
```

## 🔄 Complete Lock Process

### Step 1: Prepare Token Accounts

Before calling `lock_funds`, you need:

1. **Minter's Reward Token Account** - Must have enough reward tokens
2. **5 Escrow Wallet Token Accounts** - Must be created for the reward token mint

### Step 2: Call lock_funds Instruction

```typescript
const tx = await program.methods
  .lockFunds(
    mainToken,           // FLBY token mint
    rewardTokenMint,     // USDC token mint
    minter,              // Minter's public key
    new anchor.BN(10000000000), // 10,000 USDC (with decimals)
    new anchor.BN(1000000),     // 1M FLBY token supply
    new anchor.BN(expiry)
  )
  .accounts({
    escrowLockAccount: escrowLockPDA,
    minter: minter,
    token: mainToken,
    rewardTokenMint: rewardTokenMint,
    minterRewardAccount: minterUsdcAccount,  // Source of USDC
    escrowWallet1: escrowWallet1UsdcAccount, // Destination 1
    escrowWallet2: escrowWallet2UsdcAccount, // Destination 2
    escrowWallet3: escrowWallet3UsdcAccount, // Destination 3
    escrowWallet4: escrowWallet4UsdcAccount, // Destination 4
    escrowWallet5: escrowWallet5UsdcAccount, // Destination 5
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### Step 3: Token Transfers Happen

The instruction performs **5 SPL token transfers**:

```rust
// Transfer 1: Minter → Escrow Wallet 1 (2,000 USDC)
token::transfer(cpi_ctx_1, reward_per_wallet)?;

// Transfer 2: Minter → Escrow Wallet 2 (2,000 USDC)
token::transfer(cpi_ctx_2, reward_per_wallet)?;

// Transfer 3: Minter → Escrow Wallet 3 (2,000 USDC)
token::transfer(cpi_ctx_3, reward_per_wallet)?;

// Transfer 4: Minter → Escrow Wallet 4 (2,000 USDC)
token::transfer(cpi_ctx_4, reward_per_wallet)?;

// Transfer 5: Minter → Escrow Wallet 5 (2,000 USDC)
token::transfer(cpi_ctx_5, reward_per_wallet)?;
```

## 🔍 Under the Hood

### What Happens in the Contract

1. **Validation**
   ```rust
   // Check minter has authority
   // Check reward value > 0
   // Check value divisible by 5
   // Check expiry is in future
   ```

2. **Token Transfers** (The actual locking!)
   ```rust
   // Use SPL Token Program to transfer tokens
   // From: minter_reward_account
   // To: escrow_wallet_1, escrow_wallet_2, etc.
   // Amount: reward_per_wallet (total / 5)
   ```

3. **Record Keeping**
   ```rust
   // Store escrow information in EscrowLockAccount
   // Track: token, reward_token, total_value, remaining_value, etc.
   ```

## 💰 Real Example

### Scenario: Lock 10,000 USDC as rewards for FLBY token

**Before Lock:**
```
Minter USDC Account: 10,000 USDC
Escrow Wallet 1: 0 USDC
Escrow Wallet 2: 0 USDC
Escrow Wallet 3: 0 USDC
Escrow Wallet 4: 0 USDC
Escrow Wallet 5: 0 USDC
```

**After Lock:**
```
Minter USDC Account: 0 USDC          ← Transferred out
Escrow Wallet 1: 2,000 USDC          ← Received 1/5
Escrow Wallet 2: 2,000 USDC          ← Received 1/5
Escrow Wallet 3: 2,000 USDC          ← Received 1/5
Escrow Wallet 4: 2,000 USDC          ← Received 1/5
Escrow Wallet 5: 2,000 USDC          ← Received 1/5
```

**EscrowLockAccount (on-chain data):**
```rust
{
  token: FLBY_MINT,
  reward_token: USDC_MINT,
  minter: MINTER_PUBKEY,
  total_reward_value: 10000000000,      // 10,000 USDC
  remaining_reward_value: 10000000000,  // 10,000 USDC (not redeemed yet)
  reward_per_wallet: 2000000000,        // 2,000 USDC per wallet
  total_token_supply: 1000000,          // 1M FLBY tokens
  escrow_wallets: [wallet1, wallet2, wallet3, wallet4, wallet5],
  expires_at: 1234567890,
  is_active: true
}
```

## 🔐 Security Features

### 1. Authority Checks
```rust
// Only the minter can transfer from their account
constraint = minter_reward_account.owner == minter.key()
```

### 2. Token Mint Validation
```rust
// All escrow wallets must be for the correct token
constraint = escrow_wallet_1.mint == reward_token_mint.key()
```

### 3. Atomic Transfers
- All 5 transfers happen in one transaction
- If any transfer fails, the entire transaction reverts
- No partial locks possible

## 📝 Setting Up Token Accounts

### Create Escrow Wallet Token Accounts

```typescript
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// For each of the 5 escrow wallets
for (let i = 0; i < 5; i++) {
  const escrowWallet = escrowWalletKeypairs[i];
  
  // Get the associated token account address
  const escrowTokenAccount = await getAssociatedTokenAddress(
    rewardTokenMint,      // USDC mint
    escrowWallet.publicKey // Escrow wallet owner
  );
  
  // Create the token account if it doesn't exist
  const instruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,           // Payer
    escrowTokenAccount,        // Token account to create
    escrowWallet.publicKey,    // Owner
    rewardTokenMint            // Mint
  );
  
  // Send transaction...
}
```

## ⚠️ Important Notes

### 1. Minter Must Have Sufficient Balance
```typescript
// Check minter's balance before locking
const minterBalance = await connection.getTokenAccountBalance(minterRewardAccount);
if (minterBalance.value.amount < totalRewardValue) {
  throw new Error("Insufficient balance in minter's account");
}
```

### 2. Token Accounts Must Exist
```typescript
// All 5 escrow wallet token accounts must be created before calling lock_funds
// They must be for the correct reward token mint
```

### 3. Value Must Be Divisible by 5
```typescript
// Example: Valid values
const validValues = [
  1000000000,  // 1,000 USDC
  2500000000,  // 2,500 USDC
  10000000000, // 10,000 USDC
];

// Example: Invalid values (will fail)
const invalidValues = [
  1000000001,  // Not divisible by 5
  1234567890,  // Not divisible by 5
];
```

## 🎯 Summary

**The tokens are ACTUALLY locked in the contract!**

✅ Real SPL token transfers happen  
✅ Tokens move from minter to 5 escrow wallets  
✅ Transfers are secured by Solana's SPL Token Program  
✅ All transfers are atomic (all succeed or all fail)  
✅ Escrow wallets hold the tokens until redeemed or expired  

This is **not** just recording data - it's **real token custody** on-chain! 🔐

