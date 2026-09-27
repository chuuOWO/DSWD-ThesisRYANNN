# DSWD Blockchain-Backed Relief Operations & Supply Chain Tracker

A hybrid decentralized supply chain monitoring and chain-of-custody tracking platform developed for the **Department of Social Welfare and Development (DSWD) Region VI (Western Visayas - Panay Island)**.

This system integrates **Supabase Cloud PostgreSQL**, **Ethereum (Sepolia Testnet) Smart Contracts**, **Leaflet Real-Road Fleet Mapping**, **W3C Geolocation**, and **MetaMask Cryptographic Handshakes** to eliminate ghost deliveries, inventory tampering, and unauthorized municipal rerouting.

---

## Table of Contents
1. [Simplified Version (High-Level Overview)](#1-simplified-version-high-level-overview)
   - [The Core Problem & Solution](#the-core-problem--solution)
   - [The 3-Step Relief Lifecycle](#the-3-step-relief-lifecycle)
   - [User Roles & Permissions](#user-roles--permissions)
2. [Detailed Technical Version (How the Whole Code Works)](#2-detailed-technical-version-how-the-whole-code-works)
   - [Architecture & Tech Stack](#architecture--tech-stack)
   - [Repository Folder Structure](#repository-folder-structure)
   - [Module-by-Module Code Breakdown](#module-by-module-code-breakdown)
   - [Core Security & Operational Mechanisms](#core-security--operational-mechanisms)
3. [Smart Contract & Blockchain Architecture](#3-smart-contract--blockchain-architecture)
4. [Database Schema (Supabase PostgreSQL)](#4-database-schema-supabase-postgresql)
5. [Deployment & Why Ngrok is Not Needed](#5-deployment--why-ngrok-is-not-needed)
6. [Getting Started & Local Development](#6-getting-started--local-development)

---

# 1. Simplified Version (High-Level Overview)

### The Core Problem & Solution
During natural disasters (typhoons, floods, earthquakes) across Panay Island, thousands of family food packs and non-food relief items (FNFIs) are dispatched from regional warehouses in **Oton** and **Pototan** to local municipalities. Traditional paper delivery receipts and phone calls often result in:
- Unverified arrivals and disputes over missing relief goods.
- Drivers rerouting or delivering to unintended locations.
- Lack of real-time visibility on shipment progress.
- Unofficial personnel claiming or signing for municipal shipments.

**Our Solution:** A tamper-proof, transparent web system where:
1. Every batch of goods received at the warehouse is minted as an immutable blockchain batch.
2. Shipments travel with live GPS tracking following real Panay highway networks.
3. Local Government Unit (LGU) receivers scan an encrypted QR code and sign for delivery using their registered **MetaMask wallet** and **GPS location**.
4. The blockchain cryptographically seals the transaction—no record can ever be deleted, altered, or forged.

---

### The 3-Step Relief Lifecycle

```
[ STEP 1: INCOMING ]
Warehouse receives goods from VDRC/LDRC -> DSWD Admin verifies physical count -> 
Batch Token Minted on Blockchain -> Added to regional stock (in kits)

               |
               v

[ STEP 2: OUTGOING DISPATCH ]
Panay LGU submits emergency request -> Priority scoring ranks urgency -> 
DSWD Admin approves allocation -> Central Admin cryptographically signs release -> 
Scannable Delivery Receipt (DR) QR Code generated -> Truck loaded & dispatched

               |
               v

[ STEP 3: LIVE TRANSIT & HANDOVER ]
Truck travels across Panay highways -> Live GPS streams to central monitoring map -> 
LGU Receiver inspects package & scans QR code -> Receiver's MetaMask signs transaction -> 
Smart contract verifies registered wallet + GPS boundary -> Custody permanently sealed
```

---

### User Roles & Permissions

| Role | Interface | Responsibilities | Security Controls |
| :--- | :--- | :--- | :--- |
| **DSWD Central Admin** | Desktop Dashboard | Oversees regional stock, approves releases, views live map, manages accounts, and assigns LGUs. | Full administrative rights; signs initial blockchain release; strictly controls LGU assignment. |
| **Field Receiver (Driver / Trucker)** | Mobile / Desktop | Scans assigned delivery, streams GPS coordinates along transit corridors, transports goods. | Bound to specific vehicle/delivery; cannot alter destination or modify stock counts. |
| **LGU Receiver** | Mobile Receiver View | Inspects incoming shipment at municipal hall, verifies batch contents, confirms handover. | **Strictly locked to admin-assigned municipality**; must sign with registered MetaMask wallet. |

---

# 2. Detailed Technical Version (How the Whole Code Works)

## Architecture & Tech Stack

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  React 18  *  TypeScript  *  Tailwind CSS v4  *  Lucide Icons  *  Leaflet Maps     |
+---------------------------------------+-------------------------------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
+----------------------------------+        +---------------------------------------+
|        SUPABASE CLOUD            |        |      ETHEREUM (SEPOLIA TESTNET)       |
|  - PostgreSQL Database           |        |  - DSWDReliefTracker.sol              |
|  - Auth (JWT Sessions & RLS)     |        |  - Ethers.js v6 Smart Contract Client  |
|  - Realtime WebSockets           |        |  - MetaMask Signer & Nonce Checks     |
|  - Storage (Manifests / Hashes)  |        |  - Immutable Chain-of-Custody Hashes  |
+----------------------------------+        +---------------------------------------+
```

- **Frontend Core:** Vite 6, React 18, TypeScript, Tailwind CSS v4.
- **Mapping & Geolocation:** Leaflet, React-Leaflet, OpenStreetMap, OSRM Highway Routing, W3C HTML5 Geolocation API.
- **Blockchain Layer:** Solidity `^0.8.20`, Ethers.js v6, Alchemy Sepolia RPC, MetaMask Browser Extension / Mobile App.
- **Operational Backend:** Supabase PostgreSQL, Supabase Realtime Channels, Supabase Auth.
- **Hosting & CI/CD:** GitHub Pages (Automated via GitHub Actions), zero ngrok dependency.

---

## Repository Folder Structure

The application source code is cleanly decoupled under `src/app/components/` into structured functional domains:

```
src/
├── app/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthPage.tsx            # Split-screen responsive login/signup with wallet binding
│   │   ├── design/
│   │   │   ├── FiveDotsLoadingModal.tsx # Minimalist 5-dot pulse loading state
│   │   │   └── LocationPickerMap.tsx    # Interactive map pin dropper for warehouse coordinates
│   │   ├── layout/
│   │   │   ├── Header.tsx               # Top navigation bar, wallet status pill, and profile trigger
│   │   │   └── Sidebar.tsx              # Sidebar navigation for admin operations
│   │   ├── modals/
│   │   │   ├── AddIncomingGoodsModal.tsx# Form for logging incoming goods (locked strictly to kits)
│   │   │   ├── AddReleaseModal.tsx      # Outgoing dispatch modal with Direct Delivery support
│   │   │   ├── AddLGUModal.tsx          # Administrator modal for registering new Panay LGUs
│   │   │   ├── EditLGUModal.tsx         # Modal for updating municipality parameters & contacts
│   │   │   ├── QrCodeGeneratorModal.tsx # Scannable manifest QR generator with blockchain hash
│   │   │   ├── ProfileSettingsModal.tsx # User profile settings and MetaMask wallet binding
│   │   │   ├── ConfirmLogoutModal.tsx   # Safe session signout confirmation dialog
│   │   │   └── MetaMaskMismatchModal.tsx# Fullscreen security lock when active wallet doesn't match
│   │   ├── views/
│   │   │   ├── DashboardView.tsx        # Central executive metrics, stock summaries, and alerts
│   │   │   ├── IncomingModule.tsx       # Warehouse inflow verification and token minting
│   │   │   ├── OutgoingModule.tsx       # Outgoing dispatch queues, approvals, and release signatures
│   │   │   ├── InventoryMonitoring.tsx  # Warehouse stock levels, thresholds, and priority scoring
│   │   │   ├── LGUMonitoring.tsx        # 93 Panay municipalities status, relief aid quotas, and logs
│   │   │   ├── TruckTracking.tsx        # Live road-snapped GPS tracking across Panay Island
│   │   │   ├── AccountManagement.tsx    # Admin user management and role/municipality assignment
│   │   │   ├── ReceiverPage.tsx         # Mobile field receiver handover interface
│   │   │   └── LGUReceiverPage.tsx      # Mobile municipal receiver acceptance & GPS scan interface
│   │   └── index.ts                     # Central barrel export for all UI components
│   ├── contexts/
│   │   └── AuthContext.tsx              # Supabase session provider and authentication listener
│   ├── data/
│   │   └── panayLguDirectory.ts         # Complete directory of 93 Panay LGUs with GPS coordinates
│   ├── hooks/
│   │   └── useInventoryState.tsx        # Central business logic, inventory math, and state coordination
│   ├── lib/
│   │   ├── supabase.ts                  # Supabase client singleton
│   │   └── lguCoordinates.ts            # Panay geospatial centroid definitions
│   ├── services/
│   │   ├── authApi.ts                   # Supabase authentication and user profile management
│   │   ├── backendApi.ts                # PostgreSQL CRUD and Realtime WebSocket channel sync
│   │   └── blockchain.ts                # Ethers.js client, contract interface, and wallet verification
│   ├── App.tsx                          # Primary router, layout shell, and mismatch modal mount
│   └── main.tsx                         # React 18 DOM mount and entry point
├── contracts/
│   ├── DSWDReliefTracker.sol            # Core Solidity smart contract
│   └── DSWDReliefTracker_Flat.sol       # Flattened contract for Etherscan verification
├── dist/                                # Compiled production bundle (HTML, JS, CSS)
├── .github/workflows/
│   └── deploy.yml                       # GitHub Actions CI/CD automated deployment workflow
├── package.json                         # Project dependencies and build scripts
└── vite.config.ts                       # Vite configuration with relative base path and Tailwind
```

---

## Module-by-Module Code Breakdown

### 1. Business Logic Coordinator (`useInventoryState.tsx`)
Located at `src/app/hooks/useInventoryState.tsx`.
- Acts as the primary state hub for inventory operations.
- Synchronizes local React state with Supabase tables (`incoming_manifests`, `outgoing_requests`, `lgu_inventory_reports`, `discrepancy_reports`).
- **Batch Tokenization**: When `mintBatchToken(id)` is triggered, it calls `blockchain.mintBatchToken()`, waits for on-chain transaction receipt, and updates the incoming record status to `'Verified'` and `'Minted'`. Stock is added to available inventory only after this step.
- **Chain-of-Custody Signatures**:
  - `senderSignRelease(releaseId, gps)`: Captures sender wallet address, timestamp, and GPS; sets status to `'In Transit'`.
  - `receiverAcceptWithGps(releaseId, gps, qrPayload)`: Validates that the scanned manifest hash matches the record, calls `blockchain.recordCustodyHandover()`, updates Supabase, and logs an immutable audit trail entry.

### 2. Blockchain & Wallet Integration (`blockchain.ts`)
Located at `src/app/services/blockchain.ts`.
- Initializes `ethers.BrowserProvider(window.ethereum)`.
- **Database-Driven RBAC (`resolveWalletRoleFromDb`)**:
  - Replaced legacy static `.env` wallet addresses with dynamic database lookups.
  - Queries `profiles` in Supabase by `wallet_address`.
  - Resolves role to `'Admin'`, `'LGUReceiver'`, or `'Receiver'`.
- **Handover Contract Interaction**:
  - Interacts with contract `0x91c976fEe18761d8331d759D24987Ab65ec486A1` on Sepolia.
  - Encodes delivery manifest metadata, merkle root hash, sender/receiver addresses, and GPS coordinates into `recordHandover()` transactions.

### 3. Backend & Real-Time Sync (`backendApi.ts`)
Located at `src/app/services/backendApi.ts`.
- Manages all PostgreSQL queries via the Supabase JavaScript SDK.
- **Live Fleet Tracking Synchronization**:
  - `upsertTruckLiveLocation()`: Updates latitude, longitude, and wallet in `truck_live_locations`.
  - `subscribeToAllTruckLocations()`: Establishes a Supabase Realtime WebSocket subscription (`postgres_changes` on `truck_live_locations`). Any GPS coordinate emitted by a mobile driver is instantly received by the Central Admin map without polling.

### 4. Panay Road Network Fleet Tracking (`TruckTracking.tsx`)
Located at `src/app/components/views/TruckTracking.tsx`.
- Renders an interactive Leaflet map covering the four Panay provinces: **Iloilo**, **Capiz**, **Aklan**, and **Antique**.
- **Real Road Snapping**: Uses the OSRM (Open Source Routing Machine) routing engine to calculate true driving routes along Panay national highways (e.g., Iloilo-Capiz Highway, Antique Coastal Road) rather than straight lines across mountains or water.
- **Camera Decoupling**: Map camera does not hijack user view when GPS pings arrive. Users navigate freely or click dedicated utility controls (**Fit Fleet**, **Locate**, **Panay Overview**).

---

## Core Security & Operational Mechanisms

### 1. Strict MetaMask Account Binding & Mismatch Modal
To prevent unauthorized users from signing for shipments or using wrong accounts:
1. Every user's profile in Supabase is permanently bound to a registered MetaMask address (`profile.walletAddress`).
2. `App.tsx` listens in real-time to wallet changes via `window.ethereum.on('accountsChanged')`.
3. If the active account in MetaMask does not match `profile.walletAddress`:
   - A full-screen blocking modal ([`MetaMaskMismatchModal.tsx`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/src/app/components/modals/MetaMaskMismatchModal.tsx)) immediately blurs and locks the entire application.
   - Shows a comparison card: **Expected Wallet (Authorized)** vs. **Current Active Wallet (Unauthorized)**.
   - A live detection radar pulse watches the extension. The moment the user switches to the registered account in MetaMask, the modal automatically unmounts without a page refresh.
   - Provides a direct **Sign Out** button to exit the session safely.

### 2. Admin-Only LGU Receiver Assignment
- Local Government Unit (LGU) field receivers cannot choose or change their assigned municipality.
- The municipal jurisdiction is strictly assigned by Central Admin in the database (`profile.lguName`).
- In [`LGUReceiverPage.tsx`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/src/app/components/views/LGUReceiverPage.tsx), the self-selection dropdown has been removed and replaced with a locked badge (`[Sigma LGU] Official Municipal Custody`).
- If an account has no municipality assigned, an administrative alert banner prevents operations until DSWD Central Admin designates their jurisdiction.

### 3. Direct Delivery Mode
- Emergency national dispatches originating directly from national disaster resource centers (**VDRC** or **LDRC**) bypass regional warehouse inventory.
- Selecting `Direct Delivery` in [`AddReleaseModal.tsx`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/src/app/components/modals/AddReleaseModal.tsx) allows direct dispatch to municipalities without deducting stock from Oton or Pototan regional warehouses.

### 4. Standardized Kit Unit
- All incoming goods and relief allocations have been standardized strictly to **`kits`**.
- Obsolete unit dropdowns (`packs`, `sacks`, `bales`, etc.) have been removed across all intake and dispatch forms.

---

# 3. Smart Contract & Blockchain Architecture

Contract code: [`contracts/DSWDReliefTracker.sol`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/contracts/DSWDReliefTracker.sol)

### Data Structures

```solidity
struct ReliefBatch {
    string batchId;
    string category;
    uint256 quantity;
    string originWarehouse;
    uint256 timestamp;
    address mintedBy;
}

struct HandoverEvent {
    string drNumber;
    string merkleRootHash;
    address senderWallet;
    address receiverWallet;
    string senderGps;
    string receiverGps;
    uint256 senderSignedAt;
    uint256 receiverSignedAt;
    bool isCompleted;
}
```

### Key Functions
- `mintBatchToken(string batchId, string category, uint256 quantity, string warehouse)`: Mints an immutable batch record on-chain. Only callable by authorized DSWD Admin accounts.
- `recordHandoverRelease(string drNumber, string merkleHash, string senderGps)`: Called by DSWD Admin when releasing goods to in-transit status. Records first cryptographic signature and GPS.
- `confirmHandoverReceipt(string drNumber, string receiverGps)`: Called by LGU Receiver. Requires `msg.sender == registeredLguWallet`. Verifies receiver GPS, marks handover completed, and emits `HandoverCompleted` event.

---

# 4. Database Schema (Supabase PostgreSQL)

Full schema patch: [`supabase-schema-patch.sql`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/supabase-schema-patch.sql)

```sql
-- Profiles table with role and wallet binding
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('dswd_admin', 'receiver')),
    truck_id TEXT,
    lgu_name TEXT,
    wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incoming goods received at regional warehouses
CREATE TABLE public.incoming_manifests (
    id TEXT PRIMARY KEY,
    date_received DATE NOT NULL,
    fnfi_category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_type TEXT DEFAULT 'kits',
    expiration_date DATE,
    source TEXT NOT NULL,
    destination_type TEXT DEFAULT 'Warehouse',
    destination TEXT NOT NULL,
    incident_code TEXT,
    status TEXT DEFAULT 'Pending Verification',
    manifest_hash TEXT,
    token_id TEXT,
    audit_trail JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outgoing release requests and handovers
CREATE TABLE public.outgoing_requests (
    id TEXT PRIMARY KEY,
    dr_number TEXT UNIQUE,
    lgu_name TEXT NOT NULL,
    municipality TEXT,
    province TEXT,
    source_type TEXT DEFAULT 'Warehouse',
    warehouse_source TEXT NOT NULL,
    fnfi_category TEXT NOT NULL,
    amount_requested INTEGER NOT NULL,
    amount_approved INTEGER,
    delivery_status TEXT DEFAULT 'Draft',
    delivery_mode TEXT NOT NULL,
    assigned_truck TEXT,
    recipient_contact TEXT,
    destination_address TEXT,
    qr_code_hash TEXT,
    blockchain_hash TEXT,
    sender_wallet TEXT,
    receiver_wallet TEXT,
    sender_gps TEXT,
    receiver_gps TEXT,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time truck coordinates for live map tracking
CREATE TABLE public.truck_live_locations (
    truck_id TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    gps_text TEXT,
    accuracy DOUBLE PRECISION,
    wallet_address TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 5. Deployment & Why Ngrok is Not Needed

### Eliminating Ngrok
In previous local development setups (`http://localhost:5173`), testing on mobile devices required tunneling tools like **ngrok** because modern mobile browsers (Chrome on Android, Safari on iOS) strictly enforce a **Secure Context (HTTPS)** policy:
- `navigator.geolocation.getCurrentPosition()` is blocked on insecure HTTP networks.
- HTML5 camera streaming for QR scanning is blocked on insecure HTTP networks.

### Production GitHub Pages Deployment
By deploying to **GitHub Pages**, the site is served over native, trusted **HTTPS** with an automatic SSL certificate:
`https://chuuowo.github.io/DSWD-ThesisRYANNN/`

1. **Zero Tunnels Needed**: Anyone can open the link on their smartphone, tablet, or PC without ngrok running on a host machine.
2. **Instant Camera & GPS Permissions**: Browsers immediately prompt for and grant GPS and camera access.
3. **Automated CI/CD Pipeline** ([`.github/workflows/deploy.yml`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/.github/workflows/deploy.yml)):
   - Every push to `main` automatically runs Node 22, installs dependencies, compiles Vite, generates `dist/404.html` for single-page application routing, and publishes to GitHub Pages.

---

# 6. Getting Started & Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22 LTS
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) browser extension or mobile app

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chuuOWO/DSWD-ThesisRYANNN.git
   cd DSWD-ThesisRYANNN/Blockchain-Supabase-Thesis
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file in the project root:

4. **Run the local development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---


### Authors & Academic Context
Developed as part of the Undergraduate Thesis Project for the **Bachelor of Science in Information Technology / Computer Science**, focusing on blockchain supply chain integrity, multi-signature custody handovers, and GIS-assisted disaster logistics for DSWD Region VI.
