-- ==============================================================================
-- DSWD RELIEF SYSTEM: OPERATIONAL DATA RESET & ZERO-BASELINE LGU INVENTORY SEED
-- ==============================================================================
-- This query:
-- 1. Cleans operational tables (preserves table structures and triggers)
-- 2. Preserves your single primary admin user in public.profiles
-- 3. Inserts all 101 Panay Island & Guimaras municipalities initialized to 0 stock
-- ==============================================================================

-- 1. Clean operational tables
truncate table public.incoming_manifests cascade;
truncate table public.outgoing_requests cascade;
truncate table public.truck_live_locations cascade;
truncate table public.discrepancy_reports cascade;
truncate table public.lgu_inventory_reports cascade;

-- Reset batch and DR sequential counters
update public.app_counters set current_value = 0 where counter_name in ('batch_index', 'dr_index');

-- 2. Clean non-admin test accounts from public.profiles (preserves 1 primary admin)
delete from public.profiles
where id not in (
  select id from public.profiles
  where role = 'dswd_admin'
  order by created_at asc
  limit 1
);

-- 3. Seed zero-baseline inventory reports for ALL 101 municipalities
insert into public.lgu_inventory_reports (
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
) values
  ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Anilao', 'Iloilo', 'Anilao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Banate', 'Iloilo', 'Banate Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Batad', 'Iloilo', 'Batad Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Calinog', 'Iloilo', 'Calinog Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Carles', 'Iloilo', 'Carles Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dingle', 'Iloilo', 'Dingle Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Estancia', 'Iloilo', 'Estancia Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Leganes', 'Iloilo', 'Leganes Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Lemery', 'Iloilo', 'Lemery Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Leon', 'Iloilo', 'Leon Municipal Office', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Maasin', 'Iloilo', 'Maasin Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Mina', 'Iloilo', 'Mina Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Passi City', 'Iloilo', 'Passi City CDRRMO', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Pavia', 'Iloilo', 'Pavia Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Pototan', 'Iloilo', 'Pototan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sara', 'Iloilo', 'Sara Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Anini-y', 'Antique', 'Anini-y Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Barbaza', 'Antique', 'Barbaza Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Belison', 'Antique', 'Belison Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Bugasong', 'Antique', 'Bugasong Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Caluya', 'Antique', 'Caluya Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Culasi', 'Antique', 'Culasi Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Hamtic', 'Antique', 'Hamtic Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Laua-an', 'Antique', 'Laua-an Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Libertad', 'Antique', 'Libertad Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Pandan', 'Antique', 'Pandan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Patnongon', 'Antique', 'Patnongon Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Remigio', 'Antique', 'San Remigio Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sebaste', 'Antique', 'Sebaste Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sibalom', 'Antique', 'Sibalom Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tibiao', 'Antique', 'Tibiao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Valderrama', 'Antique', 'Valderrama Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dao', 'Capiz', 'Dao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Maayon', 'Capiz', 'Maayon Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Panay', 'Capiz', 'Panay Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Panitan', 'Capiz', 'Panitan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Pilar', 'Capiz', 'Pilar Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sapian', 'Capiz', 'Sapian Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sigma', 'Capiz', 'Sigma Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Altavas', 'Aklan', 'Altavas Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Balete', 'Aklan', 'Balete Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Banga', 'Aklan', 'Banga Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Batan', 'Aklan', 'Batan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Lezo', 'Aklan', 'Lezo Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Libacao', 'Aklan', 'Libacao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Madalag', 'Aklan', 'Madalag Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Makato', 'Aklan', 'Makato Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Malinao', 'Aklan', 'Malinao Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Nabas', 'Aklan', 'Nabas Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('New Washington', 'Aklan', 'New Washington Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Numancia', 'Aklan', 'Numancia Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.'),
  ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', now(), 0, 0, 0, 0, 0, 0, 'Green', 'Baseline initial inventory; awaiting incident report.');

-- 4. Verification count query
select province, count(*) as total_municipalities, sum(food_packs) as total_food_packs
from public.lgu_inventory_reports
group by province
order by province;