import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FluterBy } from "../target/types/fluter_by";

describe("fluter-by", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fluterBy as Program<FluterBy>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
