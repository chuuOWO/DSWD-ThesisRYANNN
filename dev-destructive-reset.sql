-- ==============================================================================
-- DSWD SYSTEM: LOCAL DEVELOPMENT DESTRUCTIVE DATA RESET SCRIPT
-- ==============================================================================
-- WARNING: HIGH RISK DESTRUCTIVE OPERATIONS!
-- This script truncates operational tables and deletes test user profiles.
-- DO NOT RUN THIS IN PRODUCTION OR STAGING ENVIRONMENTS.
--
-- Target environment safeguard:
-- To execute this script, you must explicitly opt-in by running:
--   SET app.allow_destructive_reset = 'true';
-- in your SQL session immediately before executing these commands.
-- ==============================================================================

DO $$
BEGIN
  IF coalesce(current_setting('app.allow_destructive_reset', true), '') != 'true' THEN
    RAISE EXCEPTION 'DESTRUCTIVE RESET BLOCKED: To execute a destructive reset, set app.allow_destructive_reset = ''true''; before running this script.';
  END IF;
END $$;

-- 1. Truncate operational tables (clears manifests, dispatches, GPS fixes, and reports)
TRUNCATE TABLE public.incoming_manifests CASCADE;
TRUNCATE TABLE public.outgoing_requests CASCADE;
TRUNCATE TABLE public.truck_live_locations CASCADE;
TRUNCATE TABLE public.discrepancy_reports CASCADE;
TRUNCATE TABLE public.lgu_inventory_reports CASCADE;

-- 2. Reset sequential application counters
UPDATE public.app_counters SET value = 0 WHERE key IN ('batch_index', 'manifest_index', 'dr_index');

-- 3. Clean non-admin test accounts from public.profiles (preserves primary admin)
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT id FROM public.profiles
  WHERE role = 'dswd_admin'
  ORDER BY created_at ASC
  LIMIT 1
);

-- ==============================================================================
-- END OF DESTRUCTIVE RESET SCRIPT
-- ==============================================================================

