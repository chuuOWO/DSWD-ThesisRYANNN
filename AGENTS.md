# Agent Instructions & Architecture Guidelines

This repository follows strict architectural rules and design patterns documented in [ARCHITECTURE_RULES.md](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/ARCHITECTURE_RULES.md). Every coding assistant and pair programming agent must strictly follow these instructions.

---

## Non-Negotiable Rules

1. **Zero Emojis**: Strictly no emojis anywhere (code, comments, commit messages, responses).
2. **Dual-Rail Accounting**:
   - Incoming intake is 100% off-chain. No blockchain minting or tokens on incoming goods. Terminal status is `'Verified'`.
   - Outgoing dispatches are tokenized on-chain upon Admin approval via the automated relayer.
   - Outgoing dispatches are emergency aid distributions to disaster victims; never credit them to LGU buffer stock.
3. **No MetaMask**:
   - Do not prompt for MetaMask or browser wallet extensions.
   - All smart contract interactions use the automated background relayer (`VITE_SEPOLIA_RELAYER_PRIVATE_KEY` in `.env`).
4. **Git Safety**:
   - Do not commit or push to Git without explicit user permission.
5. **Code & Documentation Integrity**:
   - Preserve existing documentation, comments, and structure unless explicitly directed otherwise.
   - Use clickable markdown links with `file://` scheme for files and symbols.

For full architectural details, consult [ARCHITECTURE_RULES.md](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/ARCHITECTURE_RULES.md).

