import { parseIncidentInfo } from './incidentHelper';

/**
 * Standard reference code helpers enforcing the three-way reference scheme:
 * 1. Incoming goods intake -> RIS codes (Requisition and Issue Slip)
 * 2. Outgoing relief dispatch -> INC codes (Disaster / Incident Allocation)
 * 3. LGU Replenishment transfer -> DR codes (Delivery Receipt)
 */

export function isReplenishCode(code?: string | null): boolean {
  if (!code) return false;
  return code.trim().toUpperCase().startsWith('DR-');
}

export function formatIncomingReference(manifestNumber?: string | null, fallbackId?: string | null): string {
  const raw = (manifestNumber || fallbackId || '').trim();
  if (!raw) return 'RIS-N/A';

  const upper = raw.toUpperCase();
  // LGU replenishment transfer records retain DR code
  if (upper.startsWith('DR-')) {
    return upper;
  }
  if (upper.startsWith('RIS-')) {
    return upper;
  }
  if (upper.startsWith('MNF-')) {
    return `RIS-${upper.slice(4)}`;
  }
  if (upper.startsWith('BATCH-MNF-')) {
    return `RIS-${upper.slice(10)}`;
  }
  if (upper.startsWith('BATCH-')) {
    return `RIS-${upper.slice(6)}`;
  }

  // Clean alphanumeric for raw UUIDs / ledger hashes
  const clean = upper.replace(/[^A-Z0-9-]/g, '');
  return clean.length > 14 ? `RIS-${clean.slice(0, 12)}` : `RIS-${clean}`;
}

export function formatOutgoingReference(
  releaseOrCode?: { incidentCode?: string | null; drNumber?: string | null } | string | null
): string {
  if (!releaseOrCode) return 'INC-N/A';

  if (typeof releaseOrCode === 'string') {
    const raw = releaseOrCode.trim();
    if (!raw) return 'INC-N/A';
    const upper = raw.toUpperCase();
    if (upper.startsWith('INC-')) return upper;
    if (upper.startsWith('DR-')) return `INC-${upper.slice(3)}`;
    return `INC-${upper}`;
  }

  const rawIncident = releaseOrCode.incidentCode;
  if (rawIncident && rawIncident.trim()) {
    const parsed = parseIncidentInfo(rawIncident).incidentCode || rawIncident;
    const cleanParsed = parsed.trim().toUpperCase();
    if (cleanParsed && cleanParsed !== 'NONE') {
      if (cleanParsed.startsWith('INC-')) return cleanParsed;
      if (cleanParsed.startsWith('DR-')) return `INC-${cleanParsed.slice(3)}`;
      return `INC-${cleanParsed}`;
    }
  }

  const rawDr = releaseOrCode.drNumber;
  if (rawDr && rawDr.trim()) {
    const cleanDr = rawDr.trim().toUpperCase();
    if (cleanDr.startsWith('INC-')) return cleanDr;
    if (cleanDr.startsWith('DR-')) return `INC-${cleanDr.slice(3)}`;
    return `INC-${cleanDr}`;
  }

  return 'INC-N/A';
}

export function formatReplenishReference(rawCode?: string | null): string {
  const raw = (rawCode || '').trim();
  if (!raw) return 'DR-N/A';
  const upper = raw.toUpperCase();
  if (upper.startsWith('DR-')) return upper;
  if (upper.startsWith('RIS-')) return `DR-${upper.slice(4)}`;
  if (upper.startsWith('MNF-')) return `DR-${upper.slice(4)}`;
  return `DR-${upper}`;
}

