-- ==============================================================================
-- DSWD RELIEF SYSTEM: OPERATIONAL DATA RESET & ALL-PROVINCE LGU INVENTORY SEED
-- ==============================================================================
-- Instruction: Run this entire script in Supabase SQL Editor.
-- It cleans operational tables, preserves one admin user, and populates
-- baseline inventory reports for all 101 Panay Island & Guimaras municipalities.
-- ==============================================================================

-- 1. Clean operational tables (keeps table definitions, indexes, and triggers intact)
truncate table public.incoming_manifests cascade;
truncate table public.outgoing_requests cascade;
truncate table public.truck_live_locations cascade;
truncate table public.discrepancy_reports cascade;
truncate table public.lgu_inventory_reports cascade;

-- Reset batch and DR sequential counters
update public.app_counters set current_value = 0 where counter_name in ('batch_index', 'dr_index');

-- 2. Clean non-admin accounts from public.profiles (preserves one primary admin)
-- If you know the exact admin email, replace the email check below.
-- By default, this keeps the FIRST created DSWD Administrator.
delete from public.profiles
where id not in (
  select id from public.profiles
  where role = 'dswd_admin'
  order by created_at asc
  limit 1
);

-- Optional: If you also want to remove non-admin users from auth.users:
-- delete from auth.users where id not in (select id from public.profiles);

-- 3. Seed baseline inventory reports for ALL current provinces and municipalities
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
  ('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', now() - interval '0 hours', 735, 369, 266, 186, 13, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', now() - interval '1 hours', 665, 327, 238, 158, 14, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Anilao', 'Iloilo', 'Anilao Municipal Hall', now() - interval '2 hours', 236, 98, 83, 234, 39, 41, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', now() - interval '3 hours', 72, 26, 19, 400, 51, 68, 'Yellow', 'Prepare allocation; monitor within 24 hours.'),
  ('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', now() - interval '4 hours', 665, 327, 238, 158, 14, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Banate', 'Iloilo', 'Banate Municipal Hall', now() - interval '5 hours', 585, 279, 206, 126, 13, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', now() - interval '6 hours', 685, 339, 246, 166, 18, 18, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', now() - interval '7 hours', 690, 342, 248, 168, 19, 18, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Batad', 'Iloilo', 'Batad Municipal Hall', now() - interval '8 hours', 515, 237, 178, 98, 14, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', now() - interval '9 hours', 775, 393, 282, 202, 6, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', now() - interval '10 hours', 252, 106, 91, 258, 43, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Calinog', 'Iloilo', 'Calinog Municipal Hall', now() - interval '11 hours', 102, 41, 29, 525, 66, 76, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('Carles', 'Iloilo', 'Carles Municipal Hall', now() - interval '0 hours', 775, 393, 282, 202, 6, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', now() - interval '1 hours', 620, 300, 220, 140, 5, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dingle', 'Iloilo', 'Dingle Municipal Hall', now() - interval '2 hours', 256, 108, 93, 264, 44, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', now() - interval '3 hours', 260, 110, 95, 270, 45, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', now() - interval '4 hours', 620, 300, 220, 140, 5, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Estancia', 'Iloilo', 'Estancia Municipal Hall', now() - interval '5 hours', 780, 396, 284, 204, 7, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', now() - interval '6 hours', 510, 234, 176, 96, 13, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', now() - interval '7 hours', 66, 23, 17, 375, 48, 68, 'Yellow', 'Prepare allocation; monitor within 24 hours.'),
  ('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', now() - interval '8 hours', 670, 330, 240, 160, 15, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', now() - interval '9 hours', 296, 128, 113, 324, 54, 47, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', now() - interval '10 hours', 216, 88, 73, 204, 34, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Leganes', 'Iloilo', 'Leganes Municipal Hall', now() - interval '11 hours', 810, 414, 296, 216, 13, 18, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Lemery', 'Iloilo', 'Lemery Municipal Hall', now() - interval '0 hours', 730, 366, 264, 184, 12, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Leon', 'Iloilo', 'Leon Municipal Office', now() - interval '1 hours', 565, 267, 198, 118, 9, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Maasin', 'Iloilo', 'Maasin Municipal Hall', now() - interval '2 hours', 220, 90, 75, 210, 35, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', now() - interval '3 hours', 292, 126, 111, 318, 53, 47, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Mina', 'Iloilo', 'Mina Municipal Hall', now() - interval '4 hours', 735, 369, 266, 186, 13, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', now() - interval '5 hours', 228, 94, 79, 222, 37, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse', now() - interval '6 hours', 555, 261, 194, 114, 7, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Passi City', 'Iloilo', 'Passi City CDRRMO', now() - interval '7 hours', 725, 363, 262, 182, 11, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Pavia', 'Iloilo', 'Pavia Municipal Hall', now() - interval '8 hours', 805, 411, 294, 214, 12, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Pototan', 'Iloilo', 'Pototan Municipal Hall', now() - interval '9 hours', 288, 124, 109, 312, 52, 45, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', now() - interval '10 hours', 126, 53, 37, 625, 78, 82, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', now() - interval '11 hours', 795, 405, 290, 210, 10, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', now() - interval '0 hours', 800, 408, 292, 212, 11, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', now() - interval '1 hours', 720, 360, 260, 180, 10, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', now() - interval '2 hours', 725, 363, 262, 182, 11, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', now() - interval '3 hours', 292, 126, 111, 318, 53, 47, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sara', 'Iloilo', 'Sara Municipal Hall', now() - interval '4 hours', 725, 363, 262, 182, 11, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', now() - interval '5 hours', 725, 363, 262, 182, 11, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', now() - interval '6 hours', 730, 366, 264, 184, 12, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', now() - interval '7 hours', 580, 276, 204, 124, 12, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Anini-y', 'Antique', 'Anini-y Municipal Hall', now() - interval '8 hours', 710, 354, 256, 176, 8, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Barbaza', 'Antique', 'Barbaza Municipal Hall', now() - interval '9 hours', 120, 50, 35, 600, 75, 80, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('Belison', 'Antique', 'Belison Municipal Hall', now() - interval '10 hours', 126, 53, 37, 625, 78, 82, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('Bugasong', 'Antique', 'Bugasong Municipal Hall', now() - interval '11 hours', 276, 118, 103, 294, 49, 45, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Caluya', 'Antique', 'Caluya Municipal Hall', now() - interval '0 hours', 268, 114, 99, 282, 47, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Culasi', 'Antique', 'Culasi Municipal Hall', now() - interval '1 hours', 272, 116, 101, 288, 48, 45, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Hamtic', 'Antique', 'Hamtic Municipal Hall', now() - interval '2 hours', 740, 372, 268, 188, 14, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Laua-an', 'Antique', 'Laua-an Municipal Hall', now() - interval '3 hours', 264, 112, 97, 276, 46, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Libertad', 'Antique', 'Libertad Municipal Hall', now() - interval '4 hours', 540, 252, 188, 108, 19, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Pandan', 'Antique', 'Pandan Municipal Hall', now() - interval '5 hours', 495, 225, 170, 90, 10, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Patnongon', 'Antique', 'Patnongon Municipal Hall', now() - interval '6 hours', 755, 381, 274, 194, 17, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', now() - interval '7 hours', 640, 312, 228, 148, 9, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Remigio', 'Antique', 'San Remigio Municipal Hall', now() - interval '8 hours', 224, 92, 77, 216, 36, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sebaste', 'Antique', 'Sebaste Municipal Hall', now() - interval '9 hours', 565, 267, 198, 118, 9, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sibalom', 'Antique', 'Sibalom Municipal Hall', now() - interval '10 hours', 570, 270, 200, 120, 10, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tibiao', 'Antique', 'Tibiao Municipal Hall', now() - interval '11 hours', 645, 315, 230, 150, 10, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', now() - interval '0 hours', 72, 26, 19, 400, 51, 68, 'Yellow', 'Prepare allocation; monitor within 24 hours.'),
  ('Valderrama', 'Antique', 'Valderrama Municipal Hall', now() - interval '1 hours', 805, 411, 294, 214, 12, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Cuartero', 'Capiz', 'Cuartero Municipal Hall', now() - interval '2 hours', 695, 345, 250, 170, 5, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dao', 'Capiz', 'Dao Municipal Hall', now() - interval '3 hours', 248, 104, 89, 252, 42, 41, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dumalag', 'Capiz', 'Dumalag Municipal Hall', now() - interval '4 hours', 775, 393, 282, 202, 6, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Dumarao', 'Capiz', 'Dumarao Municipal Hall', now() - interval '5 hours', 780, 396, 284, 204, 7, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Ivisan', 'Capiz', 'Ivisan Municipal Hall', now() - interval '6 hours', 284, 122, 107, 306, 51, 45, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Jamindan', 'Capiz', 'Jamindan Municipal Hall', now() - interval '7 hours', 805, 411, 294, 214, 12, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Maayon', 'Capiz', 'Maayon Municipal Hall', now() - interval '8 hours', 605, 291, 214, 134, 17, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Mambusao', 'Capiz', 'Mambusao Municipal Hall', now() - interval '9 hours', 780, 396, 284, 204, 7, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Panay', 'Capiz', 'Panay Municipal Hall', now() - interval '10 hours', 495, 225, 170, 90, 10, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Panitan', 'Capiz', 'Panitan Municipal Hall', now() - interval '11 hours', 670, 330, 240, 160, 15, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Pilar', 'Capiz', 'Pilar Municipal Hall', now() - interval '0 hours', 505, 231, 174, 94, 12, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', now() - interval '1 hours', 252, 106, 91, 258, 43, 43, 'Green', 'Sufficient stock; continue monitoring.'),
  ('President Roxas', 'Capiz', 'President Roxas Municipal Hall', now() - interval '2 hours', 114, 47, 33, 575, 72, 78, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', now() - interval '3 hours', 755, 381, 274, 194, 17, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sapian', 'Capiz', 'Sapian Municipal Hall', now() - interval '4 hours', 575, 273, 202, 122, 11, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sigma', 'Capiz', 'Sigma Municipal Hall', now() - interval '5 hours', 495, 225, 170, 90, 10, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tapaz', 'Capiz', 'Tapaz Municipal Hall', now() - interval '6 hours', 655, 321, 234, 154, 12, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Altavas', 'Aklan', 'Altavas Municipal Hall', now() - interval '7 hours', 212, 86, 71, 198, 33, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Balete', 'Aklan', 'Balete Municipal Hall', now() - interval '8 hours', 272, 116, 101, 288, 48, 45, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Banga', 'Aklan', 'Banga Municipal Hall', now() - interval '9 hours', 208, 84, 69, 192, 32, 37, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Batan', 'Aklan', 'Batan Municipal Hall', now() - interval '10 hours', 212, 86, 71, 198, 33, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Buruanga', 'Aklan', 'Buruanga Municipal Hall', now() - interval '11 hours', 645, 315, 230, 150, 10, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Ibajay', 'Aklan', 'Ibajay Municipal Hall', now() - interval '0 hours', 565, 267, 198, 118, 9, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', now() - interval '1 hours', 208, 84, 69, 192, 32, 37, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Lezo', 'Aklan', 'Lezo Municipal Hall', now() - interval '2 hours', 120, 50, 35, 600, 75, 80, 'Red', 'Immediate restocking and dispatch recommended.'),
  ('Libacao', 'Aklan', 'Libacao Municipal Hall', now() - interval '3 hours', 630, 306, 224, 144, 7, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Madalag', 'Aklan', 'Madalag Municipal Hall', now() - interval '4 hours', 790, 402, 288, 208, 9, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Makato', 'Aklan', 'Makato Municipal Hall', now() - interval '5 hours', 710, 354, 256, 176, 8, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', now() - interval '6 hours', 630, 306, 224, 144, 7, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Malinao', 'Aklan', 'Malinao Municipal Hall', now() - interval '7 hours', 805, 411, 294, 214, 12, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Nabas', 'Aklan', 'Nabas Municipal Hall', now() - interval '8 hours', 795, 405, 290, 210, 10, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('New Washington', 'Aklan', 'New Washington Municipal Hall', now() - interval '9 hours', 565, 267, 198, 118, 9, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Numancia', 'Aklan', 'Numancia Municipal Hall', now() - interval '10 hours', 560, 264, 196, 116, 8, 14, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Tangalan', 'Aklan', 'Tangalan Municipal Hall', now() - interval '11 hours', 495, 225, 170, 90, 10, 13, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', now() - interval '0 hours', 780, 396, 284, 204, 7, 16, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', now() - interval '1 hours', 212, 86, 71, 198, 33, 39, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', now() - interval '2 hours', 590, 282, 208, 128, 14, 15, 'Green', 'Sufficient stock; continue monitoring.'),
  ('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', now() - interval '3 hours', 615, 297, 218, 138, 19, 17, 'Green', 'Sufficient stock; continue monitoring.'),
  ('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', now() - interval '4 hours', 780, 396, 284, 204, 7, 16, 'Green', 'Sufficient stock; continue monitoring.');

-- Verification count query:
select province, count(*) as total_municipalities, sum(food_packs) as total_food_packs
from public.lgu_inventory_reports
group by province
order by province;