export interface IncidentDetails {
  incidentCode: string;
  reportReason: string;
  incidentDate: string;
}

export const DISASTER_REPORT_REASONS = [
  'Flood / Inundation',
  'Typhoon / Tropical Cyclone',
  'Earthquake',
  'Landslide',
  'Fire Incident',
  'Storm Surge',
  'Drought / El Niño',
  'Volcanic Activity / Ashfall',
  'Armed Conflict / Displacement',
  'Relief Prepositioning / Augmentation',
  'Others (Specify)'
] as const;

export function parseIncidentInfo(raw?: string | null): IncidentDetails {
  if (!raw) {
    return { incidentCode: '', reportReason: '', incidentDate: '' };
  }

  const trimmed = raw.trim();

  // Pattern: CODE [Reason: REASON | Date: DATE] or CODE [REASON | DATE]
  const bracketMatch = trimmed.match(/^(.*?)\s*\[(?:(?:Reason:\s*)?([^|\]]+))(?:\s*\|\s*(?:Date:\s*)?([^\]]+))?\]$/i);
  if (bracketMatch) {
    return {
      incidentCode: bracketMatch[1].trim(),
      reportReason: bracketMatch[2]?.trim() || '',
      incidentDate: bracketMatch[3]?.trim() || ''
    };
  }

  // Fallback for existing plain strings
  return {
    incidentCode: trimmed,
    reportReason: '',
    incidentDate: ''
  };
}

export function formatIncidentCode(code: string, reportReason?: string, incidentDate?: string): string {
  const cleanCode = code.trim();
  const cleanReason = reportReason?.trim();
  const cleanDate = incidentDate?.trim();

  if (cleanReason && cleanDate) {
    return `${cleanCode} [Reason: ${cleanReason} | Date: ${cleanDate}]`;
  }
  if (cleanReason) {
    return `${cleanCode} [Reason: ${cleanReason}]`;
  }
  if (cleanDate) {
    return `${cleanCode} [Date: ${cleanDate}]`;
  }
  return cleanCode;
}

export function resolveDisasterReason(rawCode?: string | null, explicitReason?: string | null): string {
  if (explicitReason && explicitReason.trim()) {
    const trimmed = explicitReason.trim();
    const matched = DISASTER_REPORT_REASONS.find(r => r.toLowerCase() === trimmed.toLowerCase());
    if (matched) return matched;
    return trimmed;
  }

  if (rawCode && rawCode.trim()) {
    const parsed = parseIncidentInfo(rawCode);
    if (parsed.reportReason) {
      const matched = DISASTER_REPORT_REASONS.find(r => r.toLowerCase() === parsed.reportReason.toLowerCase());
      if (matched) return matched;
      return parsed.reportReason;
    }

    const lower = rawCode.toLowerCase();
    if (lower.includes('flood') || lower.includes('inundat') || lower.includes('baha')) {
      return 'Flood / Inundation';
    }
    if (lower.includes('typhoon') || lower.includes('cyclone') || lower.includes('storm') || lower.includes('bagyo') || lower.includes('tropical') || lower.includes('kristine') || lower.includes('odette')) {
      return 'Typhoon / Tropical Cyclone';
    }
    if (lower.includes('earthquake') || lower.includes('quake') || lower.includes('lindol') || lower.includes('seismic')) {
      return 'Earthquake';
    }
    if (lower.includes('landslide') || lower.includes('slide') || lower.includes('guho')) {
      return 'Landslide';
    }
    if (lower.includes('fire') || lower.includes('sunog') || lower.includes('conflagrat')) {
      return 'Fire Incident';
    }
    if (lower.includes('surge') || lower.includes('daluyong')) {
      return 'Storm Surge';
    }
    if (lower.includes('drought') || lower.includes('el nino') || lower.includes('el niño') || lower.includes('tag-tuyot')) {
      return 'Drought / El Niño';
    }
    if (lower.includes('volcan') || lower.includes('ashfall') || lower.includes('kanlaon') || lower.includes('mayon') || lower.includes('taal')) {
      return 'Volcanic Activity / Ashfall';
    }
    if (lower.includes('conflict') || lower.includes('armed') || lower.includes('displacement') || lower.includes('bakwit')) {
      return 'Armed Conflict / Displacement';
    }
    if (lower.includes('prepos') || lower.includes('augment') || lower.includes('buffer') || lower.includes('stock')) {
      return 'Relief Prepositioning / Augmentation';
    }

    if (lower !== 'none' && (lower.startsWith('inc') || lower.startsWith('dr'))) {
      return 'Flood / Inundation';
    }
  }

  return 'Relief Prepositioning / Augmentation';
}

export function getDisasterReasonStyle(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes('flood') || lower.includes('inundat')) {
    return 'bg-blue-50 text-blue-800 border-blue-200';
  }
  if (lower.includes('typhoon') || lower.includes('cyclone') || lower.includes('storm')) {
    return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  }
  if (lower.includes('earthquake')) {
    return 'bg-amber-50 text-amber-900 border-amber-200';
  }
  if (lower.includes('landslide')) {
    return 'bg-orange-50 text-orange-900 border-orange-200';
  }
  if (lower.includes('fire')) {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  if (lower.includes('surge')) {
    return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  }
  if (lower.includes('drought')) {
    return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  }
  if (lower.includes('volcan') || lower.includes('ashfall')) {
    return 'bg-purple-50 text-purple-900 border-purple-200';
  }
  if (lower.includes('conflict') || lower.includes('displacement')) {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  if (lower.includes('preposition') || lower.includes('augmentation')) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  return 'bg-gray-50 text-gray-800 border-gray-200';
}
