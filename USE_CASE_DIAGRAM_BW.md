# DSWD Disaster Relief Supply Chain Management System
## Ultra-Compressed Black-and-White UML Use Case Diagram (with Ethereum Sepolia)

This Mermaid configuration is designed to fit onto a standard **Letter-sized paper (8.5" x 11")**:
1. **Zero Dead Space**: Removed nested inner subgraphs that caused the staircase offset. Every column starts level at the top line (`Row 1`), eliminating the empty space above the right half.
2. **Ethereum Sepolia Included**: Added back as a supporting on-chain actor on the right boundary, linked via dashed UML association lines (`-.-`) to `UC1` (Mint), `UC7` (Sign Custody), `UC9` (Transshipment), and `UC12` (Final Receipt).
3. **Actor Distribution**: Primary actors (`Admin`, `Driver`) on the left; receiving and supporting actors (`LGU Officer`, `Ethereum Sepolia`) on the right.
4. **Zero Curvy Lines & Grayscale**: Configured with `'curve': 'linear'` for 100% straight lines and pure `#ffffff` / `#000000` monochrome styling.

---

### Option 1 (Recommended: 3-Column Ultra-Compressed Flow)
*Height is only 5 rows tall. Perfectly balances width and height for Letter landscape or scalable portrait with zero dead zones.*

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#ffffff',
    'primaryTextColor': '#000000',
    'primaryBorderColor': '#000000',
    'lineColor': '#000000',
    'secondaryColor': '#ffffff',
    'tertiaryColor': '#ffffff',
    'mainBkg': '#ffffff',
    'nodeBorder': '#000000',
    'clusterBkg': '#ffffff',
    'clusterBorder': '#000000',
    'fontSize': '11px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  },
  'flowchart': {
    'curve': 'linear',
    'nodeSpacing': 12,
    'rankSpacing': 28
  }
}}%%
flowchart LR

    %% Primary Actors (Left Side)
    Admin["DSWD Admin<br/>(Logistics Supervisor)"]
    Driver["Transport Driver<br/>(Field Logistics / Trucker)"]

    %% Secondary / External Actors (Right Side)
    LGU["LGU Officer<br/>(Municipal Receiver)"]
    Blockchain["Ethereum Sepolia<br/>(Smart Contract & Relayer)"]

    %% System Boundary (Compact 3-Column Grid)
    subgraph SYSTEM ["DSWD Disaster Relief Supply Chain System"]
        %% Column 1: Central Logistics
        UC1(["Intake Goods & Mint<br/>ERC-1155 Batch Tokens"])
        UC2(["Allocate Outgoing Release<br/>& Generate Manifest QR"])
        UC3(["Track Fleet Real-Time<br/>on Road-Locked Map"])
        UC4(["Monitor Panay LGU<br/>Disaster Need Quotas"])
        UC5(["Manage Personnel Directory<br/>& Verify Credentials"])

        %% Column 2: Field Logistics & Custody
        UC6(["Scan Dispatch QR &<br/>Verify Physical Package Count"])
        UC7(["Sign Gasless Custody<br/>(On-Chain Blockchain Transfer)"])
        UC8(["Stream Satellite GNSS<br/>Vehicle Telemetry"])
        UC9(["Multi-Hop Custody Transfer<br/>(Driver Transshipment Relay)"])
        UC10(["Present Handover QR Code"])

        %% Column 3: Municipal Intake & Audit
        UC11(["Track Approaching Relief<br/>Convoys on Map"])
        UC12(["Scan Handover QR & Confirm<br/>Final Physical Receipt"])
        UC13(["Submit Periodic Local<br/>Stock Audit Reports"])
        UC14(["Report Cargo Discrepancy<br/>/ Damaged Goods"])
    end

    %% DSWD Admin (Connects to Column 1)
    Admin --- UC1
    Admin --- UC2
    Admin --- UC3
    Admin --- UC4
    Admin --- UC5

    %% Transport Driver (Connects to Column 2 + Discrepancy)
    Driver --- UC6
    Driver --- UC7
    Driver --- UC8
    Driver --- UC9
    Driver --- UC10
    Driver --- UC14

    %% LGU Officer (Connects to Column 3)
    UC11 --- LGU
    UC12 --- LGU
    UC13 --- LGU
    UC14 --- LGU

    %% Ethereum Sepolia Blockchain Interactions (Dashed Lines to Right)
    UC1 -.- Blockchain
    UC7 -.- Blockchain
    UC9 -.- Blockchain
    UC12 -.- Blockchain

    %% Standard UML Include & Extend
    UC6 -.->|<<include>>| UC7
    UC12 -.->|<<extend>>| UC14
    UC6 -.->|<<extend>>| UC14

    %% Horizontal Row-Level Alignment Constraints
    UC1 ~~~ UC6 ~~~ UC11
    UC2 ~~~ UC7 ~~~ UC12
    UC3 ~~~ UC8 ~~~ UC13
    UC4 ~~~ UC9 ~~~ UC14
    UC5 ~~~ UC10

    %% Monochrome Styling Definitions
    classDef actorBox fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000;
    classDef usecaseOval fill:#ffffff,stroke:#000000,stroke-width:1.5px,color:#000000;
    
    class Admin,Driver,LGU,Blockchain actorBox;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14 usecaseOval;
```

---

### Option 2: 2-Column Balanced Grid
*Height is 7 rows tall. Two columns side-by-side inside the single boundary box.*

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#ffffff',
    'primaryTextColor': '#000000',
    'primaryBorderColor': '#000000',
    'lineColor': '#000000',
    'secondaryColor': '#ffffff',
    'tertiaryColor': '#ffffff',
    'mainBkg': '#ffffff',
    'nodeBorder': '#000000',
    'clusterBkg': '#ffffff',
    'clusterBorder': '#000000',
    'fontSize': '11px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  },
  'flowchart': {
    'curve': 'linear',
    'nodeSpacing': 14,
    'rankSpacing': 32
  }
}}%%
flowchart LR

    %% Primary Actors (Left Side)
    Admin["DSWD Admin<br/>(Logistics Supervisor)"]
    Driver["Transport Driver<br/>(Field Logistics / Trucker)"]

    %% Secondary / External Actors (Right Side)
    LGU["LGU Officer<br/>(Municipal Receiver)"]
    Blockchain["Ethereum Sepolia<br/>(Smart Contract & Relayer)"]

    %% System Boundary
    subgraph SYSTEM ["DSWD Disaster Relief Supply Chain System"]
        UC1(["Intake Goods & Mint<br/>ERC-1155 Batch Tokens"])
        UC2(["Allocate Outgoing Release<br/>& Generate Manifest QR"])
        UC3(["Track Fleet Real-Time<br/>on Road-Locked Map"])
        UC4(["Monitor Panay LGU<br/>Disaster Need Quotas"])
        UC5(["Manage Personnel Directory<br/>& Verify Credentials"])
        UC6(["Scan Dispatch QR &<br/>Verify Physical Package Count"])
        UC8(["Stream Satellite GNSS<br/>Vehicle Telemetry"])

        UC7(["Sign Gasless Custody<br/>(On-Chain Blockchain Transfer)"])
        UC9(["Multi-Hop Custody Transfer<br/>(Driver Transshipment Relay)"])
        UC10(["Present Handover QR Code"])
        UC11(["Track Approaching Relief<br/>Convoys on Map"])
        UC12(["Scan Handover QR & Confirm<br/>Final Physical Receipt"])
        UC13(["Submit Periodic Local<br/>Stock Audit Reports"])
        UC14(["Report Cargo Discrepancy<br/>/ Damaged Goods"])
    end

    %% DSWD Admin
    Admin --- UC1
    Admin --- UC2
    Admin --- UC3
    Admin --- UC4
    Admin --- UC5

    %% Transport Driver
    Driver --- UC6
    Driver --- UC7
    Driver --- UC8
    Driver --- UC9
    Driver --- UC10
    Driver --- UC14

    %% LGU Officer
    UC11 --- LGU
    UC12 --- LGU
    UC13 --- LGU
    UC14 --- LGU

    %% Ethereum Sepolia Blockchain (Dashed Lines)
    UC1 -.- Blockchain
    UC7 -.- Blockchain
    UC9 -.- Blockchain
    UC12 -.- Blockchain

    %% Standard UML Include & Extend
    UC6 -.->|<<include>>| UC7
    UC12 -.->|<<extend>>| UC14
    UC6 -.->|<<extend>>| UC14

    %% Column Top-Alignment Constraints
    UC1 ~~~ UC7
    UC2 ~~~ UC9
    UC3 ~~~ UC10
    UC4 ~~~ UC11
    UC5 ~~~ UC12
    UC6 ~~~ UC13
    UC8 ~~~ UC14

    %% Monochrome Styling Definitions
    classDef actorBox fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000;
    classDef usecaseOval fill:#ffffff,stroke:#000000,stroke-width:1.5px,color:#000000;
    
    class Admin,Driver,LGU,Blockchain actorBox;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14 usecaseOval;
```
