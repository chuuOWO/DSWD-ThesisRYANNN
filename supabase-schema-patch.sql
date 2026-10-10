-- ==============================================================================
-- DSWD DISASTER RESPONSE SUPPLY CHAIN MANAGEMENT SYSTEM
-- FULLY RELATIONAL DATABASE SCHEMA & MIGRATION SCRIPT
-- ==============================================================================
-- Idempotent and rerun-safe. Configures all 7 tables with explicit FOREIGN KEY
-- relationships, performance indexes, Realtime replication, and RLS policies.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. MASTER LOOKUP & REGIONAL CONFIGURATION TABLES
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

alter table public.provinces add column if not exists name text;
alter table public.provinces add column if not exists region text default 'Region VI (Western Visayas)';
alter table public.provinces add column if not exists is_active boolean default true;
alter table public.provinces add column if not exists created_at timestamptz default now();
alter table public.provinces add column if not exists updated_at timestamptz default now();

create unique index if not exists provinces_name_key on public.provinces (name);

insert into public.provinces (name, region) values
  ('Aklan', 'Region VI (Western Visayas)'),
  ('Antique', 'Region VI (Western Visayas)'),
  ('Capiz', 'Region VI (Western Visayas)'),
  ('Guimaras', 'Region VI (Western Visayas)'),
  ('Iloilo', 'Region VI (Western Visayas)'),
  ('Negros Occidental', 'Region VI (Western Visayas)')
on conflict (name) do nothing;

-- 2.2 TABLE: warehouses (Regional Storage Warehouses & Authoritative Stock Balances)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  province text not null default 'Iloilo',
  municipality text not null default 'Oton',
  capacity_packs integer not null default 50000,
  latitude double precision not null default 10.6975,
  longitude double precision not null default 122.4764,
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  sleeping_kits integer not null default 0,
  kitchen_kits integer not null default 0,
  family_kits integer not null default 0,
  laminated_sacks integer not null default 0,
  rtef integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.warehouses add column if not exists name text;
alter table public.warehouses add column if not exists province text default 'Iloilo';
alter table public.warehouses add column if not exists municipality text default 'Oton';
alter table public.warehouses add column if not exists capacity_packs integer default 50000;
alter table public.warehouses add column if not exists latitude double precision default 10.6975;
alter table public.warehouses add column if not exists longitude double precision default 122.4764;
alter table public.warehouses add column if not exists food_packs integer not null default 0;
alter table public.warehouses add column if not exists hygiene_kits integer not null default 0;
alter table public.warehouses add column if not exists sleeping_kits integer not null default 0;
alter table public.warehouses add column if not exists kitchen_kits integer not null default 0;
alter table public.warehouses add column if not exists family_kits integer not null default 0;
alter table public.warehouses add column if not exists laminated_sacks integer not null default 0;
alter table public.warehouses add column if not exists rtef integer not null default 0;
alter table public.warehouses add column if not exists current_stock jsonb default '{}'::jsonb;
alter table public.warehouses add column if not exists is_active boolean default true;
alter table public.warehouses add column if not exists created_at timestamptz default now();
alter table public.warehouses add column if not exists updated_at timestamptz default now();

create unique index if not exists warehouses_name_key on public.warehouses (name);

-- Bootstrap regional warehouses with zero opening stock.
-- NOTE FOR ADMINISTRATORS: Verified initial balances must NOT be hardcoded into migrations.
-- Administrators should record verified physical inventory via the Incoming Goods module
-- (using source "VDRC", "LDRC", or initial physical count audit) so that all operational stock
-- is backed by an auditable digital manifest and transaction trail.
insert into public.warehouses (name, province, municipality, capacity_packs, latitude, longitude, food_packs, hygiene_kits, sleeping_kits, kitchen_kits, family_kits, laminated_sacks, rtef) values
  ('Oton Main Warehouse', 'Iloilo', 'Oton', 150000, 10.6975, 122.4764, 0, 0, 0, 0, 0, 0, 0),
  ('Pototan Main Warehouse', 'Iloilo', 'Pototan', 80000, 10.9492, 122.6289, 0, 0, 0, 0, 0, 0, 0)
on conflict (name) do nothing;

update public.warehouses
set current_stock = jsonb_build_object(
  'Food Pack', coalesce(food_packs, 0),
  'Hygiene Kit', coalesce(hygiene_kits, 0),
  'Sleeping Kit', coalesce(sleeping_kits, 0),
  'Kitchen Kit', coalesce(kitchen_kits, 0),
  'Family Kit', coalesce(family_kits, 0),
  'Laminated Sack', coalesce(laminated_sacks, 0),
  'RTEF', coalesce(rtef, 0)
)
where current_stock is null;

-- 2.3 TABLE: supply_sources (National Resource Centers & Distribution Hubs)
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

alter table public.supply_sources add column if not exists name text;
alter table public.supply_sources add column if not exists short_code text;
alter table public.supply_sources add column if not exists facility_type text default 'National Resource Center';
alter table public.supply_sources add column if not exists region text default 'Region VII (Central Visayas)';
alter table public.supply_sources add column if not exists location text default '';
alter table public.supply_sources add column if not exists is_active boolean default true;
alter table public.supply_sources add column if not exists created_at timestamptz default now();
alter table public.supply_sources add column if not exists updated_at timestamptz default now();

create unique index if not exists supply_sources_name_key on public.supply_sources (name);
create unique index if not exists supply_sources_short_code_key on public.supply_sources (short_code);

insert into public.supply_sources (name, short_code, facility_type, region, location) values
  ('Visayas Disaster Resource Center (VDRC)', 'VDRC', 'National Resource Center', 'Region VII (Central Visayas)', 'Tingub, Mandaue City, Cebu'),
  ('Luzon Disaster Resource Center (LDRC)', 'LDRC', 'National Resource Center', 'National Capital Region / Region III', 'Pasay City / Clark Special Economic Zone')
on conflict (short_code) do nothing;

-- 2.4 TABLE: kit_types (Relief Goods & Standard Disaster Kit Specifications)
create table if not exists public.kit_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'Food Item',
  unit_type text not null default 'packs',
  description text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kit_types add column if not exists name text;
alter table public.kit_types add column if not exists category text default 'Food Item';
alter table public.kit_types add column if not exists unit_type text default 'packs';
alter table public.kit_types add column if not exists description text default '';
alter table public.kit_types add column if not exists is_active boolean default true;
alter table public.kit_types add column if not exists created_at timestamptz default now();
alter table public.kit_types add column if not exists updated_at timestamptz default now();

create unique index if not exists kit_types_name_key on public.kit_types (name);

insert into public.kit_types (name, category, unit_type, description) values
  ('Family Food Pack', 'Food Item', 'packs', 'Standard 6kg emergency nutritional food pack (rice, canned goods, coffee)'),
  ('Hygiene Kit', 'Non-Food Item', 'kits', 'Personal sanitation supplies, soap, toothpaste, toothbrush, sanitary napkins'),
  ('Sleeping Kit', 'Non-Food Item', 'kits', 'Blankets, sleeping mats, mosquito nets, and pillowcases'),
  ('Kitchen Kit', 'Non-Food Item', 'kits', 'Cooking pots, frying pan, plates, cups, spoons, forks, and cooking utensils'),
  ('Family Kit', 'Non-Food Item', 'kits', 'Clothing apparel, underwear, bath towels, and footwear for families'),
  ('Laminated Sacks', 'Non-Food Item', 'sacks', 'Heavy-duty weatherproofing tarpaulins for temporary roof shelters'),
  ('Ready-to-Eat Food (RTEF)', 'Food Item', 'packs', 'Pre-cooked retort pouch meals requiring zero preparation')
on conflict (name) do nothing;

-- ==============================================================================
-- 3. TABLE: lgus (Master Panay & Regional Local Government Units Directory)
-- ==============================================================================
create table if not exists public.lgus (
  id uuid primary key default gen_random_uuid(),
  municipality text not null,
  province text not null default 'Iloilo',
  lgu_name text not null,
  contact_person text default '',
  contact_number text default '',
  latitude double precision not null default 10.7870,
  longitude double precision not null default 122.3892,
  remarks text default '',
  is_active boolean not null default true,
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  sleeping_kits integer not null default 0,
  kitchen_kits integer not null default 0,
  family_kits integer not null default 0,
  laminated_sacks integer not null default 0,
  rtef integer not null default 0,
  affected_families integer not null default 0,
  damage_index integer not null default 0,
  max_stock integer not null default 3000,
  current_stock jsonb default '{}'::jsonb,
  urgency_score integer default 0,
  priority_color text default 'Green',
  recommendation text default '',
  last_reported_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_lgus_muni_prov unique (municipality, province)
);

alter table public.lgus add column if not exists municipality text;
alter table public.lgus add column if not exists province text default 'Iloilo';
alter table public.lgus add column if not exists lgu_name text;
alter table public.lgus add column if not exists contact_person text default '';
alter table public.lgus add column if not exists contact_number text default '';
alter table public.lgus add column if not exists latitude double precision default 10.7870;
alter table public.lgus add column if not exists longitude double precision default 122.3892;
alter table public.lgus add column if not exists remarks text default '';
alter table public.lgus add column if not exists is_active boolean default true;
alter table public.lgus add column if not exists food_packs integer not null default 0;
alter table public.lgus add column if not exists hygiene_kits integer not null default 0;
alter table public.lgus add column if not exists sleeping_kits integer not null default 0;
alter table public.lgus add column if not exists kitchen_kits integer not null default 0;
alter table public.lgus add column if not exists family_kits integer not null default 0;
alter table public.lgus add column if not exists laminated_sacks integer not null default 0;
alter table public.lgus add column if not exists rtef integer not null default 0;
alter table public.lgus add column if not exists affected_families integer not null default 0;
alter table public.lgus add column if not exists damage_index integer not null default 0;
alter table public.lgus add column if not exists max_stock integer not null default 3000;
alter table public.lgus add column if not exists current_stock jsonb default '{}'::jsonb;
alter table public.lgus add column if not exists urgency_score integer default 0;
alter table public.lgus add column if not exists priority_color text default 'Green';
alter table public.lgus add column if not exists recommendation text default '';
alter table public.lgus add column if not exists last_reported_at timestamptz default now();
alter table public.lgus add column if not exists created_at timestamptz default now();
alter table public.lgus add column if not exists updated_at timestamptz default now();

create index if not exists lgus_province_municipality_idx on public.lgus (province, municipality);
create index if not exists lgus_is_active_idx on public.lgus (is_active);

alter table public.lgus alter column priority_color set default 'Green';
update public.lgus
set priority_color = 'Green'
where lower(coalesce(priority_color, '')) = 'green';

-- Seed all 101 Panay Island and Guimaras municipalities
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
  ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11, 122.6667),
  ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167),
  ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167),
  ('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528),
  ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.66, 122.3167),
  ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667),
  ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621),
  ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.95, 122.5),
  ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.05, 122.4833),
  ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833),
  ('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167),
  ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831),
  ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333),
  ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352),
  ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833),
  ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6),
  ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse', 10.6975, 122.4764),
  ('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417),
  ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.54),
  ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272),
  ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833),
  ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.65),
  ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333),
  ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667),
  ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333),
  ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.82, 122.5333),
  ('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167),
  ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.675, 122.3806),
  ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.75, 122.3333),
  ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.82, 122.61),
  ('Anini-y', 'Antique', 'Anini-y Municipal Hall', 10.4333, 121.9333),
  ('Barbaza', 'Antique', 'Barbaza Municipal Hall', 11.2167, 122.0667),
  ('Belison', 'Antique', 'Belison Municipal Hall', 10.8333, 121.9667),
  ('Bugasong', 'Antique', 'Bugasong Municipal Hall', 11.05, 122.0667),
  ('Caluya', 'Antique', 'Caluya Municipal Hall', 11.9167, 121.5667),
  ('Culasi', 'Antique', 'Culasi Municipal Hall', 11.4333, 122.0667),
  ('Hamtic', 'Antique', 'Hamtic Municipal Hall', 10.7, 121.9833),
  ('Laua-an', 'Antique', 'Laua-an Municipal Hall', 11.15, 122.05),
  ('Libertad', 'Antique', 'Libertad Municipal Hall', 12.0333, 121.9167),
  ('Pandan', 'Antique', 'Pandan Municipal Hall', 11.7167, 122.1),
  ('Patnongon', 'Antique', 'Patnongon Municipal Hall', 10.9167, 121.9833),
  ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', 10.75, 121.95),
  ('San Remigio', 'Antique', 'San Remigio Municipal Hall', 10.7833, 122.0833),
  ('Sebaste', 'Antique', 'Sebaste Municipal Hall', 11.5833, 122.0833),
  ('Sibalom', 'Antique', 'Sibalom Municipal Hall', 10.7833, 122.0167),
  ('Tibiao', 'Antique', 'Tibiao Municipal Hall', 11.2833, 122.0333),
  ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', 10.5167, 121.9333),
  ('Valderrama', 'Antique', 'Valderrama Municipal Hall', 11, 122.1333),
  ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', 11.35, 122.6833),
  ('Dao', 'Capiz', 'Dao Municipal Hall', 11.3833, 122.6833),
  ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', 11.3, 122.6167),
  ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', 11.2667, 122.7),
  ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', 11.5167, 122.7),
  ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', 11.4333, 122.4833),
  ('Maayon', 'Capiz', 'Maayon Municipal Hall', 11.3833, 122.7833),
  ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', 11.4333, 122.6),
  ('Panay', 'Capiz', 'Panay Municipal Hall', 11.55, 122.8),
  ('Panitan', 'Capiz', 'Panitan Municipal Hall', 11.4667, 122.7667),
  ('Pilar', 'Capiz', 'Pilar Municipal Hall', 11.4833, 122.9833),
  ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', 11.4833, 122.85),
  ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', 11.4333, 122.9333),
  ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', 11.5853, 122.7511),
  ('Sapian', 'Capiz', 'Sapian Municipal Hall', 11.5, 122.6),
  ('Sigma', 'Capiz', 'Sigma Municipal Hall', 11.4167, 122.6667),
  ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', 11.2667, 122.5333),
  ('Altavas', 'Aklan', 'Altavas Municipal Hall', 11.5333, 122.5),
  ('Balete', 'Aklan', 'Balete Municipal Hall', 11.55, 122.3833),
  ('Banga', 'Aklan', 'Banga Municipal Hall', 11.6333, 122.3333),
  ('Batan', 'Aklan', 'Batan Municipal Hall', 11.5833, 122.5),
  ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', 11.8333, 121.8833),
  ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', 11.8167, 122.1667),
  ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', 11.7083, 122.3667),
  ('Lezo', 'Aklan', 'Lezo Municipal Hall', 11.6667, 122.3333),
  ('Libacao', 'Aklan', 'Libacao Municipal Hall', 11.45, 122.3),
  ('Madalag', 'Aklan', 'Madalag Municipal Hall', 11.5167, 122.3),
  ('Makato', 'Aklan', 'Makato Municipal Hall', 11.7167, 122.2833),
  ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', 11.9, 121.9167),
  ('Malinao', 'Aklan', 'Malinao Municipal Hall', 11.65, 122.3167),
  ('Nabas', 'Aklan', 'Nabas Municipal Hall', 11.8833, 122.0667),
  ('New Washington', 'Aklan', 'New Washington Municipal Hall', 11.65, 122.4333),
  ('Numancia', 'Aklan', 'Numancia Municipal Hall', 11.7, 122.3333),
  ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', 11.7833, 122.25),
  ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', 10.6583, 122.5933),
  ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', 10.6939, 122.6842),
  ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', 10.5186, 122.5414),
  ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', 10.6128, 122.6881),
  ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', 10.55, 122.6333)
on conflict (municipality, province) do update set
  lgu_name = excluded.lgu_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

-- Backfill lgus stock from latest lgu_inventory_reports (if table already exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'lgu_inventory_reports') then
    with latest_reports as (
      select distinct on (coalesce(rpt.lgu_id, l.id))
        coalesce(rpt.lgu_id, l.id) as target_lgu_id,
        rpt.food_packs,
        rpt.hygiene_kits,
        rpt.family_kits,
        rpt.reported_at
      from public.lgu_inventory_reports rpt
      left join public.lgus l on lower(trim(rpt.municipality)) = lower(trim(l.municipality))
      order by coalesce(lgu_id, l.id), rpt.reported_at desc
    )
    update public.lgus l
    set
      food_packs = lr.food_packs,
      hygiene_kits = lr.hygiene_kits,
      family_kits = lr.family_kits,
      last_reported_at = lr.reported_at
    from latest_reports lr
    where l.id = lr.target_lgu_id;
  end if;
end $$;

update public.lgus
set current_stock = jsonb_build_object(
  'Food Pack', coalesce(food_packs, 0),
  'Hygiene Kit', coalesce(hygiene_kits, 0),
  'Sleeping Kit', coalesce(sleeping_kits, 0),
  'Kitchen Kit', coalesce(kitchen_kits, 0),
  'Family Kit', coalesce(family_kits, 0),
  'Laminated Sack', coalesce(laminated_sacks, 0),
  'RTEF', coalesce(rtef, 0)
)
where current_stock is null or current_stock = '{}'::jsonb;

-- ==============================================================================
-- 3. TABLE: incoming_manifests (Warehouse Inbound Cargo & Batch Minting)
-- ==============================================================================
create table if not exists public.incoming_manifests (
  id uuid primary key default gen_random_uuid(),
  manifest_number text,
  date_received text,
  category text,
  quantity integer not null default 0,
  unit_type text,
  expiration_date text,
  source text,
  destination_type text default 'Warehouse',
  destination text,
  incident_code text,
  status text not null default 'Draft',
  manifest_hash text,
  tx_hash text,
  batch_token_id text,
  minted_at text,
  wallet_address text,
  created_at timestamptz not null default now()
);

alter table public.incoming_manifests add column if not exists manifest_number text;
alter table public.incoming_manifests add column if not exists date_received text;
alter table public.incoming_manifests add column if not exists category text;
alter table public.incoming_manifests add column if not exists quantity integer not null default 0;
alter table public.incoming_manifests add column if not exists unit_type text;
alter table public.incoming_manifests add column if not exists expiration_date text;
alter table public.incoming_manifests add column if not exists source text;
alter table public.incoming_manifests add column if not exists destination_type text default 'Warehouse';
alter table public.incoming_manifests add column if not exists destination text;
alter table public.incoming_manifests add column if not exists incident_code text;
alter table public.incoming_manifests add column if not exists status text not null default 'Draft';
alter table public.incoming_manifests add column if not exists manifest_hash text;
alter table public.incoming_manifests add column if not exists tx_hash text;
alter table public.incoming_manifests add column if not exists batch_token_id text;
alter table public.incoming_manifests add column if not exists minted_at text;
alter table public.incoming_manifests add column if not exists wallet_address text;
alter table public.incoming_manifests add column if not exists verified_by text;
alter table public.incoming_manifests add column if not exists correction_note text;
alter table public.incoming_manifests add column if not exists created_at timestamptz not null default now();

-- Sequential manifest number generator
with numbered as (
  select
    id,
    'INC-2026-' || lpad(row_number() over (order by created_at, id)::text, 3, '0') as generated_manifest_number
  from public.incoming_manifests
  where manifest_number is null
)
update public.incoming_manifests as incoming
set manifest_number = numbered.generated_manifest_number
from numbered
where incoming.id = numbered.id;

create unique index if not exists incoming_manifests_manifest_number_key
  on public.incoming_manifests (manifest_number);

create index if not exists incoming_manifests_created_at_idx
  on public.incoming_manifests (created_at desc);

-- ==============================================================================
-- 4. TABLE: outgoing_requests (Relief Allocations & Logistics Dispatch)
-- ==============================================================================
create table if not exists public.outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  dr_number text,
  date_allocated text,
  lgu_id uuid,
  lgu_name text,
  province text,
  municipality text,
  category text,
  amount_requested integer not null default 0,
  amount_approved integer not null default 0,
  warehouse_source text,
  delivery_mode text,
  delivery_status text not null default 'Allocating',
  incident_code text,
  allocated_batches jsonb,
  sender_gps text,
  receiver_gps text,
  destination_address text,
  assigned_truck_id text,
  handover_contract_id text,
  sender_signature text,
  receiver_signature text,
  tx_hash text,
  wallet_address text,
  delivery_priority integer not null default 0,
  is_held boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.outgoing_requests add column if not exists dr_number text;
alter table public.outgoing_requests add column if not exists date_allocated text;
alter table public.outgoing_requests add column if not exists lgu_id uuid;
alter table public.outgoing_requests add column if not exists lgu_name text;
alter table public.outgoing_requests add column if not exists province text;
alter table public.outgoing_requests add column if not exists municipality text;
alter table public.outgoing_requests add column if not exists category text;
alter table public.outgoing_requests add column if not exists amount_requested integer not null default 0;
alter table public.outgoing_requests add column if not exists amount_approved integer not null default 0;
alter table public.outgoing_requests add column if not exists warehouse_source text;
alter table public.outgoing_requests add column if not exists delivery_mode text;
alter table public.outgoing_requests add column if not exists delivery_status text not null default 'Allocating';
alter table public.outgoing_requests add column if not exists incident_code text;
alter table public.outgoing_requests add column if not exists incident_date text;
alter table public.outgoing_requests add column if not exists report_reason text;
alter table public.outgoing_requests add column if not exists allocated_batches jsonb;
alter table public.outgoing_requests add column if not exists sender_gps text;
alter table public.outgoing_requests add column if not exists receiver_gps text;
alter table public.outgoing_requests add column if not exists destination_address text;
alter table public.outgoing_requests add column if not exists assigned_truck_id text;
alter table public.outgoing_requests add column if not exists handover_contract_id text;
alter table public.outgoing_requests add column if not exists sender_signature text;
alter table public.outgoing_requests add column if not exists receiver_signature text;
alter table public.outgoing_requests add column if not exists tx_hash text;
alter table public.outgoing_requests add column if not exists wallet_address text;
alter table public.outgoing_requests add column if not exists source_type text default 'Warehouse';
alter table public.outgoing_requests add column if not exists direct_source text;
alter table public.outgoing_requests add column if not exists admin_signature text;
alter table public.outgoing_requests add column if not exists correction_note text;
alter table public.outgoing_requests add column if not exists delivery_priority integer not null default 0;
alter table public.outgoing_requests add column if not exists is_held boolean not null default false;
alter table public.outgoing_requests add column if not exists created_at timestamptz not null default now();

create unique index if not exists outgoing_requests_dr_number_key
  on public.outgoing_requests (dr_number);

-- Backfill lgu_id in outgoing_requests from municipality & province
update public.outgoing_requests as req
set lgu_id = l.id
from public.lgus as l
where req.lgu_id is null
  and lower(trim(req.municipality)) = lower(trim(l.municipality))
  and (req.province is null or lower(trim(req.province)) = lower(trim(l.province)));

-- Clean up any invalid lgu_id before adding foreign key
update public.outgoing_requests
set lgu_id = null
where lgu_id is not null
  and lgu_id not in (select id from public.lgus);

-- Foreign key: outgoing_requests -> lgus
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_outgoing_requests_lgu') then
    alter table public.outgoing_requests
      add constraint fk_outgoing_requests_lgu
      foreign key (lgu_id) references public.lgus (id) on delete set null;
  end if;
end $$;

create index if not exists outgoing_requests_lgu_id_idx on public.outgoing_requests (lgu_id);
create index if not exists outgoing_requests_assigned_truck_id_idx on public.outgoing_requests (assigned_truck_id);
create index if not exists outgoing_requests_delivery_status_created_at_idx on public.outgoing_requests (delivery_status, created_at desc);
create index if not exists outgoing_requests_created_at_idx on public.outgoing_requests (created_at desc);

-- ==============================================================================
-- 5. TABLE: lgu_inventory_reports (Stock-Based Prioritization & Needs Index)
-- ==============================================================================
create table if not exists public.lgu_inventory_reports (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid,
  municipality text not null,
  province text not null default 'Iloilo',
  lgu_name text not null,
  reported_at timestamptz not null default now(),
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  family_kits integer not null default 0,
  affected_families integer not null default 0,
  damage_index integer not null default 0 check (damage_index between 0 and 100),
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  priority_color text not null default 'Green' check (priority_color in ('Red', 'Orange', 'Yellow', 'Green')),
  recommendation text not null default 'Sufficient stock; continue monitoring.',
  created_at timestamptz not null default now()
);

alter table public.lgu_inventory_reports drop constraint if exists lgu_inventory_reports_priority_color_check;
alter table public.lgu_inventory_reports add constraint lgu_inventory_reports_priority_color_check check (priority_color in ('Red', 'Orange', 'Yellow', 'Green'));

alter table public.lgu_inventory_reports add column if not exists lgu_id uuid;
alter table public.lgu_inventory_reports add column if not exists municipality text;
alter table public.lgu_inventory_reports add column if not exists province text default 'Iloilo';
alter table public.lgu_inventory_reports add column if not exists lgu_name text;
alter table public.lgu_inventory_reports add column if not exists reported_at timestamptz default now();
alter table public.lgu_inventory_reports add column if not exists food_packs integer default 0;
alter table public.lgu_inventory_reports add column if not exists hygiene_kits integer default 0;
alter table public.lgu_inventory_reports add column if not exists family_kits integer default 0;
alter table public.lgu_inventory_reports add column if not exists affected_families integer default 0;
alter table public.lgu_inventory_reports add column if not exists damage_index integer default 0;
alter table public.lgu_inventory_reports add column if not exists urgency_score integer default 0;
alter table public.lgu_inventory_reports add column if not exists priority_color text default 'Green';
alter table public.lgu_inventory_reports add column if not exists recommendation text default 'Sufficient stock; continue monitoring.';
alter table public.lgu_inventory_reports add column if not exists created_at timestamptz default now();

-- Backfill lgu_id in lgu_inventory_reports from municipality & province
update public.lgu_inventory_reports as rpt
set lgu_id = l.id
from public.lgus as l
where rpt.lgu_id is null
  and lower(trim(rpt.municipality)) = lower(trim(l.municipality))
  and (rpt.province is null or lower(trim(rpt.province)) = lower(trim(l.province)));

-- Clean up any invalid lgu_id before adding foreign key
update public.lgu_inventory_reports
set lgu_id = null
where lgu_id is not null
  and lgu_id not in (select id from public.lgus);

-- Foreign key: lgu_inventory_reports -> lgus
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_lgu_reports_lgu') then
    alter table public.lgu_inventory_reports
      add constraint fk_lgu_reports_lgu
      foreign key (lgu_id) references public.lgus (id) on delete set null;
  end if;
end $$;

create index if not exists lgu_inventory_reports_lgu_id_idx on public.lgu_inventory_reports (lgu_id);
create index if not exists lgu_inventory_reports_priority_idx on public.lgu_inventory_reports (priority_color, urgency_score desc, reported_at desc);
create index if not exists lgu_inventory_reports_municipality_idx on public.lgu_inventory_reports (municipality, reported_at desc);

-- Trigger: Automatically seed a 0-baseline inventory record when a new LGU is inserted into public.lgus
create or replace function public.handle_lgu_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.lgu_inventory_reports (
    lgu_id,
    municipality,
    province,
    lgu_name,
    reported_at,
    food_packs,
    hygiene_kits,
    family_kits,
    affected_families,
    damage_index,
    urgency_score,
    priority_color,
    recommendation
  )
  values (
    new.id,
    new.municipality,
    new.province,
    new.lgu_name,
    now(),
    0, 0, 0, 0, 0, 0, 'Green',
    'Baseline initial inventory; awaiting incident report.'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_lgu_created on public.lgus;
create trigger on_lgu_created
after insert on public.lgus
for each row execute function public.handle_lgu_created();

-- Ensure all existing LGUs in public.lgus have at least one baseline report
insert into public.lgu_inventory_reports (
  lgu_id,
  municipality,
  province,
  lgu_name,
  reported_at,
  food_packs,
  hygiene_kits,
  family_kits,
  affected_families,
  damage_index,
  urgency_score,
  priority_color,
  recommendation
)
select
  l.id,
  l.municipality,
  l.province,
  l.lgu_name,
  now(),
  0, 0, 0, 0, 0, 0, 'Green',
  'Baseline initial inventory; awaiting incident report.'
from public.lgus l
where not exists (
  select 1 from public.lgu_inventory_reports r
  where lower(trim(r.municipality)) = lower(trim(l.municipality))
    and lower(trim(r.province)) = lower(trim(l.province))
);

-- Keep the LGU master directory synchronized with latest inventory reports.
-- This powers LGU Monitoring, dashboard prioritization, and inventory LGU filters.
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
      food_packs = coalesce(new.food_packs, 0),
      hygiene_kits = coalesce(new.hygiene_kits, 0),
      family_kits = coalesce(new.family_kits, 0),
      affected_families = coalesce(new.affected_families, 0),
      damage_index = coalesce(new.damage_index, 0),
      urgency_score = new.urgency_score,
      priority_color = new.priority_color,
      recommendation = new.recommendation,
      current_stock = coalesce(current_stock, '{}'::jsonb) || jsonb_build_object(
        'Food Pack', coalesce(new.food_packs, 0),
        'Hygiene Kit', coalesce(new.hygiene_kits, 0),
        'Family Kit', coalesce(new.family_kits, 0)
      ),
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

with latest_reports as (
  select distinct on (coalesce(rpt.lgu_id, l.id))
    coalesce(rpt.lgu_id, l.id) as target_lgu_id,
    rpt.food_packs,
    rpt.hygiene_kits,
    rpt.family_kits,
    rpt.affected_families,
    rpt.damage_index,
    rpt.reported_at
  from public.lgu_inventory_reports rpt
  left join public.lgus l on lower(trim(rpt.municipality)) = lower(trim(l.municipality))
  order by coalesce(rpt.lgu_id, l.id), rpt.reported_at desc
),
computed_reports as (
  select
    lr.*,
    calc.urgency_score,
    calc.priority_color,
    calc.recommendation
  from latest_reports lr
  cross join lateral public.recalculate_lgu_priority(lr.food_packs, lr.affected_families, lr.damage_index) calc
)
update public.lgus l
set
  food_packs = coalesce(cr.food_packs, 0),
  hygiene_kits = coalesce(cr.hygiene_kits, 0),
  family_kits = coalesce(cr.family_kits, 0),
  affected_families = coalesce(cr.affected_families, 0),
  damage_index = coalesce(cr.damage_index, 0),
  urgency_score = cr.urgency_score,
  priority_color = cr.priority_color,
  recommendation = cr.recommendation,
  current_stock = coalesce(l.current_stock, '{}'::jsonb) || jsonb_build_object(
    'Food Pack', coalesce(cr.food_packs, 0),
    'Hygiene Kit', coalesce(cr.hygiene_kits, 0),
    'Family Kit', coalesce(cr.family_kits, 0)
  ),
  last_reported_at = cr.reported_at,
  updated_at = now()
from computed_reports cr
where l.id = cr.target_lgu_id;

-- ==============================================================================
-- 6. TABLE: truck_live_locations (Real-Time GPS Fleet Tracking & Navigation)
-- ==============================================================================
create table if not exists public.truck_live_locations (
  truck_id text primary key,
  current_dr_number text,
  destination_lgu_id uuid,
  destination_name text default '',
  driver_name text default '',
  driver_phone text default '',
  status text not null default 'In Transit',
  speed double precision default 0,
  heading double precision default 0,
  latitude double precision not null,
  longitude double precision not null,
  gps_text text not null,
  accuracy double precision,
  wallet_address text,
  updated_at timestamptz not null default now()
);

alter table public.truck_live_locations add column if not exists current_dr_number text;
alter table public.truck_live_locations add column if not exists shipment_id text;
alter table public.truck_live_locations add column if not exists destination_lgu_id uuid;
alter table public.truck_live_locations add column if not exists destination_name text default '';
alter table public.truck_live_locations add column if not exists driver_name text default '';
alter table public.truck_live_locations add column if not exists driver_phone text default '';
alter table public.truck_live_locations add column if not exists status text default 'In Transit';
alter table public.truck_live_locations add column if not exists speed double precision default 0;
alter table public.truck_live_locations add column if not exists heading double precision default 0;
alter table public.truck_live_locations add column if not exists latitude double precision;
alter table public.truck_live_locations add column if not exists longitude double precision;
alter table public.truck_live_locations add column if not exists gps_text text;
alter table public.truck_live_locations add column if not exists accuracy double precision;
alter table public.truck_live_locations add column if not exists wallet_address text;
alter table public.truck_live_locations add column if not exists updated_at timestamptz default now();

-- Foreign keys for truck_live_locations
-- Clean up invalid current_dr_number and destination_lgu_id before adding foreign keys
update public.truck_live_locations
set current_dr_number = null
where current_dr_number is not null
  and current_dr_number not in (select dr_number from public.outgoing_requests where dr_number is not null);

update public.truck_live_locations
set destination_lgu_id = null
where destination_lgu_id is not null
  and destination_lgu_id not in (select id from public.lgus);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_truck_current_dr') then
    alter table public.truck_live_locations
      add constraint fk_truck_current_dr
      foreign key (current_dr_number) references public.outgoing_requests (dr_number) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_truck_destination_lgu') then
    alter table public.truck_live_locations
      add constraint fk_truck_destination_lgu
      foreign key (destination_lgu_id) references public.lgus (id) on delete set null;
  end if;
end $$;

create index if not exists truck_live_locations_dr_idx on public.truck_live_locations (current_dr_number);
create index if not exists truck_live_locations_lgu_idx on public.truck_live_locations (destination_lgu_id);
create index if not exists truck_live_locations_updated_at_idx on public.truck_live_locations (updated_at desc);

-- ==============================================================================
-- 7. TABLE: discrepancy_reports (Audit Trail & Verification Mismatches)
-- ==============================================================================
create table if not exists public.discrepancy_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('Incoming', 'Outgoing')),
  manifest_number text,
  dr_number text,
  note text not null,
  reported_by_role text,
  reported_by_wallet text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.discrepancy_reports add column if not exists report_type text;
alter table public.discrepancy_reports add column if not exists manifest_number text;
alter table public.discrepancy_reports add column if not exists dr_number text;
alter table public.discrepancy_reports add column if not exists note text;
alter table public.discrepancy_reports add column if not exists reported_by_role text;
alter table public.discrepancy_reports add column if not exists reported_by_wallet text;
alter table public.discrepancy_reports add column if not exists reported_at timestamptz default now();
alter table public.discrepancy_reports add column if not exists created_at timestamptz default now();

-- Foreign keys for discrepancy_reports
-- Clean up any invalid manifest_number before adding foreign key
update public.discrepancy_reports
set manifest_number = null
where manifest_number is not null
  and manifest_number not in (select manifest_number from public.incoming_manifests where manifest_number is not null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_discrepancy_manifest') then
    alter table public.discrepancy_reports
      add constraint fk_discrepancy_manifest
      foreign key (manifest_number) references public.incoming_manifests (manifest_number) on delete set null;
  end if;
end $$;

-- Clean up any invalid dr_number before adding foreign key (e.g. orphan DR-2026-005)
update public.discrepancy_reports
set dr_number = null
where dr_number is not null
  and dr_number not in (select dr_number from public.outgoing_requests where dr_number is not null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_discrepancy_dr') then
    alter table public.discrepancy_reports
      add constraint fk_discrepancy_dr
      foreign key (dr_number) references public.outgoing_requests (dr_number) on delete set null;
  end if;
end $$;

create index if not exists discrepancy_reports_type_idx on public.discrepancy_reports (report_type, reported_at desc);
create index if not exists discrepancy_reports_manifest_idx on public.discrepancy_reports (manifest_number, reported_at desc);
create index if not exists discrepancy_reports_dr_idx on public.discrepancy_reports (dr_number, reported_at desc);

-- ==============================================================================
-- 8. TABLE: profiles (RBAC, Driver/LGU Assignment & Admin Verification)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  lgu_id uuid,
  email text not null,
  full_name text not null default '',
  first_name text default '',
  last_name text default '',
  phone_number text default '',
  job_position text default '',
  work_id_url text,
  role text not null default 'receiver',
  truck_id text,
  lgu_name text,
  wallet_address text,
  avatar_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists lgu_id uuid;
alter table public.profiles add column if not exists official_id text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text default '';
alter table public.profiles add column if not exists first_name text default '';
alter table public.profiles add column if not exists last_name text default '';
alter table public.profiles add column if not exists phone_number text default '';
alter table public.profiles add column if not exists job_position text default '';
alter table public.profiles add column if not exists work_id_url text;
alter table public.profiles add column if not exists role text default 'receiver';
alter table public.profiles add column if not exists truck_id text;
alter table public.profiles add column if not exists lgu_name text;
alter table public.profiles add column if not exists wallet_address text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists status text default 'pending';
alter table public.profiles add column if not exists created_at timestamptz default now();

-- Official ID Sequence for DSWD personnel (Format: ROLE-YYYY-NNNNNNNNN)
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

-- Backfill official_id for existing profiles
update public.profiles
set official_id = public.generate_official_id(role, (lgu_name is not null and lgu_name != ''))
where official_id is null;

create unique index if not exists profiles_official_id_key on public.profiles (official_id);

-- Backfill profiles lgu_id from lgu_name
update public.profiles as p
set lgu_id = l.id
from public.lgus as l
where p.lgu_id is null
  and p.lgu_name is not null
  and (
    lower(trim(p.lgu_name)) = lower(trim(l.municipality)) or
    lower(trim(p.lgu_name)) = lower(trim(l.lgu_name)) or
    lower(p.lgu_name) like '%' || lower(l.municipality) || '%'
  );

-- Clean up any invalid lgu_id before adding foreign key
update public.profiles
set lgu_id = null
where lgu_id is not null
  and lgu_id not in (select id from public.lgus);

-- Foreign key: profiles -> lgus
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_profiles_lgu') then
    alter table public.profiles
      add constraint fk_profiles_lgu
      foreign key (lgu_id) references public.lgus (id) on delete set null;
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'receiver' where role in ('trucker', 'lgu');
alter table public.profiles add constraint profiles_role_check check (role in ('dswd_admin', 'receiver'));

alter table public.profiles drop constraint if exists profiles_status_check;
update public.profiles set status = 'verified' where status is null;
alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'verified', 'rejected'));

-- Trigger: Automatically handle auth user profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  resolved_role text;
  is_lgu_rec boolean;
begin
  resolved_role := case
    when lower(coalesce(new.raw_user_meta_data->>'role', '')) in ('admin', 'dswd_admin') then 'dswd_admin'
    else 'receiver'
  end;
  is_lgu_rec := (new.raw_user_meta_data->>'lgu_name' is not null and trim(new.raw_user_meta_data->>'lgu_name') != '');

  insert into public.profiles (
    id,
    official_id,
    email,
    full_name,
    first_name,
    last_name,
    phone_number,
    job_position,
    work_id_url,
    role,
    truck_id,
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
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'phone_number', ''),
    coalesce(new.raw_user_meta_data->>'job_position', ''),
    new.raw_user_meta_data->>'work_id_url',
    resolved_role,
    new.raw_user_meta_data->>'truck_id',
    new.raw_user_meta_data->>'lgu_name',
    new.raw_user_meta_data->>'wallet_address',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'status', 'pending')
  )
  on conflict (id) do update set
    official_id = coalesce(public.profiles.official_id, excluded.official_id),
    email = excluded.email,
    full_name = excluded.full_name,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    job_position = coalesce(excluded.job_position, public.profiles.job_position),
    work_id_url = coalesce(excluded.work_id_url, public.profiles.work_id_url),
    role = excluded.role,
    truck_id = excluded.truck_id,
    lgu_name = coalesce(excluded.lgu_name, public.profiles.lgu_name),
    wallet_address = coalesce(excluded.wallet_address, public.profiles.wallet_address),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    status = coalesce(excluded.status, public.profiles.status);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select lower(trim(coalesce(role, ''))) from public.profiles where id = auth.uid()
$$;

-- Secure admin verification RPC (bypasses client-side RLS limitations)
create or replace function public.admin_verify_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
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

-- Secure admin profile deletion / rejection RPC
create or replace function public.admin_delete_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can delete accounts.';
  end if;

  delete from public.profiles
  where id = target_user_id;

  return true;
end;
$$;

-- ==============================================================================
-- 9. TABLE: app_counters (Sequential Identifier Synchronization)
-- ==============================================================================
create table if not exists public.app_counters (
  key text primary key,
  value integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.app_counters (key, value)
values
  ('batch_index', 0),
  ('manifest_index', 0),
  ('dr_index', 0)
on conflict (key) do nothing;

update public.app_counters
set value = greatest(value, (
  select coalesce(max((regexp_match(batch_token_id, 'BATCH-\d{4}-(\d+)'))[1]::int), 0)
  from public.incoming_manifests
))
where key = 'batch_index';

update public.app_counters
set value = greatest(value, (
  select coalesce(max((regexp_match(manifest_number, 'INC-\d{4}-(\d+)'))[1]::int), 0)
  from public.incoming_manifests
))
where key = 'manifest_index';

update public.app_counters
set value = greatest(value, (
  select coalesce(max((regexp_match(dr_number, 'DR-\d{4}-(\d+)'))[1]::int), 0)
  from public.outgoing_requests
))
where key = 'dr_index';

-- ==============================================================================
-- 10. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
do $$
begin
  alter publication supabase_realtime add table public.lgus;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.incoming_manifests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.outgoing_requests;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lgu_inventory_reports;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.discrepancy_reports;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.truck_live_locations;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.provinces;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.warehouses;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.supply_sources;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.kit_types;
exception
  when duplicate_object then null;
end $$;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.lgus enable row level security;
alter table public.provinces enable row level security;
alter table public.warehouses enable row level security;
alter table public.supply_sources enable row level security;
alter table public.kit_types enable row level security;
alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;
alter table public.lgu_inventory_reports enable row level security;
alter table public.discrepancy_reports enable row level security;
alter table public.app_counters enable row level security;
alter table public.profiles enable row level security;
alter table public.truck_live_locations enable row level security;

-- 11.1 LGUS POLICIES
drop policy if exists "Allow read lgus" on public.lgus;
create policy "Allow read lgus"
  on public.lgus for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert lgus" on public.lgus;
create policy "Allow insert lgus"
  on public.lgus for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update lgus" on public.lgus;
create policy "Allow update lgus"
  on public.lgus for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete lgus" on public.lgus;
create policy "Allow delete lgus"
  on public.lgus for delete
  to authenticated, anon
  using (true);

-- 11.2 PROVINCES POLICIES
drop policy if exists "Allow read provinces" on public.provinces;
create policy "Allow read provinces"
  on public.provinces for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert provinces" on public.provinces;
create policy "Allow insert provinces"
  on public.provinces for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update provinces" on public.provinces;
create policy "Allow update provinces"
  on public.provinces for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete provinces" on public.provinces;
create policy "Allow delete provinces"
  on public.provinces for delete
  to authenticated, anon
  using (true);

-- 11.3 WAREHOUSES POLICIES
drop policy if exists "Allow read warehouses" on public.warehouses;
create policy "Allow read warehouses"
  on public.warehouses for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert warehouses" on public.warehouses;
create policy "Allow insert warehouses"
  on public.warehouses for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update warehouses" on public.warehouses;
create policy "Allow update warehouses"
  on public.warehouses for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete warehouses" on public.warehouses;
create policy "Allow delete warehouses"
  on public.warehouses for delete
  to authenticated, anon
  using (true);

-- 11.4 SUPPLY SOURCES POLICIES
drop policy if exists "Allow read supply sources" on public.supply_sources;
create policy "Allow read supply sources"
  on public.supply_sources for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert supply sources" on public.supply_sources;
create policy "Allow insert supply sources"
  on public.supply_sources for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update supply sources" on public.supply_sources;
create policy "Allow update supply sources"
  on public.supply_sources for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete supply sources" on public.supply_sources;
create policy "Allow delete supply sources"
  on public.supply_sources for delete
  to authenticated, anon
  using (true);

-- 11.5 KIT TYPES POLICIES
drop policy if exists "Allow read kit types" on public.kit_types;
create policy "Allow read kit types"
  on public.kit_types for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert kit types" on public.kit_types;
create policy "Allow insert kit types"
  on public.kit_types for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update kit types" on public.kit_types;
create policy "Allow update kit types"
  on public.kit_types for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete kit types" on public.kit_types;
create policy "Allow delete kit types"
  on public.kit_types for delete
  to authenticated, anon
  using (true);

-- 11.6 INCOMING MANIFESTS POLICIES
drop policy if exists "Allow read incoming" on public.incoming_manifests;
create policy "Allow read incoming"
  on public.incoming_manifests for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert incoming" on public.incoming_manifests;
create policy "Allow insert incoming"
  on public.incoming_manifests for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update incoming" on public.incoming_manifests;
create policy "Allow update incoming"
  on public.incoming_manifests for update
  to authenticated, anon
  using (true)
  with check (true);

-- 11.7 OUTGOING REQUESTS POLICIES
drop policy if exists "Allow read outgoing" on public.outgoing_requests;
create policy "Allow read outgoing"
  on public.outgoing_requests for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert outgoing" on public.outgoing_requests;
create policy "Allow insert outgoing"
  on public.outgoing_requests for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update outgoing" on public.outgoing_requests;
create policy "Allow update outgoing"
  on public.outgoing_requests for update
  to authenticated, anon
  using (true)
  with check (true);

-- 11.8 LGU INVENTORY REPORTS POLICIES
drop policy if exists "Allow read LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow read LGU inventory reports"
  on public.lgu_inventory_reports for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow insert LGU inventory reports"
  on public.lgu_inventory_reports for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow update LGU inventory reports"
  on public.lgu_inventory_reports for update
  to authenticated, anon
  using (true)
  with check (true);

-- 11.9 DISCREPANCY REPORTS POLICIES
drop policy if exists "Allow read discrepancy reports" on public.discrepancy_reports;
create policy "Allow read discrepancy reports"
  on public.discrepancy_reports for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert discrepancy reports" on public.discrepancy_reports;
create policy "Allow insert discrepancy reports"
  on public.discrepancy_reports for insert
  to authenticated, anon
  with check (true);

-- 11.10 APP COUNTERS POLICIES
drop policy if exists "Allow read app counters" on public.app_counters;
create policy "Allow read app counters"
  on public.app_counters for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert app counters" on public.app_counters;
create policy "Allow insert app counters"
  on public.app_counters for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update app counters" on public.app_counters;
create policy "Allow update app counters"
  on public.app_counters for update
  to authenticated, anon
  using (true)
  with check (true);

-- 11.11 PROFILES POLICIES
drop policy if exists "Allow profile read" on public.profiles;
create policy "Allow profile read"
  on public.profiles for select
  to authenticated, anon
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Allow profile update" on public.profiles;
create policy "Allow profile update"
  on public.profiles for update
  to authenticated
  using (
    auth.uid() = id or
    public.current_user_role() in ('dswd_admin', 'admin') or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
    )
  )
  with check (
    auth.uid() = id or
    public.current_user_role() in ('dswd_admin', 'admin') or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
    )
  );

drop policy if exists "Allow profile delete" on public.profiles;
create policy "Allow profile delete"
  on public.profiles for delete
  to authenticated
  using (
    public.current_user_role() in ('dswd_admin', 'admin') or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
    )
  );

-- 11.12 TRUCK LIVE LOCATIONS POLICIES
drop policy if exists "Allow authenticated read truck live locations" on public.truck_live_locations;
create policy "Allow authenticated read truck live locations"
  on public.truck_live_locations for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow authenticated upsert truck live locations" on public.truck_live_locations;
create policy "Allow authenticated upsert truck live locations"
  on public.truck_live_locations for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow authenticated update truck live locations" on public.truck_live_locations;
create policy "Allow authenticated update truck live locations"
  on public.truck_live_locations for update
  to authenticated, anon
  using (true)
  with check (true);

drop policy if exists "Allow delete truck live locations" on public.truck_live_locations;
create policy "Allow delete truck live locations"
  on public.truck_live_locations for delete
  to authenticated, anon
  using (true);

-- ==============================================================================
-- 12. REAL-TIME AUTH METADATA SYNCHRONIZATION & TOKEN OPTIMIZATION
-- ==============================================================================

-- 12.1 Strip any oversized work_id_url base64 images from auth.users metadata
-- to guarantee JWT access tokens remain lightweight (<1KB) and never exceed
-- Cloudflare's HTTP header limits (preventing HTTP 520 / 431).
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'work_id_url'
where raw_user_meta_data ? 'work_id_url';

-- 12.2 Auto-sync function: updates auth.users user_metadata when profile status changes
create or replace function public.sync_profile_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_user_meta_data = jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{status}',
    to_jsonb(new.status)
  )
  where id = new.id;
  
  return new;
end;
$$;

drop trigger if exists on_profile_status_changed on public.profiles;
create trigger on_profile_status_changed
after update of status on public.profiles
for each row
execute function public.sync_profile_to_auth_metadata();

-- 12.3 One-time backfill: sync all existing profile statuses into auth.users metadata
update auth.users u
set raw_user_meta_data = jsonb_set(
  coalesce(u.raw_user_meta_data, '{}'::jsonb),
  '{status}',
  to_jsonb(p.status)
)
from public.profiles p
where u.id = p.id;

-- ==============================================================================
-- 13. AUTOMATIC CLEANUP OF ORPHAN TRUCK LIVE LOCATIONS ON PROFILE DELETION
-- ==============================================================================

-- 13.1 Trigger function to remove truck_live_locations when profile is deleted
create or replace function public.clean_orphan_truck_location_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.truck_id is not null and trim(OLD.truck_id) <> '' then
    delete from public.truck_live_locations where upper(trim(truck_id)) = upper(trim(OLD.truck_id));
  end if;
  if OLD.wallet_address is not null and trim(OLD.wallet_address) <> '' then
    delete from public.truck_live_locations where lower(trim(wallet_address)) = lower(trim(OLD.wallet_address));
  end if;
  return OLD;
end;
$$;

drop trigger if exists on_profile_deleted_clean_truck on public.profiles;
create trigger on_profile_deleted_clean_truck
after delete on public.profiles
for each row
execute function public.clean_orphan_truck_location_on_profile_delete();

-- 13.2 Update admin_delete_profile function to also remove truck location
create or replace function public.admin_delete_profile(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_truck_id text;
  v_wallet_address text;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can delete accounts.';
  end if;

  select truck_id, wallet_address into v_truck_id, v_wallet_address
  from public.profiles
  where id = target_user_id;

  if v_truck_id is not null and trim(v_truck_id) <> '' then
    delete from public.truck_live_locations where upper(trim(truck_id)) = upper(trim(v_truck_id));
  end if;

  if v_wallet_address is not null and trim(v_wallet_address) <> '' then
    delete from public.truck_live_locations where lower(trim(wallet_address)) = lower(trim(v_wallet_address));
  end if;

  delete from public.profiles
  where id = target_user_id;

  return true;
end;
$$;

-- 13.3 One-time cleanup: remove any existing orphan truck locations without active profile or releases
delete from public.truck_live_locations
where truck_id not in (
  select upper(trim(truck_id)) from public.profiles where truck_id is not null and trim(truck_id) <> ''
)
and (current_dr_number is null or current_dr_number = '');

-- ==============================================================================
-- 14. TABLE: activity_logs (Platform Audit Trail & Action History)
-- ==============================================================================
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

-- Idempotent column upgrades
alter table public.activity_logs add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.activity_logs add column if not exists actor_name text default 'System User';
alter table public.activity_logs add column if not exists actor_email text default 'system@dswd.gov.ph';
alter table public.activity_logs add column if not exists actor_role text default 'system';
alter table public.activity_logs add column if not exists actor_wallet text;
alter table public.activity_logs add column if not exists action text;
alter table public.activity_logs add column if not exists entity_type text default 'General';
alter table public.activity_logs add column if not exists entity_id text;
alter table public.activity_logs add column if not exists details text default '';
alter table public.activity_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.activity_logs add column if not exists tx_hash text;
alter table public.activity_logs add column if not exists created_at timestamptz default now();

-- Performance and lookup indexes
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_action on public.activity_logs (action);
create index if not exists idx_activity_logs_actor_id on public.activity_logs (actor_id);
create index if not exists idx_activity_logs_actor_email on public.activity_logs (actor_email);
create index if not exists idx_activity_logs_entity_type on public.activity_logs (entity_type);

-- Realtime replication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'activity_logs' and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;

-- Row Level Security
alter table public.activity_logs enable row level security;

drop policy if exists "Allow all authenticated users to read activity logs" on public.activity_logs;
create policy "Allow all authenticated users to read activity logs"
  on public.activity_logs for select
  to authenticated
  using (true);

drop policy if exists "Allow authenticated users to insert activity logs" on public.activity_logs;
drop policy if exists "Allow all users to insert activity logs" on public.activity_logs;
create policy "Allow all users to insert activity logs"
  on public.activity_logs for insert
  to anon, authenticated
  with check (true);

-- ==============================================================================
-- 15. CREDENTIAL GOVERNANCE & SECURITY MANAGEMENT
-- ==============================================================================

-- 15.1 Add email change request columns to public.profiles
alter table public.profiles add column if not exists pending_email text;
alter table public.profiles add column if not exists email_change_status text default null;

-- Ensure pgcrypto is available for bcrypt password hashing
create extension if not exists pgcrypto;

-- 15.2 Admin Password Reset RPC (Directly updates auth.users password hash)
create or replace function public.admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  -- Validate that caller is an authorized DSWD administrator
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can reset user passwords.';
  end if;

  if length(new_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  -- Update encrypted password in Supabase Authentication user table
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  return true;
end;
$$;

grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

-- 15.3 Admin Approve Email Change RPC (Directly updates auth.users AND public.profiles)
create or replace function public.admin_approve_email_change(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_new_email text;
begin
  -- Validate administrator authorization
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can approve email changes.';
  end if;

  select pending_email into target_new_email
  from public.profiles
  where id = target_user_id;

  if target_new_email is null or trim(target_new_email) = '' then
    raise exception 'No pending email change request found for this user.';
  end if;

  -- Update Supabase Authentication user table email
  update auth.users
  set email = lower(trim(target_new_email)),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', lower(trim(target_new_email))),
      updated_at = now()
  where id = target_user_id;

  -- Update application profiles table email
  update public.profiles
  set email = lower(trim(target_new_email)),
      pending_email = null,
      email_change_status = 'approved'
  where id = target_user_id;

  return true;
end;
$$;

grant execute on function public.admin_approve_email_change(uuid) to authenticated;

-- 15.4 Admin Decline Email Change RPC
create or replace function public.admin_decline_email_change(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Validate administrator authorization
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(trim(coalesce(role, ''))) in ('dswd_admin', 'admin')
  ) then
    raise exception 'Unauthorized: Only DSWD administrators can decline email changes.';
  end if;

  update public.profiles
  set pending_email = null,
      email_change_status = 'rejected'
  where id = target_user_id;

  return true;
end;
$$;

grant execute on function public.admin_decline_email_change(uuid) to authenticated;

-- ==============================================================================
-- 16. AUTOMATIC BIDIRECTIONAL EMAIL SYNCHRONIZATION TRIGGERS
-- ==============================================================================

-- 16.1 Sync auth.users email -> public.profiles email
create or replace function public.sync_auth_user_email_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.email is distinct from old.email and new.email is not null then
    update public.profiles
    set email = lower(trim(new.email)),
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.sync_auth_user_email_to_profile();

-- 16.2 Sync public.profiles email -> auth.users email
create or replace function public.sync_profile_email_to_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.email is distinct from old.email and new.email is not null and trim(new.email) <> '' then
    update auth.users
    set email = lower(trim(new.email)),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', lower(trim(new.email))),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_email_updated on public.profiles;
create trigger on_profile_email_updated
  after update of email on public.profiles
  for each row
  execute function public.sync_profile_email_to_auth_user();

-- ==============================================================================
-- 17. CLEANUP: DROP REDUNDANT / UNUSED COLUMNS ON truck_live_locations
-- ==============================================================================
alter table public.truck_live_locations
  drop column if exists destination_lgu_id cascade,
  drop column if exists destination_name,
  drop column if exists driver_name,
  drop column if exists driver_phone,
  drop column if exists shipment_id;

-- ==============================================================================
-- END OF SCHEMA SCRIPT
-- ==============================================================================



