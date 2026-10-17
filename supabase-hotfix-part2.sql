-- ==============================================================================
-- DSWD DISASTER RESPONSE: HOTFIX PART 2 (ACCOUNTS, TRUCKS & STOCK MOVEMENTS)
-- ==============================================================================
-- Run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Update admin_reset_user_password RPC
-- Ensures that when an admin resets a password, email_confirmed_at is set if null,
-- allowing users to log in immediately without getting stuck in unconfirmed state.
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

  -- Update encrypted password in Supabase Authentication user table and ensure email is confirmed
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_user_id;

  return true;
end;
$$;

grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

-- 2. Ensure stock_ledger movement_type constraint allows all valid enum movements
alter table public.stock_ledger drop constraint if exists stock_ledger_movement_type_check;
alter table public.stock_ledger add constraint stock_ledger_movement_type_check
  check (movement_type in (
    'INTAKE_VERIFIED',
    'RELEASE_DISPATCHED',
    'AID_RECEIVED',
    'MUTUAL_AID_OUT',
    'MUTUAL_AID_IN',
    'AUDIT_CORRECTION',
    'STOCK_RECOUNT',
    'CUSTODY_TRANSFER',
    'LGU_RECEIVED'
  ));

-- 3. Ensure truck_live_locations has index on truck_id and updated_at for fast telemetry lookup
create index if not exists idx_truck_live_locations_truck_id on public.truck_live_locations(truck_id);
create index if not exists idx_truck_live_locations_updated_at on public.truck_live_locations(updated_at desc);

-- 4. Reload Schema Cache
notify pgrst, 'reload schema';

