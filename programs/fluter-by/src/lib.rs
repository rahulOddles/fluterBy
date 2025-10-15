use anchor_lang::prelude::*;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod events;

pub use instructions::*;
pub use events::*;

declare_id!("FFdPdCrYqKohNP2wsN3peB8YLpwndz3qaoqRAoRozSRm");

#[program]
pub mod fluter_by {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
