use anchor_lang::prelude::*;

#[event]
pub struct EscrowCreated {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub reward_asset: u8, // 0 = SOL, 1 = USDC
    pub total_reward_amount: u64,
    pub total_token_supply: u64,
    pub escrow_wallet_index: u8,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct FundsLocked {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub reward_amount: u64,
    pub escrow_wallet_index: u8,
    pub timestamp: i64,
}

#[event]
pub struct RewardsRedeemed {
    pub mint: Pubkey,
    pub user: Pubkey,
    pub tokens_burned: u64,
    pub rewards_redeemed: u64,
    pub remaining_escrow_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RemainingRewardsClaimed {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub remaining_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowExpired {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub unclaimed_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct MinterRegistered {
    pub minter: Pubkey,
    pub total_escrows: u64,
    pub timestamp: i64,
}

#[event]
pub struct DistributorRegistered {
    pub distributor: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EscrowWalletRotated {
    pub old_index: u8,
    pub new_index: u8,
    pub total_rotations: u64,
    pub timestamp: i64,
}
