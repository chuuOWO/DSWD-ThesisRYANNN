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
-- 2. TABLE: lgus (Master Panay & Regional Local Government Units Directory)
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
alter table public.lgus add column if not exists created_at timestamptz default now();
alter table public.lgus add column if not exists updated_at timestamptz default now();

create index if not exists lgus_province_municipality_idx on public.lgus (province, municipality);
create index if not exists lgus_is_active_idx on public.lgus (is_active);

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
  priority_color text not null default 'Green' check (priority_color in ('Red', 'Yellow', 'Green')),
  recommendation text not null default 'Sufficient stock; continue monitoring.',
  created_at timestamptz not null default now()
);

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
begin
  insert into public.profiles (
    id,
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
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'phone_number', ''),
    coalesce(new.raw_user_meta_data->>'job_position', ''),
    new.raw_user_meta_data->>'work_id_url',
    case
      when new.raw_user_meta_data->>'role' = 'dswd_admin' then 'dswd_admin'
      else 'receiver'
    end,
    new.raw_user_meta_data->>'truck_id',
    new.raw_user_meta_data->>'lgu_name',
    new.raw_user_meta_data->>'wallet_address',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'status', 'pending')
  )
  on conflict (id) do update set
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
  select role from public.profiles where id = auth.uid()
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
values ('batch_index', 0)
on conflict (key) do nothing;

update public.app_counters
set value = greatest(value, (
  select coalesce(max((regexp_match(batch_token_id, 'BATCH-\d{4}-(\d+)'))[1]::int), 0)
  from public.incoming_manifests
))
where key = 'batch_index';

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

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.lgus enable row level security;
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

-- 11.2 INCOMING MANIFESTS POLICIES
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

-- 11.3 OUTGOING REQUESTS POLICIES
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

-- 11.4 LGU INVENTORY REPORTS POLICIES
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

-- 11.5 DISCREPANCY REPORTS POLICIES
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

-- 11.6 APP COUNTERS POLICIES
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

-- 11.7 PROFILES POLICIES
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
    public.current_user_role() = 'dswd_admin' or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'dswd_admin'
    )
  )
  with check (
    auth.uid() = id or
    public.current_user_role() = 'dswd_admin' or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'dswd_admin'
    )
  );

-- 11.8 TRUCK LIVE LOCATIONS POLICIES
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
-- END OF SCHEMA SCRIPT
-- ==============================================================================
