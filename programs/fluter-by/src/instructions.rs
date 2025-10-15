use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Mint, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::error::FluterByError;
use crate::event::*;

pub fn initialize_escrow(
    ctx: Context<InitializeEscrow>,
    reward_asset: RewardAsset,
    total_reward_amount: u64,
    total_token_supply: u64,
    expires_at: i64,
) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;
    let clock = Clock::get()?;
    
    // Initialize escrow account
    escrow_account.mint = ctx.accounts.mint.key();
    escrow_account.minter = ctx.accounts.minter.key();
    escrow_account.reward_asset = reward_asset;
    escrow_account.total_reward_amount = total_reward_amount;
    escrow_account.remaining_reward_amount = total_reward_amount;
    escrow_account.total_token_supply = total_token_supply;
    escrow_account.burned_token_amount = 0;
    escrow_account.escrow_wallet_index = 0; // Will be set during lock_funds
    escrow_account.created_at = clock.unix_timestamp;
    escrow_account.expires_at = expires_at;
    escrow_account.is_active = true;
    
    emit!(EscrowCreated {
        mint: ctx.accounts.mint.key(),
        minter: ctx.accounts.minter.key(),
        reward_asset: reward_asset as u8,
        total_reward_amount,
        total_token_supply,
        escrow_wallet_index: 0,
        expires_at,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn lock_funds(
    ctx: Context<LockFunds>,
    reward_amount: u64,
    escrow_wallet_index: u8,
) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;
    let clock = Clock::get()?;
    
    // Validate escrow wallet index
    require!(
        escrow_wallet_index < 5,
        FluterByError::InvalidEscrowWalletIndex
    );
    
    // Validate reward amount
    require!(
        reward_amount <= escrow_account.total_reward_amount,
        FluterByError::InsufficientFunds
    );
    
    // Update escrow account
    escrow_account.escrow_wallet_index = escrow_wallet_index;
    
    // Transfer funds to escrow (this would be handled by the frontend/backend)
    // The actual transfer logic depends on whether it's SOL or USDC
    
    emit!(FundsLocked {
        mint: escrow_account.mint,
        minter: escrow_account.minter,
        reward_amount,
        escrow_wallet_index,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn redeem_rewards(
    ctx: Context<RedeemRewards>,
    burn_amount: u64,
) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;
    let clock = Clock::get()?;
    
    // Validate escrow is still active and not expired
    require!(
        escrow_account.is_active,
        FluterByError::EscrowNotFound
    );
    
    require!(
        clock.unix_timestamp < escrow_account.expires_at,
        FluterByError::EscrowExpired
    );
    
    // Validate user has enough tokens
    require!(
        burn_amount <= ctx.accounts.user_token_account.amount,
        FluterByError::InsufficientTokenBalance
    );
    
    // Calculate proportional reward
    let reward_amount = (burn_amount as u128)
        .checked_mul(escrow_account.remaining_reward_amount as u128)
        .and_then(|x| x.checked_div(escrow_account.total_token_supply as u128))
        .ok_or(FluterByError::RewardCalculationOverflow)? as u64;
    
    // Validate sufficient funds in escrow
    require!(
        reward_amount <= escrow_account.remaining_reward_amount,
        FluterByError::InsufficientFunds
    );
    
    // Update escrow account
    escrow_account.burned_token_amount = escrow_account.burned_token_amount
        .checked_add(burn_amount)
        .ok_or(FluterByError::RewardCalculationOverflow)?;
    
    escrow_account.remaining_reward_amount = escrow_account.remaining_reward_amount
        .checked_sub(reward_amount)
        .ok_or(FluterByError::RewardCalculationOverflow)?;
    
    // Burn tokens (this would be handled by the frontend/backend)
    // The actual burn logic depends on the token program
    
    // Transfer rewards to user (this would be handled by the frontend/backend)
    // The actual transfer logic depends on whether it's SOL or USDC
    
    emit!(RewardsRedeemed {
        mint: escrow_account.mint,
        user: ctx.accounts.user.key(),
        tokens_burned: burn_amount,
        rewards_redeemed: reward_amount,
        remaining_escrow_amount: escrow_account.remaining_reward_amount,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn claim_remaining_rewards(
    ctx: Context<ClaimRemainingRewards>,
) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;
    let clock = Clock::get()?;
    
    // Validate escrow has expired
    require!(
        clock.unix_timestamp >= escrow_account.expires_at,
        FluterByError::EscrowNotExpired
    );
    
    // Validate minter is authorized
    require!(
        escrow_account.minter == ctx.accounts.minter.key(),
        FluterByError::UnauthorizedMinter
    );
    
    let remaining_amount = escrow_account.remaining_reward_amount;
    
    // Transfer remaining funds to minter (this would be handled by the frontend/backend)
    // The actual transfer logic depends on whether it's SOL or USDC
    
    // Close escrow account
    escrow_account.is_active = false;
    escrow_account.remaining_reward_amount = 0;
    
    emit!(RemainingRewardsClaimed {
        mint: escrow_account.mint,
        minter: escrow_account.minter,
        remaining_amount,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn register_minter(
    ctx: Context<RegisterMinter>,
) -> Result<()> {
    let minter_account = &mut ctx.accounts.minter_account;
    let clock = Clock::get()?;
    
    // Initialize minter account
    minter_account.minter = ctx.accounts.minter.key();
    minter_account.total_escrows_created = 0;
    minter_account.total_rewards_locked = 0;
    minter_account.total_rewards_claimed = 0;
    minter_account.created_at = clock.unix_timestamp;
    
    emit!(MinterRegistered {
        minter: ctx.accounts.minter.key(),
        total_escrows: 0,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn register_distributor(
    ctx: Context<RegisterDistributor>,
) -> Result<()> {
    let distributor_account = &mut ctx.accounts.distributor_account;
    let clock = Clock::get()?;
    
    // Initialize distributor account
    distributor_account.distributor = ctx.accounts.distributor.key();
    distributor_account.total_tokens_burned = 0;
    distributor_account.total_rewards_redeemed = 0;
    distributor_account.created_at = clock.unix_timestamp;
    
    emit!(DistributorRegistered {
        distributor: ctx.accounts.distributor.key(),
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn initialize_reward_wallets(
    ctx: Context<InitializeRewardWallets>,
    wallets: [Pubkey; 5],
) -> Result<()> {
    let reward_wallets = &mut ctx.accounts.reward_wallets;
    let clock = Clock::get()?;
    
    // Initialize reward wallets
    reward_wallets.wallets = wallets;
    reward_wallets.current_index = 0;
    reward_wallets.total_rotations = 0;
    
    emit!(EscrowWalletRotated {
        old_index: 0,
        new_index: 0,
        total_rotations: 0,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

// Additional account structures for registration
#[derive(Accounts)]
pub struct RegisterMinter {
    #[account(
        init,
        payer = minter,
        space = 8 + MinterAccount::INIT_SPACE,
        seeds = [b"minter", minter.key().as_ref()],
        bump
    )]
    pub minter_account: Account<'info, MinterAccount>,
    
    #[account(mut)]
    pub minter: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterDistributor {
    #[account(
        init,
        payer = distributor,
        space = 8 + DistributorAccount::INIT_SPACE,
        seeds = [b"distributor", distributor.key().as_ref()],
        bump
    )]
    pub distributor_account: Account<'info, DistributorAccount>,
    
    #[account(mut)]
    pub distributor: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeRewardWallets {
    #[account(
        init,
        payer = authority,
        space = 8 + RewardWallets::INIT_SPACE,
        seeds = [b"reward_wallets"],
        bump
    )]
    pub reward_wallets: Account<'info, RewardWallets>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
