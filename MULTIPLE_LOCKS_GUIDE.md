# 🔐 Multiple Token Locks Guide

## How Multiple Locks Work

Each lock is stored in a **unique escrow account** based on the combination of `mint` and `minter`. This means you can lock as many different tokens as you want, and all previous locks remain stored and accessible.

## 🔑 Unique Account System

```
PDA = ["escrow_lock", mint_address, minter_address]
```

### Example:

```
Lock 1: ["escrow_lock", TokenA, Minter1] → Escrow Account 1
Lock 2: ["escrow_lock", TokenB, Minter1] → Escrow Account 2
Lock 3: ["escrow_lock", TokenC, Minter1] → Escrow Account 3
Lock 4: ["escrow_lock", TokenA, Minter2] → Escrow Account 4
```

## 📊 Visual Representation

```
Minter: Alice
├── Token A Lock
│   ├── PDA: ["escrow_lock", TokenA, Alice]
│   ├── Value: 1 SOL (200M lamports per wallet)
│   ├── Expiry: 30 days
│   └── Wallets: [W1, W2, W3, W4, W5]
│
├── Token B Lock
│   ├── PDA: ["escrow_lock", TokenB, Alice]
│   ├── Value: 2 SOL (400M lamports per wallet)
│   ├── Expiry: 60 days
│   └── Wallets: [W1, W2, W3, W4, W5]
│
└── Token C Lock
    ├── PDA: ["escrow_lock", TokenC, Alice]
    ├── Value: 0.5 SOL (100M lamports per wallet)
    ├── Expiry: 7 days
    └── Wallets: [W1, W2, W3, W4, W5]
```

## ✅ What You CAN Do

### 1. Lock Different Tokens
```typescript
// Lock Token A
await lockFunds(tokenA, minter, 1000000000, expiry1, wallets);
// ✅ Creates new escrow

// Lock Token B (Token A lock still exists!)
await lockFunds(tokenB, minter, 2000000000, expiry2, wallets);
// ✅ Creates new escrow

// Lock Token C (Both previous locks still exist!)
await lockFunds(tokenC, minter, 500000000, expiry3, wallets);
// ✅ Creates new escrow
```

### 2. Different Minters Lock Same Token
```typescript
// Minter 1 locks Token A
await lockFunds(tokenA, minter1, 1000000000, expiry1, wallets);
// ✅ Creates escrow at PDA: ["escrow_lock", tokenA, minter1]

// Minter 2 locks Token A (Minter 1's lock still exists!)
await lockFunds(tokenA, minter2, 2000000000, expiry2, wallets);
// ✅ Creates escrow at PDA: ["escrow_lock", tokenA, minter2]
```

### 3. Retrieve All Your Locks
```typescript
const mints = [tokenA, tokenB, tokenC];

for (const mint of mints) {
  const [pda] = findProgramAddressSync(
    [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
    programId
  );
  
  const escrowData = await program.account.escrowLockAccount.fetch(pda);
  console.log(`Lock for ${mint}: ${escrowData.totalValue} lamports`);
}
```

## ❌ What You CANNOT Do

### Lock Same Token Twice (Same Minter)
```typescript
// First lock
await lockFunds(tokenA, minter, 1000000000, expiry1, wallets);
// ✅ Success

// Try to lock same token again with same minter
await lockFunds(tokenA, minter, 2000000000, expiry2, wallets);
// ❌ FAILS: Account already exists
```

**Why?** Because the PDA `["escrow_lock", tokenA, minter]` already exists.

**Solution:** Use a different minter or wait until the first lock expires and is closed.

## 🎯 Real-World Example

### Scenario: You're creating multiple tokens over time

```typescript
// Day 1: Launch Token A (FLBY)
await lockFunds(
  FLBY_mint,
  your_wallet,
  1000000000,  // 1 SOL
  expiry_30_days,
  escrowWallets
);
// ✅ Token A locked

// Day 7: Launch Token B (CUSTOM)
await lockFunds(
  CUSTOM_mint,
  your_wallet,
  2000000000,  // 2 SOL
  expiry_60_days,
  escrowWallets
);
// ✅ Token B locked (Token A still locked and accessible)

// Day 14: Launch Token C (SPECIAL)
await lockFunds(
  SPECIAL_mint,
  your_wallet,
  500000000,   // 0.5 SOL
  expiry_7_days,
  escrowWallets
);
// ✅ Token C locked (Token A and B still locked and accessible)
```

### Result:
- **3 separate escrow accounts**
- **All independently managed**
- **All accessible at any time**
- **Each with its own expiry**

## 📋 Summary

| Feature | Status |
|---------|--------|
| Lock multiple different tokens | ✅ YES |
| All previous locks preserved | ✅ YES |
| Each lock independent | ✅ YES |
| Different expiry times | ✅ YES |
| Different minters same token | ✅ YES |
| Same minter same token twice | ❌ NO |
| Retrieve all locks | ✅ YES |

## 💡 Best Practices

1. **Keep track of your mints**: Store all mint addresses you've locked
2. **Check before locking**: Query the PDA to see if a lock already exists
3. **Use different minters**: If you need multiple locks for the same token
4. **Monitor expiry dates**: Each lock has its own expiry time

## 🔍 How to Check Existing Locks

```typescript
async function checkLockExists(
  program: Program,
  mint: PublicKey,
  minter: PublicKey
): Promise<boolean> {
  try {
    const [pda] = findProgramAddressSync(
      [Buffer.from("escrow_lock"), mint.toBuffer(), minter.toBuffer()],
      program.programId
    );
    
    await program.account.escrowLockAccount.fetch(pda);
    return true; // Lock exists
  } catch {
    return false; // Lock doesn't exist
  }
}
```

## 🚀 Quick Start

```typescript
// Lock multiple tokens
const tokens = [
  { mint: tokenA, value: 1000000000, expiry: expiry1 },
  { mint: tokenB, value: 2000000000, expiry: expiry2 },
  { mint: tokenC, value: 500000000, expiry: expiry3 },
];

for (const token of tokens) {
  await lockFunds(
    token.mint,
    minter,
    token.value,
    token.expiry,
    escrowWallets
  );
  console.log(`✅ Locked ${token.mint}`);
}

console.log("✅ All tokens locked separately!");
```

---

**Remember:** Every different mint creates a new, separate escrow account. Your previous locks are always preserved and accessible! 🎉

