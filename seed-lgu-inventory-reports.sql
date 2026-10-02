-- ==============================================================================
-- DSWD RELIEF SYSTEM: OPERATIONAL DATA RESET & ZERO-BASELINE LGU INVENTORY SEED
-- ==============================================================================
-- This query:
-- 1. Cleans operational tables (preserves table structures and triggers)
-- 2. Preserves your primary admin user in public.profiles
-- 3. Inserts all 101 Panay Island & Guimaras municipalities into public.lgus
-- 4. Seeds zero-baseline inventory reports linked via lgu_id foreign key
-- ==============================================================================

-- 1. Clean operational tables
truncate table public.incoming_manifests cascade;
truncate table public.outgoing_requests cascade;
truncate table public.truck_live_locations cascade;
truncate table public.discrepancy_reports cascade;
truncate table public.lgu_inventory_reports cascade;

-- Reset batch and DR sequential counters
update public.app_counters set value = 0 where key = 'batch_index';

-- 2. Clean non-admin test accounts from public.profiles (preserves primary admin)
delete from public.profiles
where id not in (
  select id from public.profiles
  where role = 'dswd_admin'
  order by created_at asc
  limit 1
);

-- 3. Seed Master LGUs table with all 101 Panay Island & Guimaras municipalities
insert into public.lgus (municipality, province, lgu_name, latitude, longitude)
select
  l.municipality,
  l.province,
  l.lgu_name,
  l.latitude,
  l.longitude
from (
  values
    ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', 11.1714, 122.9818),
    ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332),
    ('Anilao', 'Iloilo', 'Anilao Municipal Hall', 10.9856, 122.7533),
    ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312),
    ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', 11.4721, 123.0847),
    ('Banate', 'Iloilo', 'Banate Municipal Hall', 11.0022, 122.8174),
    ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027),
    ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', 11.0503, 122.8466),
    ('Batad', 'Iloilo', 'Batad Municipal Hall', 11.4167, 123.0833),
    ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', 11.2036, 122.5639),
    ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856),
    ('Calinog', 'Iloilo', 'Calinog Municipal Hall', 11.1242, 122.4939),
    ('Carles', 'Iloilo', 'Carles Municipal Hall', 11.5833, 123.1667),
    ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', 11.2189, 123.1111),
    ('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11, 122.6667),
    ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167),
    ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167),
    ('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528),
    ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.66, 122.3167),
    ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667),
    ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621),
    ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.95, 122.5),
    ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.05, 122.4833),
    ('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833),
    ('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167),
    ('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831),
    ('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333),
    ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352),
    ('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833),
    ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6),
    ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse', 10.6975, 122.4764),
    ('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417),
    ('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.54),
    ('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272),
    ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833),
    ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.65),
    ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333),
    ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667),
    ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333),
    ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.82, 122.5333),
    ('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167),
    ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.675, 122.3806),
    ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.75, 122.3333),
    ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.82, 122.61),
    ('Anini-y', 'Antique', 'Anini-y Municipal Hall', 10.4333, 121.9333),
    ('Barbaza', 'Antique', 'Barbaza Municipal Hall', 11.2167, 122.0667),
    ('Belison', 'Antique', 'Belison Municipal Hall', 10.8333, 121.9667),
    ('Bugasong', 'Antique', 'Bugasong Municipal Hall', 11.0333, 122.0667),
    ('Caluya', 'Antique', 'Caluya Municipal Hall', 11.9167, 121.5667),
    ('Culasi', 'Antique', 'Culasi Municipal Hall', 11.4333, 122.05),
    ('Hamtic', 'Antique', 'Hamtic Municipal Hall', 10.7, 121.9833),
    ('Laua-an', 'Antique', 'Laua-an Municipal Hall', 11.15, 122.05),
    ('Libertad', 'Antique', 'Libertad Municipal Hall', 11.7667, 121.9167),
    ('Pandan', 'Antique', 'Pandan Municipal Hall', 11.7167, 122.1),
    ('Patnongon', 'Antique', 'Patnongon Municipal Hall', 10.9167, 121.9833),
    ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', 10.75, 121.95),
    ('San Remigio', 'Antique', 'San Remigio Municipal Hall', 10.8, 122.0833),
    ('Sebaste', 'Antique', 'Sebaste Municipal Hall', 11.5833, 122.1),
    ('Sibalom', 'Antique', 'Sibalom Municipal Hall', 10.7833, 122.0167),
    ('Tibiao', 'Antique', 'Tibiao Municipal Hall', 11.2833, 122.0333),
    ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', 10.5167, 121.9333),
    ('Valderrama', 'Antique', 'Valderrama Municipal Hall', 11, 122.1333),
    ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', 11.35, 122.6833),
    ('Dao', 'Capiz', 'Dao Municipal Hall', 11.3833, 122.6833),
    ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', 11.3, 122.6167),
    ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', 11.2667, 122.7),
    ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', 11.5167, 122.7),
    ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', 11.45, 122.4833),
    ('Maayon', 'Capiz', 'Maayon Municipal Hall', 11.3667, 122.7833),
    ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', 11.4333, 122.6),
    ('Panay', 'Capiz', 'Panay Municipal Hall', 11.5667, 122.8),
    ('Panitan', 'Capiz', 'Panitan Municipal Hall', 11.4667, 122.7667),
    ('Pilar', 'Capiz', 'Pilar Municipal Hall', 11.4833, 122.9833),
    ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', 11.4667, 122.8333),
    ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', 11.4333, 122.9333),
    ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', 11.5853, 122.7511),
    ('Sapian', 'Capiz', 'Sapian Municipal Hall', 11.5, 122.6),
    ('Sigma', 'Capiz', 'Sigma Municipal Hall', 11.4167, 122.6667),
    ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', 11.2667, 122.5333),
    ('Altavas', 'Aklan', 'Altavas Municipal Hall', 11.5333, 122.4833),
    ('Balete', 'Aklan', 'Balete Municipal Hall', 11.55, 122.3833),
    ('Banga', 'Aklan', 'Banga Municipal Hall', 11.6333, 122.3333),
    ('Batan', 'Aklan', 'Batan Municipal Hall', 11.5833, 122.5),
    ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', 11.8333, 121.9),
    ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', 11.8167, 122.1667),
    ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', 11.7078, 122.3637),
    ('Lezo', 'Aklan', 'Lezo Municipal Hall', 11.6667, 122.3333),
    ('Libacao', 'Aklan', 'Libacao Municipal Hall', 11.4667, 122.3),
    ('Madalag', 'Aklan', 'Madalag Municipal Hall', 11.5167, 122.3),
    ('Makato', 'Aklan', 'Makato Municipal Hall', 11.7167, 122.2833),
    ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', 11.9, 121.9167),
    ('Malinao', 'Aklan', 'Malinao Municipal Hall', 11.65, 122.3167),
    ('Nabas', 'Aklan', 'Nabas Municipal Hall', 11.8333, 122.0667),
    ('New Washington', 'Aklan', 'New Washington Municipal Hall', 11.65, 122.4333),
    ('Numancia', 'Aklan', 'Numancia Municipal Hall', 11.7167, 122.3333),
    ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', 11.7833, 122.25),
    ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', 10.6586, 122.5939),
    ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', 10.6833, 122.6167),
    ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', 10.5167, 122.5333),
    ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', 10.6, 122.6833),
    ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', 10.55, 122.6167)
) as l(municipality, province, lgu_name, latitude, longitude)
on conflict (municipality, province) do update set
  lgu_name = excluded.lgu_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

-- 4. Seed zero-baseline inventory reports linked directly to public.lgus via lgu_id
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
  now(),
  0, 0, 0, 0, 0, 0, 'Green',
  'Baseline initial inventory; awaiting incident report.'
from public.lgus l;

-- 5. Verification count query
select
  l.province,
  count(distinct l.id) as total_lgus,
  count(distinct r.id) as total_inventory_reports
from public.lgus l
left join public.lgu_inventory_reports r on r.lgu_id = l.id
group by l.province
order by l.province;