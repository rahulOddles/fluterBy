use anchor_lang::prelude::*;
pub mod error;
pub mod instructions;
pub mod state;
pub mod events;

pub use events::*;
pub use state::*;
pub use error::*;

declare_id!("8zsKxbVSrBUUYWDdSxkNAjS1SL4a4yR7yy7TZBH6qS1d");

#[program]
pub mod fluter_by {
    use super::*;

    /// Initialize a single escrow wallet (call 5 times for wallets 1-5)
    /// 
    /// This creates one of the 5 PDA-owned token accounts used to hold reward tokens.
    /// Must be called before lock_funds.
    /// 
    /// # Arguments
    /// * `token` - Main token pubkey (for PDA derivation)
    /// * `wallet_index` - Index 1-5 for which wallet to create
    pub fn initialize_escrow_wallet(
        ctx: Context<InitializeEscrowWallet>,
        token: Pubkey,
        wallet_index: u8,
    ) -> Result<()> {
        instructions::initialize_escrow_wallet(ctx, token, wallet_index)
    }

    /// Lock reward tokens in escrow for a main token
    /// 
    /// # Arguments
    /// * `token` - Main token that users hold
    /// * `reward_token` - Reward token locked in escrow (e.g., USDC)
    /// * `minter` - The minter who is locking the rewards
    /// * `reward_value` - Total reward value to lock (distributed equally across 5 wallets)
    /// * `token_supply` - Total supply of the main token
    /// * `expiry` - Unix timestamp when the lock expires
    pub fn lock_funds(
        ctx: Context<LockFunds>,
        token: Pubkey,
        reward_token: Pubkey,
        minter: Pubkey,
        reward_value: u64,
        token_supply: u64,
        expiry: i64,
    ) -> Result<()> {
        instructions::lock_funds(ctx, token, reward_token, minter, reward_value, token_supply, expiry)
    }

    /// Redeem rewards by burning main tokens
    /// 
    /// Users burn their main tokens to receive proportional rewards
    /// Rewards are calculated based on: (burn_amount / total_supply) * remaining_rewards
    /// The escrow must not be expired for redemption to work
    /// 
    /// # Arguments
    /// * `burn_amount` - Amount of main tokens to burn
    pub fn redeem_rewards(
        ctx: Context<RedeemRewards>,
        burn_amount: u64,
    ) -> Result<()> {
        instructions::redeem_rewards(ctx, burn_amount)
    }

    /// Withdraw all remaining rewards after escrow expiry
    /// 
    /// Only the minter can call this instruction, and only after the expiry time has passed.
    /// This withdraws all remaining reward tokens from the 5 escrow wallets back to the minter.
    /// The escrow account is marked as inactive after withdrawal.
    pub fn withdraw_expired_rewards(
        ctx: Context<WithdrawExpiredRewards>,
    ) -> Result<()> {
        instructions::withdraw_expired_rewards(ctx)
    }
}
