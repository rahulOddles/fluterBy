use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::error::FluterByError;

#[derive(Accounts)]
#[instruction(token: Pubkey, wallet_index: u8)]
pub struct InitializeEscrowWallet<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// The reward token mint
    pub reward_token_mint: Account<'info, Mint>,
    
    /// The escrow lock account (must exist as authority)
    #[account(
        seeds = [b"escrow_lock", token.as_ref(), minter.key().as_ref()],
        bump
    )]
    /// CHECK: This is the PDA that will be the authority
    pub escrow_lock_account: UncheckedAccount<'info>,
    
    /// Escrow wallet - PDA-owned token account
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

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct LockFunds<'info> {
    #[account(
        init,
        payer = minter,
        space = 8 + EscrowLockAccount::INIT_SPACE,
        seeds = [b"escrow_lock", token.as_ref(), minter.key().as_ref()],
        bump
    )]
    pub escrow_lock_account: Account<'info, EscrowLockAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// The reward token mint
    pub reward_token_mint: Account<'info, Mint>,
    
    /// Minter's reward token account (source of funds)
    #[account(
        mut,
        constraint = minter_reward_account.owner == minter.key(),
        constraint = minter_reward_account.mint == reward_token_mint.key()
    )]
    pub minter_reward_account: Account<'info, TokenAccount>,
    
    /// Escrow wallet 1 - must be pre-created
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[1]],
        bump,
    )]
    pub escrow_wallet_1: Account<'info, TokenAccount>,
    
    /// Escrow wallet 2 - must be pre-created
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[2]],
        bump,
    )]
    pub escrow_wallet_2: Account<'info, TokenAccount>,
    
    /// Escrow wallet 3 - must be pre-created
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[3]],
        bump,
    )]
    pub escrow_wallet_3: Account<'info, TokenAccount>,
    
    /// Escrow wallet 4 - must be pre-created
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[4]],
        bump,
    )]
    pub escrow_wallet_4: Account<'info, TokenAccount>,
    
    /// Escrow wallet 5 - must be pre-created
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.as_ref(), minter.key().as_ref(), &[5]],
        bump,
    )]
    pub escrow_wallet_5: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedeemRewards<'info> {
    #[account(
        mut,
        seeds = [b"escrow_lock", token.key().as_ref(), escrow_lock_account.minter.key().as_ref()],
        bump
    )]
    pub escrow_lock_account: Account<'info, EscrowLockAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the main token (to be burned)
    pub token: UncheckedAccount<'info>,
    
    /// The main token mint account
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    
    /// User's token account (holds main tokens to burn)
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == token.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the reward token
    pub reward_token: UncheckedAccount<'info>,
    
    /// User's reward token account (receives rewards)
    #[account(
        mut,
        constraint = user_reward_account.owner == user.key(),
        constraint = user_reward_account.mint == reward_token.key()
    )]
    pub user_reward_account: Account<'info, TokenAccount>,
    
    /// Escrow wallet 1 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), escrow_lock_account.minter.key().as_ref(), &[1]],
        bump,
    )]
    pub escrow_wallet_1: Account<'info, TokenAccount>,
    
    /// Escrow wallet 2 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), escrow_lock_account.minter.key().as_ref(), &[2]],
        bump,
    )]
    pub escrow_wallet_2: Account<'info, TokenAccount>,
    
    /// Escrow wallet 3 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), escrow_lock_account.minter.key().as_ref(), &[3]],
        bump,
    )]
    pub escrow_wallet_3: Account<'info, TokenAccount>,
    
    /// Escrow wallet 4 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), escrow_lock_account.minter.key().as_ref(), &[4]],
        bump,
    )]
    pub escrow_wallet_4: Account<'info, TokenAccount>,
    
    /// Escrow wallet 5 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), escrow_lock_account.minter.key().as_ref(), &[5]],
        bump,
    )]
    pub escrow_wallet_5: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawExpiredRewards<'info> {
    #[account(
        mut,
        seeds = [b"escrow_lock", token.key().as_ref(), minter.key().as_ref()],
        bump,
        constraint = escrow_lock_account.minter == minter.key() @ FluterByError::UnauthorizedMinter
    )]
    pub escrow_lock_account: Account<'info, EscrowLockAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    /// CHECK: This is the main token
    pub token: UncheckedAccount<'info>,
    
    /// The reward token mint
    pub reward_token_mint: Account<'info, Mint>,
    
    /// Minter's reward token account (receives remaining rewards)
    #[account(
        mut,
        constraint = minter_reward_account.owner == minter.key(),
        constraint = minter_reward_account.mint == reward_token_mint.key()
    )]
    pub minter_reward_account: Account<'info, TokenAccount>,
    
    /// Escrow wallet 1 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[1]],
        bump,
    )]
    pub escrow_wallet_1: Account<'info, TokenAccount>,
    
    /// Escrow wallet 2 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[2]],
        bump,
    )]
    pub escrow_wallet_2: Account<'info, TokenAccount>,
    
    /// Escrow wallet 3 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[3]],
        bump,
    )]
    pub escrow_wallet_3: Account<'info, TokenAccount>,
    
    /// Escrow wallet 4 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[4]],
        bump,
    )]
    pub escrow_wallet_4: Account<'info, TokenAccount>,
    
    /// Escrow wallet 5 - PDA-owned token account
    #[account(
        mut,
        seeds = [b"escrow_wallet", token.key().as_ref(), minter.key().as_ref(), &[5]],
        bump,
    )]
    pub escrow_wallet_5: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowLockAccount {
    pub token: Pubkey,              // Main token (users hold this)
    pub reward_token: Pubkey,       // Reward token (locked in escrow)
    pub minter: Pubkey,
    pub total_reward_value: u64,    // Total reward tokens locked
    pub remaining_reward_value: u64, // Remaining reward tokens
    pub reward_per_wallet: u64,     // Reward tokens per wallet
    pub total_token_supply: u64,    // Total supply of main token
    pub escrow_wallets: [Pubkey; 5],
    pub expires_at: i64,
    pub created_at: i64,
    pub is_active: bool,
}

impl EscrowLockAccount {
    pub const INIT_SPACE: usize = 8 + // discriminator
        32 + // token
        32 + // reward_token
        32 + // minter
        8 +  // total_reward_value
        8 +  // remaining_reward_value
        8 +  // reward_per_wallet
        8 +  // total_token_supply
        (32 * 5) + // escrow_wallets array (5 wallets)
        8 +  // expires_at
        8 +  // created_at
        1;   // is_active
}
