-- ==============================================================================
-- DSWD Logistics Platform: Migration Script - DR to INC for Outgoing Releases
-- Description: Migrates historical DR- codes to INC- codes in outgoing_requests
--              and all cascading foreign key reference tables.
-- Note: Does NOT modify replenish manifests (which remain strictly DR-).
-- ==============================================================================

BEGIN;

-- 1. Disable FK checks temporarily for safe batch update
SET CONSTRAINTS ALL DEFERRED;

-- 2. Update child table references
DO $$
BEGIN
  -- outgoing_batch_allocations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outgoing_batch_allocations') THEN
    UPDATE public.outgoing_batch_allocations
    SET outgoing_request_id = 'INC-' || SUBSTRING(outgoing_request_id FROM 4)
    WHERE outgoing_request_id LIKE 'DR-%';
  END IF;

  -- custody_hops
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custody_hops') THEN
    UPDATE public.custody_hops
    SET outgoing_request_id = 'INC-' || SUBSTRING(outgoing_request_id FROM 4)
    WHERE outgoing_request_id LIKE 'DR-%';
  END IF;

  -- truck_live_locations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'truck_live_locations') THEN
    UPDATE public.truck_live_locations
    SET current_dr_number = 'INC-' || SUBSTRING(current_dr_number FROM 4)
    WHERE current_dr_number LIKE 'DR-%';
  END IF;

  -- truck_locations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'truck_locations') THEN
    UPDATE public.truck_locations
    SET dr_number = 'INC-' || SUBSTRING(dr_number FROM 4)
    WHERE dr_number LIKE 'DR-%';
  END IF;

  -- outgoing_discrepancies (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outgoing_discrepancies') THEN
    UPDATE public.outgoing_discrepancies
    SET outgoing_request_id = 'INC-' || SUBSTRING(outgoing_request_id FROM 4)
    WHERE outgoing_request_id LIKE 'DR-%';
  END IF;

  -- 3. Update primary outgoing_requests table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outgoing_requests') THEN
    UPDATE public.outgoing_requests
    SET dr_number = 'INC-' || SUBSTRING(dr_number FROM 4)
    WHERE dr_number LIKE 'DR-%';
  END IF;
END $$;

COMMIT;

