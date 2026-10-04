export interface LguLocation {
  municipality: string;
  province: string;
  lat: number;
  lng: number;
  defaultFacility: string;
  aliases?: string[];
}

export const PANAY_LGUS: LguLocation[] = [
  // --- ILOILO (43 Municipalities + Iloilo City + Passi City) ---
  { municipality: 'Ajuy', province: 'Iloilo', lat: 11.1714, lng: 122.9818, defaultFacility: 'Ajuy Municipal Hall / DRRM Office', aliases: ['ajuy iloilo'] },
  { municipality: 'Alimodian', province: 'Iloilo', lat: 10.8202, lng: 122.4332, defaultFacility: 'Alimodian Municipal Hall', aliases: ['alimodian iloilo'] },
  { municipality: 'Anilao', province: 'Iloilo', lat: 10.9856, lng: 122.7533, defaultFacility: 'Anilao Municipal Hall', aliases: ['anilao iloilo'] },
  { municipality: 'Badiangan', province: 'Iloilo', lat: 10.9634, lng: 122.5312, defaultFacility: 'Badiangan Municipal Hall', aliases: ['badiangan iloilo'] },
  { municipality: 'Balasan', province: 'Iloilo', lat: 11.4721, lng: 123.0847, defaultFacility: 'Balasan Municipal Civic Center', aliases: ['balasan iloilo'] },
  { municipality: 'Banate', province: 'Iloilo', lat: 11.0022, lng: 122.8174, defaultFacility: 'Banate Municipal Hall', aliases: ['banate iloilo'] },
  { municipality: 'Barotac Nuevo', province: 'Iloilo', lat: 10.8931, lng: 122.7027, defaultFacility: 'Barotac Nuevo Municipal Hall', aliases: ['barotac nuevo iloilo'] },
  { municipality: 'Barotac Viejo', province: 'Iloilo', lat: 11.0503, lng: 122.8466, defaultFacility: 'Barotac Viejo Municipal Hall', aliases: ['barotac viejo iloilo'] },
  { municipality: 'Batad', province: 'Iloilo', lat: 11.4167, lng: 123.0833, defaultFacility: 'Batad Municipal Hall', aliases: ['batad iloilo'] },
  { municipality: 'Bingawan', province: 'Iloilo', lat: 11.2036, lng: 122.5639, defaultFacility: 'Bingawan Municipal Hall', aliases: ['bingawan iloilo'] },
  { municipality: 'Cabatuan', province: 'Iloilo', lat: 10.8794, lng: 122.4856, defaultFacility: 'Cabatuan Municipal Hall', aliases: ['cabatuan iloilo'] },
  { municipality: 'Calinog', province: 'Iloilo', lat: 11.1242, lng: 122.4939, defaultFacility: 'Calinog Municipal Hall', aliases: ['calinog iloilo'] },
  { municipality: 'Carles', province: 'Iloilo', lat: 11.5833, lng: 123.1667, defaultFacility: 'Carles Municipal Hall', aliases: ['carles iloilo', 'gigantes'] },
  { municipality: 'Concepcion', province: 'Iloilo', lat: 11.2189, lng: 123.1111, defaultFacility: 'Concepcion Municipal Hall', aliases: ['concepcion iloilo'] },
  { municipality: 'Dingle', province: 'Iloilo', lat: 11.0000, lng: 122.6667, defaultFacility: 'Dingle Municipal Hall', aliases: ['dingle iloilo'] },
  { municipality: 'Dueñas', province: 'Iloilo', lat: 11.0667, lng: 122.6167, defaultFacility: 'Dueñas Municipal Hall', aliases: ['duenas', 'dueñas iloilo', 'duenas iloilo'] },
  { municipality: 'Dumangas', province: 'Iloilo', lat: 10.8333, lng: 122.7167, defaultFacility: 'Dumangas Municipal Hall', aliases: ['dumangas iloilo'] },
  { municipality: 'Estancia', province: 'Iloilo', lat: 11.4556, lng: 123.1528, defaultFacility: 'Estancia Municipal Hall', aliases: ['estancia iloilo'] },
  { municipality: 'Guimbal', province: 'Iloilo', lat: 10.6600, lng: 122.3167, defaultFacility: 'Guimbal Municipal Hall', aliases: ['guimbal iloilo'] },
  { municipality: 'Igbaras', province: 'Iloilo', lat: 10.7167, lng: 122.2667, defaultFacility: 'Igbaras Municipal Hall', aliases: ['igbaras iloilo'] },
  { municipality: 'Iloilo City', province: 'Iloilo', lat: 10.7202, lng: 122.5621, defaultFacility: 'Iloilo City Hall / CDRRMO', aliases: ['iloilo', 'iloilo city proper', 'city of iloilo'] },
  { municipality: 'Janiuay', province: 'Iloilo', lat: 10.9500, lng: 122.5000, defaultFacility: 'Janiuay Municipal Hall', aliases: ['janiuay iloilo'] },
  { municipality: 'Lambunao', province: 'Iloilo', lat: 11.0500, lng: 122.4833, defaultFacility: 'Lambunao Municipal Hall', aliases: ['lambunao iloilo'] },
  { municipality: 'Leganes', province: 'Iloilo', lat: 10.7833, lng: 122.5833, defaultFacility: 'Leganes Municipal Hall', aliases: ['leganes iloilo'] },
  { municipality: 'Lemery', province: 'Iloilo', lat: 11.2333, lng: 122.9167, defaultFacility: 'Lemery Municipal Hall', aliases: ['lemery iloilo'] },
  { municipality: 'Leon', province: 'Iloilo', lat: 10.7819, lng: 122.3831, defaultFacility: 'Leon Municipal Office', aliases: ['leon iloilo', 'lgu leon', 'leon terminal'] },
  { municipality: 'Maasin', province: 'Iloilo', lat: 10.8833, lng: 122.4333, defaultFacility: 'Maasin Municipal Hall', aliases: ['maasin iloilo'] },
  { municipality: 'Miag-ao', province: 'Iloilo', lat: 10.6415, lng: 122.2352, defaultFacility: 'Miag-ao Municipal Evacuation Center', aliases: ['miagao', 'miag ao', 'miag-ao iloilo', 'miagao iloilo'] },
  { municipality: 'Mina', province: 'Iloilo', lat: 10.9333, lng: 122.5833, defaultFacility: 'Mina Municipal Hall', aliases: ['mina iloilo'] },
  { municipality: 'New Lucena', province: 'Iloilo', lat: 10.8833, lng: 122.6000, defaultFacility: 'New Lucena Municipal Hall', aliases: ['new lucena iloilo'] },
  { municipality: 'Oton', province: 'Iloilo', lat: 10.6975, lng: 122.4764, defaultFacility: 'DSWD Oton Regional Warehouse', aliases: ['oton iloilo', 'oton warehouse'] },
  { municipality: 'Passi City', province: 'Iloilo', lat: 11.1067, lng: 122.6417, defaultFacility: 'Passi City CDRRMO', aliases: ['passi', 'passi iloilo', 'city of passi'] },
  { municipality: 'Pavia', province: 'Iloilo', lat: 10.7764, lng: 122.5400, defaultFacility: 'Pavia Municipal Hall', aliases: ['pavia iloilo'] },
  { municipality: 'Pototan', province: 'Iloilo', lat: 10.9486, lng: 122.6272, defaultFacility: 'Pototan Municipal Hall', aliases: ['pototan iloilo', 'pototan warehouse'] },
  { municipality: 'San Dionisio', province: 'Iloilo', lat: 11.3667, lng: 123.0833, defaultFacility: 'San Dionisio Municipal Hall', aliases: ['san dionisio iloilo'] },
  { municipality: 'San Enrique', province: 'Iloilo', lat: 11.0833, lng: 122.6500, defaultFacility: 'San Enrique Municipal Hall', aliases: ['san enrique iloilo'] },
  { municipality: 'San Joaquin', province: 'Iloilo', lat: 10.5833, lng: 122.1333, defaultFacility: 'San Joaquin Municipal Hall', aliases: ['san joaquin iloilo'] },
  { municipality: 'San Miguel', province: 'Iloilo', lat: 10.7833, lng: 122.4667, defaultFacility: 'San Miguel Municipal Hall', aliases: ['san miguel iloilo'] },
  { municipality: 'San Rafael', province: 'Iloilo', lat: 11.1667, lng: 122.8333, defaultFacility: 'San Rafael Municipal Hall', aliases: ['san rafael iloilo'] },
  { municipality: 'Santa Barbara', province: 'Iloilo', lat: 10.8200, lng: 122.5333, defaultFacility: 'Santa Barbara Municipal Hall', aliases: ['sta barbara', 'sta. barbara', 'santa barbara iloilo', 'sta. barbara iloilo'] },
  { municipality: 'Sara', province: 'Iloilo', lat: 11.2667, lng: 123.0167, defaultFacility: 'Sara Municipal Hall', aliases: ['sara iloilo'] },
  { municipality: 'Tigbauan', province: 'Iloilo', lat: 10.6750, lng: 122.3806, defaultFacility: 'Tigbauan Municipal Hall', aliases: ['tigbauan iloilo'] },
  { municipality: 'Tubungan', province: 'Iloilo', lat: 10.7500, lng: 122.3333, defaultFacility: 'Tubungan Municipal Hall', aliases: ['tubungan iloilo'] },
  { municipality: 'Zarraga', province: 'Iloilo', lat: 10.8200, lng: 122.6100, defaultFacility: 'Zarraga Municipal Hall', aliases: ['zarraga iloilo'] },

  // --- ANTIQUE (18 Municipalities) ---
  { municipality: 'Anini-y', province: 'Antique', lat: 10.4333, lng: 121.9333, defaultFacility: 'Anini-y Municipal Hall', aliases: ['aniniy', 'anini y', 'anini-y antique', 'aniniy antique'] },
  { municipality: 'Barbaza', province: 'Antique', lat: 11.2167, lng: 122.0667, defaultFacility: 'Barbaza Municipal Hall', aliases: ['barbaza antique'] },
  { municipality: 'Belison', province: 'Antique', lat: 10.8333, lng: 121.9667, defaultFacility: 'Belison Municipal Hall', aliases: ['belison antique'] },
  { municipality: 'Bugasong', province: 'Antique', lat: 11.0500, lng: 122.0667, defaultFacility: 'Bugasong Municipal Hall', aliases: ['bugasong antique'] },
  { municipality: 'Caluya', province: 'Antique', lat: 11.9167, lng: 121.5667, defaultFacility: 'Caluya Municipal Hall', aliases: ['caluya antique', 'semirara'] },
  { municipality: 'Culasi', province: 'Antique', lat: 11.4333, lng: 122.0667, defaultFacility: 'Culasi Municipal Hall', aliases: ['culasi antique'] },
  { municipality: 'Hamtic', province: 'Antique', lat: 10.7000, lng: 121.9833, defaultFacility: 'Hamtic Municipal Hall', aliases: ['hamtic antique'] },
  { municipality: 'Laua-an', province: 'Antique', lat: 11.1500, lng: 122.0500, defaultFacility: 'Laua-an Municipal Hall', aliases: ['lauaan', 'laua an', 'laua-an antique'] },
  { municipality: 'Libertad', province: 'Antique', lat: 12.0333, lng: 121.9167, defaultFacility: 'Libertad Municipal Hall', aliases: ['libertad antique'] },
  { municipality: 'Pandan', province: 'Antique', lat: 11.7167, lng: 122.1000, defaultFacility: 'Pandan Municipal Hall', aliases: ['pandan antique'] },
  { municipality: 'Patnongon', province: 'Antique', lat: 10.9167, lng: 121.9833, defaultFacility: 'Patnongon Municipal Hall', aliases: ['patnongon antique'] },
  { municipality: 'San Jose', province: 'Antique', lat: 10.7500, lng: 121.9500, defaultFacility: 'San Jose de Buenavista Capital Hall', aliases: ['san jose de buenavista', 'san jose antique', 'san jose de buenavista antique'] },
  { municipality: 'San Remigio', province: 'Antique', lat: 10.7833, lng: 122.0833, defaultFacility: 'San Remigio Municipal Hall', aliases: ['san remigio antique'] },
  { municipality: 'Sebaste', province: 'Antique', lat: 11.5833, lng: 122.0833, defaultFacility: 'Sebaste Municipal Hall', aliases: ['sebaste antique'] },
  { municipality: 'Sibalom', province: 'Antique', lat: 10.7833, lng: 122.0167, defaultFacility: 'Sibalom Municipal Hall', aliases: ['sibalom antique'] },
  { municipality: 'Tibiao', province: 'Antique', lat: 11.2833, lng: 122.0333, defaultFacility: 'Tibiao Municipal Hall', aliases: ['tibiao antique'] },
  { municipality: 'Tobias Fornier', province: 'Antique', lat: 10.5167, lng: 121.9333, defaultFacility: 'Tobias Fornier (Dao) Municipal Hall', aliases: ['dao antique', 'tobias fornier dao', 'dao (tobias fornier)', 'dao, antique'] },
  { municipality: 'Valderrama', province: 'Antique', lat: 11.0000, lng: 122.1333, defaultFacility: 'Valderrama Municipal Hall', aliases: ['valderrama antique'] },

  // --- CAPIZ (16 Municipalities + Roxas City) ---
  { municipality: 'Cuartero', province: 'Capiz', lat: 11.3500, lng: 122.6833, defaultFacility: 'Cuartero Municipal Hall', aliases: ['cuartero capiz'] },
  { municipality: 'Dao', province: 'Capiz', lat: 11.3833, lng: 122.6833, defaultFacility: 'Dao Municipal Hall', aliases: ['dao capiz', 'dao, capiz'] },
  { municipality: 'Dumalag', province: 'Capiz', lat: 11.3000, lng: 122.6167, defaultFacility: 'Dumalag Municipal Hall', aliases: ['dumalag capiz'] },
  { municipality: 'Dumarao', province: 'Capiz', lat: 11.2667, lng: 122.7000, defaultFacility: 'Dumarao Municipal Hall', aliases: ['dumarao capiz'] },
  { municipality: 'Ivisan', province: 'Capiz', lat: 11.5167, lng: 122.7000, defaultFacility: 'Ivisan Municipal Hall', aliases: ['ivisan capiz'] },
  { municipality: 'Jamindan', province: 'Capiz', lat: 11.4333, lng: 122.4833, defaultFacility: 'Jamindan Municipal Hall', aliases: ['jamindan capiz'] },
  { municipality: 'Maayon', province: 'Capiz', lat: 11.3833, lng: 122.7833, defaultFacility: 'Maayon Municipal Hall', aliases: ['maayon capiz'] },
  { municipality: 'Mambusao', province: 'Capiz', lat: 11.4333, lng: 122.6000, defaultFacility: 'Mambusao Municipal Hall', aliases: ['mambusao capiz'] },
  { municipality: 'Panay', province: 'Capiz', lat: 11.5500, lng: 122.8000, defaultFacility: 'Panay Municipal Hall', aliases: ['panay capiz'] },
  { municipality: 'Panitan', province: 'Capiz', lat: 11.4667, lng: 122.7667, defaultFacility: 'Panitan Municipal Hall', aliases: ['panitan capiz'] },
  { municipality: 'Pilar', province: 'Capiz', lat: 11.4833, lng: 122.9833, defaultFacility: 'Pilar Municipal Hall', aliases: ['pilar capiz'] },
  { municipality: 'Pontevedra', province: 'Capiz', lat: 11.4833, lng: 122.8500, defaultFacility: 'Pontevedra Municipal Hall', aliases: ['pontevedra capiz'] },
  { municipality: 'President Roxas', province: 'Capiz', lat: 11.4333, lng: 122.9333, defaultFacility: 'President Roxas Municipal Hall', aliases: ['pres roxas', 'pres. roxas', 'president roxas capiz', 'pres roxas capiz'] },
  { municipality: 'Roxas City', province: 'Capiz', lat: 11.5853, lng: 122.7511, defaultFacility: 'Roxas City CDRRMO Hall', aliases: ['roxas', 'roxas capiz', 'city of roxas'] },
  { municipality: 'Sapian', province: 'Capiz', lat: 11.5000, lng: 122.6000, defaultFacility: 'Sapian Municipal Hall', aliases: ['sapian capiz'] },
  { municipality: 'Sigma', province: 'Capiz', lat: 11.4167, lng: 122.6667, defaultFacility: 'Sigma Municipal Hall', aliases: ['sigma capiz', 'lgu sigma', 'sigma terminal'] },
  { municipality: 'Tapaz', province: 'Capiz', lat: 11.2667, lng: 122.5333, defaultFacility: 'Tapaz Municipal Hall', aliases: ['tapaz capiz'] },

  // --- AKLAN (17 Municipalities) ---
  { municipality: 'Altavas', province: 'Aklan', lat: 11.5333, lng: 122.5000, defaultFacility: 'Altavas Municipal Hall', aliases: ['altavas aklan'] },
  { municipality: 'Balete', province: 'Aklan', lat: 11.5500, lng: 122.3833, defaultFacility: 'Balete Municipal Hall', aliases: ['balete aklan'] },
  { municipality: 'Banga', province: 'Aklan', lat: 11.6333, lng: 122.3333, defaultFacility: 'Banga Municipal Hall', aliases: ['banga aklan'] },
  { municipality: 'Batan', province: 'Aklan', lat: 11.5833, lng: 122.5000, defaultFacility: 'Batan Municipal Hall', aliases: ['batan aklan'] },
  { municipality: 'Buruanga', province: 'Aklan', lat: 11.8333, lng: 121.8833, defaultFacility: 'Buruanga Municipal Hall', aliases: ['buruanga aklan'] },
  { municipality: 'Ibajay', province: 'Aklan', lat: 11.8167, lng: 122.1667, defaultFacility: 'Ibajay Municipal Hall', aliases: ['ibajay aklan'] },
  { municipality: 'Kalibo', province: 'Aklan', lat: 11.7083, lng: 122.3667, defaultFacility: 'Kalibo Municipal Hall / MDRRMO', aliases: ['kalibo aklan', 'kalibo capital'] },
  { municipality: 'Lezo', province: 'Aklan', lat: 11.6667, lng: 122.3333, defaultFacility: 'Lezo Municipal Hall', aliases: ['lezo aklan'] },
  { municipality: 'Libacao', province: 'Aklan', lat: 11.4500, lng: 122.3000, defaultFacility: 'Libacao Municipal Hall', aliases: ['libacao aklan'] },
  { municipality: 'Madalag', province: 'Aklan', lat: 11.5167, lng: 122.3000, defaultFacility: 'Madalag Municipal Hall', aliases: ['madalag aklan'] },
  { municipality: 'Makato', province: 'Aklan', lat: 11.7167, lng: 122.2833, defaultFacility: 'Makato Municipal Hall', aliases: ['makato aklan'] },
  { municipality: 'Malay', province: 'Aklan', lat: 11.9000, lng: 121.9167, defaultFacility: 'Malay Municipal Hall (Boracay Hub)', aliases: ['boracay', 'caticlan', 'malay aklan'] },
  { municipality: 'Malinao', province: 'Aklan', lat: 11.6500, lng: 122.3167, defaultFacility: 'Malinao Municipal Hall', aliases: ['malinao aklan'] },
  { municipality: 'Nabas', province: 'Aklan', lat: 11.8833, lng: 122.0667, defaultFacility: 'Nabas Municipal Hall', aliases: ['nabas aklan'] },
  { municipality: 'New Washington', province: 'Aklan', lat: 11.6500, lng: 122.4333, defaultFacility: 'New Washington Municipal Hall', aliases: ['new washington aklan'] },
  { municipality: 'Numancia', province: 'Aklan', lat: 11.7000, lng: 122.3333, defaultFacility: 'Numancia Municipal Hall', aliases: ['numancia aklan'] },
  { municipality: 'Tangalan', province: 'Aklan', lat: 11.7833, lng: 122.2500, defaultFacility: 'Tangalan Municipal Hall', aliases: ['tangalan aklan'] },

  // --- GUIMARAS (5 Municipalities) ---
  { municipality: 'Jordan', province: 'Guimaras', lat: 10.6583, lng: 122.5933, defaultFacility: 'Jordan Municipal Hall / PDRRMO', aliases: ['jordan guimaras', 'capital of guimaras'] },
  { municipality: 'Buenavista', province: 'Guimaras', lat: 10.6939, lng: 122.6842, defaultFacility: 'Buenavista Municipal Hall', aliases: ['buenavista guimaras'] },
  { municipality: 'Nueva Valencia', province: 'Guimaras', lat: 10.5186, lng: 122.5414, defaultFacility: 'Nueva Valencia Municipal Hall', aliases: ['nueva valencia guimaras'] },
  { municipality: 'San Lorenzo', province: 'Guimaras', lat: 10.6128, lng: 122.6881, defaultFacility: 'San Lorenzo Municipal Hall', aliases: ['san lorenzo guimaras'] },
  { municipality: 'Sibunag', province: 'Guimaras', lat: 10.5500, lng: 122.6333, defaultFacility: 'Sibunag Municipal Hall', aliases: ['sibunag guimaras'] }
];

/**
 * Normalizes an LGU or municipality string by removing noise words, diacritics, and punctuation.
 */
export function normalizeLguName(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (e.g. Dueñas -> Duenas)
    .replace(/[\(\)\[\],\.\-\/]/g, ' ') // replace punctuation with spaces
    .replace(/\b(lgu|municipality|city|of|the|assigned|provincial|hall|office|mdrrmo|cdrrmo|terminal|evacuation|center|drrmo|warehouse|station|post|receiver|hub)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Authoritatively resolves any LGU query to an exact Panay / Western Visayas LGU coordinate entry.
 * Uses exact matching, alias matching, diacritic-neutral matching, and province-aware disambiguation.
 */
export function findPanayLgu(query: string, provinceFilter?: string | null): LguLocation | undefined {
  const raw = query ? query.trim() : '';
  if (!raw) return undefined;

  const rawLower = raw.toLowerCase();
  const norm = normalizeLguName(raw);
  const spacelessNorm = norm.replace(/\s+/g, '');
  const provFilterLower = provinceFilter?.trim().toLowerCase();

  let bestMatch: LguLocation | undefined = undefined;
  let bestScore = -1;

  for (const item of PANAY_LGUS) {
    const itemRaw = item.municipality.toLowerCase();
    const itemNorm = normalizeLguName(item.municipality);
    const itemSpaceless = itemNorm.replace(/\s+/g, '');
    const provMatch = provFilterLower && item.province.toLowerCase() === provFilterLower;

    let score = 0;

    // 1. Exact raw string match (highest priority)
    if (itemRaw === rawLower) {
      score = 100;
    }
    // 2. Exact normalized match without prefixes/noise words
    else if (norm && itemNorm === norm) {
      score = 95;
    }
    // 3. Spaceless match (e.g., "Miagao" vs "Miag-ao", "Aniniy" vs "Anini-y", "Lauaan" vs "Laua-an")
    else if (spacelessNorm && itemSpaceless === spacelessNorm) {
      score = 92;
    }
    // 4. Exact match on aliases
    else if (
      item.aliases?.some(
        (a) =>
          a.toLowerCase() === rawLower ||
          normalizeLguName(a) === norm ||
          normalizeLguName(a).replace(/\s+/g, '') === spacelessNorm
      )
    ) {
      score = 90;
    }
    // 5. Whole word match within query (e.g., "LGU of Leon Terminal" -> contains "leon")
    else if (norm && itemNorm) {
      const queryWords = norm.split(/\s+/);
      const itemWords = itemNorm.split(/\s+/);

      const allItemWordsInQuery = itemWords.every((w) => queryWords.includes(w));
      const allQueryWordsInItem = queryWords.every((w) => itemWords.includes(w));

      if (allItemWordsInQuery) {
        // If the item shares its name with the province (e.g. Iloilo City in province Iloilo),
        // and the query contains other distinct words besides the province name,
        // do not let the provincial capital falsely hijack a specific municipality address unless "city" was stated.
        if (itemNorm === item.province.toLowerCase() && !rawLower.includes('city') && queryWords.length > 2) {
          score = 55;
        } else {
          score = 80;
        }
      } else if (allQueryWordsInItem) {
        score = 75;
      } else if (queryWords.some((w) => itemWords.includes(w) && w.length >= 4)) {
        score = 60;
      }
    }
    // 6. Substring contains match
    else if (itemRaw.includes(rawLower) || rawLower.includes(itemRaw)) {
      score = 50;
    }

    if (score > 0) {
      // Province filter bonus ensures the right municipality wins if province matches
      if (provMatch) score += 25;
      // Penalize if provinceFilter was specified but doesn't match this item
      if (provFilterLower && !provMatch) score -= 40;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
  }

  return bestScore >= 50 ? bestMatch : undefined;
}

export const PANAY_PROVINCES = ['Iloilo', 'Aklan', 'Antique', 'Capiz'] as const;
export type PanayProvince = typeof PANAY_PROVINCES[number];

export const PANAY_MUNICIPALITIES_BY_PROVINCE: Record<string, string[]> = {
  'Iloilo': PANAY_LGUS.filter(l => l.province === 'Iloilo').map(l => l.municipality).sort(),
  'Aklan': PANAY_LGUS.filter(l => l.province === 'Aklan').map(l => l.municipality).sort(),
  'Antique': PANAY_LGUS.filter(l => l.province === 'Antique').map(l => l.municipality).sort(),
  'Capiz': PANAY_LGUS.filter(l => l.province === 'Capiz').map(l => l.municipality).sort(),
};
