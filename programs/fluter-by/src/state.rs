use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

#[derive(Clone, Copy, PartialEq, AnchorSerialize, AnchorDeserialize)]
pub enum RewardAsset {
    SOL,
    USDC,
}

#[derive(Accounts)]
pub struct InitializeEscrow {
    #[account(
        init,
        payer = minter,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", mint.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: This is the mint we're creating escrow for
    pub mint: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockFunds {
    #[account(
        mut,
        seeds = [b"escrow", mint.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: This is the mint we're creating escrow for
    pub mint: UncheckedAccount<'info>,
    
    /// CHECK: The reward asset account (SOL or USDC)
    #[account(mut)]
    pub reward_asset_account: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemRewards {
    #[account(
        mut,
        seeds = [b"escrow", mint.key().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the mint we're redeeming
    pub mint: UncheckedAccount<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: The reward asset account (SOL or USDC)
    #[account(mut)]
    pub reward_asset_account: UncheckedAccount<'info>,
    
    /// CHECK: The mint account for burning tokens
    #[account(mut)]
    pub mint_account: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRemainingRewards {
    #[account(
        mut,
        seeds = [b"escrow", mint.key().as_ref()],
        bump,
        constraint = escrow_account.minter == minter.key()
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: This is the mint we're claiming for
    pub mint: UncheckedAccount<'info>,
    
    /// CHECK: The reward asset account (SOL or USDC)
    #[account(mut)]
    pub reward_asset_account: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowAccount {
    pub mint: Pubkey,
    pub minter: Pubkey,
    pub reward_asset: RewardAsset,
    pub total_reward_amount: u64,
    pub remaining_reward_amount: u64,
    pub total_token_supply: u64,
    pub burned_token_amount: u64,
    pub escrow_wallet_index: u8,
    pub created_at: i64,
    pub expires_at: i64,
    pub is_active: bool,
}

impl EscrowAccount {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // mint
        32 + // minter
        1 +  // reward_asset
        8 +  // total_reward_amount
        8 +  // remaining_reward_amount
        8 +  // total_token_supply
        8 +  // burned_token_amount
        1 +  // escrow_wallet_index
        8 +  // created_at
        8 +  // expires_at
        1;   // is_active
}

#[account]
#[derive(InitSpace)]
pub struct MinterAccount {
    pub minter: Pubkey,
    pub total_escrows_created: u64,
    pub total_rewards_locked: u64,
    pub total_rewards_claimed: u64,
    pub created_at: i64,
}

impl MinterAccount {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // minter
        8 +  // total_escrows_created
        8 +  // total_rewards_locked
        8 +  // total_rewards_claimed
        8;   // created_at
}

#[account]
#[derive(InitSpace)]
pub struct DistributorAccount {
    pub distributor: Pubkey,
    pub total_tokens_burned: u64,
    pub total_rewards_redeemed: u64,
    pub created_at: i64,
}

impl DistributorAccount {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // distributor
        8 +  // total_tokens_burned
        8 +  // total_rewards_redeemed
        8;   // created_at
}

#[account]
#[derive(InitSpace)]
pub struct RewardWallets {
    pub wallets: [Pubkey; 5],
    pub current_index: u8,
    pub total_rotations: u64,
}

impl RewardWallets {
    pub const INIT_SPACE: usize = 8 + // discriminator
        (32 * 5) + // wallets array
        1 +        // current_index
        8;         // total_rotations
    
    pub fn get_next_wallet(&mut self) -> Pubkey {
        let wallet = self.wallets[self.current_index as usize];
        self.current_index = (self.current_index + 1) % 5;
        self.total_rotations += 1;
        wallet
    }
}
