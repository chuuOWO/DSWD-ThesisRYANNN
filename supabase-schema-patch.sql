-- Run this once in Supabase SQL Editor.
-- It adds a user-facing incoming manifest number while keeping the UUID id internal.

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

alter table public.incoming_manifests enable row level security;
alter table public.outgoing_requests enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('dswd_admin', 'trucker', 'lgu')),
  truck_id text,
  lgu_name text,
  created_at timestamptz not null default now()
);

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
    coalesce(new.raw_user_meta_data->>'role', 'trucker'),
    new.raw_user_meta_data->>'truck_id',
    new.raw_user_meta_data->>'lgu_name'
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
using (public.current_user_role() in ('dswd_admin', 'trucker', 'lgu'))
with check (public.current_user_role() in ('dswd_admin', 'trucker', 'lgu'));

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
with check (public.current_user_role() in ('dswd_admin', 'trucker'));

drop policy if exists "Allow authenticated update truck live locations" on public.truck_live_locations;
create policy "Allow authenticated update truck live locations"
on public.truck_live_locations for update
to authenticated
using (public.current_user_role() in ('dswd_admin', 'trucker'))
with check (public.current_user_role() in ('dswd_admin', 'trucker'));

do $$
begin
  alter publication supabase_realtime add table public.truck_live_locations;
exception
  when duplicate_object then null;
end $$;
