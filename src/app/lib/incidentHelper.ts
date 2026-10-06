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
