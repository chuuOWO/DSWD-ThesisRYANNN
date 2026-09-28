-- Run this once in Supabase SQL Editor.
-- It adds a user-facing incoming manifest number while keeping the UUID id internal.

create extension if not exists pgcrypto;

create table if not exists public.incoming_manifests (
  id uuid primary key default gen_random_uuid(),
  date_received text,
  category text,
  quantity integer not null default 0,
  unit_type text,
  expiration_date text,
  source text,
  destination_type text,
  destination text,
  incident_code text,
  status text not null default 'Draft',
  manifest_hash text,
  tx_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.outgoing_requests (
  id uuid primary key default gen_random_uuid(),
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
  sender_gps text,
  receiver_gps text,
  tx_hash text,
  created_at timestamptz not null default now()
);

alter table public.incoming_manifests
add column if not exists manifest_number text;

alter table public.incoming_manifests
add column if not exists batch_token_id text;

alter table public.incoming_manifests
add column if not exists minted_at text;

alter table public.incoming_manifests
add column if not exists wallet_address text;

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

-- Outgoing requests should also keep their user-facing DR number in the database.
alter table public.outgoing_requests
add column if not exists dr_number text;

alter table public.outgoing_requests
add column if not exists handover_contract_id text;

alter table public.outgoing_requests
add column if not exists sender_signature text;

alter table public.outgoing_requests
add column if not exists receiver_signature text;

alter table public.outgoing_requests
add column if not exists wallet_address text;

alter table public.outgoing_requests
add column if not exists allocated_batches jsonb;

alter table public.outgoing_requests
add column if not exists assigned_truck_id text;

create unique index if not exists outgoing_requests_dr_number_key
on public.outgoing_requests (dr_number);

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

alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;

drop policy if exists "Allow anon read incoming" on public.incoming_manifests;
drop policy if exists "Allow read incoming" on public.incoming_manifests;
create policy "Allow read incoming"
on public.incoming_manifests for select
to authenticated, anon
using (true);

drop policy if exists "Allow anon insert incoming" on public.incoming_manifests;
drop policy if exists "Allow insert incoming" on public.incoming_manifests;
create policy "Allow insert incoming"
on public.incoming_manifests for insert
to authenticated, anon
with check (true);

drop policy if exists "Allow anon update incoming" on public.incoming_manifests;
drop policy if exists "Allow update incoming" on public.incoming_manifests;
create policy "Allow update incoming"
on public.incoming_manifests for update
to authenticated, anon
using (true)
with check (true);

drop policy if exists "Allow anon read outgoing" on public.outgoing_requests;
drop policy if exists "Allow read outgoing" on public.outgoing_requests;
create policy "Allow read outgoing"
on public.outgoing_requests for select
to authenticated, anon
using (true);

drop policy if exists "Allow anon insert outgoing" on public.outgoing_requests;
drop policy if exists "Allow insert outgoing" on public.outgoing_requests;
create policy "Allow insert outgoing"
on public.outgoing_requests for insert
to authenticated, anon
with check (true);

drop policy if exists "Allow anon update outgoing" on public.outgoing_requests;
drop policy if exists "Allow update outgoing" on public.outgoing_requests;
create policy "Allow update outgoing"
on public.outgoing_requests for update
to authenticated, anon
using (true)
with check (true);

-- LGU stock and damage reports drive the Stock-Based Prioritization module.
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

create index if not exists lgu_inventory_reports_priority_idx
on public.lgu_inventory_reports (priority_color, urgency_score desc, reported_at desc);

create index if not exists lgu_inventory_reports_municipality_idx
on public.lgu_inventory_reports (municipality, reported_at desc);

do $$
begin
  alter publication supabase_realtime add table public.lgu_inventory_reports;
exception
  when duplicate_object then null;
end $$;

alter table public.lgu_inventory_reports enable row level security;

drop policy if exists "Allow anon read LGU inventory reports" on public.lgu_inventory_reports;
drop policy if exists "Allow read LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow read LGU inventory reports"
on public.lgu_inventory_reports for select
to authenticated, anon
using (true);

drop policy if exists "Allow anon insert LGU inventory reports" on public.lgu_inventory_reports;
drop policy if exists "Allow insert LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow insert LGU inventory reports"
on public.lgu_inventory_reports for insert
to authenticated, anon
with check (true);

-- Discrepancy reports capture inbound/outbound quantity mismatches.
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

create index if not exists discrepancy_reports_type_idx
on public.discrepancy_reports (report_type, reported_at desc);

create index if not exists discrepancy_reports_manifest_idx
on public.discrepancy_reports (manifest_number, reported_at desc);

create index if not exists discrepancy_reports_dr_idx
on public.discrepancy_reports (dr_number, reported_at desc);

do $$
begin
  alter publication supabase_realtime add table public.discrepancy_reports;
exception
  when duplicate_object then null;
end $$;

alter table public.discrepancy_reports enable row level security;

drop policy if exists "Allow anon read discrepancy reports" on public.discrepancy_reports;
drop policy if exists "Allow read discrepancy reports" on public.discrepancy_reports;
create policy "Allow read discrepancy reports"
on public.discrepancy_reports for select
to authenticated, anon
using (true);

drop policy if exists "Allow anon insert discrepancy reports" on public.discrepancy_reports;
drop policy if exists "Allow insert discrepancy reports" on public.discrepancy_reports;
create policy "Allow insert discrepancy reports"
on public.discrepancy_reports for insert
to authenticated, anon
with check (true);

-- App counters keep unique IDs across deletes.
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

alter table public.app_counters enable row level security;

drop policy if exists "Allow anon read app counters" on public.app_counters;
drop policy if exists "Allow read app counters" on public.app_counters;
create policy "Allow read app counters"
on public.app_counters for select
to authenticated, anon
using (true);

drop policy if exists "Allow anon insert app counters" on public.app_counters;
drop policy if exists "Allow insert app counters" on public.app_counters;
create policy "Allow insert app counters"
on public.app_counters for insert
to authenticated, anon
with check (true);

drop policy if exists "Allow anon update app counters" on public.app_counters;
drop policy if exists "Allow update app counters" on public.app_counters;
create policy "Allow update app counters"
on public.app_counters for update
to authenticated, anon
using (true)
with check (true);

-- Supabase Auth profiles drive the temporary RBAC login/signup flow.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'receiver',
  truck_id text,
  lgu_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists avatar_url text;

alter table public.profiles
add column if not exists wallet_address text;

alter table public.profiles
drop constraint if exists profiles_role_check;

update public.profiles
set role = 'receiver'
where role in ('trucker', 'lgu');

alter table public.profiles
add constraint profiles_role_check
check (role in ('dswd_admin', 'receiver'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, truck_id, lgu_name, wallet_address)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'dswd_admin' then 'dswd_admin'
      else 'receiver'
    end,
    new.raw_user_meta_data->>'truck_id',
    new.raw_user_meta_data->>'lgu_name',
    new.raw_user_meta_data->>'wallet_address'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    truck_id = excluded.truck_id,
    lgu_name = coalesce(excluded.lgu_name, public.profiles.lgu_name),
    wallet_address = coalesce(excluded.wallet_address, public.profiles.wallet_address);

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

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Receiver GPS rows power the administrative Trucking map in real time.
create table if not exists public.truck_live_locations (
  truck_id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  gps_text text not null,
  accuracy double precision,
  wallet_address text,
  updated_at timestamptz not null default now()
);

do $$
begin
  alter publication supabase_realtime add table public.truck_live_locations;
exception
  when duplicate_object then null;
end $$;

alter table public.truck_live_locations enable row level security;

drop policy if exists "Allow authenticated read truck live locations" on public.truck_live_locations;
create policy "Allow authenticated read truck live locations"
on public.truck_live_locations for select
to authenticated
using (true);

drop policy if exists "Allow authenticated upsert truck live locations" on public.truck_live_locations;
create policy "Allow authenticated upsert truck live locations"
on public.truck_live_locations for insert
to authenticated
with check (public.current_user_role() in ('dswd_admin', 'receiver'));

drop policy if exists "Allow authenticated update truck live locations" on public.truck_live_locations;
create policy "Allow authenticated update truck live locations"
on public.truck_live_locations for update
to authenticated
using (public.current_user_role() in ('dswd_admin', 'receiver'))
with check (public.current_user_role() in ('dswd_admin', 'receiver'));

-- Backfill existing auth.users into profiles so current and past accounts exist
insert into public.profiles (id, email, full_name, role)
select 
  id, 
  coalesce(email, ''), 
  coalesce(raw_user_meta_data->>'full_name', 'DSWD Officer'), 
  case 
    when raw_user_meta_data->>'role' = 'receiver' then 'receiver'
    else 'dswd_admin'
  end
from auth.users
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name;

-- Ensure incoming and outgoing are accessible to authenticated and anon users
drop policy if exists "Allow authenticated read incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated insert incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated update incoming" on public.incoming_manifests;
drop policy if exists "Allow authenticated read outgoing" on public.outgoing_requests;
drop policy if exists "Allow authenticated insert outgoing" on public.outgoing_requests;
drop policy if exists "Allow authenticated update outgoing" on public.outgoing_requests;

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

-- ==============================================================================
-- PROFILES RLS UPDATE: ALLOW DSWD ADMIN TO VIEW AND ASSIGN LGU TO RECEIVERS
-- ==============================================================================

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Allow profile read" on public.profiles;

create policy "Allow profile read"
on public.profiles for select
to authenticated, anon
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
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

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

drop policy if exists "Allow update LGU inventory reports" on public.lgu_inventory_reports;
create policy "Allow update LGU inventory reports"
on public.lgu_inventory_reports for update
to authenticated, anon
using (true)
with check (true);

-- Add status column to profiles (for signup verification)
alter table public.profiles
add column if not exists status text not null default 'pending';

-- Ensure existing active profiles are marked verified
update public.profiles
set status = 'verified'
where status is null;

-- ==============================================================================
-- HYBRID CUSTODIAL WEB3 ARCHITECTURE PATCH
-- ==============================================================================

-- 1. Profiles Table: Encrypted Custodial Key Storage (AES-256-GCM)
alter table public.profiles
add column if not exists encrypted_private_key text,
add column if not exists key_iv text,
add column if not exists key_auth_tag text;

-- Ensure wallet_address has a unique index if not null
create unique index if not exists profiles_wallet_address_key
on public.profiles (wallet_address)
where wallet_address is not null;

-- 2. Batches Table: Complete Cargo Lifecycle Metadata
create table if not exists public.batches (
  batch_id bigint primary key,
  manifest_number text not null,
  item_type text not null,
  total_quantity integer not null,
  origin_warehouse text not null,
  destination_lgu_id uuid references public.profiles(id) on delete set null,
  assigned_driver_id uuid references public.profiles(id) on delete set null,
  status text default 'PACKED' check (status in ('PACKED', 'IN_TRANSIT', 'DELIVERED', 'ACCEPTED', 'CANCELLED')),
  tx_hash_mint text,
  tx_hash_release text,
  tx_hash_receipt text,
  qr_signature text not null,
  created_at timestamptz not null default now()
);

create index if not exists batches_manifest_idx on public.batches (manifest_number);
create index if not exists batches_status_idx on public.batches (status);

-- 3. Custody Scan Logs Table: Two-Party Digital Handover Audit Trail
create table if not exists public.custody_scan_logs (
  id uuid primary key default gen_random_uuid(),
  batch_id bigint references public.batches(batch_id) on delete cascade,
  scanned_by uuid references public.profiles(id) on delete set null,
  scan_type text check (scan_type in ('DRIVER_PICKUP', 'LGU_RECEIPT')),
  device_latitude double precision,
  device_longitude double precision,
  tx_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists custody_scan_logs_batch_idx on public.custody_scan_logs (batch_id);
create index if not exists custody_scan_logs_scanned_by_idx on public.custody_scan_logs (scanned_by);

-- 4. Enable Realtime Publications
do $$
begin
  alter publication supabase_realtime add table public.batches;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.custody_scan_logs;
exception
  when duplicate_object then null;
end $$;

-- 5. Row Level Security for Batches and Custody Scan Logs
alter table public.batches enable row level security;
alter table public.custody_scan_logs enable row level security;

drop policy if exists "Allow read batches" on public.batches;
create policy "Allow read batches"
on public.batches for select
to authenticated, anon
using (true);

drop policy if exists "Allow insert batches" on public.batches;
create policy "Allow insert batches"
on public.batches for insert
to authenticated, anon
with check (true);

drop policy if exists "Allow update batches" on public.batches;
create policy "Allow update batches"
on public.batches for update
to authenticated, anon
using (true)
with check (true);

drop policy if exists "Allow read custody scan logs" on public.custody_scan_logs;
create policy "Allow read custody scan logs"
on public.custody_scan_logs for select
to authenticated, anon
using (true);

drop policy if exists "Allow insert custody scan logs" on public.custody_scan_logs;
create policy "Allow insert custody scan logs"
on public.custody_scan_logs for insert
to authenticated, anon
with check (true);



