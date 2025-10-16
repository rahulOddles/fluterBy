use anchor_lang::prelude::*;

#[event]
pub struct FundsLocked {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub value: u64,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct EscrowExpired {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub total_value: u64,
    pub timestamp: i64,
}

#[event]
pub struct FundsWithdrawn {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub amount: u64,
    pub wallet_index: u8,
    pub timestamp: i64,
}

#[event]
pub struct RewardsRedeemed {
    pub token: Pubkey,
    pub user: Pubkey,
    pub tokens_burned: u64,
    pub rewards_received: u64,
    pub remaining_rewards: u64,
    pub timestamp: i64,
}

#[event]
pub struct ExpiredRewardsWithdrawn {
    pub token: Pubkey,
    pub minter: Pubkey,
    pub amount_withdrawn: u64,
    pub timestamp: i64,
}
