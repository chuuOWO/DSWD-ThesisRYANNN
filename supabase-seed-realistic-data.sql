-- ==============================================================================
-- DSWD RELIEF LOGISTICS & INVENTORY TRACKING SYSTEM
-- AUTHORITATIVE REALISTIC DATA SEED SCRIPT (ILOILO PROVINCE LGUS ONLY)
-- ==============================================================================
-- Memory-Optimized Configuration:
-- 1. Maintained exclusively for Iloilo Province (43 Municipalities / Cities):
--      - Severe / Critical (Red) (6 LGUs): Carles, Balasan, Estancia, San Dionisio, Batad, Concepcion
--      - Low / Warning (Orange) (8 LGUs): Ajuy, Sara, Barotac Viejo, Lemery, San Rafael, Anilao, Banate, Tubungan
--      - Medium / Moderate (Yellow) (11 LGUs): Calinog, Lambunao, Janiuay, Badiangan, Dueñas, Dingle, Mina, Bingawan, Alimodian, Leon, Maasin
--      - Adequate / Safe (Green) (18 LGUs): Iloilo City, Passi City, Pavia, Santa Barbara, Cabatuan, Leganes, Zarraga, Dumangas, Barotac Nuevo, Oton, Pototan, Tigbauan, Guimbal, Miag-ao, San Joaquin, San Miguel, San Enrique, New Lucena, Igbaras
-- 2. Purges non-Iloilo operational records to reduce database size, table bloat, and Supabase RAM usage.
-- 3. Populates public.lgu_stock for the 43 Iloilo LGUs across all 7 kit types (301 rows).
-- 4. Populates public.lgu_inventory_reports for the 43 Iloilo LGUs (43 rows).
-- 5. Populates regional warehouse physical stocks in Oton and Pototan.
-- 6. Populates verified inbound logistics manifests and batches exclusively for Iloilo with rolling expiry:
--      - Expiring in <= 90 Days (rolling 1-3 months)
--      - Expiring in 91-120 Days (rolling 4-6 months)
--      - Standard shelf life (> 120 Days)
-- 7. Runs VACUUM ANALYZE to reclaim disk pages and OS memory back to Supabase.
--
-- EXCLUSION RULE:
-- Strictly DOES NOT touch outgoing_requests, outgoing_batch_allocations, or custody_hops
-- to preserve blockchain contract integrity and cryptographic wallet dispatches.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: MASTER REFERENCES (PROVINCES, SUPPLY SOURCES, KIT TYPES, WAREHOUSES)
-- ------------------------------------------------------------------------------

insert into public.provinces (name, region) values
  ('Iloilo', 'Region VI (Western Visayas)')
on conflict (name) do nothing;

insert into public.supply_sources (name, short_code, facility_type, region, location) values
  ('Visayas Disaster Resource Center (VDRC)', 'VDRC', 'National Resource Center', 'Region VII (Central Visayas)', 'Tingub, Mandaue City, Cebu'),
  ('Luzon Disaster Resource Center (LDRC)', 'LDRC', 'National Resource Center', 'National Capital Region / Region III', 'Pasay City / Clark Special Economic Zone')
on conflict (short_code) do nothing;

insert into public.kit_types (name, category, unit_type, description) values
  ('Family Food Pack', 'Food Item', 'packs', 'Standard 6kg emergency nutritional food pack (rice, canned goods, coffee)'),
  ('Ready-to-Eat Food (RTEF)', 'Food Item', 'packs', 'Pre-cooked retort pouch meals requiring zero preparation'),
  ('Hygiene Kit', 'Non-Food Item', 'kits', 'Personal sanitation supplies, soap, toothpaste, toothbrush, sanitary napkins'),
  ('Sleeping Kit', 'Non-Food Item', 'kits', 'Blankets, sleeping mats, mosquito nets, and pillowcases'),
  ('Kitchen Kit', 'Non-Food Item', 'kits', 'Cooking pots, frying pan, plates, cups, spoons, forks, and cooking utensils'),
  ('Family Kit', 'Non-Food Item', 'kits', 'Clothing apparel, underwear, bath towels, and footwear for families'),
  ('Laminated Sacks', 'Non-Food Item', 'sacks', 'Heavy-duty weatherproofing tarpaulins for temporary roof shelters')
on conflict (name) do nothing;

insert into public.incidents (incident_code, disaster_name, disaster_type, status) values
  ('INC-2026-PREPOSITION', 'Regular Disaster Preparedness & Buffer Prepositioning', 'Relief Prepositioning / Augmentation', 'Active'),
  ('INC-2026-TY-01', 'Typhoon Auring Relief Operation', 'Typhoon / Tropical Cyclone', 'Active'),
  ('INC-2026-FLD-01', 'Western Visayas Monsoon Inundation', 'Flood / Inundation', 'Active')
on conflict (incident_code) do nothing;

insert into public.warehouses (name, province, municipality, capacity_packs, latitude, longitude) values
  ('Oton Main Warehouse', 'Iloilo', 'Oton', 150000, 10.6975, 122.4764),
  ('Pototan Main Warehouse', 'Iloilo', 'Pototan', 80000, 10.9492, 122.6289)
on conflict (name) do update set
  capacity_packs = excluded.capacity_packs,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

update public.warehouses w
set province_id = p.id
from public.provinces p
where w.province_id is null and lower(trim(w.province)) = lower(trim(p.name));

-- ------------------------------------------------------------------------------
-- SECTION 2: PURGE NON-ILOILO RECORDS TO MINIMIZE SUPABASE MEMORY & STORAGE
-- ------------------------------------------------------------------------------

delete from public.stock_ledger
where lgu_id in (select id from public.lgus where province != 'Iloilo');

delete from public.inventory_batches
where lgu_id in (select id from public.lgus where province != 'Iloilo');

delete from public.incoming_manifests
where destination_lgu_id in (select id from public.lgus where province != 'Iloilo');

delete from public.lgu_stock
where lgu_id in (select id from public.lgus where province != 'Iloilo');

delete from public.lgu_inventory_reports
where province != 'Iloilo';

-- Remove non-Iloilo LGUs unless explicitly referenced by user profile accounts
delete from public.lgus
where province != 'Iloilo'
  and id not in (select lgu_id from public.profiles where lgu_id is not null);

-- ------------------------------------------------------------------------------
-- SECTION 3: SEED MASTER ILOILO LGUS DIRECTORY & BUFFER STOCK (43 LGUS)
-- ------------------------------------------------------------------------------
-- Distribution:
--   Severe / Red: 6 LGUs (<25% stock rate, high affected families, urgency 75-98)
--   Low / Orange: 8 LGUs (25-49% stock rate, urgent replenishment, urgency 55-74)
--   Medium / Yellow: 11 LGUs (50-74% stock rate, active monitoring, urgency 35-54)
--   Adequate / Green: 18 LGUs (>=75% stock rate, normal operations, urgency 5-34)
-- ------------------------------------------------------------------------------

with lgu_seed_data(muni, prov, name, lat, lng, max_s, ffp, rtef, hyg, sleep, kitc, fam, sack, aff_fam, dmg_idx, urg_score, p_color, rec) as (
  values
    -- ===== SEVERE TIER (RED) (6 LGUs) =====
    ('Carles', 'Iloilo', 'Carles Municipal Hall', 11.5833, 123.1667, 3000, 180, 45, 60, 40, 25, 30, 20, 3850, 92, 96, 'Red', 'CRITICAL: Severe coastal inundation; immediate food pack airlift and sealift required.'),
    ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', 11.4721, 123.0847, 3000, 240, 60, 80, 50, 35, 45, 30, 2900, 88, 93, 'Red', 'CRITICAL: Northern flood damage with high displaced population; buffer stock depleted.'),
    ('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528, 3000, 290, 75, 95, 65, 40, 50, 40, 3200, 89, 94, 'Red', 'CRITICAL: Evacuation center overcrowding; immediate relief convoy augmentation flagged.'),
    ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833, 3000, 310, 80, 110, 70, 50, 55, 35, 2400, 84, 88, 'Red', 'CRITICAL: Stock rate below 15%; coastal fishing communities isolated.'),
    ('Batad', 'Iloilo', 'Batad Municipal Hall', 11.4167, 123.0833, 3000, 350, 90, 105, 80, 45, 60, 50, 2150, 82, 87, 'Red', 'CRITICAL: Urgent food pack and hygiene kit replenishment requested.'),
    ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', 11.2189, 123.1111, 3000, 420, 110, 120, 85, 60, 70, 45, 2600, 85, 89, 'Red', 'CRITICAL: Island barangays cut off; relief dispatch via coast guard underway.'),

    -- ===== LOW / WARNING TIER (ORANGE) (8 LGUs) =====
    ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', 11.1714, 122.9818, 3000, 840, 210, 280, 190, 150, 170, 120, 1420, 62, 68, 'Orange', 'WARNING: Buffer reserves falling below safety margin; preposition dispatch recommended.'),
    ('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167, 3000, 920, 230, 310, 210, 160, 185, 140, 1580, 65, 71, 'Orange', 'WARNING: Evacuation centers filling up; secondary replenishment staged.'),
    ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', 11.0503, 122.8466, 3000, 980, 245, 320, 230, 175, 190, 130, 1340, 58, 64, 'Orange', 'WARNING: Riverbank erosion risk; stage 1,000 FFPs from Oton warehouse.'),
    ('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167, 3000, 1050, 260, 340, 240, 190, 205, 150, 1210, 55, 62, 'Orange', 'WARNING: Buffer level at 38%; priority dispatch requested for upland barangays.'),
    ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333, 3000, 1100, 275, 360, 260, 200, 220, 160, 1150, 54, 60, 'Orange', 'WARNING: Monitoring flash flood alert along Jalaur river tributaries.'),
    ('Anilao', 'Iloilo', 'Anilao Municipal Hall', 10.9856, 122.7533, 3000, 1180, 290, 380, 270, 210, 230, 170, 980, 48, 56, 'Orange', 'WARNING: Moderate displaced count; relief staging scheduled.'),
    ('Banate', 'Iloilo', 'Banate Municipal Hall', 11.0022, 122.8174, 3000, 1250, 310, 400, 290, 220, 240, 180, 890, 46, 55, 'Orange', 'WARNING: Coastal storm surge warning active; stock replenishment queued.'),
    ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.7500, 122.3333, 3000, 1320, 330, 420, 310, 235, 255, 190, 810, 44, 55, 'Orange', 'WARNING: Upland landslide risk; maintain heightened relief staging.'),

    -- ===== MEDIUM / MODERATE TIER (YELLOW) (11 LGUs) =====
    ('Calinog', 'Iloilo', 'Calinog Municipal Hall', 11.1242, 122.4939, 3000, 1550, 380, 480, 360, 280, 310, 210, 450, 35, 46, 'Yellow', 'MODERATE: Steady buffer stock; monitor community evacuation centers.'),
    ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.0500, 122.4833, 3000, 1620, 400, 510, 380, 295, 325, 220, 410, 32, 44, 'Yellow', 'MODERATE: Adequate central supplies; small barangay prepositioning active.'),
    ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.9500, 122.5000, 3000, 1680, 420, 530, 400, 310, 340, 230, 380, 30, 42, 'Yellow', 'MODERATE: Safe operational threshold; standard bi-weekly monitoring.'),
    ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312, 3000, 1740, 435, 550, 410, 320, 350, 240, 290, 26, 39, 'Yellow', 'MODERATE: Localized crop damage; emergency aid not yet critical.'),
    ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167, 3000, 1800, 450, 570, 425, 330, 365, 250, 260, 24, 38, 'Yellow', 'MODERATE: Low incident impact; storage conditions verified intact.'),
    ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11.0000, 122.6667, 3000, 1860, 465, 590, 440, 345, 380, 260, 220, 22, 36, 'Yellow', 'MODERATE: Regular inventory inspection passed; buffer reserves balanced.'),
    ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833, 3000, 1920, 480, 610, 455, 355, 390, 270, 180, 20, 35, 'Yellow', 'MODERATE: Minor waterlogging in agricultural zones; relief standby.'),
    ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', 11.2036, 122.5639, 3000, 1980, 495, 625, 470, 370, 405, 280, 160, 18, 35, 'Yellow', 'MODERATE: Stable municipal reserves; routine monitoring.'),
    ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332, 3000, 2040, 510, 645, 480, 380, 415, 290, 140, 16, 35, 'Yellow', 'MODERATE: Upland barangay stock verified; no major disruption.'),
    ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831, 3000, 2100, 525, 660, 495, 390, 430, 300, 120, 15, 35, 'Yellow', 'MODERATE: Satisfactory reserve capacity; routine reporting.'),
    ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333, 3000, 2160, 540, 680, 510, 400, 440, 310, 95, 12, 35, 'Yellow', 'MODERATE: Watershed basin stable; standard standby mode.'),

    -- ===== ADEQUATE / SAFE TIER (GREEN) (18 LGUs) =====
    ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621, 6000, 5450, 1360, 1720, 1280, 980, 1100, 750, 45, 5, 8, 'Green', 'ADEQUATE: Major regional hub well-stocked; regional disaster reserve intact.'),
    ('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417, 4500, 3980, 995, 1250, 930, 720, 810, 560, 30, 4, 9, 'Green', 'ADEQUATE: Component city buffer stock sufficient; routine monitoring active.'),
    ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.5400, 3000, 2580, 645, 810, 610, 480, 520, 360, 20, 3, 10, 'Green', 'ADEQUATE: High buffer stock; logistics proximity to regional warehouse.'),
    ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.8200, 122.5333, 3000, 2620, 655, 825, 620, 490, 530, 370, 15, 2, 8, 'Green', 'ADEQUATE: Zero reported displaced families; warehouse capacity optimal.'),
    ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856, 3000, 2650, 660, 835, 625, 495, 535, 375, 10, 2, 7, 'Green', 'ADEQUATE: Airport corridor relief hub fully supplied.'),
    ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833, 3000, 2700, 675, 850, 640, 500, 545, 380, 0, 0, 5, 'Green', 'ADEQUATE: Full municipal buffer stock on hand; no active alerts.'),
    ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.8200, 122.6100, 3000, 2740, 685, 860, 645, 510, 555, 385, 0, 0, 5, 'Green', 'ADEQUATE: Buffer reserves at optimal levels; routine reporting.'),
    ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167, 3000, 2760, 690, 870, 650, 515, 560, 390, 0, 0, 5, 'Green', 'ADEQUATE: Coastal port facilities operating normally; reserves intact.'),
    ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027, 3000, 2790, 695, 880, 660, 520, 565, 395, 0, 0, 5, 'Green', 'ADEQUATE: High reserve balance; routine bi-weekly monitoring.'),
    ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse Hub', 10.6975, 122.4764, 5000, 4650, 1160, 1460, 1100, 860, 940, 650, 0, 0, 5, 'Green', 'ADEQUATE: Regional logistics staging post; reserves fully stocked.'),
    ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272, 4000, 3620, 905, 1140, 855, 670, 730, 510, 0, 0, 5, 'Green', 'ADEQUATE: Secondary warehouse hub operating at peak preparedness.'),
    ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.6750, 122.3806, 3000, 2810, 700, 885, 665, 525, 570, 400, 0, 0, 5, 'Green', 'ADEQUATE: Southern corridor stock verified; full readiness.'),
    ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.6600, 122.3167, 3000, 2830, 705, 890, 670, 530, 575, 405, 0, 0, 5, 'Green', 'ADEQUATE: Coastal DRRM inventory complete; standard monitoring.'),
    ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352, 3000, 2850, 710, 895, 675, 535, 580, 410, 0, 0, 5, 'Green', 'ADEQUATE: Evacuation center ready; zero stock shortage.'),
    ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333, 3000, 2870, 715, 900, 680, 540, 585, 415, 0, 0, 5, 'Green', 'ADEQUATE: Southern border point stable; emergency buffer safe.'),
    ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667, 3000, 2890, 720, 905, 685, 545, 590, 420, 0, 0, 5, 'Green', 'ADEQUATE: Central plains inventory verified; normal status.'),
    ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.6500, 3000, 2910, 725, 910, 690, 550, 595, 425, 0, 0, 5, 'Green', 'ADEQUATE: Storage facility fully provisioned; no deficiencies.'),
    ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6000, 3000, 2930, 730, 915, 695, 555, 600, 430, 0, 0, 5, 'Green', 'ADEQUATE: Routine monitoring; inventory matches target capacity.'),
    ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667, 3000, 2950, 735, 920, 700, 560, 605, 435, 0, 0, 5, 'Green', 'ADEQUATE: Upland relief buffer completely filled; standard alert.')
)
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
)
select
  d.muni,
  d.prov,
  d.name,
  d.lat,
  d.lng,
  d.max_s,
  d.ffp,
  d.rtef,
  d.hyg,
  d.sleep,
  d.kitc,
  d.fam,
  d.sack,
  jsonb_build_object(
    'Family Food Pack', d.ffp,
    'Ready-to-Eat Food (RTEF)', d.rtef,
    'Hygiene Kit', d.hyg,
    'Sleeping Kit', d.sleep,
    'Kitchen Kit', d.kitc,
    'Family Kit', d.fam,
    'Laminated Sacks', d.sack
  ),
  d.aff_fam,
  d.dmg_idx,
  d.urg_score,
  d.p_color,
  d.rec,
  now() - (random() * interval '4 hours')
from lgu_seed_data d
on conflict (municipality, province) do update set
  lgu_name = excluded.lgu_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  max_stock = excluded.max_stock,
  food_packs = excluded.food_packs,
  rtef = excluded.rtef,
  hygiene_kits = excluded.hygiene_kits,
  sleeping_kits = excluded.sleeping_kits,
  kitchen_kits = excluded.kitchen_kits,
  family_kits = excluded.family_kits,
  laminated_sacks = excluded.laminated_sacks,
  current_stock = excluded.current_stock,
  affected_families = excluded.affected_families,
  damage_index = excluded.damage_index,
  urgency_score = excluded.urgency_score,
  priority_color = excluded.priority_color,
  recommendation = excluded.recommendation,
  last_reported_at = excluded.last_reported_at;

-- Link Iloilo LGUs to province foreign key
update public.lgus l
set province_id = p.id
from public.provinces p
where l.province_id is null and lower(trim(l.province)) = lower(trim(p.name));

-- ------------------------------------------------------------------------------
-- SECTION 4: NORMALIZED PHYSICAL BUFFER STOCK (public.lgu_stock)
-- ------------------------------------------------------------------------------
-- Inserts 7 rows per Iloilo LGU (43 * 7 = 301 rows)
-- ------------------------------------------------------------------------------

insert into public.lgu_stock (lgu_id, kit_type_id, quantity, updated_at)
select
  l.id,
  k.id,
  case
    when k.name = 'Family Food Pack' then l.food_packs
    when k.name = 'Ready-to-Eat Food (RTEF)' then coalesce(l.rtef, 0)
    when k.name = 'Hygiene Kit' then l.hygiene_kits
    when k.name = 'Sleeping Kit' then coalesce(l.sleeping_kits, 0)
    when k.name = 'Kitchen Kit' then coalesce(l.kitchen_kits, 0)
    when k.name = 'Family Kit' then coalesce(l.family_kits, 0)
    when k.name = 'Laminated Sacks' then coalesce(l.laminated_sacks, 0)
    else 0
  end as quantity,
  now()
from public.lgus l
cross join public.kit_types k
where l.province = 'Iloilo'
on conflict (lgu_id, kit_type_id) do update set
  quantity = excluded.quantity,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- SECTION 5: SITUATIONAL ASSESSMENT REPORTS (public.lgu_inventory_reports)
-- ------------------------------------------------------------------------------
-- Seed fresh reports for the 43 Iloilo LGUs (43 rows)
-- ------------------------------------------------------------------------------

delete from public.lgu_inventory_reports
where reported_by_profile_id is null;

insert into public.lgu_inventory_reports (
  lgu_id,
  municipality,
  province,
  lgu_name,
  reported_at,
  food_packs,
  hygiene_kits,
  family_kits,
  affected_families,
  damage_index,
  urgency_score,
  priority_color,
  recommendation
)
select
  l.id,
  l.municipality,
  l.province,
  l.lgu_name,
  l.last_reported_at,
  l.food_packs,
  l.hygiene_kits,
  l.family_kits,
  l.affected_families,
  l.damage_index,
  l.urgency_score,
  l.priority_color,
  l.recommendation
from public.lgus l
where l.province = 'Iloilo';

-- ------------------------------------------------------------------------------
-- SECTION 6: REGIONAL WAREHOUSE RESERVES (public.warehouse_stock)
-- ------------------------------------------------------------------------------
-- Oton Main Warehouse (140,200 kits) & Pototan Main Warehouse (74,000 kits)
-- ------------------------------------------------------------------------------

with wh_stock_seed(wh_name, kit_name, qty) as (
  values
    ('Oton Main Warehouse', 'Family Food Pack', 68500),
    ('Oton Main Warehouse', 'Ready-to-Eat Food (RTEF)', 15200),
    ('Oton Main Warehouse', 'Hygiene Kit', 14800),
    ('Oton Main Warehouse', 'Sleeping Kit', 12500),
    ('Oton Main Warehouse', 'Kitchen Kit', 9400),
    ('Oton Main Warehouse', 'Family Kit', 11200),
    ('Oton Main Warehouse', 'Laminated Sacks', 8600),

    ('Pototan Main Warehouse', 'Family Food Pack', 36000),
    ('Pototan Main Warehouse', 'Ready-to-Eat Food (RTEF)', 8400),
    ('Pototan Main Warehouse', 'Hygiene Kit', 7500),
    ('Pototan Main Warehouse', 'Sleeping Kit', 6800),
    ('Pototan Main Warehouse', 'Kitchen Kit', 5100),
    ('Pototan Main Warehouse', 'Family Kit', 5900),
    ('Pototan Main Warehouse', 'Laminated Sacks', 4300)
)
insert into public.warehouse_stock (warehouse_id, kit_type_id, quantity, updated_at)
select
  w.id,
  k.id,
  s.qty,
  now()
from wh_stock_seed s
join public.warehouses w on w.name = s.wh_name
join public.kit_types k on k.name = s.kit_name
on conflict (warehouse_id, kit_type_id) do update set
  quantity = excluded.quantity,
  updated_at = now();

-- Update warehouse denormalized stock columns
update public.warehouses w
set
  food_packs = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Family Food Pack'), 0),
  rtef = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Ready-to-Eat Food (RTEF)'), 0),
  hygiene_kits = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Hygiene Kit'), 0),
  sleeping_kits = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Sleeping Kit'), 0),
  kitchen_kits = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Kitchen Kit'), 0),
  family_kits = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Family Kit'), 0),
  laminated_sacks = coalesce((select ws.quantity from public.warehouse_stock ws join public.kit_types k on k.id = ws.kit_type_id where ws.warehouse_id = w.id and k.name = 'Laminated Sacks'), 0),
  current_stock = (
    select jsonb_object_agg(k.name, ws.quantity)
    from public.warehouse_stock ws
    join public.kit_types k on k.id = ws.kit_type_id
    where ws.warehouse_id = w.id
  );

-- ------------------------------------------------------------------------------
-- SECTION 7: VERIFIED INBOUND LOGISTICS MANIFESTS (public.incoming_manifests)
-- ------------------------------------------------------------------------------
-- Exclusively to Oton, Pototan, and key Iloilo LGUs
-- ------------------------------------------------------------------------------

with incoming_seed(m_num, rcv_date, src_code, dest_type, wh_name, lgu_muni, lgu_prov, kit_name, qty, exp_interval, inc_code, hash) as (
  values
    -- Inbounds to Oton Main Warehouse (Near Expiry <= 90 Days)
    ('MNF-2026-OTON-01', current_date - 12, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Food Pack', 5000, interval '45 days', 'INC-2026-PREPOSITION', '0xa11f8e24cbb381a9415708a38a7c640e4f8d5e18370db048a1290a618e7d23a1'),
    ('MNF-2026-OTON-02', current_date - 10, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Ready-to-Eat Food (RTEF)', 3200, interval '60 days', 'INC-2026-TY-01', '0xb23e9a15dcc492b0526819b49b8d751f509e6f29481ec159b2301b729f8e34b2'),
    ('MNF-2026-OTON-03', current_date - 8, 'LDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Hygiene Kit', 2400, interval '75 days', 'INC-2026-PREPOSITION', '0xc34f0b26edd5a3c1637920c5ac9e862061af703a592fd260c3412c83a09f45c3'),

    -- Inbounds to Oton Main Warehouse (Near Expiry 91 - 120 Days)
    ('MNF-2026-OTON-04', current_date - 6, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Food Pack', 8000, interval '95 days', 'INC-2026-PREPOSITION', '0xd4501c37fee6b4d2748031d6bd0f973172ba814b6030e371d4523d94b1a056d4'),
    ('MNF-2026-OTON-05', current_date - 5, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Ready-to-Eat Food (RTEF)', 4000, interval '110 days', 'INC-2026-TY-01', '0xe5612d480ff7c5e3859142e7ce10a84283cb925c7141f482e5634ea5c2b167e5'),
    ('MNF-2026-OTON-06', current_date - 4, 'LDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Kit', 3000, interval '115 days', 'INC-2026-PREPOSITION', '0xf6723e591008d6f496a253f8df21b95394dc036d82520593f6745fb6d3c278f6'),

    -- Inbounds to Oton Main Warehouse (Safe > 120 Days)
    ('MNF-2026-OTON-07', current_date - 3, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Food Pack', 25000, interval '270 days', 'INC-2026-PREPOSITION', '0x17834f6a2119e705a7b36409e032ca64a5ed147e936316a4078560c7e4d38907'),
    ('MNF-2026-OTON-08', current_date - 2, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Sleeping Kit', 6000, interval '365 days', 'INC-2026-PREPOSITION', '0x2894507b322af816b8c4751af143db75b6fe258fa47427b5189671d8f5e49a18'),

    -- Inbounds to Pototan Main Warehouse
    ('MNF-2026-POT-01', current_date - 9, 'VDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Family Food Pack', 4000, interval '40 days', 'INC-2026-PREPOSITION', '0x39a5618c433b0927c9d5862bf254ec86c70f3690b58538c629a782e906f5ab29'),
    ('MNF-2026-POT-02', current_date - 7, 'VDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Ready-to-Eat Food (RTEF)', 2500, interval '100 days', 'INC-2026-FLD-01', '0x4ab6729d544c1a38dae6973c0365fd97d81047a1c69649d73ab893fa1706bc3a'),
    ('MNF-2026-POT-03', current_date - 3, 'LDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Family Food Pack', 15000, interval '240 days', 'INC-2026-PREPOSITION', '0x5bc783ae655d2b49ebf7084d14760ea8e92158b2d7a75ae84bc9a40b2817cd4b'),
    ('MNF-2026-POT-04', current_date - 2, 'LDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Hygiene Kit', 3500, interval '112 days', 'INC-2026-PREPOSITION', '0x6cd894bf766e3c5af008195e25871fb9fa3269c3e8b86bf95cda051c3928de5c'),

    -- Direct Inbounds to Iloilo LGUs (Near Expiry <= 90 Days)
    ('MNF-2026-LGU-CARLES-01', current_date - 5, 'VDRC', 'LGU', null, 'Carles', 'Iloilo', 'Family Food Pack', 120, interval '28 days', 'INC-2026-TY-01', '0x7de9a5c0877f4d6b01192a6f369820cafb437ad4f9c97c0a6deb162d4a39ef6d'),
    ('MNF-2026-LGU-BALASAN-01', current_date - 4, 'VDRC', 'LGU', null, 'Balasan', 'Iloilo', 'Family Food Pack', 150, interval '35 days', 'INC-2026-TY-01', '0x8ef0b6d198805e7c122a3b7047a931db0c548be50ad08d1b7efc273e5b4af07e'),
    ('MNF-2026-LGU-ESTANCIA-01', current_date - 4, 'VDRC', 'LGU', null, 'Estancia', 'Iloilo', 'Ready-to-Eat Food (RTEF)', 80, interval '50 days', 'INC-2026-TY-01', '0x9f01c7e2a9916f8d233b4c8158ba42ec1d659cf61be19e2c8f0d384f6c5b018f'),
    ('MNF-2026-LGU-SANDIONISIO-01', current_date - 3, 'LDRC', 'LGU', null, 'San Dionisio', 'Iloilo', 'Family Food Pack', 140, interval '42 days', 'INC-2026-FLD-01', '0xa012d8f3ba02709e344c5d9269cb53fd2e76ad072cf2af3d901e49507d6c1290'),
    ('MNF-2026-LGU-BATAD-01', current_date - 6, 'VDRC', 'LGU', null, 'Batad', 'Iloilo', 'Family Food Pack', 160, interval '38 days', 'INC-2026-TY-01', '0xb123e904cb1381af455d6ea370dc640e3f87be183d03b04ea12f5a618e7d23a1'),
    ('MNF-2026-LGU-CONCEPCION-01', current_date - 5, 'VDRC', 'LGU', null, 'Concepcion', 'Iloilo', 'Family Food Pack', 180, interval '55 days', 'INC-2026-TY-01', '0xc234fa15dc2492b0566e7fb481ed751f4098cf294e14c15fb2306b729f8e34b2'),
    ('MNF-2026-LGU-SARA-01', current_date - 4, 'LDRC', 'LGU', null, 'Sara', 'Iloilo', 'Family Food Pack', 130, interval '62 days', 'INC-2026-TY-01', '0xd3450b26ed35a3c1677f80c592fe862051a9d03a5f25d260c3417c83a09f45c3'),

    -- Direct Inbounds to Iloilo LGUs (Near Expiry 91 - 120 Days)
    ('MNF-2026-LGU-CARLES-02', current_date - 3, 'VDRC', 'LGU', null, 'Carles', 'Iloilo', 'Ready-to-Eat Food (RTEF)', 60, interval '98 days', 'INC-2026-TY-01', '0xe4561c37fe46b4d2788091d6a30f973162ba814b6036e371d4528d94b1a056d4'),
    ('MNF-2026-LGU-AJUY-01', current_date - 4, 'VDRC', 'LGU', null, 'Ajuy', 'Iloilo', 'Family Food Pack', 350, interval '105 days', 'INC-2026-PREPOSITION', '0xf5672d480f57c5e38991a2e7b410a84273cb925c7147f482e5639ea5c2b167e5'),
    ('MNF-2026-LGU-PASSI-01', current_date - 2, 'LDRC', 'LGU', null, 'Passi City', 'Iloilo', 'Hygiene Kit', 400, interval '112 days', 'INC-2026-PREPOSITION', '0x06783e591068d6f49aa2b3f8c521b95384dc036d82580593f674afb6d3c278f6'),
    ('MNF-2026-LGU-ILOILOCITY-01', current_date - 3, 'LDRC', 'LGU', null, 'Iloilo City', 'Iloilo', 'Family Food Pack', 600, interval '118 days', 'INC-2026-PREPOSITION', '0x17894f6a2179e705abb3c409d632ca6495ed147e936916a40785b0c7e4d38907'),
    ('MNF-2026-LGU-BAROTACVIEJO-01', current_date - 4, 'VDRC', 'LGU', null, 'Barotac Viejo', 'Iloilo', 'Family Kit', 320, interval '108 days', 'INC-2026-PREPOSITION', '0x2890507b328af816bcc4d51ae743db75a6fe258fa47a27b51896c1d8f5e49a18'),
    ('MNF-2026-LGU-LEMERY-01', current_date - 2, 'VDRC', 'LGU', null, 'Lemery', 'Iloilo', 'Hygiene Kit', 150, interval '115 days', 'INC-2026-TY-01', '0x39a1618c439b0927cdd5e62bf854ec86b70f3690b58b38c629a7d2e906f5ab29')
)
insert into public.incoming_manifests (
  manifest_number,
  date_received,
  supply_source_id,
  destination_type,
  destination_warehouse_id,
  destination_lgu_id,
  kit_type_id,
  quantity,
  unit_type,
  expiration_date,
  incident_code,
  status,
  manifest_hash,
  verified_by,
  source,
  destination,
  category
)
select
  s.m_num,
  s.rcv_date,
  src.id,
  s.dest_type,
  w.id,
  l.id,
  k.id,
  s.qty,
  k.unit_type,
  current_date + s.exp_interval,
  s.inc_code,
  'Verified',
  s.hash,
  'DSWD Regional Logistics Inspector',
  src.name,
  coalesce(w.name, l.lgu_name, l.municipality),
  k.name
from incoming_seed s
join public.supply_sources src on src.short_code = s.src_code
join public.kit_types k on k.name = s.kit_name
left join public.warehouses w on w.name = s.wh_name and s.dest_type = 'Warehouse'
left join public.lgus l on l.municipality = s.lgu_muni and l.province = s.lgu_prov and s.dest_type = 'LGU'
on conflict (manifest_number) do update set
  quantity = excluded.quantity,
  expiration_date = excluded.expiration_date,
  status = excluded.status,
  manifest_hash = excluded.manifest_hash;

-- ------------------------------------------------------------------------------
-- SECTION 8: INVENTORY LOT BATCHES WITH EXPIRATION TRACKING (public.inventory_batches)
-- ------------------------------------------------------------------------------
-- Linked to inbound manifests with explicit rolling expiration countdowns
-- ------------------------------------------------------------------------------

insert into public.inventory_batches (
  batch_token_id,
  incoming_manifest_id,
  kit_type_id,
  initial_quantity,
  remaining_quantity,
  warehouse_id,
  lgu_id,
  expiration_date,
  manifest_hash,
  minted_at
)
select
  'BATCH-' || m.manifest_number,
  m.id,
  m.kit_type_id,
  m.quantity,
  m.quantity,
  m.destination_warehouse_id,
  m.destination_lgu_id,
  m.expiration_date,
  m.manifest_hash,
  m.created_at
from public.incoming_manifests m
where m.manifest_number like 'MNF-2026-%'
on conflict (batch_token_id) do update set
  initial_quantity = excluded.initial_quantity,
  remaining_quantity = excluded.remaining_quantity,
  expiration_date = excluded.expiration_date,
  manifest_hash = excluded.manifest_hash;

-- ------------------------------------------------------------------------------
-- SECTION 9: DOUBLE-ENTRY AUDIT JOURNAL (public.stock_ledger)
-- ------------------------------------------------------------------------------
-- Auditable record of verified inbound intakes
-- ------------------------------------------------------------------------------

insert into public.stock_ledger (
  facility_type,
  warehouse_id,
  lgu_id,
  kit_type_id,
  delta_quantity,
  balance_after,
  movement_type,
  reference_manifest_id,
  created_at
)
select
  m.destination_type,
  m.destination_warehouse_id,
  m.destination_lgu_id,
  m.kit_type_id,
  m.quantity,
  m.quantity,
  'INTAKE_VERIFIED',
  m.id,
  m.created_at
from public.incoming_manifests m
where m.manifest_number like 'MNF-2026-%'
  and not exists (
    select 1 from public.stock_ledger sl
    where sl.reference_manifest_id = m.id
  );

-- ------------------------------------------------------------------------------
-- SECTION 10: RECLAIM STORAGE PAGES & MEMORY
-- ------------------------------------------------------------------------------

vacuum analyze public.stock_ledger;
vacuum analyze public.inventory_batches;
vacuum analyze public.incoming_manifests;
vacuum analyze public.lgu_inventory_reports;
vacuum analyze public.lgu_stock;
vacuum analyze public.warehouse_stock;
vacuum analyze public.lgus;
vacuum analyze public.warehouses;

-- ------------------------------------------------------------------------------
-- SECTION 11: VERIFICATION & SUMMARY DIAGNOSTIC AUDIT
-- ------------------------------------------------------------------------------

select
  'ILOILO PROVINCE AUDIT' as check_type,
  (select count(*) from public.lgus where province = 'Iloilo') as iloilo_lgus_total,
  (select count(*) from public.lgus where province = 'Iloilo' and priority_color = 'Red') as severe_red_lgus,
  (select count(*) from public.lgus where province = 'Iloilo' and priority_color = 'Orange') as low_orange_lgus,
  (select count(*) from public.lgus where province = 'Iloilo' and priority_color = 'Yellow') as mid_yellow_lgus,
  (select count(*) from public.lgus where province = 'Iloilo' and priority_color = 'Green') as safe_green_lgus,
  (select count(*) from public.lgu_stock where lgu_id in (select id from public.lgus where province = 'Iloilo')) as iloilo_stock_records,
  (select count(*) from public.lgu_inventory_reports where province = 'Iloilo') as iloilo_inventory_reports,
  (select count(*) from public.warehouses where province = 'Iloilo') as iloilo_warehouses,
  (select count(*) from public.warehouse_stock) as warehouse_stock_records,
  (select count(*) from public.incoming_manifests where manifest_number like 'MNF-2026-%') as active_inbound_manifests,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%') as active_batches,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%' and expiration_date <= current_date + interval '90 days') as batches_expiring_90d,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%' and expiration_date > current_date + interval '90 days' and expiration_date <= current_date + interval '120 days') as batches_expiring_120d;
