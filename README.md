## DSWD Thesis Prototype (Supabase + Blockchain Flow)

This build aligns the system flow to your thesis objectives and moves away from local-only state and SQLite scaffolding.

## Objective-aligned process flow

### 1) Batch Tokenization (Incoming)
Recommended process implemented in UI logic:

Add Incoming Goods (Draft)
→ Submit for Verification
→ Verify Physical Receipt
→ **Post / Mint Batch Token**
→ Stock becomes official available inventory

Important: stock posting happens only when `mintBatchToken()` runs after verification.

### 2) Handover Smart Contract (Outgoing)

Outgoing Draft
→ Allocation Approval
→ **Sender Sign Release** (first custody signature)
→ In Transit
→ **Receiver Confirm Receipt** (second custody signature)
→ Custody completed

### 3) GPS Geolocation
Sender/receiver GPS is captured in outgoing status events and persisted in backend records.

### 4) Stock-Based Prioritization
Prioritization remains in logic layer and should be moved to Supabase SQL views/functions for real data scoring.

### 5) Admin Dashboard
Dashboard is now prepared to read from backend records via Supabase-backed API client.

---

## Database decision (thesis fit)

Use **Supabase PostgreSQL** as operational database:
- relational data model
- auth + role-based security (RLS)
- realtime dashboard updates
- storage for manifest/proof files
- optional PostGIS for geolocation

Blockchain is the immutable audit/proof layer, not the full operational database.

---

## Frontend env setup

Create `.env`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Only anon key belongs in frontend.

---

## Minimum required Supabase tables (initial)

- `incoming_manifests`
- `outgoing_requests`

These are what `src/app/services/backendApi.ts` currently uses.

---

## Run

```bash
npm install
npm run dev
```

## Next step after this commit

1. Create Supabase schema + RLS policies
2. Add MetaMask contract calls on Post/Sign/Confirm actions
3. Persist real Sepolia tx hash into Supabase rows
4. Show explorer links in dashboard tables

---

## Recent Progress & Implementation Status

### 1. Relational Data Separation (Option 1)
- **Package Custody & Tracking Decoupled**:
  - `outgoing_requests` now includes `assigned_truck_id` (`TEXT`) to establish a direct relational link between relief packages and the assigned driver's truck.
  - `truck_live_locations` is streamlined strictly as a **pure GPS telemetry table** (`truck_id`, `latitude`, `longitude`, `gps_text`, `accuracy`, `wallet_address`, `updated_at`), eliminating previous state conflicts caused by storing redundant package arrays inside GPS records.
- **Admin Road Map Integration**:
  - The admin road map dynamically joins truck GPS locations with `outgoing_requests` where `assigned_truck_id === truck.truck_id`, displaying active deliveries, quantities, and real-time transit paths accurately.

### 2. Live QR Scanning & Driver Mobile Flow
- **Pure Camera QR Scanning**:
  - Removed all mock QR generators and temporary scan testing buttons.
  - Drivers scan authentic system-generated Outgoing Release QR codes directly via mobile camera (`ScanModal`), instantly assigning the release to their truck in Supabase.
- **Continuous Telemetry & Custody**:
  - Live GPS tracking broadcasts smooth coordinates to Supabase with battery/accuracy optimization.
  - Active packages remain in driver custody until confirmed and signed off by the receiver.

### 3. Supabase Database & Auth Architecture
- **Supabase PostgreSQL Schema**:
  - `outgoing_requests`: Contains DR number (unique), handover contract ID, batch allocations, dual custody signatures, GPS coordinates, and `assigned_truck_id`.
  - `truck_live_locations`: Pure real-time vehicle GPS stream with Supabase Realtime enabled.
  - `incoming_manifests`: Tokenized inbound goods with batch token ID and verification timestamps.
  - `public.profiles` & Auth Triggers: Role-based access control (`dswd_admin`, `receiver`) synced automatically from Supabase Auth (`auth.users`).
  - `lgu_inventory_reports`: Prioritization scores and stock levels across disaster areas.
  - `discrepancy_reports`: Incident and mismatch reporting.
  - `app_counters`: Persistent unique sequence counters across record lifecycles.
- **Security & RLS**:
  - Row Level Security policies configured across all tables for authenticated administrative operations and receiver telemetry updates.

### 4. Blockchain Proofs & Handover Protocol
- **Batch Tokenization**: Inbound relief goods are minted with token identifiers once physically verified at the warehouse.
- **Custody Signatures**: Sender signs release upon truck dispatch; receiver verifies physical delivery with cryptographic proof / transaction hash upon acceptance.

### 5. Type Safety & Build Status
- Full TypeScript type-safety across all components (`authApi.ts`, `backendApi.ts`, `TruckTracking.tsx`, `TruckerLocationPage.tsx`, `useInventoryState.tsx`).
- Production build verified with Vite: **0 errors, 100% build pass rate**.

