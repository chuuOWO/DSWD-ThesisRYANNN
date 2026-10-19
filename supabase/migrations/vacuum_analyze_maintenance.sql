-- ====================================================================
-- PostgreSQL Database Optimization & Maintenance Script for DSWD Thesis
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Terminate any stuck or hanging idle transactions currently holding locks
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction' 
  AND pid <> pg_backend_pid();

-- 2. Vacuum dead rows and recalculate statistics across all core tables
VACUUM (ANALYZE, VERBOSE) public.outgoing_requests;
VACUUM (ANALYZE, VERBOSE) public.incoming_manifests;
VACUUM (ANALYZE, VERBOSE) public.warehouse_stock;
VACUUM (ANALYZE, VERBOSE) public.lgu_stock;
VACUUM (ANALYZE, VERBOSE) public.inventory_batches;
VACUUM (ANALYZE, VERBOSE) public.stock_ledger;
VACUUM (ANALYZE, VERBOSE) public.custody_hops;
VACUUM (ANALYZE, VERBOSE) public.truck_live_locations;
VACUUM (ANALYZE, VERBOSE) public.activity_logs;
VACUUM (ANALYZE, VERBOSE) public.app_counters;
VACUUM (ANALYZE, VERBOSE) public.lgus;
VACUUM (ANALYZE, VERBOSE) public.warehouses;
VACUUM (ANALYZE, VERBOSE) public.provinces;
VACUUM (ANALYZE, VERBOSE) public.kit_types;
VACUUM (ANALYZE, VERBOSE) public.trucks;
VACUUM (ANALYZE, VERBOSE) public.incidents;
VACUUM (ANALYZE, VERBOSE) public.discrepancy_reports;
VACUUM (ANALYZE, VERBOSE) public.profiles;

-- 3. Re-index high-traffic search and filtering tables to remove index fragmentation
REINDEX TABLE public.outgoing_requests;
REINDEX TABLE public.incoming_manifests;
REINDEX TABLE public.stock_ledger;
REINDEX TABLE public.truck_live_locations;
REINDEX TABLE public.custody_hops;

-- 4. Verify table row counts and dead tuple counts post-vacuum
SELECT 
    schemaname,
    relname AS table_name,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

