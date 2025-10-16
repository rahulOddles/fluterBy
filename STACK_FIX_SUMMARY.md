# Stack Overflow Fix Summary

## Problem
The original `lock_funds` instruction was trying to create too many accounts in a single transaction, causing a **stack overflow** error:

```
Error: Function ... Stack offset of 4408 exceeded max offset of 4096 by 312 bytes
```

The issue was that creating:
- 1 `EscrowLockAccount` (init)
- 5 escrow wallet PDAs (init with token account constraints)

...all in one instruction exceeded Solana's 4096-byte stack limit.

## Solution
Split the account creation into **two separate instructions**:

### 1. `initialize_escrow_wallet(token, wallet_index)`
- **Purpose**: Create a single escrow wallet PDA
- **Call 5 times** (for wallets 1-5) before calling `lock_funds`
- **Stack usage**: Minimal - only creates one account per call
- **Parameters**:
  - `token`: Main token pubkey (for PDA derivation)
  - `wallet_index`: 1-5 (which wallet to create)

### 2. `lock_funds(...)` - Refactored
- **Purpose**: Create the `EscrowLockAccount` and transfer reward tokens
- **Prerequisites**: All 5 escrow wallets must be pre-created
- **Changed**: Escrow wallets are now validated with `mut` constraints instead of `init`
- **Removed**: The `rent` sysvar (not needed anymore)

## Code Changes

### New Instruction Context
```rust
#[derive(Accounts)]
#[instruction(token: Pubkey, wallet_index: u8)]
pub struct InitializeEscrowWallet<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,
    
    pub reward_token_mint: Account<'info, Mint>,
    
    #[account(
        seeds = [b"escrow_lock", token.as_ref(), minter.key().as_ref()],
        bump
    )]
    /// CHECK: This is the PDA that will be the authority
    pub escrow_lock_account: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = minter,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[wallet_index]],
        bump,
        token::mint = reward_token_mint,
        token::authority = escrow_lock_account,
    )]
    pub escrow_wallet: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

### Updated `LockFunds` Context
```rust
// Changed from `init` to `mut` for all escrow wallets
#[account(
    mut,  // <-- Changed from init
    seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[1]],
    bump,
)]
pub escrow_wallet_1: Account<'info, TokenAccount>,
// ... same for wallets 2-5

// Removed: rent sysvar (not needed)
```

## Test Updates

All tests now follow this pattern:

```typescript
// Step 1: Initialize all 5 escrow wallets
await initializeEscrowWallets(
  mainTokenMint,
  minter,
  rewardTokenMint,
  [escrowWallet1, escrowWallet2, escrowWallet3, escrowWallet4, escrowWallet5]
);

// Step 2: Lock funds (creates escrow lock account and transfers tokens)
await program.methods
  .lockFunds(
    mainTokenMint,
    rewardTokenMint,
    minter.publicKey,
    TOTAL_REWARD_VALUE,
    TOKEN_SUPPLY,
    expiryTime
  )
  .accounts({ /* ... */ })
  .signers([minter])
  .rpc();
```

## Results

✅ **No stack overflow warnings**
✅ **All 6 tests passing**
✅ **Clean build with no errors**

### Test Summary
```
  6 passing (19s)

  ✔ Derives PDA addresses correctly
  ✔ Locks funds in escrow (2435ms)
  ✔ User redeems rewards by burning tokens (408ms)
  ✔ Prevents redemption after expiry (4874ms)
  ✔ Minter withdraws expired rewards (4453ms)
  ✔ Prevents non-minter from withdrawing expired rewards (3252ms)
```

## Architecture Benefits

### Before (Single Instruction)
- ❌ Stack overflow
- ❌ Failed to deploy
- 1 transaction to set up escrow

### After (Split Instructions)
- ✅ No stack issues
- ✅ Deploys successfully
- ✅ More modular design
- 6 transactions to set up escrow (5 wallet inits + 1 lock_funds)

## Usage Flow

For **off-chain integrations** (Node.js backend), the flow is now:

1. Call `initialize_escrow_wallet` 5 times (for indices 1-5)
2. Call `lock_funds` once to create the escrow and transfer tokens
3. Users can call `redeem_rewards` to burn tokens and claim rewards
4. After expiry, minter can call `withdraw_expired_rewards`

## Gas Costs

The new approach requires **6 transactions** instead of 1, but:
- Each transaction is smaller and fits within stack limits
- Total cost is similar (6 small txs ≈ 1 large tx that would have failed)
- **Benefit**: The program actually works! 🎉

## Files Modified

1. `programs/fluter-by/src/state.rs` - Added `InitializeEscrowWallet` context
2. `programs/fluter-by/src/instructions.rs` - Added `initialize_escrow_wallet` handler
3. `programs/fluter-by/src/lib.rs` - Registered new instruction
4. `tests/fluter-by.ts` - Updated all tests to use the new flow

## Deployment

To deploy the updated program:

```bash
anchor build
solana program deploy --program-id target/deploy/fluter_by-keypair.json target/deploy/fluter_by.so --url localhost
```

The program ID remains: `8zsKxbVSrBUUYWDdSxkNAjS1SL4a4yR7yy7TZBH6qS1d`

