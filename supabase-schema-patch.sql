-- ==============================================================================
-- DSWD DISASTER RESPONSE SUPPLY CHAIN MANAGEMENT SYSTEM
-- COMPLETE, RERUNNABLE DATABASE SCHEMA & MIGRATION SCRIPT
-- ==============================================================================
-- This script is completely idempotent. You can run or re-run the entire script
-- safely in the Supabase SQL Editor at any time. It creates all tables if they do
-- not exist, adds all missing columns, configures Realtime, sets up Row Level
-- Security (RLS) policies, and creates performance indexes.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- ==============================================================================
-- 2. TABLE: incoming_manifests (Warehouse Inbound Cargo & Batch Minting)
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

-- Ensure all columns exist for existing tables
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

-- Backfill sequential manifest numbers if any are null
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

-- Indexes for incoming_manifests
create unique index if not exists incoming_manifests_manifest_number_key
  on public.incoming_manifests (manifest_number);

create index if not exists incoming_manifests_created_at_idx
  on public.incoming_manifests (created_at desc);

-- ==============================================================================
-- 3. TABLE: outgoing_requests (Relief Allocations & Logistics Dispatch)
-- ==============================================================================
create table if not exists public.outgoing_requests (
  id uuid primary key default gen_random_uuid(),
  dr_number text,
  date_allocated text,
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

-- Ensure all columns exist for existing tables
alter table public.outgoing_requests add column if not exists dr_number text;
alter table public.outgoing_requests add column if not exists date_allocated text;
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

-- Indexes for outgoing_requests
create unique index if not exists outgoing_requests_dr_number_key
  on public.outgoing_requests (dr_number);

create index if not exists outgoing_requests_assigned_truck_id_idx
  on public.outgoing_requests (assigned_truck_id);

create index if not exists outgoing_requests_delivery_status_created_at_idx
  on public.outgoing_requests (delivery_status, created_at desc);

create index if not exists outgoing_requests_created_at_idx
  on public.outgoing_requests (created_at desc);

-- ==============================================================================
-- 4. TABLE: lgu_inventory_reports (Stock-Based Prioritization & Needs Index)
-- ==============================================================================
create table if not exists public.lgu_inventory_reports (
  id uuid primary key default gen_random_uuid(),
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

-- Ensure all columns exist for existing tables
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

-- Indexes for lgu_inventory_reports
create index if not exists lgu_inventory_reports_priority_idx
  on public.lgu_inventory_reports (priority_color, urgency_score desc, reported_at desc);

create index if not exists lgu_inventory_reports_municipality_idx
  on public.lgu_inventory_reports (municipality, reported_at desc);

-- ==============================================================================
-- 5. TABLE: discrepancy_reports (Audit Trail & Verification Mismatches)
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

-- Ensure all columns exist for existing tables
alter table public.discrepancy_reports add column if not exists report_type text;
alter table public.discrepancy_reports add column if not exists manifest_number text;
alter table public.discrepancy_reports add column if not exists dr_number text;
alter table public.discrepancy_reports add column if not exists note text;
alter table public.discrepancy_reports add column if not exists reported_by_role text;
alter table public.discrepancy_reports add column if not exists reported_by_wallet text;
alter table public.discrepancy_reports add column if not exists reported_at timestamptz default now();
alter table public.discrepancy_reports add column if not exists created_at timestamptz default now();

-- Indexes for discrepancy_reports
create index if not exists discrepancy_reports_type_idx
  on public.discrepancy_reports (report_type, reported_at desc);

create index if not exists discrepancy_reports_manifest_idx
  on public.discrepancy_reports (manifest_number, reported_at desc);

create index if not exists discrepancy_reports_dr_idx
  on public.discrepancy_reports (dr_number, reported_at desc);

-- ==============================================================================
-- 6. TABLE: app_counters (Sequential Identifier Synchronization)
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
  select coalesce(max((regexp_match(batch_token_id, 'BATCH-\\d{4}-(\\d+)'))[1]::int), 0)
  from public.incoming_manifests
))
where key = 'batch_index';

-- ==============================================================================
-- 7. TABLE: profiles (RBAC, Driver/LGU Assignment & Admin Verification)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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

-- Ensure all columns exist for existing tables
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

-- Ensure constraints and normalized role values
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'receiver' where role in ('trucker', 'lgu');
alter table public.profiles add constraint profiles_role_check check (role in ('dswd_admin', 'receiver'));

alter table public.profiles drop constraint if exists profiles_status_check;
update public.profiles set status = 'verified' where status is null;
alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'verified', 'rejected'));

-- Trigger: Automatically create or update profile when a Supabase Auth user signs up
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

-- Helper function: Returns current user role
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Backfill existing auth.users into profiles
insert into public.profiles (id, email, full_name, role, status)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data->>'full_name', 'DSWD Officer'),
  case
    when raw_user_meta_data->>'role' = 'receiver' then 'receiver'
    else 'dswd_admin'
  end,
  coalesce(raw_user_meta_data->>'status', 'verified')
from auth.users
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  status = coalesce(public.profiles.status, excluded.status);

-- ==============================================================================
-- 8. TABLE: truck_live_locations (Real-Time GPS Fleet Tracking)
-- ==============================================================================
create table if not exists public.truck_live_locations (
  truck_id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  gps_text text not null,
  accuracy double precision,
  wallet_address text,
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist for existing tables
alter table public.truck_live_locations add column if not exists latitude double precision;
alter table public.truck_live_locations add column if not exists longitude double precision;
alter table public.truck_live_locations add column if not exists gps_text text;
alter table public.truck_live_locations add column if not exists accuracy double precision;
alter table public.truck_live_locations add column if not exists wallet_address text;
alter table public.truck_live_locations add column if not exists updated_at timestamptz default now();

create index if not exists truck_live_locations_updated_at_idx
  on public.truck_live_locations (updated_at desc);

-- ==============================================================================
-- 9. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
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
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;
alter table public.lgu_inventory_reports enable row level security;
alter table public.discrepancy_reports enable row level security;
alter table public.app_counters enable row level security;
alter table public.profiles enable row level security;
alter table public.truck_live_locations enable row level security;

-- 10.1 INCOMING MANIFESTS POLICIES
drop policy if exists "Allow read incoming" on public.incoming_manifests;
drop policy if exists "Allow anon read incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated read incoming" on public.incoming_manifests;
create policy "Allow read incoming"
  on public.incoming_manifests for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert incoming" on public.incoming_manifests;
drop policy if exists "Allow anon insert incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated insert incoming" on public.incoming_manifests;
create policy "Allow insert incoming"
  on public.incoming_manifests for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update incoming" on public.incoming_manifests;
drop policy if exists "Allow anon update incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated update incoming" on public.incoming_manifests;
create policy "Allow update incoming"
  on public.incoming_manifests for update
  to authenticated, anon
  using (true)
  with check (true);

-- 10.2 OUTGOING REQUESTS POLICIES
drop policy if exists "Allow read outgoing" on public.outgoing_requests;
drop policy if exists "Allow anon read outgoing" on public.outgoing_requests;
drop policy if exists "Allow authenticated read outgoing" on public.outgoing_requests;
create policy "Allow read outgoing"
  on public.outgoing_requests for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert outgoing" on public.outgoing_requests;
drop policy if exists "Allow anon insert outgoing" on public.outgoing_requests;
drop policy if exists "Allow authenticated insert outgoing" on public.outgoing_requests;
create policy "Allow insert outgoing"
  on public.outgoing_requests for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update outgoing" on public.outgoing_requests;
drop policy if exists "Allow anon update outgoing" on public.outgoing_requests;
drop policy if exists "Allow authenticated update outgoing" on public.outgoing_requests;
create policy "Allow update outgoing"
  on public.outgoing_requests for update
  to authenticated, anon
  using (true)
  with check (true);

-- 10.3 LGU INVENTORY REPORTS POLICIES
drop policy if exists "Allow read LGU inventory reports" on public.lgu_inventory_reports;
drop policy if exists "Allow anon read LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow read LGU inventory reports"
  on public.lgu_inventory_reports for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert LGU inventory reports" on public.lgu_inventory_reports;
drop policy if exists "Allow anon insert LGU inventory reports" on public.lgu_inventory_reports;
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

-- 10.4 DISCREPANCY REPORTS POLICIES
drop policy if exists "Allow read discrepancy reports" on public.discrepancy_reports;
drop policy if exists "Allow anon read discrepancy reports" on public.discrepancy_reports;
create policy "Allow read discrepancy reports"
  on public.discrepancy_reports for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert discrepancy reports" on public.discrepancy_reports;
drop policy if exists "Allow anon insert discrepancy reports" on public.discrepancy_reports;
create policy "Allow insert discrepancy reports"
  on public.discrepancy_reports for insert
  to authenticated, anon
  with check (true);

-- 10.5 APP COUNTERS POLICIES
drop policy if exists "Allow read app counters" on public.app_counters;
drop policy if exists "Allow anon read app counters" on public.app_counters;
create policy "Allow read app counters"
  on public.app_counters for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow insert app counters" on public.app_counters;
drop policy if exists "Allow anon insert app counters" on public.app_counters;
create policy "Allow insert app counters"
  on public.app_counters for insert
  to authenticated, anon
  with check (true);

drop policy if exists "Allow update app counters" on public.app_counters;
drop policy if exists "Allow anon update app counters" on public.app_counters;
create policy "Allow update app counters"
  on public.app_counters for update
  to authenticated, anon
  using (true)
  with check (true);

-- 10.6 PROFILES POLICIES
drop policy if exists "Allow profile read" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
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
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
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

-- 10.7 TRUCK LIVE LOCATIONS POLICIES
drop policy if exists "Allow authenticated read truck live locations" on public.truck_live_locations;
create policy "Allow authenticated read truck live locations"
  on public.truck_live_locations for select
  to authenticated, anon
  using (true);

drop policy if exists "Allow authenticated upsert truck live locations" on public.truck_live_locations;
create policy "Allow authenticated upsert truck live locations"
  on public.truck_live_locations for insert
  to authenticated
  with check (
    public.current_user_role() in ('dswd_admin', 'receiver') or
    auth.uid() is not null
  );

drop policy if exists "Allow authenticated update truck live locations" on public.truck_live_locations;
create policy "Allow authenticated update truck live locations"
  on public.truck_live_locations for update
  to authenticated
  using (
    public.current_user_role() in ('dswd_admin', 'receiver') or
    auth.uid() is not null
  )
  with check (
    public.current_user_role() in ('dswd_admin', 'receiver') or
    auth.uid() is not null
  );

drop policy if exists "Allow delete truck live locations" on public.truck_live_locations;
create policy "Allow delete truck live locations"
  on public.truck_live_locations for delete
  to authenticated, anon
  using (true);

-- ==============================================================================
-- END OF SCHEMA SCRIPT
-- ==============================================================================
