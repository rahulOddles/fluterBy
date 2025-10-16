# Expired Rewards Withdrawal Flow

## Overview
After a token lock expires, the **minter** can withdraw all remaining reward tokens from the 5 escrow wallets. This ensures that unclaimed rewards are returned to the minter.

## Instruction: `withdraw_expired_rewards`

### Purpose
Allows the **minter** to reclaim all remaining reward tokens from the escrow after the expiry timestamp has passed.

---

## Flow Diagram

```
[Minter]
   |
   | (calls withdraw_expired_rewards)
   |
   v
[Escrow Lock Account]
   |
   |---> Verify: Escrow is active
   |---> Verify: Current time >= expires_at
   |---> Verify: Caller is the minter
   |---> Verify: Remaining rewards > 0
   |
   |---> Get balances from all 5 escrow wallets
   |
   v
[Transfer tokens from Escrow Wallets to Minter]
   |
   |---> Wallet 1 --> Minter Reward Account
   |---> Wallet 2 --> Minter Reward Account
   |---> Wallet 3 --> Minter Reward Account
   |---> Wallet 4 --> Minter Reward Account
   |---> Wallet 5 --> Minter Reward Account
   |
   v
[Update Escrow Lock Account]
   |
   |---> Set is_active = false
   |---> Set remaining_reward_value = 0
   |
   v
[Emit ExpiredRewardsWithdrawn Event]
   |
   v
[Escrow Closed ✅]
```

---

## Validation Checks

### 1. Escrow is Active
```rust
require!(
    escrow_lock_account.is_active,
    FluterByError::EscrowNotFound
);
```
- Ensures the escrow hasn't already been closed
- Prevents double withdrawal

### 2. Escrow Has Expired
```rust
require!(
    clock.unix_timestamp >= escrow_lock_account.expires_at,
    FluterByError::EscrowNotExpired
);
```
- **Opposite** of the `redeem_rewards` check
- Only allows withdrawal **after** expiry
- Users can't redeem after expiry, but minter can withdraw

### 3. Caller is the Minter
```rust
require!(
    escrow_lock_account.minter == ctx.accounts.minter.key(),
    FluterByError::UnauthorizedMinter
);
```
- Only the original minter who locked the funds can withdraw
- PDA seeds also validate this: `[b"escrow_lock", token, minter]`

### 4. Rewards Available
```rust
require!(
    remaining_rewards > 0,
    FluterByError::InsufficientFunds
);
```
- Ensures there are actually rewards to withdraw
- Prevents wasted transactions

---

## Token Transfer Logic

### Getting Balances
The instruction reads the actual current balance from each escrow wallet:
```rust
let wallet_1_balance = ctx.accounts.escrow_wallet_1.amount;
let wallet_2_balance = ctx.accounts.escrow_wallet_2.amount;
// ... for all 5 wallets

let total_to_withdraw = wallet_1_balance + wallet_2_balance + 
                        wallet_3_balance + wallet_4_balance + 
                        wallet_5_balance;
```

**Why read actual balances?**
- More accurate than `remaining_reward_value` (which is just tracking)
- Handles edge cases where balances might differ slightly
- Ensures we withdraw everything that's actually in the wallets

### Transferring from Each Wallet
For each escrow wallet, the instruction:
1. Checks if balance > 0
2. Transfers the **entire balance** to the minter's reward account
3. Uses PDA signer seeds for authorization

```rust
if wallet_1_balance > 0 {
    let cpi_accounts_1 = token::Transfer {
        from: ctx.accounts.escrow_wallet_1.to_account_info(),
        to: ctx.accounts.minter_reward_account.to_account_info(),
        authority: ctx.accounts.escrow_lock_account.to_account_info(),
    };
    let cpi_ctx_1 = CpiContext::new_with_signer(
        cpi_program.clone(), 
        cpi_accounts_1, 
        signer_seeds
    );
    token::transfer(cpi_ctx_1, wallet_1_balance)?;
}
```

**PDA Signer Seeds:**
```rust
let signer_seeds: &[&[&[u8]]] = &[&[
    b"escrow_lock",
    token_key.as_ref(),
    minter_key.as_ref(),
    &[bump],
]];
```
- The `EscrowLockAccount` PDA acts as the authority for the transfers
- This is why the escrow wallets must trust this PDA to move their funds

---

## Escrow Closure

After all transfers complete:
```rust
escrow_lock_account.is_active = false;
escrow_lock_account.remaining_reward_value = 0;
```

- **`is_active = false`**: Marks the escrow as closed
- **`remaining_reward_value = 0`**: Resets the tracking counter
- The escrow account itself is **not deleted** (in case you want to query history)

---

## Event Emission

```rust
emit!(ExpiredRewardsWithdrawn {
    token: escrow_lock_account.token,
    minter: escrow_lock_account.minter,
    amount_withdrawn: total_to_withdraw,
    timestamp: clock.unix_timestamp,
});
```

### Event Fields:
- `token`: The main token (FLBY) associated with this escrow
- `minter`: The minter who withdrew the rewards
- `amount_withdrawn`: Total reward tokens withdrawn (sum of all 5 wallets)
- `timestamp`: Unix timestamp of the withdrawal

---

## Example Scenario

### Initial State
- **Escrow Created**: 2024-01-01 00:00 UTC
- **Expiry**: 2024-02-01 00:00 UTC (30 days later)
- **Total Reward Value**: 10,000 USDC
- **Reward per Wallet**: 2,000 USDC each

### User Redemptions (Before Expiry)
Over the 30 days, users burn their FLBY tokens and redeem:
- Total redeemed: 7,500 USDC (75% of rewards)
- Remaining in escrow: 2,500 USDC (25% unclaimed)

### Distribution Across Wallets After Redemptions
- Wallet 1: 400 USDC
- Wallet 2: 500 USDC
- Wallet 3: 600 USDC
- Wallet 4: 450 USDC
- Wallet 5: 550 USDC
- **Total**: 2,500 USDC

### Minter Withdrawal (After Expiry)
On 2024-02-01 00:01 UTC (1 minute after expiry):
1. Minter calls `withdraw_expired_rewards`
2. Program validates:
   - ✅ Escrow is active
   - ✅ Current time (2024-02-01 00:01) >= expiry (2024-02-01 00:00)
   - ✅ Caller is the minter
   - ✅ 2,500 USDC remaining
3. Program transfers:
   - 400 USDC from Wallet 1 → Minter
   - 500 USDC from Wallet 2 → Minter
   - 600 USDC from Wallet 3 → Minter
   - 450 USDC from Wallet 4 → Minter
   - 550 USDC from Wallet 5 → Minter
4. Escrow marked as inactive
5. Minter receives **2,500 USDC** total

---

## Accounts Required

### Context: `WithdrawExpiredRewards`

| Account | Type | Constraints |
|---------|------|-------------|
| `escrow_lock_account` | PDA | Seeds: `[b"escrow_lock", token, minter]` |
| `minter` | Signer | Must match `escrow_lock_account.minter` |
| `token` | UncheckedAccount | Main token (FLBY) |
| `reward_token_mint` | Mint | The reward token (e.g., USDC) |
| `minter_reward_account` | TokenAccount | Owned by minter, mint = reward_token_mint |
| `escrow_wallet_1..5` | TokenAccount | The 5 escrow wallets |
| `token_program` | Program | SPL Token Program |
| `system_program` | Program | Solana System Program |

---

## Security Considerations

### 1. Time-Based Access Control
- Users can only redeem **before** expiry
- Minter can only withdraw **after** expiry
- This ensures a clean separation of access periods

### 2. Single Minter Authorization
- Only the original minter can withdraw
- Enforced by both:
  - PDA seeds (includes minter pubkey)
  - Account constraint check

### 3. Idempotency Protection
- `is_active` flag prevents double withdrawal
- Once escrow is closed, it can't be withdrawn again

### 4. Balance Verification
- Uses actual token account balances
- Not just internal tracking variable
- Prevents discrepancies

---

## Comparison: Redemption vs. Withdrawal

| Feature | `redeem_rewards` | `withdraw_expired_rewards` |
|---------|------------------|----------------------------|
| **Caller** | Any user holding FLBY | Only the minter |
| **Timing** | Before expiry | After expiry |
| **Action** | Burns FLBY tokens | No burning (just withdrawal) |
| **Amount** | Proportional to burned tokens | All remaining rewards |
| **Destination** | User's reward account | Minter's reward account |
| **Escrow State After** | Still active | Marked inactive |

---

## Error Cases

| Error | Reason | Solution |
|-------|--------|----------|
| `EscrowNotFound` | Escrow already closed | Check `is_active` before calling |
| `EscrowNotExpired` | Trying to withdraw before expiry | Wait until `expires_at` timestamp |
| `UnauthorizedMinter` | Wrong minter trying to withdraw | Only original minter can withdraw |
| `InsufficientFunds` | No rewards left in escrow | All rewards were already redeemed |

---

## Complete Lifecycle

```
1. LOCK FUNDS
   └─> Minter locks 10,000 USDC for FLBY token
       └─> Distributed to 5 escrow wallets (2,000 each)

2. REDEMPTION PERIOD (Before Expiry)
   └─> Users burn FLBY → receive proportional USDC
       └─> Example: Burn 10% of FLBY → receive 10% of remaining USDC

3. EXPIRY REACHED
   └─> Redemption period ends
       └─> Users can no longer redeem
       └─> Minter can now withdraw

4. MINTER WITHDRAWAL (After Expiry)
   └─> Minter withdraws all remaining USDC
       └─> Escrow closed
```

---

## Testing Checklist

- [ ] Minter can withdraw after expiry
- [ ] Minter cannot withdraw before expiry
- [ ] Non-minter cannot withdraw
- [ ] Cannot withdraw from inactive escrow
- [ ] Cannot withdraw when no funds remaining
- [ ] All 5 wallet balances are correctly transferred
- [ ] Escrow is marked inactive after withdrawal
- [ ] Event is emitted with correct data
- [ ] Users cannot redeem after expiry (even before minter withdraws)

