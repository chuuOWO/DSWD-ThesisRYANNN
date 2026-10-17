# DSWD Disaster Relief Supply Chain Management System
## Comprehensive System Architecture Specification

---

### 1. High-Level System Architecture Overview

![DSWD Disaster Relief System Architecture Diagram](C:/Users/miaqu/.gemini/antigravity/brain/c24b4e7d-1c4c-4690-ba38-6e18679d2fbc/dswd_system_architecture_diagram_1791735573873.jpg)

The system implements a **Decentralized, Gasless, Real-Time Disaster Relief Logistics Platform** designed for DSWD Field Office VI. It bridges physical relief warehousing with cryptographic verification on the public Ethereum blockchain (Sepolia Testnet), without requiring field personnel to handle cryptocurrency or wallet popups.

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Presentation & Field Terminal Layer"]
        A1["DSWD Admin Dashboard\n(Desktop Web)"]
        A2["Truck Driver Mobile PWA\n(Pick-up, Handover & Scan)"]
        A3["LGU Receiver Portal\n(Arrival & Acceptance)"]
        A4["Hardware Sensors\n(Camera Barcode & Satellite GNSS)"]
    end

    subgraph AppLayer ["2. Application & Middleware Layer"]
        B1["React 18 + Vite + TypeScript"]
        B2["Leaflet + OSRM Road Routing"]
        B3["useInventoryState & Client State Machine"]
        B4["Web Crypto API (SubtleCrypto PBKDF2)"]
        B5["Ethers.js v6 & Viem Client"]
    end

    subgraph RelayerLayer ["3. Automated Relayer & Gas Sponsorship"]
        C1["Automated Headless Relayer Signer\n(0xC699... EOA)"]
        C2["Alchemy Sepolia JSON-RPC\n(Dedicated Node Provider)"]
        C3["Alchemy Gas Manager Paymaster\n(ERC-4337 Account Abstraction)"]
    end

    subgraph DatabaseLayer ["4. Cloud Database & Realtime Layer"]
        D1["Supabase PostgreSQL\n(Row Level Security Enabled)"]
        D2["Supabase Auth\n(JWT Authentication & RBAC)"]
        D3["Supabase Realtime\n(PostgreSQL CDC over WebSockets)"]
        D4["Relational Tables\n(profiles, outgoing_requests, incoming_goods, etc.)"]
    end

    subgraph BlockchainLayer ["5. Ethereum Blockchain Layer (Sepolia)"]
        E1["DSWDReliefTracker Contract\n(0xCde6... ERC-1155)"]
        E2["Smart Contract Escrow Vault\n(address(this) Token Custody)"]
        E3["Multi-Hop Custody Ledger\n(Warehouse -> Driver -> LGU)"]
        E4["Public Verification\n(Sepolia Etherscan)"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1

    B1 --> B3
    B1 --> B2
    B3 --> B4
    B3 --> B5

    B1 <-->|REST & WebSockets| D1
    B1 <-->|JWT Tokens| D2
    B1 <-->|Realtime GPS & Alerts| D3

    B5 --> C1
    C1 --> C2
    C2 --> C3
    C2 --> E1

    E1 --> E2
    E2 --> E3
    E1 -.->|Tx Hash Verification| E4
    E1 -.->|On-Chain Event Sync| D1
```

---

### 2. Multi-Tier Layer Architecture

#### Tier 1: Presentation & Hardware Client Tier
- **Admin Dashboard**: Comprehensive logistics management interface built for regional supervisors. Enables incoming inventory recording, outgoing allocation, fleet monitoring, audit trail review, and personnel verification.
- **Driver Mobile Terminal**: Streamlined progressive web application (PWA) optimized for low-bandwidth mobile browsers. Interfaces with device hardware camera (via HTML5 `BarcodeDetector` / canvas streaming) for QR scanning and continuous GNSS geolocation sensors (`navigator.geolocation`).
- **LGU Receiver Terminal**: Dedicated municipality view allowing local emergency officers to inspect incoming relief convoys on a road-locked map, verify quantities, and sign cryptographic custody acceptance upon physical arrival.

#### Tier 2: Application & Business Logic Tier
- **React 18 & TypeScript**: Strongly-typed component architecture ensuring strict validation across inventory payloads and smart contract structures.
- **OSRM Road-Locked Engine**: Integrates Open Source Routing Machine (`router.project-osrm.org`) to snap GPS coordinates to real highways and streets, replacing straight lines with authentic driving trajectories and distance/duration estimates.
- **Deterministic Key Engine (`Web Crypto API`)**: Derives unique, secure Ethereum-compatible keypairs on the fly from user credentials using PBKDF2 with SHA-256 and salt, preventing raw private key storage on client devices.

#### Tier 3: Gasless Relayer & Node Infrastructure Tier
- **Headless Relayer (`0xC699...`)**: Acts as the transaction coordinator. Signs and broadcasts on-chain transactions in the background as soon as verified actions occur (e.g., driver QR scan, LGU confirmation).
- **Alchemy Sepolia RPC**: Enterprise-grade Ethereum node infrastructure providing high throughput, sub-second block querying, and dedicated uptime for Region VI operations.
- **Alchemy Gas Manager**: ERC-4337 Account Abstraction Paymaster policy that sponsors all network gas fees, ensuring field workers never encounter failed transactions due to zero ETH balances.

#### Tier 4: Cloud Persistence & Realtime Tier
- **Supabase PostgreSQL**: Relational database with strict foreign keys, monotonic counters, and Row Level Security (RLS) policies.
- **PostgreSQL CDC (Change Data Capture)**: Powers real-time live map updates—when a driver transmits GNSS telemetry, the coordinate stream instantly synchronizes across all active admin and LGU screens via WebSockets.

#### Tier 5: Immutable Blockchain Tier
- **Smart Contract (`DSWDReliefTracker.sol`)**: Deployed on Ethereum Sepolia Testnet at `0xCde64aBedE22F9842F5678Fe4cd84781960863eC`. Implements ERC-1155 token standards for semi-fungible commodity batches.
- **On-Chain Escrow**: Mints relief tokens directly into the smart contract vault (`address(this)`). Tokens remain safely locked until an authorized driver physically confirms departure.
- **Multi-Hop Custody Array**: Tracks the sequential physical movement of goods across intermediate logistics hops, permanently etching GPS strings, timestamps, and custodian wallet addresses into blockchain history.

---

### 3. Physical-to-Digital Custody Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as DSWD Admin (Warehouse)
    actor Driver as Transport Driver (Truck)
    actor LGU as LGU Receiving Officer
    participant App as DSWD Logistics System
    participant Relayer as Backend Relayer (0xC699...)
    participant Contract as Sepolia Contract (0xCde6...)
    participant DB as Supabase PostgreSQL

    Note over Admin, Contract: Phase 1: Allocation & Escrow Minting
    Admin->>App: Approve Outgoing Release (DR-2026-001)
    App->>DB: Save release as 'Approved' & Generate QR
    App->>Relayer: Trigger on-chain allocation
    Relayer->>Contract: mintBatchToken(DR, 500 packs, Destination)
    Contract->>Contract: Mint 500 ERC-1155 tokens to Escrow address(this)
    Contract-->>App: Emit BatchTokenMinted event

    Note over Driver, Contract: Phase 2: Loading & Departure Handover
    Driver->>App: Scan Dispatch QR Code at loading bay
    App->>App: Verify package count & capture GNSS coordinates
    App->>Relayer: Transmit signed handover request
    Relayer->>Contract: signReleaseWithDriver(DR, DriverWallet, GPS)
    Contract->>Contract: _safeTransferFrom(address(this), DriverWallet, 500)
    Contract-->>App: Emit ReleaseSigned event (Hop 1 Recorded)
    App->>DB: Update status to 'In Transit' & begin live GPS stream

    Note over Driver, LGU: Phase 3: Live Road Transit
    loop Every 3.5 Seconds
        Driver->>App: Stream live GNSS telemetry
        App->>DB: Upsert truck_live_locations
        DB-->>Admin: WebSocket broadcast to Live Fleet Map
        DB-->>LGU: WebSocket broadcast to LGU Arrival Map
    end

    Note over LGU, Contract: Phase 4: Arrival & Final Acceptance
    LGU->>App: Scan Handover QR code upon physical truck arrival
    App->>App: Capture destination GPS coordinates
    App->>Relayer: Transmit acceptance payload
    Relayer->>Contract: confirmReceiptForLgu(DR, Destination, GPS, LGUWallet)
    Contract->>Contract: _safeTransferFrom(DriverWallet, LGUWallet, 500)
    Contract-->>App: Emit ReceiptConfirmed event (Final Hop Recorded)
    App->>DB: Update status to 'Accepted' & record Sepolia Tx Hash
    App-->>Admin: Archive shipment & display Sepolia Etherscan audit link
```

---

### 4. Database Schema Entity-Relationship Diagram

```mermaid
erDiagram
    PROFILES ||--o{ OUTGOING_REQUESTS : "assigned_driver"
    PROFILES ||--o{ ACTIVITY_LOGS : "performed_by"
    PROFILES ||--o{ TRUCK_LIVE_LOCATIONS : "streams_telemetry"
    PROVINCES ||--o{ WAREHOUSES : "hosts"
    PROVINCES ||--o{ LGUS : "contains"
    WAREHOUSES ||--o{ INCOMING_GOODS : "receives"
    WAREHOUSES ||--o{ OUTGOING_REQUESTS : "sources"
    LGUS ||--o{ OUTGOING_REQUESTS : "destined_for"
    LGUS ||--o{ LGU_INVENTORY_REPORTS : "submits"

    PROFILES {
        uuid id PK
        text email UK
        text full_name
        text role "dswd_admin | receiver"
        text truck_id "Vehicle Plate"
        text lgu_name "Municipal assignment"
        text wallet_address "Ethereum Smart Account"
        text status "pending | verified | rejected"
        timestamptz created_at
    }

    OUTGOING_REQUESTS {
        uuid id PK
        text dr_number UK "Delivery Receipt #"
        text incident_code
        text category "FNFI commodity"
        integer amount_requested
        integer amount_approved
        text warehouse_source
        text municipality
        text province
        text delivery_mode "Truck | Direct Delivery"
        text delivery_status "Approved | In Transit | Delivered | Accepted"
        text assigned_truck_id
        text tx_hash "Ethereum Sepolia Hash"
        text handover_contract_id
        text receiver_gps
        timestamptz created_at
    }

    INCOMING_GOODS {
        uuid id PK
        text manifest_number UK
        text incident_code
        text category
        integer quantity
        text unit_type "packs | kits | boxes"
        text source "VDRC | LDRC | Oton | Pototan"
        text destination_type "Warehouse"
        text destination "Oton Main Warehouse | Pototan"
        text status "Draft | Pending | Verified | Minted"
        text batch_token_id "ERC-1155 Batch ID"
        text tx_hash
        timestamptz created_at
    }

    TRUCK_LIVE_LOCATIONS {
        text truck_id PK
        double_precision latitude
        double_precision longitude
        double_precision accuracy
        double_precision heading
        double_precision speed
        text current_dr
        text status "Standby | In Transit"
        timestamptz updated_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        text action "MINT_BATCH | SIGN_RELEASE | CONFIRM_RECEIPT"
        text entity_type
        text entity_id
        uuid actor_id FK
        text actor_name
        text actor_role
        text details
        text tx_hash
        jsonb metadata
        timestamptz created_at
    }
```
