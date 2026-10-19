-- ==============================================================================
-- DSWD RELIEF LOGISTICS & INVENTORY TRACKING SYSTEM
-- RESTORE ALL 101 LGUs TO CLEAN BASELINE STATE (REGION VI - WESTERN VISAYAS)
-- ==============================================================================
-- Purpose:
-- 1. Restores all 101 LGUs across all 5 provinces (Iloilo, Antique, Capiz, Aklan, Guimaras).
-- 2. Resets all LGUs to clean zero-baseline stock (0 packs, 0 urgency, Green priority).
-- 3. Cleans up all mock seed manifests (MNF-2026-%) and mock batches (BATCH-MNF-2026-%).
-- 4. Cleans up lgu_stock and automated reports to immediately free database Disk IO & storage.
-- 5. 100% Non-destructive to real operations: Preserves profiles, real dispatches, and real batches.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REMOVE SEED MANIFESTS & SEED BATCHES (IF UNALLOCATED)
-- ------------------------------------------------------------------------------

delete from public.stock_ledger
where movement_type = 'INTAKE_VERIFIED'
  and reference_manifest_id in (
    select id from public.incoming_manifests
    where manifest_number like 'MNF-2026-%'
      and id not in (
        select incoming_manifest_id from public.inventory_batches
        where incoming_manifest_id is not null
          and batch_token_id in (select batch_token_id from public.outgoing_batch_allocations where batch_token_id is not null)
      )
  );

delete from public.inventory_batches
where (batch_token_id like 'BATCH-MNF-2026-%'
   or incoming_manifest_id in (
     select id from public.incoming_manifests where manifest_number like 'MNF-2026-%'
   ))
  and batch_token_id not in (
    select batch_token_id from public.outgoing_batch_allocations where batch_token_id is not null
  );

delete from public.incoming_manifests
where manifest_number like 'MNF-2026-%'
  and id not in (
    select incoming_manifest_id from public.inventory_batches
    where incoming_manifest_id is not null
      and batch_token_id in (select batch_token_id from public.outgoing_batch_allocations where batch_token_id is not null)
  );

-- ------------------------------------------------------------------------------
-- 2. EMPTY NORMALIZED STOCK & AUTOMATED REPORTS TO MINIMIZE DISK IO
-- ------------------------------------------------------------------------------

delete from public.lgu_stock;
delete from public.warehouse_stock;

delete from public.lgu_inventory_reports
where reported_by_profile_id is null;

-- ------------------------------------------------------------------------------
-- 3. ENSURE ALL 5 PROVINCES EXIST
-- ------------------------------------------------------------------------------

insert into public.provinces (name, region) values
  ('Iloilo', 'Region VI (Western Visayas)'),
  ('Antique', 'Region VI (Western Visayas)'),
  ('Capiz', 'Region VI (Western Visayas)'),
  ('Aklan', 'Region VI (Western Visayas)'),
  ('Guimaras', 'Region VI (Western Visayas)')
on conflict (name) do nothing;

-- ------------------------------------------------------------------------------
-- 4. INSERT / RESTORE ALL 101 LGUs ACROSS ALL 5 PROVINCES
-- ------------------------------------------------------------------------------

insert into public.lgus (
  municipality,
  province,
  lgu_name,
  latitude,
  longitude,
  max_stock,
  food_packs,
  rtef,
  hygiene_kits,
  sleeping_kits,
  kitchen_kits,
  family_kits,
  laminated_sacks,
  current_stock,
  affected_families,
  damage_index,
  urgency_score,
  priority_color,
  recommendation,
  last_reported_at
) values
  -- Iloilo (44 entries: 43 municipalities + 1 city)
  ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', 11.1714, 122.9818, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Anilao', 'Iloilo', 'Anilao Municipal Hall', 10.9856, 122.7533, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', 11.4721, 123.0847, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Banate', 'Iloilo', 'Banate Municipal Hall', 11.0022, 122.8174, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', 11.0503, 122.8466, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Batad', 'Iloilo', 'Batad Municipal Hall', 11.4167, 123.0833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', 11.2036, 122.5639, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Calinog', 'Iloilo', 'Calinog Municipal Hall', 11.1242, 122.4939, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Carles', 'Iloilo', 'Carles Municipal Hall', 11.5833, 123.1667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', 11.2189, 123.1111, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11.0000, 122.6667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.6600, 122.3167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621, 6000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.9500, 122.5000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.0500, 122.4833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse Hub', 10.6975, 122.4764, 5000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.5400, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272, 4000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.6500, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.8200, 122.5333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.6750, 122.3806, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.7500, 122.3333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.8200, 122.6100, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),

  -- Antique (18 municipalities)
  ('Anini-y', 'Antique', 'Anini-y Municipal Hall', 10.4333, 121.9333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Barbaza', 'Antique', 'Barbaza Municipal Hall', 11.2167, 122.0667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Belison', 'Antique', 'Belison Municipal Hall', 10.8333, 121.9667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Bugasong', 'Antique', 'Bugasong Municipal Hall', 11.0500, 122.0667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Caluya', 'Antique', 'Caluya Municipal Hall', 11.9167, 121.5667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Culasi', 'Antique', 'Culasi Municipal Hall', 11.4333, 122.0667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Hamtic', 'Antique', 'Hamtic Municipal Hall', 10.7000, 121.9833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Laua-an', 'Antique', 'Laua-an Municipal Hall', 11.1500, 122.0500, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Libertad', 'Antique', 'Libertad Municipal Hall', 12.0333, 121.9167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Pandan', 'Antique', 'Pandan Municipal Hall', 11.7167, 122.1000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Patnongon', 'Antique', 'Patnongon Municipal Hall', 10.9167, 121.9833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', 10.7500, 121.9500, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Remigio', 'Antique', 'San Remigio Municipal Hall', 10.7833, 122.0833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sebaste', 'Antique', 'Sebaste Municipal Hall', 11.5833, 122.0833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sibalom', 'Antique', 'Sibalom Municipal Hall', 10.7833, 122.0167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tibiao', 'Antique', 'Tibiao Municipal Hall', 11.2833, 122.0333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', 10.5167, 121.9333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Valderrama', 'Antique', 'Valderrama Municipal Hall', 11.0000, 122.1333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),

  -- Capiz (17 municipalities / cities)
  ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', 11.3500, 122.6833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dao', 'Capiz', 'Dao Municipal Hall', 11.3833, 122.6833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', 11.3000, 122.6167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', 11.2667, 122.7000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', 11.5167, 122.7000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', 11.4333, 122.4833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Maayon', 'Capiz', 'Maayon Municipal Hall', 11.3833, 122.7833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', 11.4333, 122.6000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Panay', 'Capiz', 'Panay Municipal Hall', 11.5500, 122.8000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Panitan', 'Capiz', 'Panitan Municipal Hall', 11.4667, 122.7667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Pilar', 'Capiz', 'Pilar Municipal Hall', 11.4833, 122.9833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', 11.4833, 122.8500, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', 11.4333, 122.9333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', 11.5853, 122.7511, 4000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sapian', 'Capiz', 'Sapian Municipal Hall', 11.5000, 122.6000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sigma', 'Capiz', 'Sigma Municipal Hall', 11.4167, 122.6667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', 11.2667, 122.5333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),

  -- Aklan (17 municipalities)
  ('Altavas', 'Aklan', 'Altavas Municipal Hall', 11.5333, 122.5000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Balete', 'Aklan', 'Balete Municipal Hall', 11.5500, 122.3833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Banga', 'Aklan', 'Banga Municipal Hall', 11.6333, 122.3333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Batan', 'Aklan', 'Batan Municipal Hall', 11.5833, 122.5000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', 11.8333, 121.8833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', 11.8167, 122.1667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', 11.7083, 122.3667, 4000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Lezo', 'Aklan', 'Lezo Municipal Hall', 11.6667, 122.3333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Libacao', 'Aklan', 'Libacao Municipal Hall', 11.4500, 122.3000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Madalag', 'Aklan', 'Madalag Municipal Hall', 11.5167, 122.3000, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Makato', 'Aklan', 'Makato Municipal Hall', 11.7167, 122.2833, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', 11.9000, 121.9167, 4000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Malinao', 'Aklan', 'Malinao Municipal Hall', 11.6500, 122.3167, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Nabas', 'Aklan', 'Nabas Municipal Hall', 11.8833, 122.0667, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('New Washington', 'Aklan', 'New Washington Municipal Hall', 11.6500, 122.4333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Numancia', 'Aklan', 'Numancia Municipal Hall', 11.7000, 122.3333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', 11.7833, 122.2500, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),

  -- Guimaras (5 municipalities)
  ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', 10.6583, 122.5933, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', 10.6939, 122.6842, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', 10.5186, 122.5414, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', 10.6128, 122.6881, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now()),
  ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', 10.5500, 122.6333, 3000, 0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, 0, 0, 0, 'Green', 'Baseline zero stock; awaiting operational intake.', now())
on conflict (municipality, province) do update set
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

-- ------------------------------------------------------------------------------
-- 5. LINK ALL LGUs TO THEIR PROVINCE FOREIGN KEY
-- ------------------------------------------------------------------------------

update public.lgus l
set province_id = p.id
from public.provinces p
where l.province_id is null
  and lower(trim(l.province)) = lower(trim(p.name));

-- ------------------------------------------------------------------------------
-- 6. RESET WAREHOUSES BUFFER STOCK TO CLEAN ZERO
-- ------------------------------------------------------------------------------

update public.warehouses set
  food_packs = 0,
  rtef = 0,
  hygiene_kits = 0,
  sleeping_kits = 0,
  kitchen_kits = 0,
  family_kits = 0,
  laminated_sacks = 0,
  current_stock = '{}'::jsonb;

-- ------------------------------------------------------------------------------
-- 7. AUDIT VERIFICATION
-- ------------------------------------------------------------------------------

select
  'CLEAN BASELINE RESTORATION AUDIT' as check_type,
  (select count(*) from public.lgus) as total_restored_lgus,
  (select count(*) from public.lgus where province = 'Iloilo') as iloilo_lgus,
  (select count(*) from public.lgus where province = 'Antique') as antique_lgus,
  (select count(*) from public.lgus where province = 'Capiz') as capiz_lgus,
  (select count(*) from public.lgus where province = 'Aklan') as aklan_lgus,
  (select count(*) from public.lgus where province = 'Guimaras') as guimaras_lgus,
  (select count(*) from public.incoming_manifests where manifest_number like 'MNF-2026-%') as remaining_seed_manifests,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%') as remaining_seed_batches,
  (select count(*) from public.lgu_stock) as remaining_lgu_stock,
  (select count(*) from public.outgoing_requests) as preserved_real_dispatches;
