# DSWD Disaster Relief Supply Chain Management System
## Modular Publication-Ready Entity-Relationship Diagrams (ERD) - Version 3
### Academic Thesis Format | Monochrome (Black & White) | Standard Crow's Foot Notation | 8.5" x 11" Portrait Optimized

To ensure 100% legibility on letter-sized portrait paper (8.5" $\times$ 11") without visual clutter or microscopic text, the schema is decomposed into **three dedicated domain sub-models**:

1. **Figure 3.1:** *Master Geo-Logistics, Fleet & Personnel Directory* (5 entities)
2. **Figure 3.2:** *Inbound Relief Intake, Tokenized Blockchain Batches & Warehouse Inventory* (7 entities)
3. **Figure 3.3:** *Relief Dispatch, Live Telemetry, Custody Transshipment & Field Auditing* (8 entities)

---

## Figure 3.1: Master Geo-Logistics, Fleet & Personnel Directory

*Models regional jurisdictions, municipal local government units (LGUs), centralized relief warehouses, transport fleet vehicles, and authenticated user profiles.*

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
    'attributeBackgroundColorOdd': '#ffffff',
    'attributeBackgroundColorEven': '#ffffff',
    'fontSize': '12px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  }
}}%%
erDiagram

    provinces ||--o{ lgus : "governs"
    provinces ||--o{ warehouses : "locates"
    lgus ||--o{ warehouses : "hosts"
    lgus ||--o{ profiles : "employs"
    warehouses ||--o{ profiles : "stations"
    trucks ||--o{ profiles : "assigns"

    provinces {
        uuid prv_id PK
        text prv_name UK
        text prv_region
        boolean prv_is_active
    }

    lgus {
        uuid lgu_id PK
        uuid lgu_province_id FK
        text lgu_municipality
        text lgu_name
        int lgu_urgency_score
        text lgu_priority_color
        boolean lgu_is_active
    }

    warehouses {
        uuid wrh_id PK
        uuid wrh_province_id FK
        uuid wrh_lgu_id FK
        text wrh_name UK
        int wrh_capacity_packs
        boolean wrh_is_active
    }

    trucks {
        text trk_truck_id PK
        text trk_plate_number UK
        text trk_model
        int trk_capacity_kg
        boolean trk_is_active
    }

    profiles {
        uuid prfl_id PK
        text prfl_official_id UK
        text prfl_email
        text prfl_full_name
        text prfl_role
        text prfl_truck_id FK
        uuid prfl_lgu_id FK
        uuid prfl_warehouse_id FK
        text prfl_status
    }
```

---

## Figure 3.2: Inbound Relief Intake, Tokenized Blockchain Batches & Warehouse Inventory

*Models incoming supplier shipments, relief goods categorization, disaster incident tagging, ERC-1155 token minting, physical warehouse stock balances, and the immutable inventory ledger.*

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
    'attributeBackgroundColorOdd': '#ffffff',
    'attributeBackgroundColorEven': '#ffffff',
    'fontSize': '12px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  }
}}%%
erDiagram

    supply_sources ||--o{ incoming_manifests : "supplies"
    kit_types ||--o{ incoming_manifests : "classifies"
    incidents ||--o{ incoming_manifests : "prompts"
    
    incoming_manifests ||--o{ inventory_batches : "tokenizes"
    kit_types ||--o{ inventory_batches : "specifies"

    kit_types ||--o{ warehouse_stock : "stocks"
    kit_types ||--o{ stock_ledger : "categorizes"
    incoming_manifests ||--o{ stock_ledger : "records"

    supply_sources {
        uuid src_id PK
        text src_short_code UK
        text src_name
        text src_type
        boolean src_is_active
    }

    kit_types {
        uuid kit_id PK
        text kit_name UK
        text kit_category
        text kit_unit_type
        boolean kit_is_active
    }

    incidents {
        text incd_incident_code PK
        text incd_incident_name
        text incd_disaster_type
        date incd_incident_date
        text incd_severity_level
    }

    incoming_manifests {
        uuid inm_id PK
        text inm_manifest_number UK
        date inm_date_received
        text inm_incident_code FK
        uuid inm_supply_source_id FK
        uuid inm_dest_warehouse_id FK
        uuid inm_kit_type_id FK
        int inm_quantity
        text inm_status
        text inm_manifest_hash
        uuid inm_verified_by_profile_id FK
    }

    inventory_batches {
        uuid bat_id PK
        text bat_batch_token_id UK
        uuid bat_incoming_manifest_id FK
        uuid bat_kit_type_id FK
        int bat_quantity_minted
        text bat_mint_tx_hash
        uuid bat_minted_by_profile_id FK
        timestamptz bat_minted_at
    }

    warehouse_stock {
        uuid wst_id PK
        uuid wst_warehouse_id FK
        uuid wst_kit_type_id FK
        int wst_quantity
        timestamptz wst_updated_at
    }

    stock_ledger {
        uuid led_id PK
        uuid led_warehouse_id FK
        uuid led_kit_type_id FK
        uuid led_reference_manifest_id FK
        text led_transaction_type
        int led_quantity_change
        int led_balance_after
        uuid led_actor_profile_id FK
        timestamptz led_created_at
    }
```

---

## Figure 3.3: Relief Dispatch, Live Telemetry, Custody Transshipment & Field Auditing

*Models outgoing municipal allocations, FIFO batch deprivations, live GPS convoy tracking, multi-hop transshipments, destination LGU stock, emergency needs reports, and discrepancy inspections.*

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
    'attributeBackgroundColorOdd': '#ffffff',
    'attributeBackgroundColorEven': '#ffffff',
    'fontSize': '12px',
    'fontFamily': 'Arial, Helvetica, sans-serif'
  }
}}%%
erDiagram

    outgoing_requests ||--o{ outgoing_batch_allocations : "allocates"
    outgoing_requests ||--o{ truck_live_locations : "tracks"
    outgoing_requests ||--o{ custody_hops : "transfers"
    outgoing_requests ||--o{ lgu_stock : "replenishes"
    outgoing_requests ||--o{ discrepancy_reports : "flags"
    outgoing_requests ||--o{ activity_logs : "logs"
    lgu_stock ||--o{ lgu_inventory_reports : "audits"

    outgoing_requests {
        uuid req_id PK
        text req_dr_number UK
        date req_date_allocated
        text req_source_type
        uuid req_source_warehouse_id FK
        uuid req_source_lgu_id FK
        uuid req_lgu_id FK
        uuid req_kit_type_id FK
        int req_amount_requested
        int req_amount_approved
        text req_delivery_status
        text req_incident_code FK
        text req_assigned_truck_id FK
        uuid req_assigned_driver_profile_id FK
        uuid req_approved_by_profile_id FK
        uuid req_dispatched_by_profile_id FK
        uuid req_received_by_profile_id FK
        text req_sender_signature
        text req_receiver_signature
        text req_tx_hash
        int req_delivery_priority
        boolean req_is_held
        timestamptz req_created_at
    }

    outgoing_batch_allocations {
        uuid bal_id PK
        uuid bal_outgoing_request_id FK
        text bal_batch_token_id FK
        int bal_allocated_quantity
        timestamptz bal_allocated_at
    }

    truck_live_locations {
        text tloc_truck_id PK
        text tloc_current_dr_number FK
        uuid tloc_driver_profile_id FK
        text tloc_status
        double tloc_speed
        double tloc_heading
        double tloc_latitude
        double tloc_longitude
        text tloc_gps_text
        timestamptz tloc_updated_at
    }

    custody_hops {
        uuid hop_id PK
        uuid hop_outgoing_request_id FK
        int hop_sequence
        uuid hop_from_driver_profile_id FK
        uuid hop_to_driver_profile_id FK
        text hop_from_truck_id FK
        text hop_to_truck_id FK
        text hop_gps_coordinates
        text hop_note
        text hop_tx_hash
        timestamptz hop_transferred_at
    }

    lgu_stock {
        uuid lst_lgu_id PK_FK
        uuid lst_kit_type_id PK_FK
        int lst_quantity
        timestamptz lst_updated_at
    }

    lgu_inventory_reports {
        uuid lir_id PK
        uuid lir_lgu_id FK
        uuid lir_reported_by_profile_id FK
        int lir_affected_families
        int lir_damage_index
        int lir_urgency_score
        text lir_priority_color
        text lir_recommendation
        timestamptz lir_reported_at
    }

    discrepancy_reports {
        uuid disc_id PK
        text disc_report_type
        text disc_manifest_number FK
        text disc_dr_number FK
        uuid disc_reported_by_profile_id FK
        uuid disc_resolved_by_profile_id FK
        text disc_status
        text disc_note
        timestamptz disc_reported_at
    }

    activity_logs {
        uuid log_id PK
        uuid log_actor_id FK
        text log_actor_name
        text log_actor_role
        text log_action_type
        text log_dr_number FK
        text log_details
        text log_tx_hash
        timestamptz log_created_at
    }
```

---

## Academic Thesis Integration Summary

| Figure | Subsystem Focus | Table Count | Typical Thesis Section Placement |
|---|---|---|---|
| **Figure 3.1** | Jurisdictions, Facilities & Actor Directory | 5 tables | *Section 3.2.1: System Architecture & Organizational Actors* |
| **Figure 3.2** | Inbound Procurement, Verification & Token Minting | 7 tables | *Section 3.2.2: Relief Goods Tokenization & Intake Pipeline* |
| **Figure 3.3** | Outbound Dispatch, Telemetry & Custody Tracking | 8 tables | *Section 3.2.3: Fleet Telemetry, Multi-Hop Handover & Field Acceptance* |

*Note: All tables and columns map 1-to-1 with `supabase-schema-patch-v3.sql`. Full physical definitions with exhaustive column listings are documented in Appendix: Data Dictionary.*
