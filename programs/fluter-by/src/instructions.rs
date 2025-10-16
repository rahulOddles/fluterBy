use anchor_lang::prelude::*;
use anchor_spl::token;
use crate::state::*;
use crate::error::FluterByError;
use crate::events::*;

pub fn initialize_escrow_wallet(
    _ctx: Context<InitializeEscrowWallet>,
    _token: Pubkey,
    wallet_index: u8,
) -> Result<()> {
    msg!("Initialized escrow wallet {}", wallet_index);
    Ok(())
}

pub fn lock_funds(
    ctx: Context<LockFunds>,
    token: Pubkey,
    reward_token: Pubkey,
    minter: Pubkey,
    reward_value: u64,
    token_supply: u64,
    expiry: i64,
) -> Result<()> {
    let escrow_lock_account = &mut ctx.accounts.escrow_lock_account;
    let clock = Clock::get()?;
    
    // Validate reward value is greater than 0
    require!(
        reward_value > 0,
        FluterByError::InvalidDistributionAmount
    );
    
    // Validate token supply is greater than 0
    require!(
        token_supply > 0,
        FluterByError::InvalidDistributionAmount
    );
    
    // Calculate reward per wallet (equal distribution across 5 wallets)
    let reward_per_wallet = reward_value
        .checked_div(5)
        .ok_or(FluterByError::DistributionCalculationOverflow)?;
    
    // Validate that the division is clean (no remainder)
    require!(
        reward_per_wallet * 5 == reward_value,
        FluterByError::InvalidDistributionAmount
    );
    
    // Validate minter matches the signer
    require!(
        minter == ctx.accounts.minter.key(),
        FluterByError::UnauthorizedMinter
    );
    
    // Transfer reward tokens from minter to each of the 5 escrow wallets
    // Each wallet receives reward_per_wallet amount
    msg!("Transferring {} tokens to each of 5 escrow wallets...", reward_per_wallet);
    
    // Transfer to wallet 1
    let cpi_accounts_1 = token::Transfer {
        from: ctx.accounts.minter_reward_account.to_account_info(),
        to: ctx.accounts.escrow_wallet_1.to_account_info(),
        authority: ctx.accounts.minter.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_1 = CpiContext::new(cpi_program.clone(), cpi_accounts_1);
    token::transfer(cpi_ctx_1, reward_per_wallet)?;
    msg!("Transferred {} to wallet 1", reward_per_wallet);
    
    // Transfer to wallet 2
    let cpi_accounts_2 = token::Transfer {
        from: ctx.accounts.minter_reward_account.to_account_info(),
        to: ctx.accounts.escrow_wallet_2.to_account_info(),
        authority: ctx.accounts.minter.to_account_info(),
    };
    let cpi_ctx_2 = CpiContext::new(cpi_program.clone(), cpi_accounts_2);
    token::transfer(cpi_ctx_2, reward_per_wallet)?;
    msg!("Transferred {} to wallet 2", reward_per_wallet);
    
    // Transfer to wallet 3
    let cpi_accounts_3 = token::Transfer {
        from: ctx.accounts.minter_reward_account.to_account_info(),
        to: ctx.accounts.escrow_wallet_3.to_account_info(),
        authority: ctx.accounts.minter.to_account_info(),
    };
    let cpi_ctx_3 = CpiContext::new(cpi_program.clone(), cpi_accounts_3);
    token::transfer(cpi_ctx_3, reward_per_wallet)?;
    msg!("Transferred {} to wallet 3", reward_per_wallet);
    
    // Transfer to wallet 4
    let cpi_accounts_4 = token::Transfer {
        from: ctx.accounts.minter_reward_account.to_account_info(),
        to: ctx.accounts.escrow_wallet_4.to_account_info(),
        authority: ctx.accounts.minter.to_account_info(),
    };
    let cpi_ctx_4 = CpiContext::new(cpi_program.clone(), cpi_accounts_4);
    token::transfer(cpi_ctx_4, reward_per_wallet)?;
    msg!("Transferred {} to wallet 4", reward_per_wallet);
    
    // Transfer to wallet 5
    let cpi_accounts_5 = token::Transfer {
        from: ctx.accounts.minter_reward_account.to_account_info(),
        to: ctx.accounts.escrow_wallet_5.to_account_info(),
        authority: ctx.accounts.minter.to_account_info(),
    };
    let cpi_ctx_5 = CpiContext::new(cpi_program, cpi_accounts_5);
    token::transfer(cpi_ctx_5, reward_per_wallet)?;
    msg!("Transferred {} to wallet 5", reward_per_wallet);
    
    msg!("✅ All reward tokens transferred to escrow wallets!");
    
    // Store the 5 escrow wallet addresses
    let escrow_wallets = [
        ctx.accounts.escrow_wallet_1.key(),
        ctx.accounts.escrow_wallet_2.key(),
        ctx.accounts.escrow_wallet_3.key(),
        ctx.accounts.escrow_wallet_4.key(),
        ctx.accounts.escrow_wallet_5.key(),
    ];
    
    // Initialize escrow lock account
    escrow_lock_account.token = token;
    escrow_lock_account.reward_token = reward_token;
    escrow_lock_account.minter = minter;
    escrow_lock_account.total_reward_value = reward_value;
    escrow_lock_account.remaining_reward_value = reward_value;
    escrow_lock_account.reward_per_wallet = reward_per_wallet;
    escrow_lock_account.total_token_supply = token_supply;
    escrow_lock_account.escrow_wallets = escrow_wallets;
    escrow_lock_account.expires_at = expiry;
    escrow_lock_account.created_at = clock.unix_timestamp;
    escrow_lock_account.is_active = true;
    
    msg!("Token: {}", token);
    msg!("Reward Token: {}", reward_token);
    msg!("Total Reward Value: {}", reward_value);
    msg!("Reward per wallet: {}", reward_per_wallet);
    msg!("Token Supply: {}", token_supply);
    msg!("Distribution across 5 wallets:");
    msg!("  Wallet 1: {}", escrow_wallets[0]);
    msg!("  Wallet 2: {}", escrow_wallets[1]);
    msg!("  Wallet 3: {}", escrow_wallets[2]);
    msg!("  Wallet 4: {}", escrow_wallets[3]);
    msg!("  Wallet 5: {}", escrow_wallets[4]);
    
    emit!(FundsLocked {
        mint: token,
        minter,
        value: reward_value,
        expires_at: expiry,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn redeem_rewards(
    ctx: Context<RedeemRewards>,
    burn_amount: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    
    // Validate escrow is still active
    require!(
        ctx.accounts.escrow_lock_account.is_active,
        FluterByError::EscrowNotFound
    );
    
    // Validate escrow has not expired
    require!(
        clock.unix_timestamp < ctx.accounts.escrow_lock_account.expires_at,
        FluterByError::EscrowExpired
    );
    
    // Validate user has enough tokens to burn
    require!(
        ctx.accounts.user_token_account.amount >= burn_amount,
        FluterByError::InsufficientTokenBalance
    );
    
    // Validate burn amount is greater than 0
    require!(
        burn_amount > 0,
        FluterByError::InvalidDistributionAmount
    );
    
    // Calculate proportional reward based on burned tokens
    // reward = (burn_amount / total_token_supply) * remaining_reward_value
    let reward_amount = (burn_amount as u128)
        .checked_mul(ctx.accounts.escrow_lock_account.remaining_reward_value as u128)
        .and_then(|x| x.checked_div(ctx.accounts.escrow_lock_account.total_token_supply as u128))
        .ok_or(FluterByError::DistributionCalculationOverflow)? as u64;
    
    // Validate there are enough rewards remaining
    require!(
        reward_amount <= ctx.accounts.escrow_lock_account.remaining_reward_value,
        FluterByError::InsufficientFunds
    );
    
    // Burn the user's FLBY tokens
    msg!("Burning {} FLBY tokens...", burn_amount);
    let cpi_accounts_burn = token::Burn {
        mint: ctx.accounts.token_mint.to_account_info(),
        from: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx_burn = CpiContext::new(cpi_program.clone(), cpi_accounts_burn);
    token::burn(cpi_ctx_burn, burn_amount)?;
    msg!("✅ Burned {} FLBY tokens", burn_amount);
    
    // Calculate how much to take from each of the 5 escrow wallets
    // Distribute the withdrawal proportionally from each wallet
    let reward_per_wallet = reward_amount
        .checked_div(5)
        .ok_or(FluterByError::DistributionCalculationOverflow)?;
    
    let remainder = reward_amount % 5;
    
    msg!("Transferring {} reward tokens from 5 escrow wallets to user...", reward_amount);
    msg!("Base amount per wallet: {}, Remainder: {}", reward_per_wallet, remainder);
    
    // Get the PDA signer seeds for authority
    let token_key = ctx.accounts.escrow_lock_account.token;
    let minter_key = ctx.accounts.escrow_lock_account.minter;
    let bump = ctx.bumps.escrow_lock_account;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"escrow_lock",
        token_key.as_ref(),
        minter_key.as_ref(),
        &[bump],
    ]];
    
    // Transfer from escrow wallet 1 (gets extra from remainder if any)
    let amount_1 = if remainder > 0 { reward_per_wallet + 1 } else { reward_per_wallet };
    if amount_1 > 0 {
        let cpi_accounts_1 = token::Transfer {
            from: ctx.accounts.escrow_wallet_1.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_1 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_1, signer_seeds);
        token::transfer(cpi_ctx_1, amount_1)?;
        msg!("Transferred {} from wallet 1", amount_1);
    }
    
    // Transfer from escrow wallet 2 (gets extra from remainder if any)
    let amount_2 = if remainder > 1 { reward_per_wallet + 1 } else { reward_per_wallet };
    if amount_2 > 0 {
        let cpi_accounts_2 = token::Transfer {
            from: ctx.accounts.escrow_wallet_2.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_2 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_2, signer_seeds);
        token::transfer(cpi_ctx_2, amount_2)?;
        msg!("Transferred {} from wallet 2", amount_2);
    }
    
    // Transfer from escrow wallet 3 (gets extra from remainder if any)
    let amount_3 = if remainder > 2 { reward_per_wallet + 1 } else { reward_per_wallet };
    if amount_3 > 0 {
        let cpi_accounts_3 = token::Transfer {
            from: ctx.accounts.escrow_wallet_3.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_3 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_3, signer_seeds);
        token::transfer(cpi_ctx_3, amount_3)?;
        msg!("Transferred {} from wallet 3", amount_3);
    }
    
    // Transfer from escrow wallet 4 (gets extra from remainder if any)
    let amount_4 = if remainder > 3 { reward_per_wallet + 1 } else { reward_per_wallet };
    if amount_4 > 0 {
        let cpi_accounts_4 = token::Transfer {
            from: ctx.accounts.escrow_wallet_4.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_4 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_4, signer_seeds);
        token::transfer(cpi_ctx_4, amount_4)?;
        msg!("Transferred {} from wallet 4", amount_4);
    }
    
    // Transfer from escrow wallet 5
    if reward_per_wallet > 0 {
        let cpi_accounts_5 = token::Transfer {
            from: ctx.accounts.escrow_wallet_5.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_5 = CpiContext::new_with_signer(cpi_program, cpi_accounts_5, signer_seeds);
        token::transfer(cpi_ctx_5, reward_per_wallet)?;
        msg!("Transferred {} from wallet 5", reward_per_wallet);
    }
    
    // Update remaining reward value
    ctx.accounts.escrow_lock_account.remaining_reward_value = ctx.accounts.escrow_lock_account.remaining_reward_value
        .checked_sub(reward_amount)
        .ok_or(FluterByError::DistributionCalculationOverflow)?;
    
    msg!("✅ Redemption complete!");
    msg!("FLBY tokens burned: {}", burn_amount);
    msg!("Reward tokens received: {}", reward_amount);
    msg!("Remaining rewards in escrow: {}", ctx.accounts.escrow_lock_account.remaining_reward_value);
    
    emit!(RewardsRedeemed {
        token: ctx.accounts.escrow_lock_account.token,
        user: ctx.accounts.user.key(),
        tokens_burned: burn_amount,
        rewards_received: reward_amount,
        remaining_rewards: ctx.accounts.escrow_lock_account.remaining_reward_value,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}

pub fn withdraw_expired_rewards(
    ctx: Context<WithdrawExpiredRewards>,
) -> Result<()> {
    let clock = Clock::get()?;
    
    // Validate escrow is still active
    require!(
        ctx.accounts.escrow_lock_account.is_active,
        FluterByError::EscrowNotFound
    );
    
    // Validate escrow HAS expired (opposite of redeem_rewards)
    require!(
        clock.unix_timestamp >= ctx.accounts.escrow_lock_account.expires_at,
        FluterByError::EscrowNotExpired
    );
    
    // Validate caller is the minter
    require!(
        ctx.accounts.escrow_lock_account.minter == ctx.accounts.minter.key(),
        FluterByError::UnauthorizedMinter
    );
    
    let remaining_rewards = ctx.accounts.escrow_lock_account.remaining_reward_value;
    
    // Check if there are any rewards left to withdraw
    require!(
        remaining_rewards > 0,
        FluterByError::InsufficientFunds
    );
    
    msg!("🔓 Escrow has expired. Minter withdrawing remaining rewards...");
    msg!("Remaining rewards to withdraw: {}", remaining_rewards);
    
    // Get the PDA signer seeds for authority
    let token_key = ctx.accounts.escrow_lock_account.token;
    let minter_key = ctx.accounts.escrow_lock_account.minter;
    let bump = ctx.bumps.escrow_lock_account;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"escrow_lock",
        token_key.as_ref(),
        minter_key.as_ref(),
        &[bump],
    ]];
    
    // Get current balance from each escrow wallet and transfer all to minter
    let wallet_1_balance = ctx.accounts.escrow_wallet_1.amount;
    let wallet_2_balance = ctx.accounts.escrow_wallet_2.amount;
    let wallet_3_balance = ctx.accounts.escrow_wallet_3.amount;
    let wallet_4_balance = ctx.accounts.escrow_wallet_4.amount;
    let wallet_5_balance = ctx.accounts.escrow_wallet_5.amount;
    
    let total_to_withdraw = wallet_1_balance + wallet_2_balance + wallet_3_balance + 
                            wallet_4_balance + wallet_5_balance;
    
    msg!("Total rewards in escrow wallets: {}", total_to_withdraw);
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    
    // Transfer all funds from wallet 1
    if wallet_1_balance > 0 {
        let cpi_accounts_1 = token::Transfer {
            from: ctx.accounts.escrow_wallet_1.to_account_info(),
            to: ctx.accounts.minter_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_1 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_1, signer_seeds);
        token::transfer(cpi_ctx_1, wallet_1_balance)?;
        msg!("Transferred {} from wallet 1", wallet_1_balance);
    }
    
    // Transfer all funds from wallet 2
    if wallet_2_balance > 0 {
        let cpi_accounts_2 = token::Transfer {
            from: ctx.accounts.escrow_wallet_2.to_account_info(),
            to: ctx.accounts.minter_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_2 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_2, signer_seeds);
        token::transfer(cpi_ctx_2, wallet_2_balance)?;
        msg!("Transferred {} from wallet 2", wallet_2_balance);
    }
    
    // Transfer all funds from wallet 3
    if wallet_3_balance > 0 {
        let cpi_accounts_3 = token::Transfer {
            from: ctx.accounts.escrow_wallet_3.to_account_info(),
            to: ctx.accounts.minter_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_3 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_3, signer_seeds);
        token::transfer(cpi_ctx_3, wallet_3_balance)?;
        msg!("Transferred {} from wallet 3", wallet_3_balance);
    }
    
    // Transfer all funds from wallet 4
    if wallet_4_balance > 0 {
        let cpi_accounts_4 = token::Transfer {
            from: ctx.accounts.escrow_wallet_4.to_account_info(),
            to: ctx.accounts.minter_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_4 = CpiContext::new_with_signer(cpi_program.clone(), cpi_accounts_4, signer_seeds);
        token::transfer(cpi_ctx_4, wallet_4_balance)?;
        msg!("Transferred {} from wallet 4", wallet_4_balance);
    }
    
    // Transfer all funds from wallet 5
    if wallet_5_balance > 0 {
        let cpi_accounts_5 = token::Transfer {
            from: ctx.accounts.escrow_wallet_5.to_account_info(),
            to: ctx.accounts.minter_reward_account.to_account_info(),
            authority: ctx.accounts.escrow_lock_account.to_account_info(),
        };
        let cpi_ctx_5 = CpiContext::new_with_signer(cpi_program, cpi_accounts_5, signer_seeds);
        token::transfer(cpi_ctx_5, wallet_5_balance)?;
        msg!("Transferred {} from wallet 5", wallet_5_balance);
    }
    
    // Mark escrow as inactive
    ctx.accounts.escrow_lock_account.is_active = false;
    ctx.accounts.escrow_lock_account.remaining_reward_value = 0;
    
    msg!("✅ Withdrawal complete! Escrow closed.");
    msg!("Total withdrawn: {}", total_to_withdraw);
    msg!("Minter received all remaining rewards.");
    
    emit!(ExpiredRewardsWithdrawn {
        token: ctx.accounts.escrow_lock_account.token,
        minter: ctx.accounts.escrow_lock_account.minter,
        amount_withdrawn: total_to_withdraw,
        timestamp: clock.unix_timestamp,
    });
    
    Ok(())
}
