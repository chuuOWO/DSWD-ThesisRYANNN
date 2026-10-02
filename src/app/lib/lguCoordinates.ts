/**
 * Comprehensive Panay & Western Visayas LGU Coordinates Registry
 * Covers municipalities across Iloilo, Capiz, Antique, and Aklan.
 */

export interface LguEntry {
  canonicalName: string;
  province: 'Iloilo' | 'Capiz' | 'Antique' | 'Aklan';
  position: [number, number];
  aliases: string[];
}

export const PANAY_LGUS: LguEntry[] = [
  // --- ILOILO PROVINCE ---
  {
    canonicalName: 'Leon Municipal Office',
    province: 'Iloilo',
    position: [10.7870, 122.3892],
    aliases: ['leon', 'leon iloilo', 'leon lgu']
  },
  {
    canonicalName: 'Miag-ao Municipal Office',
    province: 'Iloilo',
    position: [10.6445, 122.2367],
    aliases: ['miagao', 'miag-ao', 'miag ao', 'miagao iloilo']
  },
  {
    canonicalName: 'Oton Municipal Office',
    province: 'Iloilo',
    position: [10.6931, 122.4738],
    aliases: ['oton', 'oton iloilo', 'oton warehouse', 'dswd oton']
  },
  {
    canonicalName: 'Pavia Municipal Office',
    province: 'Iloilo',
    position: [10.7766, 122.5414],
    aliases: ['pavia', 'pavia iloilo', 'pavia lgu']
  },
  {
    canonicalName: 'Pototan Municipal Office',
    province: 'Iloilo',
    position: [10.9435, 122.6369],
    aliases: ['pototan', 'pototan iloilo', 'pototan warehouse', 'dswd pototan']
  },
  {
    canonicalName: 'Santa Barbara Municipal Office',
    province: 'Iloilo',
    position: [10.8231, 122.5341],
    aliases: ['santa barbara', 'sta barbara', 'sta. barbara']
  },
  {
    canonicalName: 'San Miguel Municipal Office',
    province: 'Iloilo',
    position: [10.7800, 122.4658],
    aliases: ['san miguel', 'san miguel iloilo']
  },
  {
    canonicalName: 'Barotac Nuevo Municipal Office',
    province: 'Iloilo',
    position: [10.8940, 122.7042],
    aliases: ['barotac nuevo', 'barotac nuevo iloilo']
  },
  {
    canonicalName: 'Barotac Viejo Municipal Office',
    province: 'Iloilo',
    position: [11.0500, 122.8500],
    aliases: ['barotac viejo', 'barotac viejo iloilo']
  },
  {
    canonicalName: 'Dumangas Municipal Office',
    province: 'Iloilo',
    position: [10.8250, 122.7136],
    aliases: ['dumangas', 'dumangas iloilo']
  },
  {
    canonicalName: 'Passi City Hall',
    province: 'Iloilo',
    position: [11.1078, 122.6419],
    aliases: ['passi', 'passi city', 'passi iloilo']
  },
  {
    canonicalName: 'Sara Municipal Office',
    province: 'Iloilo',
    position: [11.2570, 123.0147],
    aliases: ['sara', 'sara iloilo']
  },
  {
    canonicalName: 'Cabatuan Municipal Office',
    province: 'Iloilo',
    position: [10.8789, 122.4847],
    aliases: ['cabatuan', 'cabatuan iloilo']
  },
  {
    canonicalName: 'Alimodian Municipal Office',
    province: 'Iloilo',
    position: [10.8197, 122.4308],
    aliases: ['alimodian', 'alimodian iloilo']
  },
  {
    canonicalName: 'Tigbauan Municipal Office',
    province: 'Iloilo',
    position: [10.6728, 122.3789],
    aliases: ['tigbauan', 'tigbauan iloilo']
  },
  {
    canonicalName: 'Guimbal Municipal Office',
    province: 'Iloilo',
    position: [10.6586, 122.3169],
    aliases: ['guimbal', 'guimbal iloilo']
  },
  {
    canonicalName: 'Igbaras Municipal Office',
    province: 'Iloilo',
    position: [10.7167, 122.2667],
    aliases: ['igbaras', 'igbaras iloilo']
  },
  {
    canonicalName: 'Tubungan Municipal Office',
    province: 'Iloilo',
    position: [10.7500, 122.3167],
    aliases: ['tubungan', 'tubungan iloilo']
  },
  {
    canonicalName: 'San Joaquin Municipal Office',
    province: 'Iloilo',
    position: [10.5833, 122.1333],
    aliases: ['san joaquin', 'san joaquin iloilo']
  },
  {
    canonicalName: 'Leganes Municipal Office',
    province: 'Iloilo',
    position: [10.7833, 122.5833],
    aliases: ['leganes', 'leganes iloilo']
  },
  {
    canonicalName: 'Zarraga Municipal Office',
    province: 'Iloilo',
    position: [10.8167, 122.6000],
    aliases: ['zarraga', 'zarraga iloilo']
  },
  {
    canonicalName: 'New Lucena Municipal Office',
    province: 'Iloilo',
    position: [10.8833, 122.6000],
    aliases: ['new lucena', 'new lucena iloilo']
  },
  {
    canonicalName: 'Dingle Municipal Office',
    province: 'Iloilo',
    position: [11.0000, 122.6667],
    aliases: ['dingle', 'dingle iloilo']
  },
  {
    canonicalName: 'Dueñas Municipal Office',
    province: 'Iloilo',
    position: [11.0667, 122.6167],
    aliases: ['duenas', 'dueñas', 'duenas iloilo']
  },
  {
    canonicalName: 'San Enrique Municipal Office',
    province: 'Iloilo',
    position: [11.0833, 122.6667],
    aliases: ['san enrique', 'san enrique iloilo']
  },
  {
    canonicalName: 'Calinog Municipal Office',
    province: 'Iloilo',
    position: [11.1500, 122.5333],
    aliases: ['calinog', 'calinog iloilo']
  },
  {
    canonicalName: 'Lambunao Municipal Office',
    province: 'Iloilo',
    position: [11.0500, 122.4833],
    aliases: ['lambunao', 'lambunao iloilo']
  },
  {
    canonicalName: 'Janiuay Municipal Office',
    province: 'Iloilo',
    position: [10.9500, 122.5000],
    aliases: ['janiuay', 'janiuay iloilo']
  },
  {
    canonicalName: 'Badiangan Municipal Office',
    province: 'Iloilo',
    position: [10.9667, 122.5500],
    aliases: ['badiangan', 'badiangan iloilo']
  },
  {
    canonicalName: 'Mina Municipal Office',
    province: 'Iloilo',
    position: [10.9333, 122.5833],
    aliases: ['mina', 'mina iloilo']
  },
  {
    canonicalName: 'Banate Municipal Office',
    province: 'Iloilo',
    position: [11.0167, 122.8167],
    aliases: ['banate', 'banate iloilo']
  },
  {
    canonicalName: 'Anilao Municipal Office',
    province: 'Iloilo',
    position: [10.9833, 122.7667],
    aliases: ['anilao', 'anilao iloilo']
  },
  {
    canonicalName: 'Ajuy Municipal Office',
    province: 'Iloilo',
    position: [11.1667, 123.0167],
    aliases: ['ajuy', 'ajuy iloilo']
  },
  {
    canonicalName: 'Concepcion Municipal Office',
    province: 'Iloilo',
    position: [11.2167, 123.1167],
    aliases: ['concepcion', 'concepcion iloilo']
  },
  {
    canonicalName: 'Estancia Municipal Office',
    province: 'Iloilo',
    position: [11.4500, 123.1500],
    aliases: ['estancia', 'estancia iloilo']
  },
  {
    canonicalName: 'Carles Municipal Office',
    province: 'Iloilo',
    position: [11.5833, 123.1333],
    aliases: ['carles', 'carles iloilo']
  },
  {
    canonicalName: 'Iloilo City Hall',
    province: 'Iloilo',
    position: [10.7202, 122.5621],
    aliases: ['iloilo city', 'iloilo', 'iloilo capitol']
  },

  // --- CAPIZ PROVINCE ---
  {
    canonicalName: 'Sigma Municipal Office',
    province: 'Capiz',
    position: [11.4175, 122.6675],
    aliases: ['sigma', 'sigma capiz', 'sigma municipal office']
  },
  {
    canonicalName: 'Roxas City Hall',
    province: 'Capiz',
    position: [11.5853, 122.7511],
    aliases: ['roxas city', 'roxas', 'roxas capiz']
  },
  {
    canonicalName: 'Panay Municipal Office',
    province: 'Capiz',
    position: [11.5583, 122.7936],
    aliases: ['panay capiz', 'panay municipality']
  },
  {
    canonicalName: 'Panitan Municipal Office',
    province: 'Capiz',
    position: [11.4889, 122.7750],
    aliases: ['panitan', 'panitan capiz']
  },
  {
    canonicalName: 'Pontevedra Municipal Office',
    province: 'Capiz',
    position: [11.4333, 122.8333],
    aliases: ['pontevedra', 'pontevedra capiz']
  },
  {
    canonicalName: 'Pilar Municipal Office',
    province: 'Capiz',
    position: [11.4833, 122.9833],
    aliases: ['pilar', 'pilar capiz']
  },
  {
    canonicalName: 'Dao Municipal Office',
    province: 'Capiz',
    position: [11.3933, 122.6842],
    aliases: ['dao', 'dao capiz']
  },
  {
    canonicalName: 'Cuartero Municipal Office',
    province: 'Capiz',
    position: [11.3583, 122.6694],
    aliases: ['cuartero', 'cuartero capiz']
  },
  {
    canonicalName: 'Dumalag Municipal Office',
    province: 'Capiz',
    position: [11.3000, 122.6167],
    aliases: ['dumalag', 'dumalag capiz']
  },
  {
    canonicalName: 'Dumarao Municipal Office',
    province: 'Capiz',
    position: [11.2667, 122.6833],
    aliases: ['dumarao', 'dumarao capiz']
  },
  {
    canonicalName: 'Ivisan Municipal Office',
    province: 'Capiz',
    position: [11.5167, 122.6833],
    aliases: ['ivisan', 'ivisan capiz']
  },
  {
    canonicalName: 'Mambusao Municipal Office',
    province: 'Capiz',
    position: [11.4333, 122.6000],
    aliases: ['mambusao', 'mambusao capiz']
  },
  {
    canonicalName: 'Sapian Municipal Office',
    province: 'Capiz',
    position: [11.5000, 122.6000],
    aliases: ['sapian', 'sapian capiz']
  },
  {
    canonicalName: 'Tapaz Municipal Office',
    province: 'Capiz',
    position: [11.2592, 122.5361],
    aliases: ['tapaz', 'tapaz capiz']
  },

  // --- ANTIQUE PROVINCE ---
  {
    canonicalName: 'San Jose de Buenavista Municipal Office',
    province: 'Antique',
    position: [10.7456, 121.9442],
    aliases: ['san jose', 'san jose de buenavista', 'antique capitol']
  },
  {
    canonicalName: 'Hamtic Municipal Office',
    province: 'Antique',
    position: [10.7000, 121.9833],
    aliases: ['hamtic', 'hamtic antique']
  },
  {
    canonicalName: 'Sibalom Municipal Office',
    province: 'Antique',
    position: [10.7833, 122.0167],
    aliases: ['sibalom', 'sibalom antique']
  },
  {
    canonicalName: 'Culasi Municipal Office',
    province: 'Antique',
    position: [11.4333, 122.0500],
    aliases: ['culasi', 'culasi antique']
  },

  // --- AKLAN PROVINCE ---
  {
    canonicalName: 'Kalibo Municipal Office',
    province: 'Aklan',
    position: [11.7083, 122.3667],
    aliases: ['kalibo', 'kalibo aklan']
  },
  {
    canonicalName: 'Malay Municipal Office',
    province: 'Aklan',
    position: [11.9000, 121.9167],
    aliases: ['malay', 'boracay', 'malay aklan']
  }
];

export const DEFAULT_DESTINATION_POSITION: [number, number] = [10.7870, 122.3892]; // Leon

/**
 * Clean and normalize an LGU search query
 */
export function normalizeLguKey(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[,\.\-\/]/g, ' ')
    .replace(/\b(municipal|office|hall|lgu|city|municipality|of|the|assigned)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves any destination string (from scanned QR payload, Supabase release, or user input)
 * to an authoritative Panay LGU entry with exact GPS coordinates.
 */
export function resolveLgu(destination?: string | null): { name: string; position: [number, number] } {
  if (!destination || typeof destination !== 'string') {
    return { name: 'Leon Municipal Office', position: DEFAULT_DESTINATION_POSITION };
  }

  const raw = destination.trim();
  const cleaned = normalizeLguKey(raw);

  if (!cleaned) {
    return { name: raw || 'Leon Municipal Office', position: DEFAULT_DESTINATION_POSITION };
  }

  // 1. Exact alias match
  for (const lgu of PANAY_LGUS) {
    for (const alias of lgu.aliases) {
      const cleanedAlias = normalizeLguKey(alias);
      if (cleaned === cleanedAlias) {
        return { name: lgu.canonicalName, position: lgu.position };
      }
    }
  }

  // 2. Substring match (either query contains alias, or alias contains query)
  for (const lgu of PANAY_LGUS) {
    for (const alias of lgu.aliases) {
      const cleanedAlias = normalizeLguKey(alias);
      if (cleaned.includes(cleanedAlias) || cleanedAlias.includes(cleaned)) {
        return { name: lgu.canonicalName, position: lgu.position };
      }
    }
  }

  // 3. Fallback: check raw string includes
  const lowerRaw = raw.toLowerCase();
  for (const lgu of PANAY_LGUS) {
    for (const alias of lgu.aliases) {
      if (lowerRaw.includes(alias.toLowerCase())) {
        return { name: lgu.canonicalName, position: lgu.position };
      }
    }
  }

  // If completely unknown, return raw name and default coordinates
  return { name: raw, position: DEFAULT_DESTINATION_POSITION };
}

