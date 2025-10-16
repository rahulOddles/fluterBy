# Test Guide for Fluter-By Smart Contract

## Overview
This document explains the comprehensive test suite for the Fluter-By escrow and reward redemption system.

---

## Test Suite Structure

### Setup (`before` hook)
Creates the test environment with:
- **Minter** and **User** keypairs with SOL airdrops
- **Main Token (FLBY)** - Token users hold and burn
- **Reward Token (USDC)** - Token users receive as rewards
- **Token Accounts** for minter and user
- Initial minting of tokens to appropriate accounts

**Constants:**
- `TOTAL_REWARD_VALUE`: 10,000 tokens (with 6 decimals)
- `TOKEN_SUPPLY`: 1,000 tokens
- `REWARD_PER_WALLET`: 2,000 tokens each (10,000 / 5)

---

## Test Cases

### 1. ✅ **Derives PDA addresses correctly**

**Purpose:** Verify that all PDA addresses are derived correctly

**What it tests:**
- Derives `escrowLockAccount` PDA using seeds: `[b"escrow_lock", mainToken, minter]`
- Derives 5 `escrowWallet` PDAs using seeds: `[b"escrow_wallet", mainToken, minter, N]` where N = 1-5
- Validates all PDAs exist

**Expected Result:**
- All 6 PDA addresses are successfully derived
- Addresses are deterministic and verifiable

---

### 2. ✅ **Locks funds in escrow**

**Purpose:** Test the `lock_funds` instruction

**What it tests:**
- Creates escrow lock account with correct metadata
- Creates 5 PDA token accounts (escrow wallets)
- Transfers reward tokens from minter to each escrow wallet
- Verifies equal distribution (2,000 tokens per wallet)

**Verifications:**
- ✅ Escrow lock account created with correct data
- ✅ `token` = main token mint
- ✅ `rewardToken` = reward token mint  
- ✅ `minter` = minter pubkey
- ✅ `totalRewardValue` = 10,000
- ✅ `remainingRewardValue` = 10,000
- ✅ `rewardPerWallet` = 2,000
- ✅ `totalTokenSupply` = 1,000
- ✅ `isActive` = true
- ✅ Each of 5 wallets has exactly 2,000 tokens

**Expected Output:**
```
Lock funds transaction signature: <tx_sig>
✅ Escrow lock account created successfully
  Total Reward Value: 10000000000
  Reward Per Wallet: 2000000000
  Token Supply: 1000000000
  Escrow Wallet 1 Balance: 2000000000
  Escrow Wallet 2 Balance: 2000000000
  Escrow Wallet 3 Balance: 2000000000
  Escrow Wallet 4 Balance: 2000000000
  Escrow Wallet 5 Balance: 2000000000
✅ All escrow wallets funded correctly
```

---

### 3. ✅ **User redeems rewards by burning tokens**

**Purpose:** Test the `redeem_rewards` instruction

**What it tests:**
- User burns 100 FLBY tokens (10% of supply)
- Calculates proportional reward: (100 / 1,000) × 10,000 = 1,000 USDC
- Burns user's main tokens
- Transfers proportional rewards from escrow wallets to user
- Updates escrow remaining value

**Verifications:**
- ✅ User's main token balance decreased by 100
- ✅ User's reward token balance increased by 1,000
- ✅ Tokens were actually burned (not transferred)
- ✅ Reward amount matches expected calculation
- ✅ Escrow `remainingRewardValue` = 9,000 (10,000 - 1,000)

**Expected Output:**
```
User main token balance before: 1000000000
User reward balance before: 0
Redeem rewards transaction signature: <tx_sig>
User main token balance after: 900000000
User reward balance after: 1000000000
✅ Tokens burned: 100000000
✅ Rewards received: 1000000000
✅ Remaining rewards in escrow: 9000000000
```

---

### 4. ✅ **Prevents redemption after expiry**

**Purpose:** Test that users cannot redeem rewards after the expiry date

**What it tests:**
- Creates a new escrow with immediate expiry (timestamp in the past)
- Attempts to call `redeem_rewards` after expiry
- Expects transaction to fail with `EscrowExpired` error

**Verifications:**
- ✅ Transaction fails
- ✅ Error message contains "EscrowExpired"
- ✅ No tokens are burned
- ✅ No rewards are transferred

**Expected Output:**
```
✅ Correctly prevented redemption after expiry
```

---

### 5. ✅ **Minter withdraws expired rewards**

**Purpose:** Test the `withdraw_expired_rewards` instruction

**What it tests:**
- Creates a new escrow with immediate expiry
- Minter calls `withdraw_expired_rewards` after expiry
- All remaining tokens transferred from 5 escrow wallets to minter
- Escrow marked as inactive

**Verifications:**
- ✅ Minter balance increases by total remaining rewards (10,000)
- ✅ All 5 escrow wallets are emptied (balance = 0)
- ✅ Escrow `isActive` = false
- ✅ Escrow `remainingRewardValue` = 0

**Expected Output:**
```
✅ Created expired escrow for withdrawal test
Minter balance before withdrawal: 0
Withdraw expired rewards transaction signature: <tx_sig>
Minter balance after withdrawal: 10000000000
✅ Minter withdrew: 10000000000
✅ Escrow marked as inactive
✅ Remaining rewards set to 0
  Escrow Wallet 1 Balance: 0
  Escrow Wallet 2 Balance: 0
  Escrow Wallet 3 Balance: 0
  Escrow Wallet 4 Balance: 0
  Escrow Wallet 5 Balance: 0
✅ All escrow wallets emptied
```

---

### 6. ✅ **Prevents non-minter from withdrawing expired rewards**

**Purpose:** Test authorization for withdrawal

**What it tests:**
- Creates an escrow with immediate expiry
- User (not the minter) attempts to call `withdraw_expired_rewards`
- Expects transaction to fail with authorization error

**Verifications:**
- ✅ Transaction fails
- ✅ Authorization error is thrown
- ✅ No tokens are transferred
- ✅ Escrow remains active

**Expected Output:**
```
✅ Correctly prevented non-minter from withdrawing
```

---

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Start local validator
solana-test-validator
```

### Build the program
```bash
anchor build
```

### Deploy to local validator
```bash
anchor deploy
```

### Run tests
```bash
# Run all tests
anchor test

# Run tests with detailed logs
anchor test --skip-local-validator -- --show-logs

# Run a specific test
anchor test --skip-local-validator -- --grep "Locks funds in escrow"
```

---

## Test Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│  SETUP                                                    │
│  - Create minter & user                                   │
│  - Create FLBY (main) and USDC (reward) tokens           │
│  - Mint 10,000 USDC to minter                             │
│  - Mint 1,000 FLBY to user                                │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 1: Derive PDAs                                      │
│  ✅ All 6 PDAs derived successfully                       │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 2: Lock Funds                                       │
│  - Minter locks 10,000 USDC                               │
│  - Creates escrow + 5 wallets                             │
│  ✅ Each wallet has 2,000 USDC                            │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 3: Redeem Rewards                                   │
│  - User burns 100 FLBY (10%)                              │
│  - Receives 1,000 USDC (10% of 10,000)                    │
│  ✅ Proportional calculation works                        │
│  ✅ Remaining: 9,000 USDC in escrow                       │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 4: Prevent Expired Redemption                       │
│  - Create expired escrow                                  │
│  - User tries to redeem                                   │
│  ✅ Transaction fails with EscrowExpired                  │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 5: Withdraw Expired                                 │
│  - Create expired escrow                                  │
│  - Minter withdraws all 10,000 USDC                       │
│  ✅ All wallets emptied                                   │
│  ✅ Escrow closed                                         │
└──────────────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────┐
│  TEST 6: Prevent Unauthorized Withdrawal                  │
│  - User tries to withdraw (not minter)                    │
│  ✅ Transaction fails with authorization error            │
└──────────────────────────────────────────────────────────┘
```

---

## Key Test Patterns

### 1. **PDA Derivation**
```typescript
const [escrowLockAccount] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("escrow_lock"),
    mainTokenMint.toBuffer(),
    minter.publicKey.toBuffer(),
  ],
  program.programId
);
```

### 2. **Testing Instruction Calls**
```typescript
await program.methods
  .lockFunds(mainToken, rewardToken, minter, value, supply, expiry)
  .accounts({ /* all required accounts */ })
  .signers([minter])
  .rpc();
```

### 3. **Verifying Account Data**
```typescript
const escrowData = await program.account.escrowLockAccount.fetch(escrowLockAccount);
assert.equal(escrowData.totalRewardValue.toString(), expectedValue.toString());
```

### 4. **Verifying Token Balances**
```typescript
const accountInfo = await getAccount(provider.connection, tokenAccount);
assert.equal(accountInfo.amount.toString(), expectedAmount.toString());
```

### 5. **Testing Error Cases**
```typescript
try {
  await program.methods.redeemRewards(amount)
    .accounts({ /* ... */ })
    .rpc();
  assert.fail("Should have thrown an error");
} catch (error) {
  assert.include(error.toString(), "EscrowExpired");
}
```

---

## Coverage Summary

| Instruction | Test Coverage |
|-------------|---------------|
| `lock_funds` | ✅ Happy path<br>✅ PDA creation<br>✅ Token transfers<br>✅ Equal distribution |
| `redeem_rewards` | ✅ Happy path<br>✅ Token burning<br>✅ Proportional rewards<br>✅ Expired check<br>✅ Balance updates |
| `withdraw_expired_rewards` | ✅ Happy path<br>✅ Expiry validation<br>✅ Authorization check<br>✅ Escrow closure<br>✅ Complete withdrawal |

---

## Expected Test Results

When all tests pass:
```
  fluter-by
    ✔ Derives PDA addresses correctly (XXms)
    ✔ Locks funds in escrow (XXms)
    ✔ User redeems rewards by burning tokens (XXms)
    ✔ Prevents redemption after expiry (XXms)
    ✔ Minter withdraws expired rewards (XXms)
    ✔ Prevents non-minter from withdrawing expired rewards (XXms)

  6 passing (Xs)
```

---

## Troubleshooting

### Test Fails: "Account not found"
- Make sure you've run `anchor build` and `anchor deploy`
- Verify the program ID in `Anchor.toml` matches `lib.rs`

### Test Fails: "Insufficient funds"
- Increase SOL airdrop amounts in the `before` hook
- Check that token minting is successful

### Test Fails: "Invalid seeds"
- Verify PDA derivation uses correct seeds
- Check that seeds match those in the Rust program

### Test Fails: "Transaction timeout"
- Local validator might be slow
- Increase timeout in test configuration
- Check validator logs for errors

---

## Next Steps

1. **Run the tests**: `anchor test`
2. **Check coverage**: Ensure all instructions are tested
3. **Add edge cases**: Test with different token amounts, multiple users, etc.
4. **Integration tests**: Test full user flows end-to-end
5. **Stress tests**: Test with maximum values, edge case calculations

---

## Additional Test Ideas

### Future Enhancements:
- [ ] Test with multiple users redeeming simultaneously
- [ ] Test with very large token amounts (overflow checks)
- [ ] Test with very small token amounts (precision checks)
- [ ] Test redemption with different burn amounts
- [ ] Test multiple escrows for same minter (different tokens)
- [ ] Test multiple escrows for different minters (same token)
- [ ] Test withdrawal attempt before expiry (should fail)
- [ ] Test double withdrawal (should fail)
- [ ] Test redemption after escrow closed (should fail)
- [ ] Test with 0 burn amount (should fail)
- [ ] Test with burn amount > balance (should fail)

Happy Testing! 🎉

