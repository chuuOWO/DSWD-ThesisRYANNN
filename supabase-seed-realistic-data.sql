-- ==============================================================================
-- DSWD RELIEF LOGISTICS & INVENTORY TRACKING SYSTEM
-- AUTHORITATIVE REALISTIC DATA SEED SCRIPT (23 NEARBY METRO & CENTRAL ILOILO LGUS)
-- ==============================================================================
-- Ultra-Lightweight & High-Performance Configuration:
-- 1. Maintained exclusively for the 23 municipalities surrounding Iloilo City:
--      - Severe / Critical (Red) (4 LGUs): Tubungan, Alimodian, Leon, Maasin
--      - Low / Warning (Orange) (5 LGUs): Guimbal, Tigbauan, Mina, Badiangan, New Lucena
--      - Medium / Moderate (Yellow) (6 LGUs): Janiuay, Dingle, San Miguel, Cabatuan, Barotac Nuevo, Dumangas
--      - Adequate / Safe (Green) (8 LGUs): Iloilo City, Oton, Pototan, Pavia, Santa Barbara, Leganes, Zarraga, Miag-ao
-- 2. Purges distant non-metro records so your database stays ultra-fast and lightweight (<250 KB).
-- 3. Populates public.lgu_stock for the 23 LGUs across all 7 kit types (161 rows).
-- 4. Populates public.lgu_inventory_reports for the 23 LGUs (23 rows).
-- 5. Populates regional warehouse physical stocks in Oton and Pototan.
-- 6. Populates verified inbound logistics manifests and batches exclusively for nearby LGUs:
--      - Expiring in <= 90 Days (rolling 1-3 months)
--      - Expiring in 91-120 Days (rolling 4-6 months)
--      - Standard shelf life (> 120 Days)
-- 7. Zero transaction errors: Omits VACUUM to run smoothly in Supabase SQL Editor.
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
-- SECTION 2: PURGE NON-NEARBY RECORDS TO MINIMIZE SUPABASE MEMORY & STORAGE
-- ------------------------------------------------------------------------------

delete from public.stock_ledger
where lgu_id in (select id from public.lgus where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
));

delete from public.inventory_batches
where lgu_id in (select id from public.lgus where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
));

delete from public.incoming_manifests
where destination_lgu_id in (select id from public.lgus where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
));

delete from public.lgu_stock
where lgu_id in (select id from public.lgus where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
));

delete from public.lgu_inventory_reports
where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
);

-- Delete non-nearby LGUs unless linked to an active user profile
delete from public.lgus
where municipality not in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
)
and id not in (select lgu_id from public.profiles where lgu_id is not null);

-- ------------------------------------------------------------------------------
-- SECTION 3: SEED THE 23 NEARBY ILOILO LGUS & SITUATIONAL BUFFER STOCK
-- ------------------------------------------------------------------------------

with lgu_seed_data(muni, prov, name, lat, lng, max_s, ffp, rtef, hyg, sleep, kitc, fam, sack, aff_fam, dmg_idx, urg_score, p_color, rec) as (
  values
    -- ===== SEVERE TIER (RED) (4 LGUs) =====
    ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.7500, 122.3333, 3000, 260, 65, 80, 55, 40, 45, 30, 2850, 91, 94, 'Red', 'CRITICAL: Upland road closures from flash flood; urgent food pack airlift requested.'),
    ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332, 3000, 310, 80, 95, 60, 45, 50, 35, 2600, 87, 91, 'Red', 'CRITICAL: Aganan river overflow; severe buffer depletion in evacuation centers.'),
    ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831, 3000, 380, 95, 110, 75, 50, 60, 40, 2400, 84, 88, 'Red', 'CRITICAL: Mountain barangays cut off; relief convoy staging required.'),
    ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333, 3000, 430, 110, 125, 85, 60, 70, 45, 2150, 82, 86, 'Red', 'CRITICAL: Dam catchment inundation; emergency stock dispatched.'),

    -- ===== LOW / WARNING TIER (ORANGE) (5 LGUs) =====
    ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.6600, 122.3167, 3000, 890, 220, 290, 200, 155, 175, 125, 1380, 61, 67, 'Orange', 'WARNING: High coastal swell; buffer reserves falling below safety margin.'),
    ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.6750, 122.3806, 3000, 980, 245, 320, 230, 175, 190, 130, 1250, 58, 64, 'Orange', 'WARNING: Storm surge warning active; secondary replenishment staged.'),
    ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833, 3000, 1080, 270, 350, 245, 190, 210, 150, 1120, 52, 59, 'Orange', 'WARNING: Low-lying agricultural inundation; stock replenishment queued.'),
    ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312, 3000, 1160, 290, 370, 265, 205, 225, 165, 960, 48, 56, 'Orange', 'WARNING: Flash flood alert along Jalaur river; monitor stock drawdown.'),
    ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6000, 3000, 1240, 310, 400, 285, 220, 240, 175, 880, 45, 55, 'Orange', 'WARNING: Moderate displaced count in evacuation centers; staging scheduled.'),

    -- ===== MEDIUM / MODERATE TIER (YELLOW) (6 LGUs) =====
    ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.9500, 122.5000, 3000, 1620, 405, 515, 380, 295, 325, 225, 420, 33, 44, 'Yellow', 'MODERATE: Steady buffer stock; standard bi-weekly monitoring active.'),
    ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11.0000, 122.6667, 3000, 1710, 425, 540, 405, 315, 345, 240, 340, 28, 41, 'Yellow', 'MODERATE: Safe operational threshold; buffer reserves balanced.'),
    ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667, 3000, 1800, 450, 570, 425, 330, 365, 250, 260, 24, 38, 'Yellow', 'MODERATE: Central plain inventory verified; normal standby.'),
    ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856, 3000, 1890, 470, 600, 445, 350, 385, 265, 200, 20, 36, 'Yellow', 'MODERATE: Airport corridor relief hub fully provisioned; no deficiencies.'),
    ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027, 3000, 1970, 490, 620, 465, 365, 400, 280, 150, 17, 35, 'Yellow', 'MODERATE: Plain drainage holding; reserves at safe threshold.'),
    ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167, 3000, 2050, 510, 650, 480, 380, 415, 290, 110, 14, 35, 'Yellow', 'MODERATE: Coastal port facilities operating normally; reserves intact.'),

    -- ===== ADEQUATE / SAFE TIER (GREEN) (8 LGUs) =====
    ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621, 6000, 5450, 1360, 1720, 1280, 980, 1100, 750, 45, 5, 8, 'Green', 'ADEQUATE: Major regional hub well-stocked; regional disaster reserve intact.'),
    ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse Hub', 10.6975, 122.4764, 5000, 4650, 1160, 1460, 1100, 860, 940, 650, 0, 0, 5, 'Green', 'ADEQUATE: Regional logistics staging post; reserves fully stocked.'),
    ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272, 4000, 3620, 905, 1140, 855, 670, 730, 510, 0, 0, 5, 'Green', 'ADEQUATE: Secondary warehouse hub operating at peak preparedness.'),
    ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.5400, 3000, 2580, 645, 810, 610, 480, 520, 360, 20, 3, 10, 'Green', 'ADEQUATE: High buffer stock; logistics proximity to regional warehouse.'),
    ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.8200, 122.5333, 3000, 2620, 655, 825, 620, 490, 530, 370, 15, 2, 8, 'Green', 'ADEQUATE: Zero reported displaced families; warehouse capacity optimal.'),
    ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833, 3000, 2700, 675, 850, 640, 500, 545, 380, 0, 0, 5, 'Green', 'ADEQUATE: Full municipal buffer stock on hand; no active alerts.'),
    ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.8200, 122.6100, 3000, 2740, 685, 860, 645, 510, 555, 385, 0, 0, 5, 'Green', 'ADEQUATE: Buffer reserves at optimal levels; routine reporting.'),
    ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352, 3000, 2850, 710, 895, 675, 535, 580, 410, 0, 0, 5, 'Green', 'ADEQUATE: Southern coastal evacuation center ready; zero stock shortage.')
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

-- Link LGUs to province foreign key
update public.lgus l
set province_id = p.id
from public.provinces p
where l.province_id is null and lower(trim(l.province)) = lower(trim(p.name));

-- ------------------------------------------------------------------------------
-- SECTION 4: NORMALIZED PHYSICAL BUFFER STOCK (public.lgu_stock)
-- ------------------------------------------------------------------------------
-- Inserts 7 rows per nearby LGU (23 * 7 = 161 rows)
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
where l.municipality in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
)
on conflict (lgu_id, kit_type_id) do update set
  quantity = excluded.quantity,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- SECTION 5: SITUATIONAL ASSESSMENT REPORTS (public.lgu_inventory_reports)
-- ------------------------------------------------------------------------------
-- Seed fresh reports for the 23 nearby LGUs (23 rows)
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
where l.municipality in (
  'Iloilo City', 'Pavia', 'Leganes', 'Oton', 'Santa Barbara', 'San Miguel', 'Zarraga',
  'Tigbauan', 'Cabatuan', 'Alimodian', 'New Lucena', 'Dumangas', 'Guimbal', 'Leon',
  'Barotac Nuevo', 'Maasin', 'Tubungan', 'Pototan', 'Mina', 'Miag-ao', 'Badiangan',
  'Dingle', 'Janiuay'
);

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
-- Exclusively to Oton, Pototan, and nearby Metro/Central Iloilo LGUs
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
    ('MNF-2026-OTON-06', current_date - 4, 'LDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Kit', 3000, interval '115 days', 'INC-2026-PREPOSITION', '0xf6723e591008d6f496a253f8df21b95394dc036d82580593f6745fb6d3c278f6'),

    -- Inbounds to Oton Main Warehouse (Safe > 120 Days)
    ('MNF-2026-OTON-07', current_date - 3, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Family Food Pack', 25000, interval '270 days', 'INC-2026-PREPOSITION', '0x17834f6a2119e705a7b36409e032ca64a5ed147e936316a4078560c7e4d38907'),
    ('MNF-2026-OTON-08', current_date - 2, 'VDRC', 'Warehouse', 'Oton Main Warehouse', null, null, 'Sleeping Kit', 6000, interval '365 days', 'INC-2026-PREPOSITION', '0x2894507b322af816b8c4751af143db75b6fe258fa47427b5189671d8f5e49a18'),

    -- Inbounds to Pototan Main Warehouse
    ('MNF-2026-POT-01', current_date - 9, 'VDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Family Food Pack', 4000, interval '40 days', 'INC-2026-PREPOSITION', '0x39a5618c433b0927c9d5862bf254ec86c70f3690b58538c629a782e906f5ab29'),
    ('MNF-2026-POT-02', current_date - 7, 'VDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Ready-to-Eat Food (RTEF)', 2500, interval '100 days', 'INC-2026-FLD-01', '0x4ab6729d544c1a38dae6973c0365fd97d81047a1c69649d73ab893fa1706bc3a'),
    ('MNF-2026-POT-03', current_date - 3, 'LDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Family Food Pack', 15000, interval '240 days', 'INC-2026-PREPOSITION', '0x5bc783ae655d2b49ebf7084d14760ea8e92158b2d7a75ae84bc9a40b2817cd4b'),
    ('MNF-2026-POT-04', current_date - 2, 'LDRC', 'Warehouse', 'Pototan Main Warehouse', null, null, 'Hygiene Kit', 3500, interval '112 days', 'INC-2026-PREPOSITION', '0x6cd894bf766e3c5af008195e25871fb9fa3269c3e8b86bf95cda051c3928de5c'),

    -- Direct Inbounds to Nearby Critical LGUs (Near Expiry <= 90 Days)
    ('MNF-2026-LGU-TUBUNGAN-01', current_date - 5, 'VDRC', 'LGU', null, 'Tubungan', 'Iloilo', 'Family Food Pack', 140, interval '28 days', 'INC-2026-TY-01', '0x7de9a5c0877f4d6b01192a6f369820cafb437ad4f9c97c0a6deb162d4a39ef6d'),
    ('MNF-2026-LGU-ALIMODIAN-01', current_date - 4, 'VDRC', 'LGU', null, 'Alimodian', 'Iloilo', 'Family Food Pack', 160, interval '35 days', 'INC-2026-TY-01', '0x8ef0b6d198805e7c122a3b7047a931db0c548be50ad08d1b7efc273e5b4af07e'),
    ('MNF-2026-LGU-LEON-01', current_date - 4, 'VDRC', 'LGU', null, 'Leon', 'Iloilo', 'Ready-to-Eat Food (RTEF)', 90, interval '50 days', 'INC-2026-TY-01', '0x9f01c7e2a9916f8d233b4c8158ba42ec1d659cf61be19e2c8f0d384f6c5b018f'),
    ('MNF-2026-LGU-MAASIN-01', current_date - 3, 'LDRC', 'LGU', null, 'Maasin', 'Iloilo', 'Family Food Pack', 150, interval '42 days', 'INC-2026-FLD-01', '0xa012d8f3ba02709e344c5d9269cb53fd2e76ad072cf2af3d901e49507d6c1290'),

    -- Direct Inbounds to Nearby LGUs (Near Expiry 91 - 120 Days)
    ('MNF-2026-LGU-GUIMBAL-01', current_date - 4, 'VDRC', 'LGU', null, 'Guimbal', 'Iloilo', 'Family Food Pack', 320, interval '105 days', 'INC-2026-PREPOSITION', '0xf5672d480f57c5e38991a2e7b410a84273cb925c7147f482e5639ea5c2b167e5'),
    ('MNF-2026-LGU-TIGBAUAN-01', current_date - 3, 'VDRC', 'LGU', null, 'Tigbauan', 'Iloilo', 'Ready-to-Eat Food (RTEF)', 80, interval '98 days', 'INC-2026-TY-01', '0xe4561c37fe46b4d2788091d6a30f973162ba814b6036e371d4528d94b1a056d4'),
    ('MNF-2026-LGU-MINA-01', current_date - 2, 'LDRC', 'LGU', null, 'Mina', 'Iloilo', 'Hygiene Kit', 250, interval '112 days', 'INC-2026-PREPOSITION', '0x06783e591068d6f49aa2b3f8c521b95384dc036d82580593f674afb6d3c278f6'),
    ('MNF-2026-LGU-ILOILOCITY-01', current_date - 3, 'LDRC', 'LGU', null, 'Iloilo City', 'Iloilo', 'Family Food Pack', 600, interval '118 days', 'INC-2026-PREPOSITION', '0x17894f6a2179e705abb3c409d632ca6495ed147e936916a40785b0c7e4d38907'),
    ('MNF-2026-LGU-PAVIA-01', current_date - 4, 'VDRC', 'LGU', null, 'Pavia', 'Iloilo', 'Family Kit', 280, interval '108 days', 'INC-2026-PREPOSITION', '0x2890507b328af816bcc4d51ae743db75a6fe258fa47a27b51896c1d8f5e49a18'),
    ('MNF-2026-LGU-JANIUAY-01', current_date - 2, 'VDRC', 'LGU', null, 'Janiuay', 'Iloilo', 'Hygiene Kit', 180, interval '115 days', 'INC-2026-TY-01', '0x39a1618c439b0927cdd5e62bf854ec86b70f3690b58b38c629a7d2e906f5ab29')
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
-- SECTION 10: VERIFICATION & SUMMARY DIAGNOSTIC AUDIT
-- ------------------------------------------------------------------------------

select
  '23 NEARBY ILOILO LGUS AUDIT' as check_type,
  (select count(*) from public.lgus) as total_active_lgus,
  (select count(*) from public.lgus where priority_color = 'Red') as severe_red_lgus,
  (select count(*) from public.lgus where priority_color = 'Orange') as low_orange_lgus,
  (select count(*) from public.lgus where priority_color = 'Yellow') as mid_yellow_lgus,
  (select count(*) from public.lgus where priority_color = 'Green') as safe_green_lgus,
  (select count(*) from public.lgu_stock) as total_stock_records,
  (select count(*) from public.lgu_inventory_reports) as total_inventory_reports,
  (select count(*) from public.warehouses) as active_warehouses,
  (select count(*) from public.warehouse_stock) as warehouse_stock_records,
  (select count(*) from public.incoming_manifests where manifest_number like 'MNF-2026-%') as active_inbound_manifests,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%') as active_batches,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%' and expiration_date <= current_date + interval '90 days') as batches_expiring_90d,
  (select count(*) from public.inventory_batches where batch_token_id like 'BATCH-MNF-2026-%' and expiration_date > current_date + interval '90 days' and expiration_date <= current_date + interval '120 days') as batches_expiring_120d;
