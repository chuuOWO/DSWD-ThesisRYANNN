# DSWD Disaster Relief Supply Chain Management System
## Ultra-Compressed 5-Tier Black-and-White System Architecture (Single Letter Page Edition)

This Mermaid diagram maintains all **5 official architectural tiers** while compressing the entire layout to fit cleanly on a **single Letter-sized page (8.5" x 11")**:
1. **All 5 Tiers Explicitly Preserved**: Every single tier (`TIER 1` to `TIER 5`) has its own independent subgraph box.
2. **2D Grid Layout (Eliminates 3-Page Height)**: Instead of stacking all 5 tiers top-to-bottom in a vertical tower, **Tier 1 & Tier 2** sit at the top, while **Tier 4 (Cloud)** and **Tier 3 + Tier 5 (Web3 Stack)** sit side-by-side beneath them.
3. **Zero Word Wrapping**: All labels are concise, single-line names without `<br/>` tags or multi-line subtitles.
4. **Strictly Straight Lines**: Configured with `'curve': 'linear'` for 100% straight connections with zero squiggly lines.
5. **Pure Monochrome**: High-contrast black and white styling for crisp thesis manuscript printing.

---

### 5-Tier Ultra-Compressed Architecture Code

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
    'nodeSpacing': 10,
    'rankSpacing': 22
  }
}}%%
flowchart TD

    subgraph TIER1 ["TIER 1: PRESENTATION & CLIENT LAYER"]
        A1["DSWD Admin Web Portal"]
        A2["Mobile Driver PWA"]
        A3["LGU Municipal Portal"]
        A4["Hardware: Camera & GPS"]
    end

    subgraph TIER2 ["TIER 2: CLIENT APPLICATION LOGIC"]
        B1["React 18 + Vite UI Engine"]
        B2["Leaflet & OSRM Road Routing"]
        B3["useInventoryState Machine"]
        B4["Web Crypto API: PBKDF2"]
        B5["Ethers.js v6 Web3 Client"]
    end

    subgraph TIER4 ["TIER 4: CLOUD BACKEND & REALTIME (SUPABASE)"]
        D1["Supabase PostgreSQL DB"]
        D2["Supabase Auth & RBAC (JWT)"]
        D3["Supabase Realtime WebSockets"]
        D4["Relational Data Tables"]
    end

    subgraph TIER3 ["TIER 3: TRANSACTION RELAYER & MIDDLEWARE"]
        C1["Headless Relayer (0xC699...)"]
        C2["Alchemy Sepolia JSON-RPC Node"]
        C3["Alchemy Gasless Paymaster"]
    end

    subgraph TIER5 ["TIER 5: ETHEREUM BLOCKCHAIN (SEPOLIA)"]
        E1["DSWDReliefTracker Contract (ERC-1155)"]
        E2["Smart Contract Escrow Vault"]
        E3["Multi-Hop Custody Ledger"]
        E4["Sepolia Etherscan Explorer"]
    end

    %% Tier 1 to Tier 2
    A1 & A2 & A3 & A4 --> B1
    B1 --> B2 & B3 & B4 & B5

    %% Tier 2 to Tier 4 (Cloud Backend on Left)
    B1 -->|REST API| D1
    B1 -->|JWT Auth| D2
    B1 -->|Live GPS| D3
    D1 --> D4

    %% Tier 2 to Tier 3 (Relayer on Right)
    B5 -->|Sign Payload| C1
    C1 --> C2 --> C3

    %% Tier 3 to Tier 5 (Blockchain Execution on Right)
    C2 -->|Relay Tx| E1
    E1 --> E2 --> E3
    E1 -.-> E4
    E1 -.->|Sync Event| D1

    %% Side-by-side alignment: Tier 4 (Left) and Tier 3 + 5 (Right)
    TIER4 ~~~ TIER3

    %% Monochrome Styling Definitions
    classDef bwBox fill:#ffffff,stroke:#000000,stroke-width:1.5px,color:#000000;
    classDef bwCluster fill:#ffffff,stroke:#000000,stroke-width:2px,stroke-dasharray: 4 2,color:#000000;
    
    class A1,A2,A3,A4,B1,B2,B3,B4,B5,C1,C2,C3,D1,D2,D3,D4,E1,E2,E3,E4 bwBox;
```
