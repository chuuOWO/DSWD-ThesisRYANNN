-- ==============================================================================
-- DSWD DISASTER RESPONSE SUPPLY CHAIN MANAGEMENT SYSTEM
-- AUTHORITATIVE DATABASE SCHEMA & MIGRATION SCRIPT (VERSION 2)
-- ==============================================================================
-- Idempotent, rerun-safe, and production-tested.
-- Streamlined to retain only active, operational application fields:
-- 1. All 13 relational tables with explicit Foreign Key (FK) relationships.
-- 2. Dual-dispatch support: Central Warehouse-to-LGU and Inter-LGU Mutual Aid.
-- 3. Dual-intake support: Warehouse Intake and Direct Municipal Drop-off.
-- 4. Clean separation of concerns: Blockchain tokens and custody proofs reside
--    exclusively on outgoing_requests (removed legacy on-chain clutter from incoming).
-- 5. Full RLS security policies, Realtime publication, and automated triggers.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. MASTER GEO-LOGISTICS TABLES
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
  category text not null default 'Food Item',
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

-- 2.4 TABLE: warehouses (Regional Storage Warehouses)
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete set null,
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
  current_stock jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure province_id column & FK exist
alter table public.warehouses add column if not exists province_id uuid;

update public.warehouses w
set province_id = p.id
from public.provinces p
where w.province_id is null
  and lower(trim(w.province)) = lower(trim(p.name));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_warehouses_province') then
    alter table public.warehouses
      add constraint fk_warehouses_province
      foreign key (province_id) references public.provinces(id) on delete set null;
  end if;
end $$;

create index if not exists warehouses_province_id_idx on public.warehouses (province_id);

insert into public.warehouses (name, province, municipality, capacity_packs, latitude, longitude) values
  ('Oton Main Warehouse', 'Iloilo', 'Oton', 150000, 10.6975, 122.4764),
  ('Pototan Main Warehouse', 'Iloilo', 'Pototan', 80000, 10.9492, 122.6289)
on conflict (name) do nothing;

-- 2.5 TABLE: lgus (Master Panay Local Government Units Directory & Live Monitoring)
create table if not exists public.lgus (
  id uuid primary key default gen_random_uuid(),
  province_id uuid references public.provinces(id) on delete set null,
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
  current_stock jsonb not null default '{}'::jsonb,
  urgency_score integer default 0,
  priority_color text default 'Green',
  recommendation text default '',
  last_reported_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_lgus_muni_prov unique (municipality, province)
);

-- Ensure province_id column & FK exist
alter table public.lgus add column if not exists province_id uuid;

update public.lgus l
set province_id = p.id
from public.provinces p
where l.province_id is null
  and lower(trim(l.province)) = lower(trim(p.name));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_lgus_province') then
    alter table public.lgus
      add constraint fk_lgus_province
      foreign key (province_id) references public.provinces(id) on delete set null;
  end if;
end $$;

create index if not exists lgus_province_id_idx on public.lgus (province_id);
create index if not exists lgus_province_municipality_idx on public.lgus (province, municipality);
create index if not exists lgus_is_active_idx on public.lgus (is_active);

-- Seed baseline 101 Panay municipalities
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

-- ==============================================================================
-- 3. SUPPLY CHAIN OPERATIONS TABLES
-- ==============================================================================

-- 3.1 TABLE: incoming_manifests (Inbound Goods Intake & Physical Verification)
-- NOTE: Blockchain batch minting occurs on outgoing allocation; incoming operates
-- as physical warehouse receiving inspection.
create table if not exists public.incoming_manifests (
  id uuid primary key default gen_random_uuid(),
  manifest_number text not null unique,
  date_received text not null,
  category text not null,
  quantity integer not null default 0,
  unit_type text not null default 'packs',
  expiration_date text default '',
  source text not null,
  destination_type text not null default 'Warehouse' check (destination_type in ('Warehouse', 'LGU')),
  destination text not null,
  incident_code text default '',
  status text not null default 'Draft' check (status in ('Draft', 'Pending Verification', 'Verified', 'Correction Requested', 'Rejected')),
  manifest_hash text default '',
  verified_by text default '',
  correction_note text default '',
  supply_source_id uuid references public.supply_sources(id) on delete set null,
  destination_warehouse_id uuid references public.warehouses(id) on delete set null,
  destination_lgu_id uuid references public.lgus(id) on delete set null,
  kit_type_id uuid references public.kit_types(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Clean up any legacy obsolete columns from previous iterations
alter table public.incoming_manifests drop column if exists batch_token_id cascade;
alter table public.incoming_manifests drop column if exists minted_at cascade;
alter table public.incoming_manifests drop column if exists wallet_address cascade;
alter table public.incoming_manifests drop column if exists tx_hash cascade;

-- Ensure foreign key columns exist
alter table public.incoming_manifests add column if not exists supply_source_id uuid;
alter table public.incoming_manifests add column if not exists destination_warehouse_id uuid;
alter table public.incoming_manifests add column if not exists destination_lgu_id uuid;
alter table public.incoming_manifests add column if not exists kit_type_id uuid;

-- Backfill supply_source_id
update public.incoming_manifests inc
set supply_source_id = s.id
from public.supply_sources s
where inc.supply_source_id is null and (
  lower(trim(coalesce(inc.source, ''))) = lower(trim(s.short_code)) or
  lower(trim(coalesce(inc.source, ''))) = lower(trim(s.name)) or
  lower(coalesce(inc.source, '')) like '%' || lower(s.short_code) || '%'
);

-- Backfill destination_warehouse_id
update public.incoming_manifests inc
set destination_warehouse_id = w.id
from public.warehouses w
where inc.destination_warehouse_id is null
  and lower(trim(coalesce(inc.destination_type, 'warehouse'))) = 'warehouse'
  and (
    lower(trim(coalesce(inc.destination, ''))) = lower(trim(w.name)) or
    lower(trim(coalesce(inc.destination, ''))) = lower(trim(w.municipality)) or
    lower(coalesce(inc.destination, '')) like '%' || lower(trim(w.municipality)) || '%'
  );

-- Backfill destination_lgu_id
update public.incoming_manifests inc
set destination_lgu_id = l.id
from public.lgus l
where inc.destination_lgu_id is null
  and lower(trim(coalesce(inc.destination_type, ''))) = 'lgu'
  and (
    lower(trim(coalesce(inc.destination, ''))) = lower(trim(l.municipality)) or
    lower(trim(coalesce(inc.destination, ''))) = lower(trim(l.lgu_name))
  );

-- Backfill kit_type_id
update public.incoming_manifests inc
set kit_type_id = k.id
from public.kit_types k
where inc.kit_type_id is null
  and (
    lower(trim(coalesce(inc.category, ''))) = lower(trim(k.name)) or
    lower(coalesce(inc.category, '')) like '%' || lower(trim(k.name)) || '%'
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_incoming_supply_source') then
    alter table public.incoming_manifests
      add constraint fk_incoming_supply_source
      foreign key (supply_source_id) references public.supply_sources(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_incoming_dest_warehouse') then
    alter table public.incoming_manifests
      add constraint fk_incoming_dest_warehouse
      foreign key (destination_warehouse_id) references public.warehouses(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_incoming_dest_lgu') then
    alter table public.incoming_manifests
      add constraint fk_incoming_dest_lgu
      foreign key (destination_lgu_id) references public.lgus(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_incoming_kit_type') then
    alter table public.incoming_manifests
      add constraint fk_incoming_kit_type
      foreign key (kit_type_id) references public.kit_types(id) on delete set null;
  end if;
end $$;

create index if not exists incoming_manifests_supply_source_idx on public.incoming_manifests (supply_source_id);
create index if not exists incoming_manifests_dest_warehouse_idx on public.incoming_manifests (destination_warehouse_id);
create index if not exists incoming_manifests_dest_lgu_idx on public.incoming_manifests (destination_lgu_id);
create index if not exists incoming_manifests_kit_type_idx on public.incoming_manifests (kit_type_id);
create index if not exists incoming_manifests_created_at_idx on public.incoming_manifests (created_at desc);

-- 3.2 TABLE: outgoing_requests (Relief Allocation, Blockchain Minting & Custody Dispatch)
create table if not exists public.outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  dr_number text not null unique,
  date_allocated text not null,
  source_type text not null default 'Warehouse' check (source_type in ('Warehouse', 'LGU')),
  warehouse_source text not null,
  source_warehouse_id uuid references public.warehouses(id) on delete set null,
  source_lgu_id uuid references public.lgus(id) on delete set null,
  lgu_id uuid references public.lgus(id) on delete set null,
  lgu_name text not null,
  province text not null,
  municipality text not null,
  category text not null,
  kit_type_id uuid references public.kit_types(id) on delete set null,
  amount_requested integer not null default 0,
  amount_approved integer not null default 0,
  delivery_mode text default 'DSWD Assigned Receiver',
  delivery_status text not null default 'Allocating',
  incident_code text default '',
  incident_date text default '',
  report_reason text default '',
  allocated_batches jsonb default '[]'::jsonb,
  assigned_truck_id text,
  handover_contract_id text default '',
  admin_signature text default '',
  sender_signature text default '',
  receiver_signature text default '',
  sender_gps text default '',
  receiver_gps text default '',
  destination_address text default '',
  tx_hash text default '',
  wallet_address text default '',
  delivery_priority integer not null default 0,
  is_held boolean not null default false,
  correction_note text default '',
  created_at timestamptz not null default now()
);

-- Ensure all foreign key columns exist
alter table public.outgoing_requests add column if not exists source_type text default 'Warehouse';
alter table public.outgoing_requests add column if not exists source_warehouse_id uuid;
alter table public.outgoing_requests add column if not exists source_lgu_id uuid;
alter table public.outgoing_requests add column if not exists lgu_id uuid;
alter table public.outgoing_requests add column if not exists kit_type_id uuid;

-- Backfill destination lgu_id from municipality & province
update public.outgoing_requests req
set lgu_id = l.id
from public.lgus l
where req.lgu_id is null
  and lower(trim(req.municipality)) = lower(trim(l.municipality))
  and (req.province is null or lower(trim(req.province)) = lower(trim(l.province)));

-- Backfill source_warehouse_id from warehouses
update public.outgoing_requests req
set source_warehouse_id = w.id
from public.warehouses w
where req.source_warehouse_id is null
  and (req.source_type is null or lower(trim(req.source_type)) = 'warehouse')
  and (
    lower(trim(coalesce(req.warehouse_source, ''))) = lower(trim(w.name)) or
    lower(trim(coalesce(req.warehouse_source, ''))) = lower(trim(w.municipality)) or
    lower(coalesce(req.warehouse_source, '')) like '%' || lower(trim(w.municipality)) || '%'
  );

-- Backfill source_lgu_id from lgus (Inter-LGU Mutual Aid source)
update public.outgoing_requests req
set source_lgu_id = l.id
from public.lgus l
where req.source_lgu_id is null
  and lower(trim(coalesce(req.source_type, ''))) = 'lgu'
  and (
    lower(trim(coalesce(req.warehouse_source, ''))) = lower(trim(l.municipality)) or
    lower(trim(coalesce(req.warehouse_source, ''))) = lower(trim(l.lgu_name))
  );

-- Backfill kit_type_id from kit_types
update public.outgoing_requests req
set kit_type_id = k.id
from public.kit_types k
where req.kit_type_id is null
  and (
    lower(trim(coalesce(req.category, ''))) = lower(trim(k.name)) or
    lower(coalesce(req.category, '')) like '%' || lower(trim(k.name)) || '%'
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_outgoing_requests_lgu') then
    alter table public.outgoing_requests
      add constraint fk_outgoing_requests_lgu
      foreign key (lgu_id) references public.lgus(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_outgoing_source_warehouse') then
    alter table public.outgoing_requests
      add constraint fk_outgoing_source_warehouse
      foreign key (source_warehouse_id) references public.warehouses(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_outgoing_source_lgu') then
    alter table public.outgoing_requests
      add constraint fk_outgoing_source_lgu
      foreign key (source_lgu_id) references public.lgus(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_outgoing_kit_type') then
    alter table public.outgoing_requests
      add constraint fk_outgoing_kit_type
      foreign key (kit_type_id) references public.kit_types(id) on delete set null;
  end if;
end $$;

create index if not exists outgoing_requests_lgu_id_idx on public.outgoing_requests (lgu_id);
create index if not exists outgoing_requests_source_warehouse_idx on public.outgoing_requests (source_warehouse_id);
create index if not exists outgoing_requests_source_lgu_idx on public.outgoing_requests (source_lgu_id);
create index if not exists outgoing_requests_kit_type_idx on public.outgoing_requests (kit_type_id);
create index if not exists outgoing_requests_assigned_truck_id_idx on public.outgoing_requests (assigned_truck_id);
create index if not exists outgoing_requests_delivery_status_created_at_idx on public.outgoing_requests (delivery_status, created_at desc);
create index if not exists outgoing_requests_created_at_idx on public.outgoing_requests (created_at desc);

-- 3.3 TABLE: lgu_inventory_reports (Stock-Based Needs Index & Priority Reports)
create table if not exists public.lgu_inventory_reports (
  id uuid primary key default gen_random_uuid(),
  lgu_id uuid references public.lgus(id) on delete set null,
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

-- Backfill lgu_id from municipality & province
update public.lgu_inventory_reports rpt
set lgu_id = l.id
from public.lgus l
where rpt.lgu_id is null
  and lower(trim(rpt.municipality)) = lower(trim(l.municipality))
  and (rpt.province is null or lower(trim(rpt.province)) = lower(trim(l.province)));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_lgu_reports_lgu') then
    alter table public.lgu_inventory_reports
      add constraint fk_lgu_reports_lgu
      foreign key (lgu_id) references public.lgus(id) on delete set null;
  end if;
end $$;

create index if not exists lgu_inventory_reports_lgu_id_idx on public.lgu_inventory_reports (lgu_id);
create index if not exists lgu_inventory_reports_priority_idx on public.lgu_inventory_reports (priority_color, urgency_score desc, reported_at desc);
create index if not exists lgu_inventory_reports_municipality_idx on public.lgu_inventory_reports (municipality, reported_at desc);

-- ==============================================================================
-- 4. FLEET TELEMETRY, AUDIT & SECURITY TABLES
-- ==============================================================================

-- 4.1 TABLE: profiles (RBAC, Official ID & User Jurisdictions)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  official_id text unique,
  email text not null,
  full_name text not null default '',
  first_name text default '',
  last_name text default '',
  phone_number text default '',
  job_position text default '',
  work_id_url text,
  role text not null default 'receiver' check (role in ('dswd_admin', 'receiver')),
  truck_id text,
  lgu_id uuid references public.lgus(id) on delete set null,
  lgu_name text,
  wallet_address text,
  avatar_url text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  pending_email text,
  email_change_status text default null,
  created_at timestamptz not null default now()
);

-- Backfill profiles lgu_id from lgu_name
update public.profiles p
set lgu_id = l.id
from public.lgus l
where p.lgu_id is null
  and p.lgu_name is not null
  and (
    lower(trim(p.lgu_name)) = lower(trim(l.municipality)) or
    lower(trim(p.lgu_name)) = lower(trim(l.lgu_name)) or
    lower(p.lgu_name) like '%' || lower(l.municipality) || '%'
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_profiles_lgu') then
    alter table public.profiles
      add constraint fk_profiles_lgu
      foreign key (lgu_id) references public.lgus(id) on delete set null;
  end if;
end $$;

create index if not exists profiles_lgu_id_idx on public.profiles (lgu_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);

-- 4.2 TABLE: truck_live_locations (Live Convoy GPS Fleet Tracking)
create table if not exists public.truck_live_locations (
  truck_id text primary key,
  current_dr_number text references public.outgoing_requests(dr_number) on delete set null,
  destination_lgu_id uuid references public.lgus(id) on delete set null,
  driver_profile_id uuid references public.profiles(id) on delete set null,
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

-- Clean up unused columns
alter table public.truck_live_locations drop column if exists destination_name cascade;
alter table public.truck_live_locations drop column if exists driver_name cascade;
alter table public.truck_live_locations drop column if exists driver_phone cascade;
alter table public.truck_live_locations drop column if exists shipment_id cascade;

-- Backfill driver_profile_id from profiles
update public.truck_live_locations t
set driver_profile_id = p.id
from public.profiles p
where t.driver_profile_id is null
  and (
    (p.truck_id is not null and trim(p.truck_id) <> '' and upper(trim(t.truck_id)) = upper(trim(p.truck_id))) or
    (t.wallet_address is not null and p.wallet_address is not null and lower(trim(t.wallet_address)) = lower(trim(p.wallet_address)))
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_truck_current_dr') then
    alter table public.truck_live_locations
      add constraint fk_truck_current_dr
      foreign key (current_dr_number) references public.outgoing_requests(dr_number) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_truck_destination_lgu') then
    alter table public.truck_live_locations
      add constraint fk_truck_destination_lgu
      foreign key (destination_lgu_id) references public.lgus(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_truck_driver_profile') then
    alter table public.truck_live_locations
      add constraint fk_truck_driver_profile
      foreign key (driver_profile_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists truck_live_locations_dr_idx on public.truck_live_locations (current_dr_number);
create index if not exists truck_live_locations_lgu_idx on public.truck_live_locations (destination_lgu_id);
create index if not exists truck_live_locations_driver_idx on public.truck_live_locations (driver_profile_id);
create index if not exists truck_live_locations_updated_at_idx on public.truck_live_locations (updated_at desc);

-- 4.3 TABLE: discrepancy_reports (Inspection Mismatches & Quality Audit Flags)
create table if not exists public.discrepancy_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('Incoming', 'Outgoing')),
  manifest_number text references public.incoming_manifests(manifest_number) on delete set null,
  dr_number text references public.outgoing_requests(dr_number) on delete set null,
  reported_by_profile_id uuid references public.profiles(id) on delete set null,
  reported_by_role text,
  reported_by_wallet text,
  note text not null,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Backfill reported_by_profile_id from profiles
update public.discrepancy_reports d
set reported_by_profile_id = p.id
from public.profiles p
where d.reported_by_profile_id is null
  and d.reported_by_wallet is not null
  and p.wallet_address is not null
  and lower(trim(d.reported_by_wallet)) = lower(trim(p.wallet_address));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_discrepancy_manifest') then
    alter table public.discrepancy_reports
      add constraint fk_discrepancy_manifest
      foreign key (manifest_number) references public.incoming_manifests(manifest_number) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_discrepancy_dr') then
    alter table public.discrepancy_reports
      add constraint fk_discrepancy_dr
      foreign key (dr_number) references public.outgoing_requests(dr_number) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_discrepancy_reported_by_profile') then
    alter table public.discrepancy_reports
      add constraint fk_discrepancy_reported_by_profile
      foreign key (reported_by_profile_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists discrepancy_reports_type_idx on public.discrepancy_reports (report_type, reported_at desc);
create index if not exists discrepancy_reports_manifest_idx on public.discrepancy_reports (manifest_number, reported_at desc);
create index if not exists discrepancy_reports_dr_idx on public.discrepancy_reports (dr_number, reported_at desc);
create index if not exists discrepancy_reports_reporter_idx on public.discrepancy_reports (reported_by_profile_id);

-- 4.4 TABLE: activity_logs (Platform Audit Trail & Action History)
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

create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_action on public.activity_logs (action);
create index if not exists idx_activity_logs_actor_id on public.activity_logs (actor_id);
create index if not exists idx_activity_logs_entity_type on public.activity_logs (entity_type);

-- 4.5 TABLE: app_counters (Sequential Number Synchronization)
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

-- Synchronize counter baselines from existing records
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
-- 5. BUSINESS LOGIC FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 5.1 Official ID Sequence for DSWD personnel (Format: ROLE-YYYY-NNNNNNNNN)
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

-- 5.2 Dynamic LGU Priority Recalculation Engine
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

-- 5.3 Trigger: Synchronize LGU inventory report to master directory
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

-- 5.4 Trigger: Auto-provision auth.users profile
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

-- 5.5 Trigger: Clean orphan truck locations when profile is deleted
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
-- 6. ADMINISTRATIVE SECURITY & RPC FUNCTIONS
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
-- 7. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'provinces', 'supply_sources', 'kit_types', 'warehouses', 'lgus',
    'incoming_manifests', 'outgoing_requests', 'lgu_inventory_reports',
    'truck_live_locations', 'discrepancy_reports', 'profiles', 'activity_logs', 'app_counters'
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
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.provinces enable row level security;
alter table public.supply_sources enable row level security;
alter table public.kit_types enable row level security;
alter table public.warehouses enable row level security;
alter table public.lgus enable row level security;
alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;
alter table public.lgu_inventory_reports enable row level security;
alter table public.truck_live_locations enable row level security;
alter table public.discrepancy_reports enable row level security;
alter table public.profiles enable row level security;
alter table public.activity_logs enable row level security;
alter table public.app_counters enable row level security;

-- Read policies (Public & Authenticated)
create policy "Allow read provinces" on public.provinces for select using (true);
create policy "Allow read supply sources" on public.supply_sources for select using (true);
create policy "Allow read kit types" on public.kit_types for select using (true);
create policy "Allow read warehouses" on public.warehouses for select using (true);
create policy "Allow read lgus" on public.lgus for select using (true);
create policy "Allow read incoming" on public.incoming_manifests for select using (true);
create policy "Allow read outgoing" on public.outgoing_requests for select using (true);
create policy "Allow read LGU reports" on public.lgu_inventory_reports for select using (true);
create policy "Allow read truck locations" on public.truck_live_locations for select using (true);
create policy "Allow read discrepancy reports" on public.discrepancy_reports for select using (true);
create policy "Allow read profiles" on public.profiles for select using (true);
create policy "Allow read activity logs" on public.activity_logs for select using (true);
create policy "Allow read app counters" on public.app_counters for select using (true);

-- Write policies
create policy "Allow write provinces" on public.provinces for all using (true) with check (true);
create policy "Allow write supply sources" on public.supply_sources for all using (true) with check (true);
create policy "Allow write kit types" on public.kit_types for all using (true) with check (true);
create policy "Allow write warehouses" on public.warehouses for all using (true) with check (true);
create policy "Allow write lgus" on public.lgus for all using (true) with check (true);
create policy "Allow write incoming" on public.incoming_manifests for all using (true) with check (true);
create policy "Allow write outgoing" on public.outgoing_requests for all using (true) with check (true);
create policy "Allow write LGU reports" on public.lgu_inventory_reports for all using (true) with check (true);
create policy "Allow write truck locations" on public.truck_live_locations for all using (true) with check (true);
create policy "Allow write discrepancy reports" on public.discrepancy_reports for all using (true) with check (true);
create policy "Allow write activity logs" on public.activity_logs for all using (true) with check (true);
create policy "Allow write app counters" on public.app_counters for all using (true) with check (true);

-- Profile specific RLS
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
-- END OF SCHEMA SCRIPT (VERSION 2)
-- ==============================================================================
