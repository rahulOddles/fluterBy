# PDA-Based Escrow Architecture Explained

## The Problem We Solved

### ❌ **Original Problem: External Wallets**

In the original design, the 5 escrow wallets were **external accounts** that you had to:
1. Create manually off-chain
2. Pass their addresses to the program
3. Hope they were properly configured

**This caused a critical issue:**
```rust
// When trying to redeem rewards...
let cpi_accounts = token::Transfer {
    from: escrow_wallet_1,           // External wallet
    to: user_reward_account,
    authority: escrow_lock_account,  // PDA trying to authorize
};
token::transfer(cpi_ctx, amount)?;  // ❌ FAILS!
```

**Error:** `"Transfer: from must be owned by authority"`

**Why it failed:**
- The external wallet doesn't recognize the PDA as its authority
- The PDA can't sign for an account it doesn't control
- Users couldn't redeem rewards!

---

## ✅ **Solution: PDA-Owned Escrow Wallets**

Now the 5 escrow wallets are **PDAs created and owned by the program itself**.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    PROGRAM CONTROLS                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │  EscrowLockAccount (PDA)                │             │
│  │  Seeds: [b"escrow_lock", token, minter] │             │
│  │  - Stores metadata                       │             │
│  │  - Acts as authority for wallets         │             │
│  └─────────────────────────────────────────┘             │
│            │                                              │
│            │ (controls)                                   │
│            ↓                                              │
│  ┌─────────────────────────────────────────┐             │
│  │  Escrow Wallet 1 (PDA Token Account)    │             │
│  │  Seeds: [..., &[1]]                      │             │
│  │  Authority: EscrowLockAccount ✅         │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │  Escrow Wallet 2 (PDA Token Account)    │             │
│  │  Seeds: [..., &[2]]                      │             │
│  │  Authority: EscrowLockAccount ✅         │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │  Escrow Wallet 3 (PDA Token Account)    │             │
│  │  Seeds: [..., &[3]]                      │             │
│  │  Authority: EscrowLockAccount ✅         │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │  Escrow Wallet 4 (PDA Token Account)    │             │
│  │  Seeds: [..., &[4]]                      │             │
│  │  Authority: EscrowLockAccount ✅         │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
│  ┌─────────────────────────────────────────┐             │
│  │  Escrow Wallet 5 (PDA Token Account)    │             │
│  │  Seeds: [..., &[5]]                      │             │
│  │  Authority: EscrowLockAccount ✅         │             │
│  └─────────────────────────────────────────┘             │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## How PDA Authority Works

### 1. **Creating the Escrow Wallets**

In `LockFunds` context:

```rust
/// Escrow wallet 1 - PDA-owned token account
#[account(
    init,                                  // Create this account
    payer = minter,                        // Minter pays rent
    seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[1]],
    bump,
    token::mint = reward_token_mint,       // This wallet holds USDC
    token::authority = escrow_lock_account, // EscrowLockAccount PDA is the authority ✅
)]
pub escrow_wallet_1: Account<'info, TokenAccount>,
```

**Key points:**
- `init` - Creates a new SPL Token Account on-chain
- `seeds` - Makes it a PDA with deterministic address
- `token::authority = escrow_lock_account` - **The EscrowLockAccount PDA is set as the authority**
- This happens automatically for all 5 wallets when `lock_funds` is called

### 2. **Locking Funds (Minter → Escrow Wallets)**

When minter locks funds:

```rust
// Step 1: Create all 5 escrow wallet PDAs (done by Anchor via `init`)
// Step 2: Transfer from minter to each wallet
let cpi_accounts = token::Transfer {
    from: minter_reward_account,     // Minter's account
    to: escrow_wallet_1,             // New PDA wallet
    authority: minter,               // Minter signs ✅
};
token::transfer(cpi_ctx, reward_per_wallet)?;
```

**This works because:**
- Minter owns their account and can authorize transfers from it
- We're transferring TO the PDA wallet (no authority needed to receive)

### 3. **Redeeming Rewards (Escrow Wallets → User)**

When user redeems rewards:

```rust
// Get PDA signer seeds
let token_key = escrow_lock_account.token;
let minter_key = escrow_lock_account.minter;
let bump = ctx.bumps.escrow_lock_account;
let signer_seeds: &[&[&[u8]]] = &[&[
    b"escrow_lock",
    token_key.as_ref(),
    minter_key.as_ref(),
    &[bump],
]];

// Transfer FROM escrow wallet (PDA signs)
let cpi_accounts = token::Transfer {
    from: escrow_wallet_1,               // PDA wallet
    to: user_reward_account,             // User's account
    authority: escrow_lock_account,      // PDA is the authority ✅
};
let cpi_ctx = CpiContext::new_with_signer(
    cpi_program, 
    cpi_accounts, 
    signer_seeds  // PDA proves it's the authority by providing seeds
);
token::transfer(cpi_ctx, amount)?;  // ✅ SUCCESS!
```

**This works because:**
- `escrow_wallet_1` was created with `token::authority = escrow_lock_account`
- When we call `CpiContext::new_with_signer(...)` with the PDA seeds, the program **proves** it controls the PDA
- Solana verifies the seeds produce the PDA address
- Transfer is authorized! ✅

### 4. **Withdrawing After Expiry (Escrow Wallets → Minter)**

Same mechanism as redemption:

```rust
// PDA signs with its seeds
let cpi_accounts = token::Transfer {
    from: escrow_wallet_1,
    to: minter_reward_account,
    authority: escrow_lock_account,  // PDA authority ✅
};
let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
token::transfer(cpi_ctx, amount)?;  // ✅ SUCCESS!
```

---

## PDA Seeds Breakdown

### EscrowLockAccount PDA
```rust
seeds = [b"escrow_lock", token.key(), minter.key()]
```
**Purpose:** Metadata account that acts as authority for the 5 wallets

**Examples:**
- Token A + Minter X → Unique PDA
- Token B + Minter X → Different PDA
- Token A + Minter Y → Different PDA

### Escrow Wallet PDAs
```rust
// Wallet 1
seeds = [b"escrow_wallet", token.key(), minter.key(), &[1]]

// Wallet 2
seeds = [b"escrow_wallet", token.key(), minter.key(), &[2]]

// Wallet 3
seeds = [b"escrow_wallet", token.key(), minter.key(), &[3]]

// Wallet 4
seeds = [b"escrow_wallet", token.key(), minter.key(), &[4]]

// Wallet 5
seeds = [b"escrow_wallet", token.key(), minter.key(), &[5]]
```

**Purpose:** SPL Token Accounts that hold the actual reward tokens

**Key feature:** The last byte `&[1]` through `&[5]` makes each wallet unique

---

## Complete Flow Example

### Scenario: Minter locks 10,000 USDC for FLBY token

#### Step 1: Call `lock_funds`

```typescript
await program.methods
  .lockFunds(
    flbyToken,      // token
    usdcMint,       // reward_token
    minter.pubkey,  // minter
    10_000_000000,  // reward_value (10k USDC)
    1_000_000,      // token_supply
    expiryTime      // expiry
  )
  .accounts({
    escrowLockAccount,      // Will be created
    minter,
    token: flbyToken,
    rewardTokenMint: usdcMint,
    minterRewardAccount,
    escrowWallet1,          // Will be created (PDA)
    escrowWallet2,          // Will be created (PDA)
    escrowWallet3,          // Will be created (PDA)
    escrowWallet4,          // Will be created (PDA)
    escrowWallet5,          // Will be created (PDA)
    tokenProgram,
    systemProgram,
    rent,
  })
  .rpc();
```

**What happens on-chain:**
1. ✅ Create `EscrowLockAccount` PDA
2. ✅ Create `escrow_wallet_1` PDA (authority = EscrowLockAccount)
3. ✅ Create `escrow_wallet_2` PDA (authority = EscrowLockAccount)
4. ✅ Create `escrow_wallet_3` PDA (authority = EscrowLockAccount)
5. ✅ Create `escrow_wallet_4` PDA (authority = EscrowLockAccount)
6. ✅ Create `escrow_wallet_5` PDA (authority = EscrowLockAccount)
7. ✅ Transfer 2,000 USDC from minter → wallet 1
8. ✅ Transfer 2,000 USDC from minter → wallet 2
9. ✅ Transfer 2,000 USDC from minter → wallet 3
10. ✅ Transfer 2,000 USDC from minter → wallet 4
11. ✅ Transfer 2,000 USDC from minter → wallet 5

#### Step 2: User calls `redeem_rewards`

User burns 100 FLBY tokens (10% of supply):

```typescript
await program.methods
  .redeemRewards(
    100_000000  // burn 100 FLBY
  )
  .accounts({
    escrowLockAccount,      // Existing PDA
    user,
    token: flbyToken,
    tokenMint: flbyMint,
    userTokenAccount,       // Has FLBY to burn
    rewardToken: usdcMint,
    userRewardAccount,      // Will receive USDC
    escrowWallet1,          // PDA (derived from seeds)
    escrowWallet2,          // PDA
    escrowWallet3,          // PDA
    escrowWallet4,          // PDA
    escrowWallet5,          // PDA
    tokenProgram,
    systemProgram,
  })
  .rpc();
```

**What happens on-chain:**
1. ✅ Burn 100 FLBY from user
2. ✅ Calculate reward: (100 / 1,000,000) * 10,000 = 1 USDC
3. ✅ Transfer 0.2 USDC from wallet 1 → user (PDA signs ✅)
4. ✅ Transfer 0.2 USDC from wallet 2 → user (PDA signs ✅)
5. ✅ Transfer 0.2 USDC from wallet 3 → user (PDA signs ✅)
6. ✅ Transfer 0.2 USDC from wallet 4 → user (PDA signs ✅)
7. ✅ Transfer 0.2 USDC from wallet 5 → user (PDA signs ✅)

**User receives 1 USDC total!**

#### Step 3: Minter calls `withdraw_expired_rewards` (after expiry)

```typescript
await program.methods
  .withdrawExpiredRewards()
  .accounts({
    escrowLockAccount,
    minter,
    token: flbyToken,
    rewardTokenMint: usdcMint,
    minterRewardAccount,
    escrowWallet1,
    escrowWallet2,
    escrowWallet3,
    escrowWallet4,
    escrowWallet5,
    tokenProgram,
    systemProgram,
  })
  .rpc();
```

**What happens on-chain:**
1. ✅ Check current time > expiry ✅
2. ✅ Read balances from all 5 wallets
3. ✅ Transfer all from wallet 1 → minter (PDA signs ✅)
4. ✅ Transfer all from wallet 2 → minter (PDA signs ✅)
5. ✅ Transfer all from wallet 3 → minter (PDA signs ✅)
6. ✅ Transfer all from wallet 4 → minter (PDA signs ✅)
7. ✅ Transfer all from wallet 5 → minter (PDA signs ✅)
8. ✅ Mark escrow as inactive

**Minter receives remaining 9,999 USDC!**

---

## Security Benefits

### ✅ **1. Program-Controlled**
- Only the program can move funds from escrow wallets
- No external party can drain the wallets
- No need to trust external wallet owners

### ✅ **2. Deterministic Addresses**
- Wallet addresses are derived from seeds
- Anyone can calculate the addresses
- No need to store addresses off-chain

### ✅ **3. Automatic Creation**
- Wallets are created when `lock_funds` is called
- No manual setup required
- Reduces user error

### ✅ **4. Time-Based Access Control**
- Before expiry: Only users can redeem (by burning tokens)
- After expiry: Only minter can withdraw
- Enforced by program logic

### ✅ **5. Single Source of Truth**
- All escrow state is on-chain
- Transparent and auditable
- No off-chain coordination needed

---

## Key Takeaways

| Feature | External Wallets (❌ Old) | PDA Wallets (✅ New) |
|---------|---------------------------|----------------------|
| **Creation** | Manual, off-chain | Automatic, on-chain |
| **Authority** | External party | Program PDA |
| **Trust Model** | Trust wallet owner | Trustless |
| **Addresses** | Stored/passed manually | Derived from seeds |
| **Transfers Out** | ❌ Fails (no authority) | ✅ Works (PDA signs) |
| **Security** | Depends on external setup | Guaranteed by program |
| **User Experience** | Complex | Simple |

---

## Technical Implementation Notes

### Why `token::authority = escrow_lock_account`?

```rust
#[account(
    init,
    payer = minter,
    seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[1]],
    bump,
    token::mint = reward_token_mint,
    token::authority = escrow_lock_account,  // <-- THIS IS CRITICAL
)]
pub escrow_wallet_1: Account<'info, TokenAccount>,
```

This line tells the SPL Token Program:
- "The authority for this token account is the `EscrowLockAccount` PDA"
- Without this, the token account would have no authority
- With this, the PDA can sign for transfers from this account

### Why `CpiContext::new_with_signer`?

```rust
let cpi_ctx = CpiContext::new_with_signer(
    cpi_program,
    cpi_accounts,
    signer_seeds  // <-- Proves we control the PDA
);
```

- Regular `CpiContext::new` doesn't include PDA signing
- `new_with_signer` provides the seeds to prove PDA ownership
- Solana runtime verifies: `hash(seeds) == PDA address`
- If verified, the PDA is authorized to sign the transaction

---

## Summary

**Before:** External wallets → No control → Transfers fail ❌

**After:** PDA wallets → Program control → Transfers work ✅

Your escrow system is now **fully on-chain, trustless, and secure**! 🎉

