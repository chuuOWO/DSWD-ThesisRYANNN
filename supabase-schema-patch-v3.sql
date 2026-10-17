-- ==============================================================================
-- DSWD DISASTER RESPONSE SUPPLY CHAIN MANAGEMENT SYSTEM
-- AUTHORITATIVE DATABASE SCHEMA & MIGRATION SCRIPT (VERSION 3)
-- ==============================================================================
-- Production-hardened, idempotent, and rerun-safe.
-- Harmonized 1-to-1 with TypeScript Application Models:
-- 1. Standard clean column names (truck_id, plate_number, incident_code, 
--    batch_token_id, manifest_number, dr_number) matching backendApi.ts.
-- 2. Master Fleet table (trucks) with live convoy truck assignments.
-- 3. Master Incidents table (incidents) with disaster state tracking.
-- 4. End-to-end Lot & Batch Provenance (inventory_batches & outgoing_batch_allocations).
-- 5. Multi-hop Convoy Custody Relay table (custody_hops).
-- 6. Normalized 3NF Inventory (warehouse_stock, lgu_stock, stock_ledger).
-- 7. Realtime Replication registered across all 21 tables.
-- 8. Public Read Policies on trucks, incidents, kit_types, and locations
--    for seamless login, registration dropdowns, and live tracking.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. MASTER GEO-LOGISTICS & SPECIFICATION TABLES
-- ==============================================================================

-- 2.1 TABLE: provinces (Provincial Jurisdictions)
create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text not null default 'Region VI (Western Visayas)',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.provinces (name, region) values
  ('Aklan', 'Region VI (Western Visayas)'),
  ('Antique', 'Region VI (Western Visayas)'),
  ('Capiz', 'Region VI (Western Visayas)'),
  ('Guimaras', 'Region VI (Western Visayas)'),
  ('Iloilo', 'Region VI (Western Visayas)'),
  ('Negros Occidental', 'Region VI (Western Visayas)')
on conflict (name) do nothing;

-- 2.2 TABLE: supply_sources (National Resource Centers & Inbound Hubs)
create table if not exists public.supply_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  facility_type text not null default 'National Resource Center',
  region text not null default 'Region VII (Central Visayas)',
  location text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.supply_sources (name, short_code, facility_type, region, location) values
  ('Visayas Disaster Resource Center (VDRC)', 'VDRC', 'National Resource Center', 'Region VII (Central Visayas)', 'Tingub, Mandaue City, Cebu'),
  ('Luzon Disaster Resource Center (LDRC)', 'LDRC', 'National Resource Center', 'National Capital Region / Region III', 'Pasay City / Clark Special Economic Zone')
on conflict (short_code) do nothing;

-- 2.3 TABLE: kit_types (Standard FNFI Kit Specifications)
create table if not exists public.kit_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('Food Item', 'Non-Food Item')),
  unit_type text not null default 'packs',
  description text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.kit_types (name, category, unit_type, description) values
  ('Family Food Pack', 'Food Item', 'packs', 'Standard 6kg emergency nutritional food pack (rice, canned goods, coffee)'),
  ('Hygiene Kit', 'Non-Food Item', 'kits', 'Personal sanitation supplies, soap, toothpaste, toothbrush, sanitary napkins'),
  ('Sleeping Kit', 'Non-Food Item', 'kits', 'Blankets, sleeping mats, mosquito nets, and pillowcases'),
  ('Kitchen Kit', 'Non-Food Item', 'kits', 'Cooking pots, frying pan, plates, cups, spoons, forks, and cooking utensils'),
  ('Family Kit', 'Non-Food Item', 'kits', 'Clothing apparel, underwear, bath towels, and footwear for families'),
  ('Laminated Sacks', 'Non-Food Item', 'sacks', 'Heavy-duty weatherproofing tarpaulins for temporary roof shelters'),
  ('Ready-to-Eat Food (RTEF)', 'Food Item', 'packs', 'Pre-cooked retort pouch meals requiring zero preparation')
on conflict (name) do nothing;

-- 2.4 TABLE: lgus (Master Panay LGUs Directory & Live Status)
create table if not exists public.lgus (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete restrict,
  municipality text not null,
  province text not null default 'Iloilo',
  lgu_name text not null,
  contact_person text default '',
  contact_number text default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  affected_families integer not null default 0 check (affected_families >= 0),
  damage_index integer not null default 0 check (damage_index between 0 and 100),
  max_stock integer not null default 3000 check (max_stock > 0),
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  sleeping_kits integer not null default 0,
  kitchen_kits integer not null default 0,
  family_kits integer not null default 0,
  laminated_sacks integer not null default 0,
  rtef integer not null default 0,
  current_stock jsonb not null default '{}'::jsonb,
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  priority_color text not null default 'Green' check (priority_color in ('Red', 'Orange', 'Yellow', 'Green')),
  recommendation text default '',
  remarks text default '',
  is_active boolean not null default true,
  last_reported_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_lgus_muni_prov unique (municipality, province)
);

create index if not exists idx_lgus_province_id on public.lgus (province_id);
create index if not exists idx_lgus_province_municipality on public.lgus (province, municipality);
create index if not exists idx_lgus_priority on public.lgus (priority_color, urgency_score desc);

alter table public.lgus add column if not exists food_packs integer not null default 0;
alter table public.lgus add column if not exists hygiene_kits integer not null default 0;
alter table public.lgus add column if not exists sleeping_kits integer not null default 0;
alter table public.lgus add column if not exists kitchen_kits integer not null default 0;
alter table public.lgus add column if not exists family_kits integer not null default 0;
alter table public.lgus add column if not exists laminated_sacks integer not null default 0;
alter table public.lgus add column if not exists rtef integer not null default 0;
alter table public.lgus add column if not exists current_stock jsonb not null default '{}'::jsonb;

-- Seed baseline Panay LGUs
insert into public.lgus (municipality, province, lgu_name, latitude, longitude) values
  ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', 11.1714, 122.9818),
  ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332),
  ('Anilao', 'Iloilo', 'Anilao Municipal Hall', 10.9856, 122.7533),
  ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312),
  ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', 11.4721, 123.0847),
  ('Banate', 'Iloilo', 'Banate Municipal Hall', 11.0022, 122.8174),
  ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027),
  ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', 11.0503, 122.8466),
  ('Batad', 'Iloilo', 'Batad Municipal Hall', 11.4167, 123.0833),
  ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', 11.2036, 122.5639),
  ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856),
  ('Calinog', 'Iloilo', 'Calinog Municipal Hall', 11.1242, 122.4939),
  ('Carles', 'Iloilo', 'Carles Municipal Hall', 11.5833, 123.1667),
  ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', 11.2189, 123.1111),
  ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11.0000, 122.6667),
  ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167),
  ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167),
  ('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528),
  ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.6600, 122.3167),
  ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667),
  ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621),
  ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.9500, 122.5000),
  ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.0500, 122.4833),
  ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833),
  ('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167),
  ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831),
  ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333),
  ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352),
  ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833),
  ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6000),
  ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse Hub', 10.6975, 122.4764),
  ('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417),
  ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.5400),
  ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272),
  ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833),
  ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.6500),
  ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333),
  ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667),
  ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333),
  ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.8200, 122.5333),
  ('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167),
  ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.6750, 122.3806),
  ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.7500, 122.3333),
  ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.8200, 122.6100),
  ('Anini-y', 'Antique', 'Anini-y Municipal Hall', 10.4333, 121.9333),
  ('Barbaza', 'Antique', 'Barbaza Municipal Hall', 11.2167, 122.0667),
  ('Belison', 'Antique', 'Belison Municipal Hall', 10.8333, 121.9667),
  ('Bugasong', 'Antique', 'Bugasong Municipal Hall', 11.0500, 122.0667),
  ('Caluya', 'Antique', 'Caluya Municipal Hall', 11.9167, 121.5667),
  ('Culasi', 'Antique', 'Culasi Municipal Hall', 11.4333, 122.0667),
  ('Hamtic', 'Antique', 'Hamtic Municipal Hall', 10.7000, 121.9833),
  ('Laua-an', 'Antique', 'Laua-an Municipal Hall', 11.1500, 122.0500),
  ('Libertad', 'Antique', 'Libertad Municipal Hall', 12.0333, 121.9167),
  ('Pandan', 'Antique', 'Pandan Municipal Hall', 11.7167, 122.1000),
  ('Patnongon', 'Antique', 'Patnongon Municipal Hall', 10.9167, 121.9833),
  ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', 10.7500, 121.9500),
  ('San Remigio', 'Antique', 'San Remigio Municipal Hall', 10.7833, 122.0833),
  ('Sebaste', 'Antique', 'Sebaste Municipal Hall', 11.5833, 122.0833),
  ('Sibalom', 'Antique', 'Sibalom Municipal Hall', 10.7833, 122.0167),
  ('Tibiao', 'Antique', 'Tibiao Municipal Hall', 11.2833, 122.0333),
  ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', 10.5167, 121.9333),
  ('Valderrama', 'Antique', 'Valderrama Municipal Hall', 11.0000, 122.1333),
  ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', 11.3500, 122.6833),
  ('Dao', 'Capiz', 'Dao Municipal Hall', 11.3833, 122.6833),
  ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', 11.3000, 122.6167),
  ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', 11.2667, 122.7000),
  ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', 11.5167, 122.7000),
  ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', 11.4333, 122.4833),
  ('Maayon', 'Capiz', 'Maayon Municipal Hall', 11.3833, 122.7833),
  ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', 11.4333, 122.6000),
  ('Panay', 'Capiz', 'Panay Municipal Hall', 11.5500, 122.8000),
  ('Panitan', 'Capiz', 'Panitan Municipal Hall', 11.4667, 122.7667),
  ('Pilar', 'Capiz', 'Pilar Municipal Hall', 11.4833, 122.9833),
  ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', 11.4833, 122.8500),
  ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', 11.4333, 122.9333),
  ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', 11.5853, 122.7511),
  ('Sapian', 'Capiz', 'Sapian Municipal Hall', 11.5000, 122.6000),
  ('Sigma', 'Capiz', 'Sigma Municipal Hall', 11.4167, 122.6667),
  ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', 11.2667, 122.5333),
  ('Altavas', 'Aklan', 'Altavas Municipal Hall', 11.5333, 122.5000),
  ('Balete', 'Aklan', 'Balete Municipal Hall', 11.5500, 122.3833),
  ('Banga', 'Aklan', 'Banga Municipal Hall', 11.6333, 122.3333),
  ('Batan', 'Aklan', 'Batan Municipal Hall', 11.5833, 122.5000),
  ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', 11.8333, 121.8833),
  ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', 11.8167, 122.1667),
  ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', 11.7083, 122.3667),
  ('Lezo', 'Aklan', 'Lezo Municipal Hall', 11.6667, 122.3333),
  ('Libacao', 'Aklan', 'Libacao Municipal Hall', 11.4500, 122.3000),
  ('Madalag', 'Aklan', 'Madalag Municipal Hall', 11.5167, 122.3000),
  ('Makato', 'Aklan', 'Makato Municipal Hall', 11.7167, 122.2833),
  ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', 11.9000, 121.9167),
  ('Malinao', 'Aklan', 'Malinao Municipal Hall', 11.6500, 122.3167),
  ('Nabas', 'Aklan', 'Nabas Municipal Hall', 11.8833, 122.0667),
  ('New Washington', 'Aklan', 'New Washington Municipal Hall', 11.6500, 122.4333),
  ('Numancia', 'Aklan', 'Numancia Municipal Hall', 11.7000, 122.3333),
  ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', 11.7833, 122.2500),
  ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', 10.6583, 122.5933),
  ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', 10.6939, 122.6842),
  ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', 10.5186, 122.5414),
  ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', 10.6128, 122.6881),
  ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', 10.5500, 122.6333)
on conflict (municipality, province) do update set
  lgu_name = excluded.lgu_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

update public.lgus l
set province_id = p.id
from public.provinces p
where l.province_id is null
  and lower(trim(l.province)) = lower(trim(p.name));

-- 2.5 TABLE: warehouses (Regional Storage Warehouses)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete restrict,
  lgu_id uuid references public.lgus(id) on delete set null,
  name text not null unique,
  province text not null default 'Iloilo',
  municipality text not null default 'Oton',
  capacity_packs integer not null default 50000 check (capacity_packs > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  sleeping_kits integer not null default 0,
  kitchen_kits integer not null default 0,
  family_kits integer not null default 0,
  laminated_sacks integer not null default 0,
  rtef integer not null default 0,
  current_stock jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.warehouses (name, province, municipality, capacity_packs, latitude, longitude)
values
  ('Oton Main Warehouse', 'Iloilo', 'Oton', 150000, 10.6975, 122.4764),
  ('Pototan Main Warehouse', 'Iloilo', 'Pototan', 80000, 10.9492, 122.6289)
on conflict (name) do nothing;

update public.warehouses w
set province_id = p.id
from public.provinces p
where w.province_id is null
  and lower(trim(w.province)) = lower(trim(p.name));

update public.warehouses w
set lgu_id = l.id
from public.lgus l
where w.lgu_id is null
  and lower(trim(w.municipality)) = lower(trim(l.municipality));

create index if not exists idx_warehouses_province_id on public.warehouses (province_id);
create index if not exists idx_warehouses_lgu_id on public.warehouses (lgu_id);

-- ==============================================================================
-- 3. FLEET & DISASTER INCIDENT MASTER TABLES
-- ==============================================================================

-- 3.1 TABLE: trucks (Master Transport Fleet Directory)
create table if not exists public.trucks (
  truck_id text primary key,
  plate_number text not null unique,
  model text not null default 'DSWD 6-Wheeler Relief Cargo Truck',
  capacity_kg integer not null default 5000 check (capacity_kg > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.trucks (truck_id, plate_number, model, capacity_kg) values
  ('TRUCK-01', 'SAA-1001', 'Isuzu Forward 6-Wheeler (5-Ton)', 5000),
  ('TRUCK-02', 'SAA-1002', 'Isuzu Forward 6-Wheeler (5-Ton)', 5000),
  ('TRUCK-03', 'SAA-1003', 'Hino 500 Series (6-Ton)', 6000),
  ('TRUCK-04', 'SAA-1004', 'Hino 500 Series (6-Ton)', 6000),
  ('TRUCK-05', 'SAA-1005', 'Fuso Fighter (7-Ton Heavy)', 7000),
  ('TRUCK-06', 'SAA-1006', 'Fuso Fighter (7-Ton Heavy)', 7000),
  ('TRUCK-07', 'SAA-1007', 'Isuzu Elf Light Cargo (3-Ton)', 3000),
  ('TRUCK-08', 'SAA-1008', 'Isuzu Elf Light Cargo (3-Ton)', 3000),
  ('TRUCK-09', 'SAA-1009', 'Mitsubishi Canter (3-Ton)', 3000),
  ('TRUCK-10', 'SAA-1010', 'Mitsubishi Canter (3-Ton)', 3000)
on conflict (truck_id) do nothing;

-- 3.2 TABLE: incidents (Disaster Incident Master)
create table if not exists public.incidents (
  incident_code text primary key,
  disaster_name text not null,
  disaster_type text not null,
  declared_at timestamptz not null default now(),
  status text not null default 'Active' check (status in ('Active', 'Monitoring', 'Closed')),
  region text not null default 'Region VI (Western Visayas)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.incidents (incident_code, disaster_name, disaster_type, status) values
  ('INC-2026-PREPOSITION', 'Regular Disaster Preparedness & Buffer Prepositioning', 'Relief Prepositioning / Augmentation', 'Active'),
  ('INC-2026-TY-01', 'Typhoon Auring (Tropical Cyclone Relief Operation)', 'Typhoon / Tropical Cyclone', 'Active'),
  ('INC-2026-FLD-01', 'Western Visayas Monsoon Inundation & Flash Floods', 'Flood / Inundation', 'Active'),
  ('INC-2026-EQ-01', 'Panay Central Fault Seismic Movement', 'Earthquake', 'Active')
on conflict (incident_code) do nothing;

-- ==============================================================================
-- 4. USER AUTHENTICATION & JURISDICTION PROFILES
-- ==============================================================================

-- 4.1 TABLE: profiles (RBAC, Official Credentials & Jurisdictions)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  official_id text unique,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone_number text default '',
  job_position text default '',
  work_id_url text,
  role text not null default 'receiver' check (role in ('dswd_admin', 'receiver')),
  truck_id text references public.trucks(truck_id) on update cascade on delete set null,
  lgu_id uuid references public.lgus(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  lgu_name text,
  wallet_address text,
  avatar_url text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  pending_email text,
  email_change_status text default null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_lgu_id on public.profiles (lgu_id);
create index if not exists idx_profiles_truck_id on public.profiles (truck_id);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_status on public.profiles (status);

alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles drop column if exists full_name;

-- ==============================================================================
-- 5. SUPPLY CHAIN INTAKE, BATCH PROVENANCE & DISPATCH TABLES
-- ==============================================================================

-- 5.1 TABLE: incoming_manifests (Inbound Goods Receiving & Physical Inspection)
create table if not exists public.incoming_manifests (
  id uuid primary key default gen_random_uuid(),
  manifest_number text not null unique,
  date_received date not null default current_date,
  supply_source_id uuid references public.supply_sources(id) on delete set null,
  destination_type text not null default 'Warehouse' check (destination_type in ('Warehouse', 'LGU')),
  destination_warehouse_id uuid references public.warehouses(id) on delete set null,
  destination_lgu_id uuid references public.lgus(id) on delete set null,
  kit_type_id uuid references public.kit_types(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_type text not null default 'packs',
  expiration_date date,
  incident_code text references public.incidents(incident_code) on update cascade on delete set null,
  status text not null default 'Draft' check (status in ('Draft', 'Pending Verification', 'Verified', 'Correction Requested', 'Rejected')),
  manifest_hash text default '',
  verified_by text default '',
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  correction_note text default '',
  source text not null default '',
  destination text not null default '',
  category text not null default '',
  created_at timestamptz not null default now(),
  constraint chk_incoming_dest_mutex check (
    (destination_type = 'Warehouse' and destination_warehouse_id is not null and destination_lgu_id is null) or
    (destination_type = 'LGU' and destination_lgu_id is not null and destination_warehouse_id is null)
  )
);

create index if not exists idx_incoming_manifest_num on public.incoming_manifests (manifest_number);
create index if not exists idx_incoming_dest_wh on public.incoming_manifests (destination_warehouse_id);
create index if not exists idx_incoming_dest_lgu on public.incoming_manifests (destination_lgu_id);
create index if not exists idx_incoming_kit_type on public.incoming_manifests (kit_type_id);
create index if not exists idx_incoming_status on public.incoming_manifests (status);

-- 5.2 TABLE: inventory_batches (Inbound Lot & Cryptographic Batch Token Ledger)
create table if not exists public.inventory_batches (
  batch_token_id text primary key,
  incoming_manifest_id uuid references public.incoming_manifests(id) on delete cascade,
  kit_type_id uuid references public.kit_types(id) on delete set null,
  initial_quantity integer not null check (initial_quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  warehouse_id uuid references public.warehouses(id) on delete set null,
  lgu_id uuid references public.lgus(id) on delete set null,
  expiration_date date,
  manifest_hash text default '',
  minted_by_profile_id uuid references public.profiles(id) on delete set null,
  minted_at timestamptz not null default now()
);

create index if not exists idx_batches_manifest on public.inventory_batches (incoming_manifest_id);
create index if not exists idx_batches_kit on public.inventory_batches (kit_type_id);
create index if not exists idx_batches_wh on public.inventory_batches (warehouse_id);

-- 5.3 TABLE: outgoing_requests (Relief Allocation, Blockchain Minting & Custody Dispatch)
create table if not exists public.outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  dr_number text not null unique,
  date_allocated date not null default current_date,
  source_type text not null default 'Warehouse' check (source_type in ('Warehouse', 'LGU')),
  source_warehouse_id uuid references public.warehouses(id) on delete restrict,
  source_lgu_id uuid references public.lgus(id) on delete restrict,
  lgu_id uuid not null references public.lgus(id) on delete restrict,
  destination_lgu_id uuid references public.lgus(id) on delete restrict,
  kit_type_id uuid references public.kit_types(id) on delete restrict,
  amount_requested integer not null check (amount_requested > 0),
  amount_approved integer not null default 0 check (amount_approved >= 0),
  delivery_mode text default 'DSWD Assigned Receiver',
  delivery_status text not null default 'Allocating' check (
    delivery_status in ('Allocating', 'Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed', 'Correction Requested', 'Cancelled')
  ),
  incident_code text references public.incidents(incident_code) on update cascade on delete set null,
  assigned_truck_id text references public.trucks(truck_id) on update cascade on delete set null,
  assigned_driver_profile_id uuid references public.profiles(id) on delete set null,
  handover_contract_id text default '',
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  dispatched_by_profile_id uuid references public.profiles(id) on delete set null,
  received_by_profile_id uuid references public.profiles(id) on delete set null,
  admin_signature text default '',
  sender_signature text default '',
  receiver_signature text default '',
  sender_gps text default '',
  receiver_gps text default '',
  destination_address text default '',
  tx_hash text default '',
  wallet_address text default '',
  warehouse_source text not null default '',
  source_name_snapshot text default '',
  lgu_name text not null default '',
  province text not null default '',
  municipality text not null default '',
  category text not null default '',
  item_name_snapshot text default '',
  delivery_priority integer not null default 0,
  is_held boolean not null default false,
  correction_note text default '',
  allocated_batches jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint chk_outgoing_source_mutex check (
    (source_type = 'Warehouse' and source_warehouse_id is not null and source_lgu_id is null) or
    (source_type = 'LGU' and source_lgu_id is not null and source_warehouse_id is null)
  )
);

create index if not exists idx_outgoing_dr_num on public.outgoing_requests (dr_number);
create index if not exists idx_outgoing_lgu_id on public.outgoing_requests (lgu_id);
create index if not exists idx_outgoing_source_wh on public.outgoing_requests (source_warehouse_id);
create index if not exists idx_outgoing_source_lgu on public.outgoing_requests (source_lgu_id);
create index if not exists idx_outgoing_truck on public.outgoing_requests (assigned_truck_id);
create index if not exists idx_outgoing_status on public.outgoing_requests (delivery_status, created_at desc);

alter table public.outgoing_requests add column if not exists destination_lgu_id uuid references public.lgus(id);
alter table public.outgoing_requests add column if not exists item_name_snapshot text default '';
alter table public.outgoing_requests add column if not exists source_name_snapshot text default '';

-- 5.4 TABLE: outgoing_batch_allocations (Line-Item Token Allocation per DR)
create table if not exists public.outgoing_batch_allocations (
  id uuid primary key default gen_random_uuid(),
  outgoing_request_id text not null references public.outgoing_requests(dr_number) on delete cascade,
  batch_token_id text not null references public.inventory_batches(batch_token_id) on delete restrict,
  allocated_quantity integer not null check (allocated_quantity > 0),
  allocated_at timestamptz not null default now()
);

create index if not exists idx_allocations_dr on public.outgoing_batch_allocations (outgoing_request_id);
create index if not exists idx_allocations_batch on public.outgoing_batch_allocations (batch_token_id);

-- 5.5 TABLE: custody_hops (Multi-Hop Convoy Relay Tracking)
create table if not exists public.custody_hops (
  id uuid primary key default gen_random_uuid(),
  outgoing_request_id text not null references public.outgoing_requests(dr_number) on delete cascade,
  sequence integer not null check (sequence >= 1),
  from_driver_profile_id uuid references public.profiles(id) on delete set null,
  to_driver_profile_id uuid not null references public.profiles(id) on delete restrict,
  from_truck_id text references public.trucks(truck_id) on update cascade on delete set null,
  to_truck_id text references public.trucks(truck_id) on update cascade on delete set null,
  gps_coordinates text not null,
  note text,
  tx_hash text,
  transferred_at timestamptz not null default now(),
  constraint uq_custody_hop_seq unique (outgoing_request_id, sequence)
);

create index if not exists idx_custody_hops_dr on public.custody_hops (outgoing_request_id);
create index if not exists idx_custody_hops_to_driver on public.custody_hops (to_driver_profile_id);

-- ==============================================================================
-- 6. 3NF INVENTORY BALANCE & LEDGER TABLES
-- ==============================================================================

-- 6.1 TABLE: warehouse_stock (Normalized Physical Stock per Warehouse & Kit)
create table if not exists public.warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  kit_type_id uuid not null references public.kit_types(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  constraint uq_warehouse_stock unique (warehouse_id, kit_type_id)
);

create index if not exists idx_wh_stock_wh on public.warehouse_stock (warehouse_id);

-- 6.2 TABLE: lgu_stock (Normalized Municipal Buffer Stock per LGU & Kit)
create table if not exists public.lgu_stock (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid not null references public.lgus(id) on delete cascade,
  kit_type_id uuid not null references public.kit_types(id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  constraint uq_lgu_stock unique (lgu_id, kit_type_id)
);

create index if not exists idx_lgu_stock_lgu on public.lgu_stock (lgu_id);

-- 6.3 TABLE: stock_ledger (Auditable Double-Entry Inventory Journal)
create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  facility_type text not null check (facility_type in ('Warehouse', 'LGU')),
  warehouse_id uuid references public.warehouses(id) on delete cascade,
  lgu_id uuid references public.lgus(id) on delete cascade,
  kit_type_id uuid not null references public.kit_types(id) on delete restrict,
  delta_quantity integer not null,
  balance_after integer not null check (balance_after >= 0),
  movement_type text not null check (
    movement_type in ('INTAKE_VERIFIED', 'RELEASE_DISPATCHED', 'AID_RECEIVED', 'MUTUAL_AID_OUT', 'AUDIT_CORRECTION')
  ),
  reference_manifest_id uuid references public.incoming_manifests(id) on delete set null,
  reference_dr_id uuid references public.outgoing_requests(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_wh on public.stock_ledger (warehouse_id);
create index if not exists idx_ledger_lgu on public.stock_ledger (lgu_id);
create index if not exists idx_ledger_created on public.stock_ledger (created_at desc);

-- ==============================================================================
-- 7. AUDIT, TELEMETRY & DISCREPANCY TABLES
-- ==============================================================================

-- 7.1 TABLE: lgu_inventory_reports (Municipal Stock Needs Reports)
create table if not exists public.lgu_inventory_reports (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid references public.lgus(id) on delete set null,
  reported_by_profile_id uuid references public.profiles(id) on delete set null,
  municipality text not null,
  province text not null default 'Iloilo',
  lgu_name text not null,
  reported_at timestamptz not null default now(),
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  family_kits integer not null default 0,
  affected_families integer not null default 0 check (affected_families >= 0),
  damage_index integer not null default 0 check (damage_index between 0 and 100),
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  priority_color text not null default 'Green' check (priority_color in ('Red', 'Orange', 'Yellow', 'Green')),
  recommendation text not null default 'Sufficient stock; continue monitoring.',
  created_at timestamptz not null default now()
);

create index if not exists idx_lgu_reports_lgu on public.lgu_inventory_reports (lgu_id);
create index if not exists idx_lgu_reports_priority on public.lgu_inventory_reports (priority_color, urgency_score desc);

-- 7.2 TABLE: truck_live_locations (Live Convoy GPS Fleet Tracking)
create table if not exists public.truck_live_locations (
  truck_id text primary key references public.trucks(truck_id) on update cascade on delete cascade,
  current_dr_number text references public.outgoing_requests(dr_number) on delete set null,
  destination_lgu_id uuid references public.lgus(id) on delete set null,
  driver_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'In Transit',
  speed double precision default 0,
  heading double precision default 0,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  gps_text text not null,
  accuracy double precision,
  wallet_address text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_truck_locations_dr on public.truck_live_locations (current_dr_number);
create index if not exists idx_truck_locations_driver on public.truck_live_locations (driver_profile_id);

-- 7.3 TABLE: discrepancy_reports (Inspection Mismatches & Quality Audit Flags)
create table if not exists public.discrepancy_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('Incoming', 'Outgoing')),
  manifest_number text references public.incoming_manifests(manifest_number) on delete cascade,
  dr_number text references public.outgoing_requests(dr_number) on delete cascade,
  reported_by_profile_id uuid references public.profiles(id) on delete set null,
  reported_by_role text,
  reported_by_wallet text,
  note text not null,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint chk_discrepancy_mutex check (
    (report_type = 'Incoming' and manifest_number is not null and dr_number is null) or
    (report_type = 'Outgoing' and dr_number is not null and manifest_number is null)
  )
);

create index if not exists idx_discrepancy_manifest on public.discrepancy_reports (manifest_number);
create index if not exists idx_discrepancy_dr on public.discrepancy_reports (dr_number);

-- 7.4 TABLE: activity_logs (Platform Audit Trail & Action History)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'System User',
  actor_email text not null default 'system@dswd.gov.ph',
  actor_role text not null default 'system',
  actor_wallet text,
  action text not null,
  entity_type text not null,
  entity_id text,
  details text not null,
  metadata jsonb default '{}'::jsonb,
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created on public.activity_logs (created_at desc);

-- 7.5 TABLE: app_counters (Sequential Number Synchronization)
create table if not exists public.app_counters (
  key text primary key,
  value integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.app_counters (key, value) values
  ('manifest_index', 0),
  ('dr_index', 0),
  ('batch_index', 0)
on conflict (key) do nothing;

-- ==============================================================================
-- 8. BUSINESS LOGIC FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 8.1 Official ID Sequence for DSWD personnel
create sequence if not exists public.official_id_seq start with 1 increment by 1;

create or replace function public.generate_official_id(user_role text, is_lgu boolean)
returns text
language plpgsql
as $$
declare
  prefix text;
  seq_num bigint;
  current_yr text;
begin
  if user_role = 'dswd_admin' then
    prefix := 'ADMN';
  elsif is_lgu then
    prefix := 'LGUR';
  else
    prefix := 'RCVR';
  end if;

  current_yr := to_char(now(), 'YYYY');
  seq_num := nextval('public.official_id_seq');

  return prefix || '-' || current_yr || '-' || lpad(seq_num::text, 9, '0');
end;
$$;

-- 8.2 Dynamic LGU Priority Recalculation Engine
create or replace function public.recalculate_lgu_priority(
  food_packs_input integer,
  affected_families_input integer,
  damage_index_input integer
)
returns table (
  urgency_score integer,
  priority_color text,
  recommendation text
)
language plpgsql
immutable
as $$
declare
  stock_score integer;
  demand_score integer;
  damage_score integer;
  score integer;
  color text;
begin
  stock_score := case
    when coalesce(food_packs_input, 0) < 150 then 45
    when coalesce(food_packs_input, 0) < 300 then 25
    else 8
  end;
  demand_score := least(35, round(coalesce(affected_families_input, 0)::numeric / 30)::integer);
  damage_score := round(coalesce(damage_index_input, 0)::numeric * 0.2)::integer;
  score := least(100, greatest(0, stock_score + demand_score + damage_score));
  color := case
    when score >= 75 then 'Red'
    when score >= 50 then 'Orange'
    when score >= 25 then 'Yellow'
    else 'Green'
  end;

  return query select
    score,
    color,
    case
      when color = 'Red' then 'Critical stock deficit; immediate priority dispatch required.'
      when color = 'Orange' then 'Low buffer stock; emergency flag active.'
      when color = 'Yellow' then 'Moderate buffer stock; scheduled replenishment recommended.'
      else 'Adequate buffer stock; routine monitoring.'
    end;
end;
$$;

-- 8.3 Trigger: Synchronize LGU inventory report to master directory
create or replace function public.sync_lgu_inventory_report_to_lgus()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_lgu_id uuid;
  computed record;
begin
  if new.lgu_id is null then
    select id into target_lgu_id
    from public.lgus
    where lower(trim(municipality)) = lower(trim(new.municipality))
      and lower(trim(province)) = lower(trim(coalesce(new.province, province)))
    limit 1;
  else
    target_lgu_id := new.lgu_id;
  end if;

  select * into computed
  from public.recalculate_lgu_priority(
    coalesce(new.food_packs, 0),
    coalesce(new.affected_families, 0),
    coalesce(new.damage_index, 0)
  );

  new.urgency_score := coalesce(nullif(new.urgency_score, 0), computed.urgency_score);
  new.priority_color := case
    when new.priority_color in ('Red', 'Orange', 'Yellow', 'Green') then new.priority_color
    else computed.priority_color
  end;
  new.recommendation := coalesce(nullif(new.recommendation, ''), computed.recommendation);
  new.lgu_id := target_lgu_id;

  if target_lgu_id is not null then
    update public.lgus
    set
      affected_families = coalesce(new.affected_families, 0),
      damage_index = coalesce(new.damage_index, 0),
      urgency_score = new.urgency_score,
      priority_color = new.priority_color,
      recommendation = new.recommendation,
      last_reported_at = coalesce(new.reported_at, now()),
      updated_at = now()
    where id = target_lgu_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_lgu_inventory_report_sync on public.lgu_inventory_reports;
create trigger on_lgu_inventory_report_sync
before insert or update on public.lgu_inventory_reports
for each row execute function public.sync_lgu_inventory_report_to_lgus();

-- 8.4 Trigger: Auto-provision auth.users profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  resolved_role text;
  resolved_lgu_id uuid;
  resolved_warehouse_id uuid;
  is_lgu_rec boolean;
  extracted_first_name text;
  extracted_last_name text;
begin
  resolved_role := case
    when lower(coalesce(new.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'dswd_admin'
    else 'receiver'
  end;
  is_lgu_rec := (new.raw_user_meta_data->>'lgu_name' is not null and trim(new.raw_user_meta_data->>'lgu_name') != '');

  if is_lgu_rec then
    select id into resolved_lgu_id
    from public.lgus
    where lower(trim(municipality)) = lower(trim(new.raw_user_meta_data->>'lgu_name'))
       or lower(trim(lgu_name)) = lower(trim(new.raw_user_meta_data->>'lgu_name'))
    limit 1;
  end if;

  if new.raw_user_meta_data->>'warehouse_name' is not null then
    select id into resolved_warehouse_id
    from public.warehouses
    where lower(trim(name)) = lower(trim(new.raw_user_meta_data->>'warehouse_name'))
    limit 1;
  end if;

  extracted_first_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(split_part(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ' ', 1), ''),
    ''
  );
  extracted_last_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(substring(trim(coalesce(new.raw_user_meta_data->>'full_name', '')) from length(split_part(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ' ', 1)) + 1)), ''),
    ''
  );

  insert into public.profiles (
    id,
    official_id,
    email,
    first_name,
    last_name,
    phone_number,
    job_position,
    work_id_url,
    role,
    truck_id,
    lgu_id,
    warehouse_id,
    lgu_name,
    wallet_address,
    avatar_url,
    status
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'official_id',
      public.generate_official_id(resolved_role, is_lgu_rec)
    ),
    coalesce(new.email, ''),
    extracted_first_name,
    extracted_last_name,
    coalesce(new.raw_user_meta_data->>'phone_number', ''),
    coalesce(new.raw_user_meta_data->>'job_position', ''),
    new.raw_user_meta_data->>'work_id_url',
    resolved_role,
    new.raw_user_meta_data->>'truck_id',
    resolved_lgu_id,
    resolved_warehouse_id,
    new.raw_user_meta_data->>'lgu_name',
    new.raw_user_meta_data->>'wallet_address',
    new.raw_user_meta_data->>'avatar_url',
    case
      when resolved_role = 'dswd_admin' then 'verified'
      else coalesce(new.raw_user_meta_data->>'status', 'pending')
    end
  )
  on conflict (id) do update set
    official_id = coalesce(public.profiles.official_id, excluded.official_id),
    email = excluded.email,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    job_position = coalesce(excluded.job_position, public.profiles.job_position),
    work_id_url = coalesce(excluded.work_id_url, public.profiles.work_id_url),
    role = excluded.role,
    truck_id = excluded.truck_id,
    lgu_id = coalesce(excluded.lgu_id, public.profiles.lgu_id),
    warehouse_id = coalesce(excluded.warehouse_id, public.profiles.warehouse_id),
    lgu_name = coalesce(excluded.lgu_name, public.profiles.lgu_name),
    wallet_address = coalesce(excluded.wallet_address, public.profiles.wallet_address),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    status = case
      when excluded.role = 'dswd_admin' then 'verified'
      else coalesce(excluded.status, public.profiles.status)
    end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8.5 Trigger: Clean orphan truck locations when profile is deleted
create or replace function public.clean_orphan_truck_location_on_profile_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if OLD.truck_id is not null and trim(OLD.truck_id) <> '' then
    delete from public.truck_live_locations where upper(trim(truck_id)) = upper(trim(OLD.truck_id));
  end if;
  return OLD;
end;
$$;

drop trigger if exists on_profile_deleted_clean_truck on public.profiles;
create trigger on_profile_deleted_clean_truck
after delete on public.profiles
for each row execute function public.clean_orphan_truck_location_on_profile_delete();

-- ==============================================================================
-- 9. ADMINISTRATIVE SECURITY & RPC FUNCTIONS
-- ==============================================================================

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select lower(trim(coalesce(role, ''))) from public.profiles where id = auth.uid()
$$;

create or replace function public.admin_verify_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can verify accounts.';
  end if;

  update public.profiles
  set status = 'verified'
  where id = target_user_id;

  return true;
end;
$$;

create or replace function public.admin_delete_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_truck_id text;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can delete accounts.';
  end if;

  select truck_id into v_truck_id from public.profiles where id = target_user_id;
  if v_truck_id is not null and trim(v_truck_id) <> '' then
    delete from public.truck_live_locations where upper(trim(truck_id)) = upper(trim(v_truck_id));
  end if;

  delete from public.profiles where id = target_user_id;
  return true;
end;
$$;

-- ==============================================================================
-- 10. REALTIME REPLICATION CONFIGURATION (ALL 21 TABLES)
-- ==============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'provinces', 'supply_sources', 'kit_types', 'lgus', 'warehouses',
    'trucks', 'incidents', 'profiles', 'incoming_manifests', 'inventory_batches',
    'outgoing_requests', 'outgoing_batch_allocations', 'custody_hops',
    'warehouse_stock', 'lgu_stock', 'stock_ledger', 'lgu_inventory_reports',
    'truck_live_locations', 'discrepancy_reports', 'activity_logs', 'app_counters'
  ];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.provinces enable row level security;
alter table public.supply_sources enable row level security;
alter table public.kit_types enable row level security;
alter table public.lgus enable row level security;
alter table public.warehouses enable row level security;
alter table public.trucks enable row level security;
alter table public.incidents enable row level security;
alter table public.profiles enable row level security;
alter table public.incoming_manifests enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.outgoing_requests enable row level security;
alter table public.outgoing_batch_allocations enable row level security;
alter table public.custody_hops enable row level security;
alter table public.warehouse_stock enable row level security;
alter table public.lgu_stock enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.lgu_inventory_reports enable row level security;
alter table public.truck_live_locations enable row level security;
alter table public.discrepancy_reports enable row level security;
alter table public.activity_logs enable row level security;
alter table public.app_counters enable row level security;

-- 11.1 Public & Authenticated Read Policies (Unrestricted for Operational Master Data & Dropdowns)
create policy "Allow read provinces" on public.provinces for select using (true);
create policy "Allow read supply sources" on public.supply_sources for select using (true);
create policy "Allow read kit types" on public.kit_types for select using (true);
create policy "Allow read lgus" on public.lgus for select using (true);
create policy "Allow read warehouses" on public.warehouses for select using (true);
create policy "Allow read trucks" on public.trucks for select using (true);
create policy "Allow read incidents" on public.incidents for select using (true);
create policy "Allow read profiles" on public.profiles for select using (true);
create policy "Allow read incoming manifests" on public.incoming_manifests for select using (true);
create policy "Allow read inventory batches" on public.inventory_batches for select using (true);
create policy "Allow read outgoing requests" on public.outgoing_requests for select using (true);
create policy "Allow read batch allocations" on public.outgoing_batch_allocations for select using (true);
create policy "Allow read custody hops" on public.custody_hops for select using (true);
create policy "Allow read warehouse stock" on public.warehouse_stock for select using (true);
create policy "Allow read lgu stock" on public.lgu_stock for select using (true);
create policy "Allow read stock ledger" on public.stock_ledger for select using (true);
create policy "Allow read lgu reports" on public.lgu_inventory_reports for select using (true);
create policy "Allow read truck locations" on public.truck_live_locations for select using (true);
create policy "Allow read discrepancy reports" on public.discrepancy_reports for select using (true);
create policy "Allow read activity logs" on public.activity_logs for select using (true);
create policy "Allow read app counters" on public.app_counters for select using (true);

-- 11.2 Write Policies (Public & Authenticated System Write)
create policy "Allow write provinces" on public.provinces for all using (true) with check (true);
create policy "Allow write supply sources" on public.supply_sources for all using (true) with check (true);
create policy "Allow write kit types" on public.kit_types for all using (true) with check (true);
create policy "Allow write lgus" on public.lgus for all using (true) with check (true);
create policy "Allow write warehouses" on public.warehouses for all using (true) with check (true);
create policy "Allow write trucks" on public.trucks for all using (true) with check (true);
create policy "Allow write incidents" on public.incidents for all using (true) with check (true);
create policy "Allow write incoming manifests" on public.incoming_manifests for all using (true) with check (true);
create policy "Allow write inventory batches" on public.inventory_batches for all using (true) with check (true);
create policy "Allow write outgoing requests" on public.outgoing_requests for all using (true) with check (true);
create policy "Allow write batch allocations" on public.outgoing_batch_allocations for all using (true) with check (true);
create policy "Allow write custody hops" on public.custody_hops for all using (true) with check (true);
create policy "Allow write warehouse stock" on public.warehouse_stock for all using (true) with check (true);
create policy "Allow write lgu stock" on public.lgu_stock for all using (true) with check (true);
create policy "Allow write stock ledger" on public.stock_ledger for all using (true) with check (true);
create policy "Allow write lgu reports" on public.lgu_inventory_reports for all using (true) with check (true);
create policy "Allow write truck locations" on public.truck_live_locations for all using (true) with check (true);
create policy "Allow write discrepancy reports" on public.discrepancy_reports for all using (true) with check (true);
create policy "Allow write activity logs" on public.activity_logs for all using (true) with check (true);
create policy "Allow write app counters" on public.app_counters for all using (true) with check (true);

-- 11.3 Profile Specific Security Policies
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Allow profile update" on public.profiles for update using (
  auth.uid() = id or
  public.current_user_role() in ('dswd_admin', 'admin') or
  exists (select 1 from public.profiles where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin'))
) with check (
  auth.uid() = id or
  public.current_user_role() in ('dswd_admin', 'admin') or
  exists (select 1 from public.profiles where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin'))
);
create policy "Allow profile delete" on public.profiles for delete using (
  public.current_user_role() in ('dswd_admin', 'admin') or
  exists (select 1 from public.profiles where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin'))
);

-- ==============================================================================
-- 12. AUTOMATIC PROFILE RESTORATION / SEED FOR EXISTING AUTH USERS
-- ==============================================================================
-- If auth.users already exist in Supabase Auth, restore their profiles into public.profiles
-- so no administrator or registered personnel is locked out after running this script.
insert into public.profiles (
  id,
  official_id,
  email,
  first_name,
  last_name,
  phone_number,
  job_position,
  role,
  status
)
select
  u.id,
  public.generate_official_id(
    case when lower(coalesce(u.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'dswd_admin' else 'receiver' end,
    false
  ),
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'first_name'), ''),
    nullif(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ' ', 1), ''),
    'DSWD'
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(substring(trim(coalesce(u.raw_user_meta_data->>'full_name', '')) from length(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ' ', 1)) + 1)), ''),
    'Officer'
  ),
  coalesce(u.raw_user_meta_data->>'phone_number', ''),
  coalesce(u.raw_user_meta_data->>'job_position', case when lower(coalesce(u.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'DSWD Administrator' else 'Field Officer' end),
  case when lower(coalesce(u.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'dswd_admin' else 'receiver' end,
  case when lower(coalesce(u.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'verified' else coalesce(u.raw_user_meta_data->>'status', 'pending') end
from auth.users u
on conflict (id) do update set
  role = excluded.role,
  status = excluded.status;

-- ==============================================================================
-- END OF SCHEMA SCRIPT (VERSION 3)
-- ==============================================================================
