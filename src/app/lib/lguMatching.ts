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

