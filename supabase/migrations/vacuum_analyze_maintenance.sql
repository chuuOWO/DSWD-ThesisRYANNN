-- ====================================================================
-- Lightweight Database Optimization Script for DSWD Thesis
-- Safe for Supabase Free Tier (Zero Table Locks, No Timeouts)
-- ====================================================================

-- 1. Terminate hanging connections or stuck transactions holding locks
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND (state = 'idle in transaction' OR state = 'idle' OR now() - query_start > interval '30 seconds');

-- 2. Fast, lightweight ANALYZE on active tables (does NOT lock tables)
ANALYZE public.outgoing_requests;
ANALYZE public.incoming_manifests;
ANALYZE public.stock_ledger;
ANALYZE public.truck_live_locations;
ANALYZE public.custody_hops;
ANALYZE public.warehouse_stock;
ANALYZE public.lgu_stock;
ANALYZE public.inventory_batches;

-- 3. Verify active connection count post-cleanup
SELECT count(*) AS active_connections FROM pg_stat_activity WHERE state != 'idle';
