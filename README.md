# DSWD Blockchain-Backed Relief Operations & Supply Chain Tracker

A hybrid decentralized supply chain monitoring and chain-of-custody tracking platform developed for the **Department of Social Welfare and Development (DSWD) Region VI (Western Visayas - Panay Island)**.

This system integrates **Supabase Cloud PostgreSQL**, **Ethereum (Sepolia Testnet) Smart Contracts (ERC-1155)**, **Leaflet Real-Road Fleet Mapping**, **W3C Geolocation**, and **MetaMask Cryptographic Handshakes** to eliminate ghost deliveries, inventory tampering, and unauthorized municipal rerouting.

---

## Table of Contents

1. [Simplified Version (Plain-English Overview)](#1-simplified-version-plain-english-overview)
   - [The Problem Being Solved](#the-problem-being-solved)
   - [How the System Works in 4 Steps](#how-the-system-works-in-4-steps)
   - [Who Uses the System (User Roles)](#who-uses-the-system-user-roles)
2. [Detailed Technical Version (Complete Codebase Breakdown)](#2-detailed-technical-version-complete-codebase-breakdown)
   - [System Architecture & Data Flow](#system-architecture--data-flow)
   - [Complete Project File Inventory](#complete-project-file-inventory)
   - [Root Configuration & Infrastructure Files](#root-configuration--infrastructure-files)
   - [Smart Contracts Layer (`contracts/`)](#smart-contracts-layer-contracts)
   - [Core Application Shell & Contexts (`src/app/`)](#core-application-shell--contexts-srcapp)
   - [Services & Data Access Layer (`src/app/services/` & `src/app/lib/`)](#services--data-access-layer-srcappservices--srcapplib)
   - [State Management & Custom Hook (`src/app/hooks/`)](#state-management--custom-hook-srcapphooks)
   - [Static Reference Data (`src/app/data/`)](#static-reference-data-srcappdata)
   - [Layout & Navigation Components (`src/app/components/layout/`)](#layout--navigation-components-srcappcomponentslayout)
   - [Authentication Components (`src/app/components/auth/`)](#authentication-components-srcappcomponentsauth)
   - [Primary Application Views (`src/app/components/views/`)](#primary-application-views-srcappcomponentsviews)
   - [Modals & Dialogs (`src/app/components/modals/`)](#modals--dialogs-srcappcomponentsmodals)
   - [Specialized UI & Design Elements (`src/app/components/design/`)](#specialized-ui--design-elements-srcappcomponentsdesign)
   - [Styling & Asset Manifests (`src/styles/` & `src/imports/`)](#styling--asset-manifests-srcstyles--srcimports)
3. [Smart Contract Technical Specification](#3-smart-contract-technical-specification)
4. [Database Schema (Supabase PostgreSQL)](#4-database-schema-supabase-postgresql)
5. [Production Deployment & GitHub Pages CI/CD](#5-production-deployment--github-pages-cicd)
6. [Local Development & Setup Guide](#6-local-development--setup-guide)

---

# 1. Simplified Version (Plain-English Overview)

### The Problem Being Solved
When typhoons, floods, or calamities strike Panay Island (Iloilo, Antique, Capiz, and Aklan), the DSWD Regional Office dispatches thousands of family food packs and disaster kits from its regional warehouses in **Oton** and **Pototan** to local municipal evacuation gyms.

Historically, relief logistics relied on paper manifests, manual phone check-ins, and physical delivery receipts. This created serious vulnerabilities:
- **Disputed Deliveries:** Difficulties verifying whether relief packs actually reached the intended evacuees or local government offices.
- **Rerouting Risks:** Drivers taking unverified routes or goods arriving at unauthorized facilities without official acknowledgement.
- **Paper Trail Loss:** Waterlogged, lost, or forged paperwork preventing transparent auditing.
- **Unauthorized Claimants:** Individuals without authorized municipal authority receiving aid shipments on behalf of an LGU.

### How the System Works in 4 Steps

```
[ 1. INTAKE AT WAREHOUSE ]
Goods arrive at Oton or Pototan from national resource centers (VDRC / LDRC).
DSWD staff verify counts. The Admin mints an immutable blockchain batch token.
Stock is officially added to available regional inventory in standardized "kits".

               |
               v

[ 2. ALLOCATION & DISPATCH ]
Local Government Units (LGUs) submit disaster reports and relief requests.
The system calculates emergency priority scores (Red/Yellow/Green).
Central Admin approves the requested quantity and signs the dispatch on blockchain.
A scannable Delivery Receipt (DR) with a cryptographic hash is issued to the driver.

               |
               v

[ 3. REAL-ROAD TRANSIT TRACKING ]
The driver opens the mobile app and taps "Start Delivery".
The phone streams live GPS coordinates over secure WebSockets.
The Admin Dashboard plots the vehicle moving along actual Panay highway corridors.

               |
               v

[ 4. CRYPTOGRAPHIC HANDOVER AT MUNICIPAL HALL ]
The truck arrives at the municipal gym or evacuation center.
The designated LGU Receiver inspects the goods and counts physical packages.
The receiver scans the driver's QR code using their smartphone camera.
The receiver signs using their registered MetaMask cryptographic wallet.
The smart contract verifies wallet identity + GPS location, permanently sealing custody.
```

### Who Uses the System (User Roles)

| Role | Access Device | Key Responsibilities | Protection & Controls |
| :--- | :--- | :--- | :--- |
| **DSWD Central Admin** | Desktop PC | Approves dispatches, mints inventory batches, views live fleet map, manages staff accounts, and assigns LGUs. | Full administrative rights; protected by database role (`dswd_admin`) and verified MetaMask wallet. |
| **Field Receiver (Driver / Trucker)** | Mobile Smartphone | Carries shipments, broadcasts real-time GPS telemetry, and presents proof-of-transit QR codes. | Bound to specific DR numbers and truck IDs; cannot edit quantities or divert municipal destinations. |
| **LGU Receiver** | Mobile Smartphone | Inspects incoming packages at the municipal hall, performs barcode scans, and signs for custody. | **Strictly locked to their Admin-assigned Panay municipality**; can only sign with their registered MetaMask wallet. |

---

# 2. Detailed Technical Version (Complete Codebase Breakdown)

## System Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
|                                    BROWSER CLIENT                                     |
|  React 18  *  TypeScript  *  Tailwind CSS v4  *  Leaflet Routing  *  Ethers.js v6     |
+-------------------------------------------+-------------------------------------------+
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
                    v                                               v
+---------------------------------------+       +---------------------------------------+
|            SUPABASE CLOUD             |       |      ETHEREUM (SEPOLIA TESTNET)       |
|  - PostgreSQL Database Engine         |       |  - DSWDReliefTracker.sol (ERC-1155)   |
|  - Realtime WebSocket Channels        |       |  - Immutable Batch Token Minting      |
|  - Supabase Auth & JWT Sessions       |       |  - Multi-Signature Custody Handovers  |
|  - Row Level Security (RLS) Policies  |       |  - EIP-712 Fallback Hash Signing      |
+---------------------------------------+       +---------------------------------------+
```

---

## Complete Project File Inventory

### Root Configuration & Infrastructure Files

| File | Purpose |
| :--- | :--- |
| `.env` / `.env.production` | Environment variable definitions for Supabase URL, Anon Key, Sepolia Contract addresses, Chain ID (`11155111`), and Alchemy RPC endpoint. |
| `.github/workflows/deploy.yml` | Automated GitHub Actions CI/CD pipeline that triggers on push to `main`, installs packages using Node 22, executes `npm run build`, creates `dist/404.html` for SPA routing, and deploys directly to GitHub Pages. |
| `vite.config.ts` | Vite configuration specifying `@vitejs/plugin-react`, `@tailwindcss/vite`, relative asset pathing (`base: './'`), and Figma asset resolver plugins. |
| `tsconfig.json` | TypeScript compiler configuration targeting ESNext, React JSX runtime, DOM libraries, and strict module resolution. |
| `package.json` | Project manifest defining runtime dependencies (`ethers`, `@supabase/supabase-js`, `leaflet`, `lucide-react`, `react`, `react-dom`) and build scripts. |
| `postcss.config.mjs` | PostCSS configuration powering Tailwind CSS utility compilation. |
| `supabase-schema-patch.sql` | Complete SQL migration script defining tables (`profiles`, `incoming_manifests`, `outgoing_requests`, `truck_live_locations`, `lgu_inventory_reports`, `discrepancy_reports`), RLS policies, indexes, and triggers. |
| `index.html` | Application HTML entry point containing viewport meta tags, preloaded web fonts (Inter, Lexend, JetBrains Mono), and the root DOM mounting node `#root`. |

---

### Smart Contracts Layer (`contracts/`)

| File | Description |
| :--- | :--- |
| `contracts/DSWDReliefTracker.sol` | Primary Solidity smart contract (`^0.8.20`) inheriting OpenZeppelin ERC-1155 and Ownable. Manages tokenized relief batches (`mintBatchToken`), multi-signature handovers (`signRelease`, `confirmReceipt`), GPS timestamp recording, and administrator whitelist management (`onlyAdmin`, `setAdmin`). |
| `contracts/DSWDReliefTracker_Flat.sol` | Flattened, single-file concatenation of `DSWDReliefTracker.sol` and all imported OpenZeppelin dependencies for direct contract verification on Etherscan Sepolia. |

---

### Core Application Shell & Contexts (`src/app/`)

| File | Description |
| :--- | :--- |
| `src/main.tsx` | Main application bootstrap that mounts React into `#root` with `React.StrictMode` and wraps the application with `AuthProvider`. |
| `src/vite-env.d.ts` | TypeScript declarations for Vite client environment variables and the global `window.ethereum` MetaMask interface. |
| `src/app/App.tsx` | Root component managing application navigation, view routing, role detection, MetaMask account change listeners, session validation, and conditional rendering of `MetaMaskMismatchModal`. |
| `src/app/contexts/AuthContext.tsx` | React Context provider that exposes user profile data (`UserProfile`), authentication state (`isAuthenticated`, `isLoading`), login/logout methods, and profile refresh triggers. |

---

### Services & Data Access Layer (`src/app/services/` & `src/app/lib/`)

| File | Description |
| :--- | :--- |
| `src/app/services/blockchain.ts` | Core blockchain integration service using Ethers.js v6. Handles MetaMask connection, contract instances, database-driven wallet role verification (`resolveWalletRoleFromDb`), batch token minting (`mintBatchToken`), dispatch authorization (`mintAndAuthorizeRelease`), and recipient verification. |
| `src/app/services/backendApi.ts` | Data access client communicating with Supabase PostgreSQL. Implements CRUD operations for incoming manifests, outgoing requests, live truck location upserts (`upsertTruckLiveLocation`), discrepancy filings, and WebSocket subscriptions (`subscribeToAllTruckLocations`). |
| `src/app/services/authApi.ts` | Authentication service managing Supabase Auth sign-ins, registrations, password resets, profile retrieval, profile photo updates, and wallet address bindings. |
| `src/app/lib/supabase.ts` | Singleton factory initializing and exporting the `supabase` JavaScript client using runtime environment variables. |
| `src/app/lib/inputValidation.ts` | Centralized sanitization library enforcing strict data types: `sanitizeNumbersOnly` (numeric inputs), `sanitizeTextOnly` (letters, spaces, periods, hyphens), `sanitizePhone` (digits and single leading `+`), and `sanitizeAlphanumeric`. |
| `src/app/lib/lguMatching.ts` | Master utility matching database LGU records from Supabase, resolving names/aliases, extracting distinct provinces, grouping municipalities, and defining regional provinces. |

---

### State Management & Custom Hook (`src/app/hooks/`)

| File | Description |
| :--- | :--- |
| `src/app/hooks/useInventoryState.tsx` | The central state engine of the application. Coordinates available warehouse inventory counts, loads incoming manifests and outgoing releases, computes disaster priority scores, executes stock deductions, handles blockchain minting handshakes, and subscribes to Supabase Realtime changes. |

---

### Geographic Reference Data (`src/app/data/`)

| File | Description |
| :--- | :--- |
| `src/app/data/panayProvinceBoundaries.ts` | Static geographic reference boundaries (GeoJSON polygon geometries) for Panay Island provinces used for map layer overlays. |

---

### Layout & Navigation Components (`src/app/components/layout/`)

| File | Description |
| :--- | :--- |
| `src/app/components/layout/Header.tsx` | Top application header displaying DSWD branding, current system date, connected MetaMask wallet status pill, network indicator, and user profile drawer trigger. |
| `src/app/components/layout/Sidebar.tsx` | Collapsible desktop navigation bar providing one-click switching between views (Dashboard, Incoming, Outgoing, Inventory, LGUs, Fleet Tracking, Accounts) with active view badges. |

---

### Authentication Components (`src/app/components/auth/`)

| File | Description |
| :--- | :--- |
| `src/app/components/auth/AuthPage.tsx` | Responsive split-screen login and signup interface featuring DSWD institutional branding, role selection tabs (Admin vs. Field Receiver), input sanitization, and optional MetaMask wallet pre-linking. |

---

### Primary Application Views (`src/app/components/views/`)

| File | Description |
| :--- | :--- |
| `src/app/components/views/DashboardView.tsx` | Executive summary screen displaying total inventory in kits, active dispatches, low stock indicators, critical LGU priority alerts, recent blockchain audit feeds, and quick navigation shortcuts. |
| `src/app/components/views/IncomingModule.tsx` | Warehouse intake log showing received relief goods shipments. Allows supervisors to draft incoming manifests, verify physical package tallies, and trigger on-chain batch token minting. |
| `src/app/components/views/OutgoingModule.tsx` | Outgoing dispatch management queue. Allows administrators to review LGU requests, approve requested quantities, sign releases via MetaMask, generate scannable QR Delivery Receipts, and monitor shipment progress. |
| `src/app/components/views/InventoryMonitoring.tsx` | Real-time warehouse storage monitor. Visualizes stock by category (Food Packs, Hygiene Kits, Family Kits, etc.) across Oton and Pototan warehouses, highlighting reorder thresholds below 500 kits. |
| `src/app/components/views/LGUMonitoring.tsx` | Comprehensive disaster status and inventory view for all Panay municipalities. Displays damage indices, affected family metrics, computed priority scores, and recorded stock levels. |
| `src/app/components/views/AccountManagement.tsx` | Administrative user roster. Allows Central Admins to approve pending signups, assign or reassign field receivers to specific Panay municipalities, and authorize wallet addresses. |
| `src/app/components/views/TruckTracking.tsx` | Live fleet map built on Leaflet and OpenStreetMap. Displays real-time vehicle positions snapped to Panay highway corridors, driving speed, battery/GPS accuracy, and dedicated camera controls (**Fit Fleet**, **Locate**, **Panay Overview**). |
| `src/app/components/views/ReceiverPage.tsx` | Mobile-optimized interface for field truck drivers. Allows drivers to start delivery, stream device GPS coordinates to Supabase Realtime, and view shipment route checkpoints. |
| `src/app/components/views/LGUReceiverPage.tsx` | Dedicated mobile portal for municipal LGU receivers. Features an embedded camera QR scanner, package verification counters, and one-tap MetaMask cryptographic handover signing. |

---

### Modals & Dialogs (`src/app/components/modals/`)

| File | Description |
| :--- | :--- |
| `src/app/components/modals/AddIncomingGoodsModal.tsx` | Intake modal for recording shipments arriving at regional warehouses from VDRC, LDRC, or external donors, locked to "kits" with strict numeric quantity validation. |
| `src/app/components/modals/AddReleaseModal.tsx` | Outgoing release modal allowing administrators to select destination LGUs, specify requested quantities, choose delivery modes, or toggle **Direct Delivery** from national centers. |
| `src/app/components/modals/AddLGUModal.tsx` | Admin dialog to register a new municipal drop-off location with province, municipality name, contact personnel, and initial stock statistics. |
| `src/app/components/modals/EditLGUModal.tsx` | Admin dialog to update existing LGU profile details, contact numbers, and recorded inventory statistics with strict input validation. |
| `src/app/components/modals/ProfileSettingsModal.tsx` | User profile modal allowing staff to update full names, take web camera snapshots for profile photos, link MetaMask wallets permanently, and review assigned roles. |
| `src/app/components/modals/QrCodeGeneratorModal.tsx` | Generates high-resolution scannable QR codes containing encrypted Delivery Receipt data, batch token IDs, and hash proofs for field verification. |
| `src/app/components/modals/MetaMaskMismatchModal.tsx` | Security lock modal that blurs and blocks application access whenever the active MetaMask account differs from the account registered in the user's profile. |
| `src/app/components/modals/ConfirmLogoutModal.tsx` | Safety confirmation dialog prompting users before ending their authenticated session and disconnecting active state. |

---

### Specialized UI & Design Elements (`src/app/components/design/`)

| File | Description |
| :--- | :--- |
| `src/app/components/design/LocationPickerMap.tsx` | Interactive Leaflet mini-map component enabling users to drop and drag a geospatial pin to set precise coordinates for drop-off facilities or evacuation gyms. |
| `src/app/components/design/FiveDotsLoadingModal.tsx` | Minimalist 5-dot animated pulse loading modal providing clear visual feedback during asynchronous blockchain minting and database sync operations. |

---

### Styling & Asset Manifests (`src/styles/` & `src/imports/`)

| File | Description |
| :--- | :--- |
| `src/styles/tailwind.css` | Tailwind CSS v4 entry point importing base utilities, theme definitions, and component styles. |
| `src/styles/theme.css` | Custom theme variables defining primary blue (`#2500ba`), surface colors, borders, and modal shadows. |
| `src/styles/fonts.css` | Typography definitions loading Inter, Lexend, and JetBrains Mono monospace typefaces. |
| `src/styles/index.css` | Global CSS reset and scrollbar styling overrides. |
| `src/imports/dswdlogo.png` | Official DSWD high-resolution insignia used in application headers and authentication screens. |
| `src/imports/dswd_building.png` | Architectural graphic displayed in desktop login view backgrounds. |

---

# 3. Smart Contract Technical Specification

Contract File: [`contracts/DSWDReliefTracker.sol`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/contracts/DSWDReliefTracker.sol)

### Core Storage & Structs

```solidity
struct Batch {
    uint256 batchId;
    string manifestNumber;
    string batchTokenId;
    string manifestHash;
    string category;
    uint256 quantity;
    string destination;
    address mintedBy;
    uint256 mintedAt;
}

struct Handover {
    uint256 handoverId;
    string drNumber;
    string handoverContractId;
    uint256[] batchIds;
    uint256[] batchQuantities;
    string fromLocation;
    string destination;
    string senderGps;
    string receiverGps;
    address sender;
    address receiver;
    uint256 releasedAt;
    uint256 acceptedAt;
    HandoverStatus status;
}
```

### Essential Methods & Access Rules

1. `mintBatchToken(...) external onlyAdmin nonReentrant returns (uint256)`:
   - Validates that the caller is an authorized administrator (`owner()` or `isAuthorizedAdmin`).
   - Mints an ERC-1155 token representing physical relief goods in warehouse storage.
   - Stores metadata hash, batch token ID, and quantity.
2. `signRelease(...) external nonReentrant returns (uint256)`:
   - Called by the releasing party (Warehouse/Admin) when goods depart.
   - Records sender wallet address, departure timestamp, and initial GPS reading.
   - Sets handover status to `Released`.
3. `confirmReceipt(...) external nonReentrant returns (uint256)`:
   - Called by the municipal receiver upon arrival.
   - Validates that the receiver wallet matches the authorized recipient.
   - Records the destination GPS coordinate and acceptance timestamp.
   - Transitions status to `Accepted`, cryptographically sealing the handover.
4. `setAdmin(address admin, bool authorized) external onlyOwner`:
   - Allows the contract owner to whitelist or revoke administrator privileges for new staff wallets without redeploying the contract.

---

# 4. Database Schema (Supabase PostgreSQL)

Complete Schema Script: [`supabase-schema-patch.sql`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/supabase-schema-patch.sql)

### Table Reference

#### 1. `profiles`
Stores user identities, application roles, and permanent wallet address bindings.
- `id` (UUID, Primary Key, references `auth.users`)
- `email` (TEXT, Unique)
- `full_name` (TEXT)
- `role` (TEXT, check: `dswd_admin` or `receiver`)
- `truck_id` (TEXT, optional driver identifier)
- `lgu_name` (TEXT, assigned Panay municipality for LGU receivers)
- `wallet_address` (TEXT, bound MetaMask address)
- `avatar_url` (TEXT, base64 photo captured via web camera)
- `status` (TEXT, check: `pending`, `verified`, `rejected`)

#### 2. `incoming_manifests`
Tracks relief supplies arriving at regional warehouses.
- `id` (TEXT, Primary Key, manifest ID)
- `date_received` (DATE)
- `fnfi_category` (TEXT)
- `quantity` (INTEGER)
- `unit_type` (TEXT, standardized to `kits`)
- `source` (TEXT, e.g., `VDRC`, `LDRC`, `Oton Main Warehouse`)
- `destination` (TEXT)
- `status` (TEXT, check: `Draft`, `Pending Verification`, `Verified`, `Minted`)
- `manifest_hash` (TEXT, SHA-256 fingerprint)
- `token_id` (TEXT, blockchain batch token reference)
- `audit_trail` (JSONB)

#### 3. `outgoing_requests`
Maintains records of dispatches, delivery statuses, and handover proofs.
- `id` (TEXT, Primary Key)
- `dr_number` (TEXT, Unique delivery receipt number)
- `lgu_name` (TEXT, destination office or evacuation facility)
- `municipality` (TEXT)
- `province` (TEXT)
- `warehouse_source` (TEXT)
- `fnfi_category` (TEXT)
- `amount_requested` (INTEGER)
- `amount_approved` (INTEGER)
- `delivery_status` (TEXT, check: `Draft`, `Allocating`, `Approved`, `Released`, `In Transit`, `Delivered`, `Correction Requested`)
- `delivery_mode` (TEXT, e.g., `Truck`, `Van`, `Pick-up`, `Direct Delivery`)
- `assigned_truck` (TEXT)
- `qr_code_hash` (TEXT)
- `blockchain_hash` (TEXT)
- `sender_wallet` (TEXT)
- `receiver_wallet` (TEXT)
- `sender_gps` (TEXT)
- `receiver_gps` (TEXT)
- `timeline` (JSONB)

#### 4. `truck_live_locations`
Real-time GPS coordinate stream for live fleet monitoring.
- `truck_id` (TEXT, Primary Key)
- `latitude` (DOUBLE PRECISION)
- `longitude` (DOUBLE PRECISION)
- `gps_text` (TEXT)
- `accuracy` (DOUBLE PRECISION)
- `wallet_address` (TEXT)
- `updated_at` (TIMESTAMPTZ)

#### 5. `lgu_inventory_reports`
Municipal disaster reports driving priority ranking scores.
- `id` (UUID, Primary Key)
- `lgu_name` (TEXT)
- `municipality` (TEXT)
- `province` (TEXT)
- `food_packs` (INTEGER)
- `hygiene_kits` (INTEGER)
- `family_kits` (INTEGER)
- `affected_families` (INTEGER)
- `damage_index` (NUMERIC)
- `priority_score` (NUMERIC)
- `priority_level` (TEXT, check: `Critical`, `High`, `Moderate`, `Low`)
- `reported_at` (TIMESTAMPTZ)

#### 6. `discrepancy_reports`
Disputes filed by field receivers when physical counts do not match manifests.
- `id` (UUID, Primary Key)
- `report_type` (TEXT)
- `dr_number` (TEXT)
- `manifest_id` (TEXT)
- `note` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

# 5. Production Deployment & GitHub Pages CI/CD

### Why Ngrok is Not Needed
In previous local development setups (`http://localhost:5173`), testing mobile features required tunneling tools like **ngrok** because mobile operating systems strictly enforce a **Secure Context (HTTPS)** policy:
- `navigator.geolocation.watchPosition()` is completely blocked over plain HTTP on remote devices.
- HTML5 camera streaming (`navigator.mediaDevices.getUserMedia()`) is blocked over plain HTTP.

### Production Deployment via GitHub Pages
The application is deployed over native, trusted HTTPS at:
`https://chuuowo.github.io/DSWD-ThesisRYANNN/`

- **Zero Third-Party Tunnels:** Accessible from any smartphone or desktop directly without host tunneling software.
- **Immediate Device Access:** Mobile browsers grant camera and GPS access without security warnings.
- **Continuous Integration Pipeline:** Configured in [`.github/workflows/deploy.yml`](file:///c:/Users/miaqu/newthesisv3/Blockchain-Supabase-Thesis/.github/workflows/deploy.yml). Every push to `main` compiles the TypeScript codebase, builds Vite production chunks, copies `index.html` to `dist/404.html` for single-page routing, and publishes to GitHub Pages.

---

# 6. Local Development & Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v20.x or v22.x LTS
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) browser extension (desktop) or mobile app

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
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   VITE_RELIEF_TRACKER_CONTRACT_ADDRESS=0x91c976fEe18761d8331d759D24987Ab65ec486A1
   VITE_BATCH_TOKEN_CONTRACT_ADDRESS=0x91c976fEe18761d8331d759D24987Ab65ec486A1
   VITE_HANDOVER_CONTRACT_ADDRESS=0x91c976fEe18761d8331d759D24987Ab65ec486A1
   VITE_BLOCKCHAIN_CHAIN_ID=11155111
   VITE_BLOCKCHAIN_CHAIN_NAME=Sepolia
   VITE_BLOCKCHAIN_RPC_URL=your_alchemy_or_infura_sepolia_rpc_url
   ```

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
Developed as part of the Undergraduate Thesis Project for the **Bachelor of Science in Information Technology / Computer Science**, focusing on blockchain supply chain integrity, multi-signature custody handovers, and GIS-assisted disaster logistics for DSWD Region VI (Western Visayas).
