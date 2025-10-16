use anchor_lang::prelude::*;

#[error_code]
pub enum FluterByError {
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    
    #[msg("Insufficient funds for distribution")]
    InsufficientFunds,
    
    #[msg("Invalid escrow wallet index")]
    InvalidEscrowWalletIndex,
    
    #[msg("Escrow has expired")]
    EscrowExpired,
    
    #[msg("Escrow not found")]
    EscrowNotFound,
    
    #[msg("Unauthorized minter")]
    UnauthorizedMinter,
    
    #[msg("Token burn amount exceeds balance")]
    InsufficientTokenBalance,
    
    #[msg("Distribution calculation overflow")]
    DistributionCalculationOverflow,
    
    #[msg("Invalid distribution amount")]
    InvalidDistributionAmount,
    
    #[msg("Escrow has not expired yet")]
    EscrowNotExpired,
}