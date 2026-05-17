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
