use anchor_lang::prelude::*;

#[error_code]
pub enum FluterByError {
    #[msg("Escrow has expired")]
    EscrowExpired,
    
    #[msg("Escrow has not expired yet")]
    EscrowNotExpired,
    
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
    
    #[msg("Invalid reward asset type")]
    InvalidRewardAsset,
    
    #[msg("Unauthorized minter")]
    UnauthorizedMinter,
    
    #[msg("Invalid escrow wallet index")]
    InvalidEscrowWalletIndex,
    
    #[msg("Token burn amount exceeds balance")]
    InsufficientTokenBalance,
    
    #[msg("Escrow account not found")]
    EscrowNotFound,
    
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    
    #[msg("Reward calculation overflow")]
    RewardCalculationOverflow,
    
    #[msg("Escrow wallet rotation error")]
    EscrowWalletRotationError,
}
