-- ==============================================================================
-- DSWD RELIEF LOGISTICS SYSTEM
-- UNDO SEED DATA SCRIPT (SUPABASE POSTGRESQL)
-- ==============================================================================
-- Purpose:
-- Safely removes all heavy seed records created by supabase-seed-realistic-data.sql
-- to immediately free up database memory, table size, and compute in Supabase.
--
-- What this script does:
-- 1. Deletes all seeded double-entry ledger entries from public.stock_ledger.
-- 2. Deletes all seeded batch tokens from public.inventory_batches (BATCH-MNF-2026-%).
-- 3. Deletes all seeded incoming manifests from public.incoming_manifests (MNF-2026-%).
-- 4. Cleans automated baseline reports from public.lgu_inventory_reports.
-- 5. Empties public.lgu_stock and public.warehouse_stock to reclaim table storage.
-- 6. Resets all 101 LGUs and Warehouses to 0 stock, 0 affected families, and Green priority.
-- 7. Runs VACUUM ANALYZE to reclaim disk pages and OS memory back to Supabase.
--
-- Safeguards:
-- - NEVER touches public.profiles or auth.users (user accounts are 100% preserved).
-- - NEVER touches outgoing_requests or blockchain smart contract tables.
-- - Only removes seed manifests matching 'MNF-2026-%' to protect any real user data.
-- ==============================================================================

-- 1. Remove double-entry stock ledger journal records for seeded manifests
delete from public.stock_ledger
where movement_type = 'INTAKE_VERIFIED'
  and reference_manifest_id in (
    select id from public.incoming_manifests where manifest_number like 'MNF-2026-%'
  );

-- 2. Remove seeded inventory lot batches
delete from public.inventory_batches
where batch_token_id like 'BATCH-MNF-2026-%'
   or incoming_manifest_id in (
     select id from public.incoming_manifests where manifest_number like 'MNF-2026-%'
   );

-- 3. Remove seeded incoming logistics manifests
delete from public.incoming_manifests
where manifest_number like 'MNF-2026-%';

-- 4. Remove automated baseline reports (preserves reports created by real user profiles)
delete from public.lgu_inventory_reports
where reported_by_profile_id is null;

-- 5. Empty normalized stock records to free table pages and memory
delete from public.lgu_stock;
delete from public.warehouse_stock;

-- 6. Reset all 101 LGUs to clean zero-baseline and Adequate (Green) priority
update public.lgus set
  food_packs = 0,
  rtef = 0,
  hygiene_kits = 0,
  sleeping_kits = 0,
  kitchen_kits = 0,
  family_kits = 0,
  laminated_sacks = 0,
  current_stock = '{}'::jsonb,
  affected_families = 0,
  damage_index = 0,
  urgency_score = 0,
  priority_color = 'Green',
  recommendation = 'Baseline zero stock; awaiting operational intake.',
  last_reported_at = now();

-- 7. Reset regional warehouses stock counters to 0
update public.warehouses set
  food_packs = 0,
  rtef = 0,
  hygiene_kits = 0,
  sleeping_kits = 0,
  kitchen_kits = 0,
  family_kits = 0,
  laminated_sacks = 0,
  current_stock = '{}'::jsonb;

-- 8. Run VACUUM ANALYZE to reclaim storage pages and optimize database memory
vacuum analyze public.stock_ledger;
vacuum analyze public.inventory_batches;
vacuum analyze public.incoming_manifests;
vacuum analyze public.lgu_inventory_reports;
vacuum analyze public.lgu_stock;
vacuum analyze public.warehouse_stock;
vacuum analyze public.lgus;
vacuum analyze public.warehouses;

-- ------------------------------------------------------------------------------
-- VERIFICATION AUDIT (Confirm all heavy seed data is cleared)
-- ------------------------------------------------------------------------------
select
  'CLEANUP VERIFICATION' as check_type,
  (select count(*) from public.incoming_manifests where manifest_number like 'MNF-2026-%') as remaining_seed_manifests,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%') as remaining_seed_batches,
  (select count(*) from public.lgu_stock) as remaining_lgu_stock_records,
  (select count(*) from public.warehouse_stock) as remaining_warehouse_stock_records,
  (select count(*) from public.lgu_inventory_reports where reported_by_profile_id is null) as remaining_seed_reports,
  (select sum(food_packs) from public.lgus) as total_lgu_food_packs_sum,
  (select sum(food_packs) from public.warehouses) as total_warehouse_food_packs_sum;

