# DSWD Disaster Relief Supply Chain Management System
## Ultra-Compressed Black-and-White Software Architecture (Publication & draw.io Edition)

This Mermaid diagram models the internal **Software Architecture** of the codebase:
1. **18px Text Size**: Configured with `'fontSize': '18px'` in `themeVariables` for large, clear readability in thesis documents.
2. **Ultra-Compressed Spacing**: Configured with minimal spacing (`nodeSpacing: 10`, `rankSpacing: 18`) to pack all modules tightly without dead space.
3. **No Word Wrapping**: Single-line, crisp module titles without `<br/>` tags.
4. **Pure Monochrome**: `#ffffff` fills, `#000000` borders, text, and arrowheads for sharp black-and-white printing.
5. **Strictly Straight Lines**: Configured with `'curve': 'linear'` for 100% straight connections with zero wavy lines.

---

### Software Architecture Code (18px Monochrome Edition)

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
    'fontSize': '18px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  },
  'flowchart': {
    'curve': 'linear',
    'nodeSpacing': 10,
    'rankSpacing': 18
  }
}}%%
flowchart TD

    subgraph UI ["1. PRESENTATION LAYER (REACT 18 + VITE)"]
        UI1["Admin Dashboard & Views"]
        UI2["Driver Mobile PWA"]
        UI3["LGU Municipal Portal"]
        UI4["Requisition & QR Modals"]
    end

    subgraph STATE ["2. STATE MANAGEMENT & REACTIVE LOGIC"]
        ST1["useInventoryState Machine Hook"]
        ST2["AuthContext & CDC Sync"]
        ST3["Priority Logic Urgency Engine"]
        ST4["Leaflet & OSRM Routing Engine"]
    end

    subgraph SERVICES ["3. DATA ACCESS & CLOUD PERSISTENCE (WEB2)"]
        SV1["backendApi Service (61 CRUD Methods)"]
        SV2["authApi RBAC Security Service"]
        DB1["Supabase PostgreSQL (13 Tables)"]
        DB2["Row-Level Security & Triggers"]
        DB3["Supabase Realtime WebSockets"]
    end

    subgraph BLOCKCHAIN ["4. CRYPTOGRAPHY & SMART CONTRACTS (WEB3)"]
        CR1["Web Crypto API: PBKDF2 Key Derivation"]
        CR2["EIP-712 Typed Data Signer"]
        SV3["blockchain.ts Web3 Service"]
        SC1["DSWDReliefTracker Contract (ERC-1155)"]
        SC2["Smart Contract Escrow Vault Storage"]
        SC3["Dynamic Multi-Hop Custody Array"]
        SC4["Gasless Relayer Execution (0xC699...)"]
    end

    %% UI to State
    UI1 & UI2 & UI3 & UI4 --> ST1
    ST1 --> ST2 & ST3 & ST4

    %% State to Web2
    ST1 --> SV1
    ST2 --> SV2
    SV1 --> DB1
    SV2 --> DB2
    ST4 -.-> DB3

    %% State to Web3
    ST1 --> CR1
    CR1 --> CR2 --> SV3
    SV3 --> SC4
    SC4 --> SC1
    SC1 --> SC2 --> SC3
    SC1 -.->|Sync Event| DB1

    %% Force Web2 and Web3 side-by-side
    SERVICES ~~~ BLOCKCHAIN

    %% Monochrome Styling Definitions
    classDef bwBox fill:#ffffff,stroke:#000000,stroke-width:1.5px,color:#000000;
    classDef bwCluster fill:#ffffff,stroke:#000000,stroke-width:2px,stroke-dasharray: 4 2,color:#000000;
    
    class UI1,UI2,UI3,UI4,ST1,ST2,ST3,ST4,SV1,SV2,DB1,DB2,DB3,CR1,CR2,SV3,SC1,SC2,SC3,SC4 bwBox;
```

