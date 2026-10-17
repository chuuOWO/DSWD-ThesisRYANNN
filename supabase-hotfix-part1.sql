-- ==============================================================================
-- DSWD DISASTER RESPONSE: HOTFIX PART 1 (DATABASE CONSTRAINTS & COLUMNS)
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to update constraints and columns
-- safely without dropping or recreating any existing tables.
-- ==============================================================================

-- 1. Update outgoing_requests delivery_status check constraint to include 'Draft'
alter table public.outgoing_requests drop constraint if exists outgoing_requests_delivery_status_check;
alter table public.outgoing_requests add constraint outgoing_requests_delivery_status_check
  check (delivery_status in ('Draft', 'Allocating', 'Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed', 'Correction Requested', 'Cancelled'));

-- 2. Ensure destination_lgu_id exists on outgoing_requests
alter table public.outgoing_requests add column if not exists destination_lgu_id uuid references public.lgus(id) on delete restrict;

-- 3. Confirm incoming_manifests status check constraint (pure off-chain intake)
alter table public.incoming_manifests drop constraint if exists incoming_manifests_status_check;
alter table public.incoming_manifests add constraint incoming_manifests_status_check
  check (status in ('Draft', 'Pending Verification', 'Verified', 'Correction Requested', 'Rejected'));

-- 4. Ensure FNFI stockpile columns exist on public.lgus
alter table public.lgus add column if not exists food_packs integer not null default 0;
alter table public.lgus add column if not exists hygiene_kits integer not null default 0;
alter table public.lgus add column if not exists sleeping_kits integer not null default 0;
alter table public.lgus add column if not exists kitchen_kits integer not null default 0;
alter table public.lgus add column if not exists family_kits integer not null default 0;
alter table public.lgus add column if not exists laminated_sacks integer not null default 0;
alter table public.lgus add column if not exists rtef integer not null default 0;
alter table public.lgus add column if not exists current_stock jsonb not null default '{}'::jsonb;

-- 5. Sync metadata from auth.users to public.profiles (wallets, trucks, lgu_names)
update public.profiles p
set
  wallet_address = coalesce(p.wallet_address, u.raw_user_meta_data->>'wallet_address'),
  truck_id = case
    when exists (select 1 from public.trucks t where t.truck_id = (u.raw_user_meta_data->>'truck_id'))
    then (u.raw_user_meta_data->>'truck_id')
    else p.truck_id
  end,
  lgu_name = coalesce(p.lgu_name, u.raw_user_meta_data->>'lgu_name')
from auth.users u
where p.id = u.id;

-- 6. Reload Schema Cache
notify pgrst, 'reload schema';

