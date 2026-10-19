import { parseIncidentInfo } from './incidentHelper';

/**
 * Standard reference code helpers enforcing the three-way reference scheme:
 * 1. Incoming goods intake -> RIS codes (Requisition and Issue Slip)
 * 2. Outgoing relief dispatch -> INC codes (Disaster / Incident Allocation)
 * 3. LGU Replenishment transfer -> DR codes (Delivery Receipt)
 */

function stripLeadingPrefixes(code: string, prefixes: string[]): string {
  const s = code.trim();
  const pattern = new RegExp(`^((?:${prefixes.join('|')})[-_ ]*)+`, 'i');
  return s.replace(pattern, '').trim();
}

export function isReplenishCode(code?: string | null): boolean {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return upper.startsWith('DR-') || /^DR[-_ ]*[0-9A-Z]/i.test(upper);
}

export function formatIncomingReference(manifestNumber?: string | null, fallbackId?: string | null): string {
  const raw = (manifestNumber || fallbackId || '').trim();
  if (!raw) return 'RIS-N/A';

  const upper = raw.toUpperCase();
  // LGU replenishment transfer records retain DR code
  if (isReplenishCode(upper)) {
    return formatReplenishReference(upper);
  }

  const remainder = stripLeadingPrefixes(upper, ['RIS', 'BATCH-MNF', 'BATCH', 'MNF']);
  if (!remainder) return 'RIS-N/A';

  // Clean alphanumeric or preserve structured hyphenated codes
  const clean = remainder.replace(/[^A-Z0-9-]/g, '');
  if (!clean) return 'RIS-N/A';

  return clean.length > 14 && !clean.includes('-')
    ? `RIS-${clean.slice(0, 12)}`
    : `RIS-${clean}`;
}

export function formatOutgoingReference(
  releaseOrCode?: { incidentCode?: string | null; drNumber?: string | null } | string | null
): string {
  if (!releaseOrCode) return 'INC-N/A';

  if (typeof releaseOrCode === 'string') {
    const raw = releaseOrCode.trim();
    if (!raw) return 'INC-N/A';
    const upper = raw.toUpperCase();
    const remainder = stripLeadingPrefixes(upper, ['INC', 'DR']);
    return remainder ? `INC-${remainder}` : 'INC-N/A';
  }

  const rawDr = releaseOrCode.drNumber;
  if (rawDr && rawDr.trim()) {
    const upper = rawDr.trim().toUpperCase();
    if (upper.startsWith('INC')) {
      const remainder = stripLeadingPrefixes(upper, ['INC', 'DR']);
      if (remainder) return `INC-${remainder}`;
    }
  }

  const rawIncident = releaseOrCode.incidentCode;
  if (rawIncident && rawIncident.trim()) {
    const parsed = parseIncidentInfo(rawIncident).incidentCode || rawIncident;
    const cleanParsed = parsed.trim().toUpperCase();
    if (cleanParsed && cleanParsed !== 'NONE') {
      const remainder = stripLeadingPrefixes(cleanParsed, ['INC', 'DR']);
      if (remainder) return `INC-${remainder}`;
    }
  }

  if (rawDr && rawDr.trim()) {
    const upper = rawDr.trim().toUpperCase();
    const remainder = stripLeadingPrefixes(upper, ['INC', 'DR']);
    if (remainder) return `INC-${remainder}`;
  }

  return 'INC-N/A';
}

export function formatReplenishReference(rawCode?: string | null): string {
  const raw = (rawCode || '').trim();
  if (!raw) return 'DR-N/A';
  const upper = raw.toUpperCase();
  const remainder = stripLeadingPrefixes(upper, ['DR', 'RIS', 'BATCH-MNF', 'BATCH', 'MNF']);
  if (!remainder) return 'DR-N/A';
  const clean = remainder.replace(/[^A-Z0-9-]/g, '');
  return clean ? `DR-${clean}` : 'DR-N/A';
}

export function formatShipmentReference(
  releaseOrCode?: { incidentCode?: string | null; drNumber?: string | null } | string | null
): string {
  if (!releaseOrCode) return 'INC-N/A';
  if (typeof releaseOrCode === 'string') {
    if (isReplenishCode(releaseOrCode)) {
      return formatReplenishReference(releaseOrCode);
    }
    return formatOutgoingReference(releaseOrCode);
  }
  if (releaseOrCode.drNumber && isReplenishCode(releaseOrCode.drNumber)) {
    return formatReplenishReference(releaseOrCode.drNumber);
  }
  return formatOutgoingReference(releaseOrCode);
}

