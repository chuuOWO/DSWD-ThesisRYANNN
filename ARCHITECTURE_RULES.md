# DSWD Disaster Relief Supply Chain System Architecture Rules

This document defines the mandatory architectural rules, accounting invariants, blockchain execution standards, and database conventions for the DSWD Field Office VI Disaster Relief Supply Chain platform. All contributors and coding agents must strictly adhere to these rules.

---

## 1. Core System Invariants

### 1.1 Zero Emoji Policy
- Strictly zero emojis across the entire project: no emojis in source code, TypeScript/TSX comments, SQL scripts, Git commit messages, logs, documentation, or chat responses.

### 1.2 Dual-Rail Logistics Accounting
- **Incoming Goods (Warehouse & LGU Intake)**: Strictly off-chain and database-driven. Zero blockchain minting, zero ERC-1155 tokens, and zero on-chain transactions on incoming goods.
- **Outgoing Releases (Relief Dispatches)**: Blockchain tokenization and smart contract custody verification live strictly on Outgoing dispatches.
- **Disaster Aid vs. Buffer Stock**: Outgoing dispatches to LGUs are relief aid distributed to disaster victims. They must never be credited to LGU buffer stockpiles in inventory monitoring.
- **Direct Intake to LGUs**: Mutual aid or direct supplier deliveries received by an LGU add to that LGU local buffer stockpile only after physical verification (`status === 'Verified'`).

### 1.3 Zero MetaMask / Gasless Relayer Architecture
- Field workers, truckers, LGU receivers, and regional administrators must never be prompted with MetaMask or browser wallet extension popups.
- All on-chain transactions are signed and broadcast in the background by the automated relayer wallet using `VITE_SEPOLIA_RELAYER_PRIVATE_KEY` configured in `.env`.
- Account Abstraction (ERC-4337) and the Alchemy Gas Manager sponsor transaction fees.
- Role-Based Access Control (RBAC) is enforced through authenticated Supabase user sessions and profile roles (`dswd_admin`, `receiver`), not through client wallet extension connections.

---

## 2. Module Specifications & Pipelines

### 2.1 Incoming Goods Pipeline (`IncomingModule.tsx`)
- **Allowed Statuses**: `Draft` -> `Pending Verification` -> `Verified & Stocked`.
- **Status Value**: The terminal verified status in the database is `'Verified'`. The UI displays `'Verified & Stocked'`. Statuses such as `'Minted'` are strictly prohibited.
- **Stock Timing**: Warehouse inventory is credited strictly upon physical verification (`verifyIncomingReceipt`), never upon initial draft creation or pending submission.

### 2.2 Outgoing Releases Pipeline (`OutgoingModule.tsx`)
- **Allowed Statuses**: `Draft` / `Allocating` -> `Approved` -> `In Transit` / `Driver Handover` -> `Delivered` / `Accepted`.
- **Relational Integrity**: Every outgoing release must resolve and populate a valid `lgu_id` matching `public.lgus(id)` before insertion.
- **Deduction Invariant**: Warehouse stock deduction occurs strictly once upon administrative approval (`approveAllocation`), exactly when the batch token is minted on-chain. Stock must not be pre-deducted on draft release creation.
- **On-Chain Tokenization**:
  - `mintBatchToken` runs on `DSWDReliefTracker.sol` via the automated relayer.
  - Generates a batch token ID in the format `BATCH-YYYY-MMDD-##########`.
  - Links the on-chain transaction hash (`tx_hash`) and batch ID to the release record.

### 2.3 Inventory Monitoring Engine (`InventoryMonitoring.tsx`)
- **Warehouse Stock Aggregation**: Total warehouse stock must be calculated dynamically across all registered regional facilities rather than hardcoded to a single warehouse.
- **LGU Stock Isolation**: Accepted outgoing releases represent aid consumed by disaster-affected families; they must never be added to LGU buffer stock counts.
- **Batch Expiration Watchlist**: Batches must qualify for the watchlist using `'Verified'` status.

### 2.4 LGU Stock & Priority Monitoring (`LGUMonitoring.tsx`, `LGUReceiverPage.tsx`)
- **Authoritative Stock Store**: `public.lgu_stock` is the primary source of truth for LGU inventory.
- **Kit Breakdown**: The LGU Receiver interface reads quantities per kit category from `lgu_stock` rather than legacy monolithic columns.
- **Cumulative Stock Preservation**: When adding or deducting stock for a specific kit type in an LGU, existing stock counts for other kits must be preserved from the latest report or `lgu_stock` baseline.
- **Priority Sync**: Every LGU stock adjustment must recalculate urgency scores, priority indicators (`Red`, `Yellow`, `Green`), and append a full snapshot row to `public.lgu_inventory_reports`.
- **Graceful Fallback**: Schema updates must defensively update `public.lgus` without failing if specific kit columns do not exist.

---

## 3. Database & API Conventions (`backendApi.ts`, `supabase.ts`)

### 3.1 Kit Name Matching
- All kit name matching must be bi-directional and substring-resilient via `resolveKitTypeId`.
- `'Food Pack'`, `'Family Food Pack'`, and `'FFP'` must resolve deterministically to the canonical `Family Food Pack` kit type UUID.

### 3.2 Audit Ledger Logging
- Every inventory change (intake, allocation, mutual aid transfer, receipt confirmation) must insert an immutable audit record into `public.stock_ledger`:
  - `INTAKE_VERIFIED`: Physical intake at warehouse or LGU.
  - `RELEASE_DISPATCHED`: Deduction on approved outgoing dispatch.
  - `MUTUAL_AID_OUT` / `MUTUAL_AID_IN`: Cross-facility transfers.

### 3.3 Foreign Key Validation
- Foreign keys (`lgu_id`, `warehouse_id`, `truck_id`, `kit_type_id`) must be validated against their respective tables prior to mutation.
- Default profile assignments must verify that assigned truck IDs exist in `public.trucks` before persisting.

### 3.4 Multi-Runtime Environment Support
- `src/app/lib/supabase.ts` must safely resolve environment variables in both Vite browser runtime (`import.meta.env`) and Node CLI execution (`process.env`).

---

## 4. Smart Contract & Cryptography Rules

### 4.1 Deployment Reference
- **Contract**: `DSWDReliefTracker.sol` (ERC-1155 Multi-Token).
- **Target Network**: Ethereum Sepolia Testnet (Chain ID: `11155111`).
- **Contract Address**: `0xCde64aBedE22F9842F5678Fe4cd84781960863eC`.

### 4.2 Custody Multi-Hop Protocol
- **Hop 1 (Warehouse to Driver)**: Driver confirms physical loading; driver wallet address, timestamp, and device GPS are appended.
- **Hop 2 (Driver to LGU Receiver)**: LGU receiver confirms delivery; receiver wallet address, timestamp, and device GPS are appended.
- All hops update the on-chain custody array and synchronize coordinates to `truck_live_locations` and `outgoing_requests`.

---

## 5. Development & Git Workflow

### 5.1 Git Commit Authorization
- Never run `git commit` or `git push` without explicit user permission.
- All commit messages must be clear, conventional, and free of emojis.

### 5.2 Verification Before Pushing
- Before committing, verify code integrity:
  - Run the test suite: `npx tsx --env-file=.env C:/Users/miaqu/.gemini/antigravity/brain/c24b4e7d-1c4c-4690-ba38-6e18679d2fbc/scratch/verify_part1.ts`
  - Ensure zero TypeScript/build regressions: `npm run build`

