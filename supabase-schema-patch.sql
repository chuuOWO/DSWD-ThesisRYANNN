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

create table if not exists public.lgu_priority_reports (
  id uuid primary key default gen_random_uuid(),
  lgu_name text not null,
  municipality text not null,
  province text not null,
  reported_at timestamptz not null default now(),
  food_packs integer not null default 0,
  hygiene_kits integer not null default 0,
  family_kits integer not null default 0,
  affected_families integer not null default 0,
  damage_index integer not null default 0,
  urgency_score integer not null default 0,
  priority_color text not null default 'Green' check (priority_color in ('Red', 'Yellow', 'Green')),
  recommendation text not null default ''
);

create table if not exists public.lgu_delivery_summaries (
  id uuid primary key default gen_random_uuid(),
  lgu_name text not null,
  municipality text not null,
  province text not null,
  total_items_released integer not null default 0,
  delivery_count integer not null default 0,
  completed_deliveries integer not null default 0,
  pending_deliveries integer not null default 0,
  last_delivery_date text,
  current_stock jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

do $$
begin
  alter publication supabase_realtime add table public.lgu_priority_reports;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.lgu_delivery_summaries;
exception
  when duplicate_object then null;
end $$;

alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;
alter table public.lgu_priority_reports enable row level security;
alter table public.lgu_delivery_summaries enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('dswd_admin', 'receiver')),
  truck_id text,
  lgu_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles
drop constraint if exists profiles_role_check;

update public.profiles
set role = 'receiver'
where role in ('trucker', 'lgu');

alter table public.profiles
add constraint profiles_role_check
check (role in ('dswd_admin', 'receiver'));

create table if not exists public.truck_live_locations (
  truck_id text primary key,
  dr_number text,
  latitude double precision not null,
  longitude double precision not null,
  gps_text text not null,
  accuracy double precision,
  tx_hash text,
  wallet_address text,
  proof_mode text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.truck_live_locations enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, truck_id, lgu_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' = 'dswd_admin' then 'dswd_admin'
      else 'receiver'
    end,
    case
      when new.raw_user_meta_data->>'role' = 'dswd_admin' then null
      else new.raw_user_meta_data->>'truck_id'
    end,
    null
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    truck_id = excluded.truck_id,
    lgu_name = excluded.lgu_name;

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

drop policy if exists "Allow anon read incoming" on public.incoming_manifests;
create policy "Allow anon read incoming"
on public.incoming_manifests for select
to authenticated
using (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow anon insert incoming" on public.incoming_manifests;
create policy "Allow anon insert incoming"
on public.incoming_manifests for insert
to authenticated
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow anon update incoming" on public.incoming_manifests;
create policy "Allow anon update incoming"
on public.incoming_manifests for update
to authenticated
using (public.current_user_role() = 'dswd_admin')
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow anon read outgoing" on public.outgoing_requests;
create policy "Allow anon read outgoing"
on public.outgoing_requests for select
to authenticated
using (true);

drop policy if exists "Allow anon insert outgoing" on public.outgoing_requests;
create policy "Allow anon insert outgoing"
on public.outgoing_requests for insert
to authenticated
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow anon update outgoing" on public.outgoing_requests;
create policy "Allow anon update outgoing"
on public.outgoing_requests for update
to authenticated
using (public.current_user_role() in ('dswd_admin', 'receiver'))
with check (public.current_user_role() in ('dswd_admin', 'receiver'));

drop policy if exists "Allow authenticated read lgu priority reports" on public.lgu_priority_reports;
create policy "Allow authenticated read lgu priority reports"
on public.lgu_priority_reports for select
to authenticated
using (true);

drop policy if exists "Allow admin insert lgu priority reports" on public.lgu_priority_reports;
create policy "Allow admin insert lgu priority reports"
on public.lgu_priority_reports for insert
to authenticated
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow admin update lgu priority reports" on public.lgu_priority_reports;
create policy "Allow admin update lgu priority reports"
on public.lgu_priority_reports for update
to authenticated
using (public.current_user_role() = 'dswd_admin')
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow authenticated read lgu delivery summaries" on public.lgu_delivery_summaries;
create policy "Allow authenticated read lgu delivery summaries"
on public.lgu_delivery_summaries for select
to authenticated
using (true);

drop policy if exists "Allow admin insert lgu delivery summaries" on public.lgu_delivery_summaries;
create policy "Allow admin insert lgu delivery summaries"
on public.lgu_delivery_summaries for insert
to authenticated
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Allow admin update lgu delivery summaries" on public.lgu_delivery_summaries;
create policy "Allow admin update lgu delivery summaries"
on public.lgu_delivery_summaries for update
to authenticated
using (public.current_user_role() = 'dswd_admin')
with check (public.current_user_role() = 'dswd_admin');

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

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

do $$
begin
  alter publication supabase_realtime add table public.truck_live_locations;
exception
  when duplicate_object then null;
end $$;
