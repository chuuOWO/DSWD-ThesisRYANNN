import type { LguRecord } from '../services/backendApi';

/**
 * Standard operational provinces for Region VI (Western Visayas).
 * Note: Geographic boundary polygons cover the Panay Island mainland (Aklan, Antique, Capiz, Iloilo),
 * while operational jurisdiction encompasses all six Region VI provinces including Guimaras and Negros Occidental.
 */
export const REGIONAL_PROVINCES = [
  'Aklan',
  'Antique',
  'Capiz',
  'Guimaras',
  'Iloilo',
  'Negros Occidental'
] as const;

export type RegionalProvince = typeof REGIONAL_PROVINCES[number];

/**
 * Normalizes an LGU or municipality string by removing noise prefixes,
 * facility suffixes, and extra punctuation to allow reliable string matching.
 */
export function normalizeLguName(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^lgu\s+of\s+/i, '')
    .replace(/^municipality\s+of\s+/i, '')
    .replace(/^city\s+of\s+/i, '')
    .replace(/^lgu\s+/i, '')
    .replace(/^provincial\s+government\s+of\s+/i, '')
    .replace(/\s+(municipal\s+hall|city\s+hall|drrm\s+office|drrmo|mdrrmo|cdrrmo|pdrrmo|evacuation\s+center|evacuation\s+gym|civic\s+center|terminal|gym|warehouse|office).*$/i, '')
    .replace(/[,\-./()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches an LGU query string against an authoritative list of database LGU records.
 * Uses exact match, spaceless matching, word tokens, and optional province filtering.
 */
export function findMatchingLgu(
  lgus: LguRecord[],
  query?: string | null,
  provinceFilter?: string | null
): LguRecord | undefined {
  if (!query || !query.trim() || !Array.isArray(lgus) || lgus.length === 0) {
    return undefined;
  }

  const rawLower = query.trim().toLowerCase();
  const normalizedQuery = normalizeLguName(query);
  const spacelessQuery = normalizedQuery.replace(/\s+/g, '');
  const provFilterLower = provinceFilter ? provinceFilter.trim().toLowerCase() : null;

  let bestMatch: LguRecord | undefined = undefined;
  let bestScore = 0;

  for (const item of lgus) {
    const itemMuni = (item.municipality || '').trim();
    const itemProv = (item.province || '').trim();
    const itemLguName = (item.lguName || '').trim();

    const muniLower = itemMuni.toLowerCase();
    const provLower = itemProv.toLowerCase();
    const lguNameLower = itemLguName.toLowerCase();

    const normalizedMuni = normalizeLguName(itemMuni);
    const spacelessMuni = normalizedMuni.replace(/\s+/g, '');

    const provMatches = provFilterLower ? provLower === provFilterLower : false;

    let score = 0;

    // 1. Exact raw match
    if (muniLower === rawLower || lguNameLower === rawLower) {
      score = 100;
    }
    // 2. Exact normalized match
    else if (normalizedMuni === normalizedQuery && normalizedMuni.length > 0) {
      score = 95;
    }
    // 3. Spaceless match (handles "Miagao" vs "Miag-ao", "PassiCity" vs "Passi City")
    else if (spacelessMuni === spacelessQuery && spacelessMuni.length > 0) {
      score = 90;
    }
    // 4. Token overlap match
    else if (normalizedQuery && normalizedMuni) {
      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
      const muniWords = normalizedMuni.split(/\s+/).filter(w => w.length > 2);

      const allMuniInQuery = muniWords.every(w => queryWords.includes(w));
      const allQueryInMuni = queryWords.every(w => muniWords.includes(w));

      if (allMuniInQuery && muniWords.length > 0) {
        score = 80;
      } else if (allQueryInMuni && queryWords.length > 0) {
        score = 75;
      } else if (queryWords.some(w => muniWords.includes(w))) {
        score = 60;
      }
    }
    // 5. Substring contains match
    else if (rawLower.includes(muniLower) || lguNameLower.includes(rawLower)) {
      score = 50;
    }

    if (score > 0) {
      // Province weighting bonus
      if (provMatches) score += 20;
      if (provFilterLower && !provMatches) score -= 30;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
  }

  return bestScore >= 50 ? bestMatch : undefined;
}

/**
 * Extracts a unique, sorted list of provinces from database LGU records.
 * Falls back to regional provinces if database list is empty.
 */
export function extractProvinces(lgus: LguRecord[]): string[] {
  if (!Array.isArray(lgus) || lgus.length === 0) {
    return [...REGIONAL_PROVINCES];
  }
  const set = new Set<string>();
  lgus.forEach(l => {
    if (l.province && l.province.trim()) {
      set.add(l.province.trim());
    }
  });
  const list = Array.from(set).sort();
  return list.length > 0 ? list : [...REGIONAL_PROVINCES];
}

/**
 * Groups municipality names by province from database LGU records.
 */
export function groupMunicipalitiesByProvince(lgus: LguRecord[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!Array.isArray(lgus)) return map;

  lgus.forEach(l => {
    const prov = l.province?.trim();
    const muni = l.municipality?.trim();
    if (!prov || !muni) return;
    if (!map[prov]) map[prov] = [];
    if (!map[prov].includes(muni)) {
      map[prov].push(muni);
    }
  });

  Object.keys(map).forEach(p => map[p].sort());
  return map;
}

export const DEFAULT_KIT_NAMES = [
  'Food Pack',
  'Hygiene Kit',
  'Sleeping Kit',
  'Kitchen Kit',
  'Family Kit',
  'Laminated Sack',
  'RTEF'
] as const;

export const DEFAULT_KIT_TYPES = [
  { id: 'kit-1', name: 'Food Pack', category: 'Food Item' as const, unitType: 'packs', description: 'Family Food Pack (6kg rice, canned goods, coffee, cereal)', isActive: true },
  { id: 'kit-2', name: 'Hygiene Kit', category: 'Non-Food Item' as const, unitType: 'kits', description: 'Toothpaste, toothbrushes, bath soap, detergent, sanitary pads', isActive: true },
  { id: 'kit-3', name: 'Sleeping Kit', category: 'Non-Food Item' as const, unitType: 'kits', description: 'Blankets, sleeping mats, mosquito nets, pillowcases', isActive: true },
  { id: 'kit-4', name: 'Kitchen Kit', category: 'Non-Food Item' as const, unitType: 'kits', description: 'Cooking pots, frying pan, plates, cups, spoons, forks', isActive: true },
  { id: 'kit-5', name: 'Family Kit', category: 'Non-Food Item' as const, unitType: 'kits', description: 'Clothing apparel, bath towels, footwear for families', isActive: true },
  { id: 'kit-6', name: 'Laminated Sack', category: 'Non-Food Item' as const, unitType: 'sacks', description: 'Heavy-duty weatherproofing tarpaulins for temporary roof shelters', isActive: true },
  { id: 'kit-7', name: 'RTEF', category: 'Food Item' as const, unitType: 'packs', description: 'Ready-to-Eat Food / pre-cooked retort pouch meals', isActive: true }
];

export const DEFAULT_WAREHOUSES = [
  { id: 'wh-oton', name: 'Oton Main Warehouse', municipality: 'Oton', province: 'Iloilo', region: 'Region VI (Western Visayas)', latitude: 10.6975, longitude: 122.4764, capacityPacks: 100000, currentStock: {}, isActive: true },
  { id: 'wh-pototan', name: 'Pototan Main Warehouse', municipality: 'Pototan', province: 'Iloilo', region: 'Region VI (Western Visayas)', latitude: 10.9486, longitude: 122.6272, capacityPacks: 80000, currentStock: {}, isActive: true }
];

export const DEFAULT_SUPPLY_SOURCES = [
  { id: 'src-vdrc', name: 'Visayas Disaster Resource Center', shortCode: 'VDRC', facilityType: 'National Resource Center', region: 'Region VII (Central Visayas)', location: 'Mandaue City, Cebu', isActive: true },
  { id: 'src-ldrc', name: 'Luzon Disaster Resource Center', shortCode: 'LDRC', facilityType: 'National Resource Center', region: 'Region III (Central Luzon)', location: 'Clark, Pampanga', isActive: true }
];

export const DEFAULT_PROVINCES = [
  { id: 'prov-aklan', name: 'Aklan', region: 'Region VI (Western Visayas)', isActive: true },
  { id: 'prov-antique', name: 'Antique', region: 'Region VI (Western Visayas)', isActive: true },
  { id: 'prov-capiz', name: 'Capiz', region: 'Region VI (Western Visayas)', isActive: true },
  { id: 'prov-guimaras', name: 'Guimaras', region: 'Region VI (Western Visayas)', isActive: true },
  { id: 'prov-iloilo', name: 'Iloilo', region: 'Region VI (Western Visayas)', isActive: true },
  { id: 'prov-negros', name: 'Negros Occidental', region: 'Region VI (Western Visayas)', isActive: true }
];

const createDefaultLgu = (
  municipality: string,
  province: string,
  lguName: string,
  latitude: number,
  longitude: number
): LguRecord => ({
  id: `lgu-${province.toLowerCase()}-${municipality.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  municipality,
  province,
  lguName,
  latitude,
  longitude,
  isActive: true,
  foodPacks: 0,
  hygieneKits: 0,
  sleepingKits: 0,
  kitchenKits: 0,
  familyKits: 0,
  laminatedSacks: 0,
  rtef: 0,
  currentStock: {
    'Food Pack': 0,
    'Hygiene Kit': 0,
    'Sleeping Kit': 0,
    'Kitchen Kit': 0,
    'Family Kit': 0,
    'Laminated Sack': 0,
    'RTEF': 0
  },
  urgencyScore: 20,
  priorityColor: 'Green',
  recommendation: 'Stable baseline stock',
  lastReportedAt: new Date().toISOString()
});

export const DEFAULT_PANAY_LGUS: LguRecord[] = [
  // --- ILOILO (44 LGUs) ---
  createDefaultLgu('Ajuy', 'Iloilo', 'Ajuy Municipal Hall / DRRM Office', 11.1714, 122.9818),
  createDefaultLgu('Alimodian', 'Iloilo', 'Alimodian Municipal Hall', 10.8202, 122.4332),
  createDefaultLgu('Anilao', 'Iloilo', 'Anilao Municipal Hall', 10.9856, 122.7533),
  createDefaultLgu('Badiangan', 'Iloilo', 'Badiangan Municipal Hall', 10.9634, 122.5312),
  createDefaultLgu('Balasan', 'Iloilo', 'Balasan Municipal Civic Center', 11.4721, 123.0847),
  createDefaultLgu('Banate', 'Iloilo', 'Banate Municipal Hall', 11.0022, 122.8174),
  createDefaultLgu('Barotac Nuevo', 'Iloilo', 'Barotac Nuevo Municipal Hall', 10.8931, 122.7027),
  createDefaultLgu('Barotac Viejo', 'Iloilo', 'Barotac Viejo Municipal Hall', 11.0503, 122.8466),
  createDefaultLgu('Batad', 'Iloilo', 'Batad Municipal Hall', 11.4167, 123.0833),
  createDefaultLgu('Bingawan', 'Iloilo', 'Bingawan Municipal Hall', 11.2036, 122.5639),
  createDefaultLgu('Cabatuan', 'Iloilo', 'Cabatuan Municipal Hall', 10.8794, 122.4856),
  createDefaultLgu('Calinog', 'Iloilo', 'Calinog Municipal Hall', 11.1242, 122.4939),
  createDefaultLgu('Carles', 'Iloilo', 'Carles Municipal Hall', 11.5833, 123.1667),
  createDefaultLgu('Concepcion', 'Iloilo', 'Concepcion Municipal Hall', 11.2189, 123.1111),
  createDefaultLgu('Dingle', 'Iloilo', 'Dingle Municipal Hall', 11.0000, 122.6667),
  createDefaultLgu('Dueñas', 'Iloilo', 'Dueñas Municipal Hall', 11.0667, 122.6167),
  createDefaultLgu('Dumangas', 'Iloilo', 'Dumangas Municipal Hall', 10.8333, 122.7167),
  createDefaultLgu('Estancia', 'Iloilo', 'Estancia Municipal Hall', 11.4556, 123.1528),
  createDefaultLgu('Guimbal', 'Iloilo', 'Guimbal Municipal Hall', 10.6600, 122.3167),
  createDefaultLgu('Igbaras', 'Iloilo', 'Igbaras Municipal Hall', 10.7167, 122.2667),
  createDefaultLgu('Iloilo City', 'Iloilo', 'Iloilo City Hall / CDRRMO', 10.7202, 122.5621),
  createDefaultLgu('Janiuay', 'Iloilo', 'Janiuay Municipal Hall', 10.9500, 122.5000),
  createDefaultLgu('Lambunao', 'Iloilo', 'Lambunao Municipal Hall', 11.0500, 122.4833),
  createDefaultLgu('Leganes', 'Iloilo', 'Leganes Municipal Hall', 10.7833, 122.5833),
  createDefaultLgu('Lemery', 'Iloilo', 'Lemery Municipal Hall', 11.2333, 122.9167),
  createDefaultLgu('Leon', 'Iloilo', 'Leon Municipal Office', 10.7819, 122.3831),
  createDefaultLgu('Maasin', 'Iloilo', 'Maasin Municipal Hall', 10.8833, 122.4333),
  createDefaultLgu('Miag-ao', 'Iloilo', 'Miag-ao Municipal Evacuation Center', 10.6415, 122.2352),
  createDefaultLgu('Mina', 'Iloilo', 'Mina Municipal Hall', 10.9333, 122.5833),
  createDefaultLgu('New Lucena', 'Iloilo', 'New Lucena Municipal Hall', 10.8833, 122.6000),
  createDefaultLgu('Oton', 'Iloilo', 'DSWD Oton Regional Warehouse', 10.6975, 122.4764),
  createDefaultLgu('Passi City', 'Iloilo', 'Passi City CDRRMO', 11.1067, 122.6417),
  createDefaultLgu('Pavia', 'Iloilo', 'Pavia Municipal Hall', 10.7764, 122.5400),
  createDefaultLgu('Pototan', 'Iloilo', 'Pototan Municipal Hall', 10.9486, 122.6272),
  createDefaultLgu('San Dionisio', 'Iloilo', 'San Dionisio Municipal Hall', 11.3667, 123.0833),
  createDefaultLgu('San Enrique', 'Iloilo', 'San Enrique Municipal Hall', 11.0833, 122.6500),
  createDefaultLgu('San Joaquin', 'Iloilo', 'San Joaquin Municipal Hall', 10.5833, 122.1333),
  createDefaultLgu('San Miguel', 'Iloilo', 'San Miguel Municipal Hall', 10.7833, 122.4667),
  createDefaultLgu('San Rafael', 'Iloilo', 'San Rafael Municipal Hall', 11.1667, 122.8333),
  createDefaultLgu('Santa Barbara', 'Iloilo', 'Santa Barbara Municipal Hall', 10.8200, 122.5333),
  createDefaultLgu('Sara', 'Iloilo', 'Sara Municipal Hall', 11.2667, 123.0167),
  createDefaultLgu('Tigbauan', 'Iloilo', 'Tigbauan Municipal Hall', 10.6750, 122.3806),
  createDefaultLgu('Tubungan', 'Iloilo', 'Tubungan Municipal Hall', 10.7500, 122.3333),
  createDefaultLgu('Zarraga', 'Iloilo', 'Zarraga Municipal Hall', 10.8200, 122.6100),

  // --- ANTIQUE (18 LGUs) ---
  createDefaultLgu('Anini-y', 'Antique', 'Anini-y Municipal Hall', 10.4333, 121.9333),
  createDefaultLgu('Barbaza', 'Antique', 'Barbaza Municipal Hall', 11.2167, 122.0667),
  createDefaultLgu('Belison', 'Antique', 'Belison Municipal Hall', 10.8333, 121.9667),
  createDefaultLgu('Bugasong', 'Antique', 'Bugasong Municipal Hall', 11.0333, 122.0667),
  createDefaultLgu('Caluya', 'Antique', 'Caluya Municipal Hall', 11.9167, 121.5667),
  createDefaultLgu('Culasi', 'Antique', 'Culasi Municipal Hall', 11.4333, 122.0500),
  createDefaultLgu('Hamtic', 'Antique', 'Hamtic Municipal Hall', 10.7000, 121.9833),
  createDefaultLgu('Laua-an', 'Antique', 'Laua-an Municipal Hall', 11.1500, 122.0500),
  createDefaultLgu('Libertad', 'Antique', 'Libertad Municipal Hall', 11.7667, 121.9167),
  createDefaultLgu('Pandan', 'Antique', 'Pandan Municipal Hall', 11.7167, 122.1000),
  createDefaultLgu('Patnongon', 'Antique', 'Patnongon Municipal Hall', 10.9167, 121.9833),
  createDefaultLgu('San Jose', 'Antique', 'San Jose de Buenavista Capital Hall', 10.7500, 121.9500),
  createDefaultLgu('San Remigio', 'Antique', 'San Remigio Municipal Hall', 10.8000, 122.0833),
  createDefaultLgu('Sebaste', 'Antique', 'Sebaste Municipal Hall', 11.5833, 122.1000),
  createDefaultLgu('Sibalom', 'Antique', 'Sibalom Municipal Hall', 10.7833, 122.0167),
  createDefaultLgu('Tibiao', 'Antique', 'Tibiao Municipal Hall', 11.2833, 122.0333),
  createDefaultLgu('Tobias Fornier', 'Antique', 'Tobias Fornier (Dao) Municipal Hall', 10.5167, 121.9333),
  createDefaultLgu('Valderrama', 'Antique', 'Valderrama Municipal Hall', 11.0000, 122.1333),

  // --- CAPIZ (17 LGUs) ---
  createDefaultLgu('Cuartero', 'Capiz', 'Cuartero Municipal Hall', 11.3500, 122.6833),
  createDefaultLgu('Dao', 'Capiz', 'Dao Municipal Hall', 11.3833, 122.6833),
  createDefaultLgu('Dumalag', 'Capiz', 'Dumalag Municipal Hall', 11.3000, 122.6167),
  createDefaultLgu('Dumarao', 'Capiz', 'Dumarao Municipal Hall', 11.2667, 122.7000),
  createDefaultLgu('Ivisan', 'Capiz', 'Ivisan Municipal Hall', 11.5167, 122.7000),
  createDefaultLgu('Jamindan', 'Capiz', 'Jamindan Municipal Hall', 11.4500, 122.4833),
  createDefaultLgu('Maayon', 'Capiz', 'Maayon Municipal Hall', 11.3667, 122.7833),
  createDefaultLgu('Mambusao', 'Capiz', 'Mambusao Municipal Hall', 11.4333, 122.6000),
  createDefaultLgu('Panay', 'Capiz', 'Panay Municipal Hall', 11.5667, 122.8000),
  createDefaultLgu('Panitan', 'Capiz', 'Panitan Municipal Hall', 11.4667, 122.7667),
  createDefaultLgu('Pilar', 'Capiz', 'Pilar Municipal Hall', 11.4833, 122.9833),
  createDefaultLgu('Pontevedra', 'Capiz', 'Pontevedra Municipal Hall', 11.4667, 122.8333),
  createDefaultLgu('President Roxas', 'Capiz', 'President Roxas Municipal Hall', 11.4333, 122.9333),
  createDefaultLgu('Roxas City', 'Capiz', 'Roxas City CDRRMO Hall', 11.5853, 122.7511),
  createDefaultLgu('Sapian', 'Capiz', 'Sapian Municipal Hall', 11.5000, 122.6000),
  createDefaultLgu('Sigma', 'Capiz', 'Sigma Municipal Hall', 11.4167, 122.6667),
  createDefaultLgu('Tapaz', 'Capiz', 'Tapaz Municipal Hall', 11.2667, 122.5333),

  // --- AKLAN (17 LGUs) ---
  createDefaultLgu('Altavas', 'Aklan', 'Altavas Municipal Hall', 11.5333, 122.4833),
  createDefaultLgu('Balete', 'Aklan', 'Balete Municipal Hall', 11.5500, 122.3833),
  createDefaultLgu('Banga', 'Aklan', 'Banga Municipal Hall', 11.6333, 122.3333),
  createDefaultLgu('Batan', 'Aklan', 'Batan Municipal Hall', 11.5833, 122.5000),
  createDefaultLgu('Buruanga', 'Aklan', 'Buruanga Municipal Hall', 11.8333, 121.9000),
  createDefaultLgu('Ibajay', 'Aklan', 'Ibajay Municipal Hall', 11.8167, 122.1667),
  createDefaultLgu('Kalibo', 'Aklan', 'Kalibo Municipal Hall / MDRRMO', 11.7078, 122.3637),
  createDefaultLgu('Lezo', 'Aklan', 'Lezo Municipal Hall', 11.6667, 122.3333),
  createDefaultLgu('Libacao', 'Aklan', 'Libacao Municipal Hall', 11.4667, 122.3000),
  createDefaultLgu('Madalag', 'Aklan', 'Madalag Municipal Hall', 11.5167, 122.3000),
  createDefaultLgu('Makato', 'Aklan', 'Makato Municipal Hall', 11.7167, 122.2833),
  createDefaultLgu('Malay', 'Aklan', 'Malay Municipal Hall (Boracay Hub)', 11.9000, 121.9167),
  createDefaultLgu('Malinao', 'Aklan', 'Malinao Municipal Hall', 11.6500, 122.3167),
  createDefaultLgu('Nabas', 'Aklan', 'Nabas Municipal Hall', 11.8333, 122.0667),
  createDefaultLgu('New Washington', 'Aklan', 'New Washington Municipal Hall', 11.6500, 122.4333),
  createDefaultLgu('Numancia', 'Aklan', 'Numancia Municipal Hall', 11.7167, 122.3333),
  createDefaultLgu('Tangalan', 'Aklan', 'Tangalan Municipal Hall', 11.7833, 122.2500),

  // --- GUIMARAS (5 LGUs) ---
  createDefaultLgu('Jordan', 'Guimaras', 'Jordan Municipal Hall / PDRRMO', 10.6586, 122.5939),
  createDefaultLgu('Buenavista', 'Guimaras', 'Buenavista Municipal Hall', 10.6833, 122.6167),
  createDefaultLgu('Nueva Valencia', 'Guimaras', 'Nueva Valencia Municipal Hall', 10.5167, 122.5333),
  createDefaultLgu('San Lorenzo', 'Guimaras', 'San Lorenzo Municipal Hall', 10.6000, 122.6833),
  createDefaultLgu('Sibunag', 'Guimaras', 'Sibunag Municipal Hall', 10.5500, 122.6167),

  // --- NEGROS OCCIDENTAL (Regional Capital) ---
  createDefaultLgu('Bacolod City', 'Negros Occidental', 'Bacolod City CDRRMO Hall', 10.6765, 122.9509)
];


