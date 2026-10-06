import type { LguRecord } from '../services/backendApi';
import type { OutgoingRelease, IncomingGoods, LGUPriorityReport } from '../hooks/useInventoryState';
import { DEFAULT_PANAY_LGUS } from './lguMatching';
import { evaluatePriorityIndicator, type PriorityColor, type PriorityLevel } from './priorityLogic';

export interface SynchronizedLgu extends LguRecord {
  id: string;
  municipality: string;
  province: string;
  lguName: string;
  totalItemsReleased: number;
  deliveryCount: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  lastDeliveryDate: string;
  contactPerson?: string;
  contactNumber?: string;
  remarks?: string;
  latitude: number;
  longitude: number;
  currentStock: Record<string, number>;
  foodPacks: number;
  hygieneKits: number;
  familyKits: number;
  sleepingKits: number;
  kitchenKits: number;
  laminatedSacks: number;
  rtef: number;
  urgencyScore: number;
  priorityColor: PriorityColor;
  priorityLevel?: PriorityLevel;
  maxStock: number;
  stockRate?: number;
  completionRate?: number;
  effectiveRate?: number;
  systemResponse?: string;
  recommendation: string;
  lastReportedAt?: string;
  isActive: boolean;
}

/**
 * Normalizes category names to standard canonical format.
 */
export function normalizeCategoryName(cat?: string | null): string {
  if (!cat) return '';
  const c = cat.trim().toLowerCase();
  if (c.includes('food pack') || c === 'food packs') return 'Food Pack';
  if (c.includes('hygiene')) return 'Hygiene Kit';
  if (c.includes('family')) return 'Family Kit';
  if (c.includes('sleeping')) return 'Sleeping Kit';
  if (c.includes('kitchen')) return 'Kitchen Kit';
  if (c.includes('laminated') || c.includes('sack')) return 'Laminated Sack';
  if (c.includes('rtef') || c.includes('ready-to-eat')) return 'RTEF';
  return cat.trim();
}


/**
 * Retrieves stock count for any category name with case-insensitive and alias fallbacks.
 */
export function getLguStockForCategory(
  lgu: { currentStock?: Record<string, number>; foodPacks?: number; hygieneKits?: number; familyKits?: number; sleepingKits?: number; kitchenKits?: number; laminatedSacks?: number; rtef?: number } | null | undefined,
  category: string
): number {
  if (!lgu || !category) return 0;
  const stock = lgu.currentStock || {};

  if (stock[category] !== undefined && stock[category] !== null) {
    return Number(stock[category]) || 0;
  }

  const normalized = normalizeCategoryName(category);
  if (stock[normalized] !== undefined && stock[normalized] !== null) {
    return Number(stock[normalized]) || 0;
  }

  const catLower = category.trim().toLowerCase();
  for (const [k, v] of Object.entries(stock)) {
    if (k.trim().toLowerCase() === catLower) {
      return Number(v) || 0;
    }
  }

  if (catLower.includes('food pack')) return Number(lgu.foodPacks) || 0;
  if (catLower.includes('hygiene')) return Number(lgu.hygieneKits) || 0;
  if (catLower.includes('family kit')) return Number(lgu.familyKits) || 0;
  if (catLower.includes('sleeping')) return Number(lgu.sleepingKits) || 0;
  if (catLower.includes('kitchen')) return Number(lgu.kitchenKits) || 0;
  if (catLower.includes('sack')) return Number(lgu.laminatedSacks) || 0;
  if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) return Number(lgu.rtef) || 0;

  return 0;
}

/**
 * Computes authoritative synchronized LGU stock and metrics across the entire application.
 * Integrates baseline inventory, emergency recounts, inbound deliveries, and outbound dispatches.
 */
export function computeSynchronizedLgus(params: {
  masterLgus?: LguRecord[];
  outgoingReleases?: OutgoingRelease[];
  incomingGoods?: IncomingGoods[];
  lguPriorityReports?: LGUPriorityReport[];
}): SynchronizedLgu[] {
  const masterLgus = (params.masterLgus && params.masterLgus.length > 0)
    ? params.masterLgus
    : DEFAULT_PANAY_LGUS;
  const releases = params.outgoingReleases || [];
  const incomingGoods = params.incomingGoods || [];
  const reports = params.lguPriorityReports || [];

  const result: SynchronizedLgu[] = masterLgus.map((lgu) => {
    const muni = (lgu.municipality || '').trim();
    const muniLower = muni.toLowerCase();
    const prov = (lgu.province || 'Iloilo').trim();
    const provLower = prov.toLowerCase();

    // 1. Inbound releases destined for this LGU
    const inboundReleases = releases.filter((r) => {
      if (!r) return false;
      if (r.lguId && lgu.id && r.lguId === lgu.id) return true;
      const targetMuni = (r.municipality || '').trim().toLowerCase();
      const targetName = (r.lguName || '').trim().toLowerCase();
      const rProv = (r.province || '').trim().toLowerCase();
      const provMatch = !rProv || rProv === provLower;
      return provMatch && (targetMuni === muniLower || (muniLower.length > 2 && targetName.includes(muniLower)));
    });

    // 2. Outbound releases dispatched FROM this LGU as source
    const outboundReleases = releases.filter((r) => {
      if (!r) return false;
      if (r.sourceType !== 'LGU') return false;
      if (r.deliveryStatus === 'Cancelled') return false;
      const source = (r.warehouseSource || '').trim().toLowerCase();
      return source === muniLower || (muniLower.length > 2 && source.includes(muniLower));
    });

    // 3. Direct incoming goods stocked directly to this LGU
    const lguIncomingDirect = incomingGoods.filter((inc) => {
      if (!inc) return false;
      if (inc.destinationType === 'LGU') {
        const dest = (inc.destination || '').trim().toLowerCase();
        return dest === muniLower || (muniLower.length > 2 && dest.includes(muniLower));
      }
      return false;
    });

    // 4. Official priority report
    const report = reports.find((rep) => {
      if (!rep) return false;
      if (rep.lguId && lgu.id && rep.lguId === lgu.id) return true;
      const repMuni = (rep.municipality || '').trim().toLowerCase();
      return repMuni === muniLower;
    });

    const totalReleased = inboundReleases.reduce((sum, r) => sum + (Number(r.amountApproved) || Number(r.amountRequested) || 0), 0);
    const deliveryCount = inboundReleases.length;
    const completed = inboundReleases.filter((r) => ['Delivered', 'Accepted', 'Distributed'].includes(r.deliveryStatus)).length;
    const pending = inboundReleases.filter((r) => ['Allocating', 'Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus)).length;
    const lastDate = inboundReleases[0]?.dateAllocated || (report ? report.reportedAt?.slice(0, 10) : (lgu.lastReportedAt?.slice(0, 10) || 'N/A'));

    // 5. Baseline stock from record or emergency recount
    const stock: Record<string, number> = {
      ...(lgu.currentStock && typeof lgu.currentStock === 'object' ? lgu.currentStock : {})
    };
    if (lgu.foodPacks && !stock['Food Pack']) stock['Food Pack'] = Number(lgu.foodPacks);
    if (lgu.hygieneKits && !stock['Hygiene Kit']) stock['Hygiene Kit'] = Number(lgu.hygieneKits);
    if (lgu.familyKits && !stock['Family Kit']) stock['Family Kit'] = Number(lgu.familyKits);
    if (lgu.sleepingKits && !stock['Sleeping Kit']) stock['Sleeping Kit'] = Number(lgu.sleepingKits);
    if (lgu.kitchenKits && !stock['Kitchen Kit']) stock['Kitchen Kit'] = Number(lgu.kitchenKits);
    if (lgu.laminatedSacks && !stock['Laminated Sack']) stock['Laminated Sack'] = Number(lgu.laminatedSacks);
    if (lgu.rtef && !stock['RTEF']) stock['RTEF'] = Number(lgu.rtef);

    // 6. Aggregate verified inbound arrivals from completed deliveries and direct manifests
    const arrivalsMap: Record<string, number> = {};
    inboundReleases.forEach((r) => {
      if (['Delivered', 'Accepted', 'Distributed'].includes(r.deliveryStatus) && r.fnfiCategory) {
        const canonical = normalizeCategoryName(r.fnfiCategory);
        const qty = Number(r.amountApproved) || Number(r.amountRequested) || 0;
        arrivalsMap[canonical] = (arrivalsMap[canonical] || 0) + qty;
      }
    });
    lguIncomingDirect.forEach((inc) => {
      if (inc.fnfiCategory && Number(inc.quantity) > 0) {
        const canonical = normalizeCategoryName(inc.fnfiCategory);
        arrivalsMap[canonical] = (arrivalsMap[canonical] || 0) + Number(inc.quantity);
      }
    });

    Object.entries(arrivalsMap).forEach(([cat, arrivalQty]) => {
      stock[cat] = Math.max(Number(stock[cat]) || 0, arrivalQty);
    });

    // 7. Deduct outbound dispatches where this LGU is the source
    outboundReleases.forEach((r) => {
      if (r.fnfiCategory) {
        const canonical = normalizeCategoryName(r.fnfiCategory);
        const dispatchQty = Number(r.amountApproved) || Number(r.amountRequested) || 0;
        stock[canonical] = Math.max(0, (Number(stock[canonical]) || 0) - dispatchQty);
      }
    });

    // 8. Priority report override if reported on-hand stock is higher
    if (report) {
      if (report.foodPacks) stock['Food Pack'] = Math.max(Number(stock['Food Pack']) || 0, Number(report.foodPacks));
      if (report.hygieneKits) stock['Hygiene Kit'] = Math.max(Number(stock['Hygiene Kit']) || 0, Number(report.hygieneKits));
      if (report.familyKits) stock['Family Kit'] = Math.max(Number(stock['Family Kit']) || 0, Number(report.familyKits));
    }

    // 9. Consolidate into strictly unique canonical categories (no duplicate alias keys)
    const canonicalStock: Record<string, number> = {
      'Food Pack': Math.max(0, Number(stock['Food Pack']) || 0),
      'Hygiene Kit': Math.max(0, Number(stock['Hygiene Kit']) || 0),
      'Family Kit': Math.max(0, Number(stock['Family Kit']) || 0),
      'Sleeping Kit': Math.max(0, Number(stock['Sleeping Kit']) || 0),
      'Kitchen Kit': Math.max(0, Number(stock['Kitchen Kit']) || 0),
      'Laminated Sack': Math.max(0, Number(stock['Laminated Sack'] ?? stock['Laminated Sacks']) || 0),
      'RTEF': Math.max(0, Number(stock['RTEF'] ?? stock['Ready-to-Eat Food']) || 0)
    };

    // Any other custom non-standard categories that are not standard kit aliases
    Object.entries(stock).forEach(([k, v]) => {
      const canonical = normalizeCategoryName(k);
      if (['Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit', 'Kitchen Kit', 'Laminated Sack', 'RTEF'].includes(canonical)) {
        return;
      }
      if (Number(v) > 0) {
        canonicalStock[canonical] = Math.max(0, Number(v) || 0);
      }
    });

    const foodPacks = canonicalStock['Food Pack'];
    const hygieneKits = canonicalStock['Hygiene Kit'];
    const familyKits = canonicalStock['Family Kit'];
    const sleepingKits = canonicalStock['Sleeping Kit'];
    const kitchenKits = canonicalStock['Kitchen Kit'];
    const laminatedSacks = canonicalStock['Laminated Sack'];
    const rtef = canonicalStock['RTEF'];

    const maxStock = Number(lgu.maxStock) > 0 ? Number(lgu.maxStock) : 3000;

    const evalRes = evaluatePriorityIndicator({
      foodPacks,
      completedDeliveries: completed,
      pendingDeliveries: pending,
      totalDeliveries: deliveryCount,
      affectedFamilies: lgu.affectedFamilies,
      targetQuota: maxStock
    });

    const urgencyScore = evalRes.urgencyScore;
    const priorityColor = evalRes.priorityColor;

    return {
      id: lgu.id || `lgu-${provLower}-${muniLower.replace(/[^a-z0-9]/g, '-')}`,
      municipality: muni,
      province: prov,
      lguName: lgu.lguName || `${muni} Municipal Office`,
      totalItemsReleased: totalReleased,
      deliveryCount,
      completedDeliveries: completed,
      pendingDeliveries: pending,
      lastDeliveryDate: lastDate,
      contactPerson: lgu.contactPerson || '',
      contactNumber: lgu.contactNumber || '',
      remarks: lgu.remarks || '',
      latitude: Number(lgu.latitude ?? 10.7870),
      longitude: Number(lgu.longitude ?? 122.3892),
      currentStock: canonicalStock,
      foodPacks,
      hygieneKits,
      familyKits,
      sleepingKits,
      kitchenKits,
      laminatedSacks,
      rtef,
      maxStock,
      urgencyScore,
      priorityColor,
      priorityLevel: evalRes.priorityLevel,
      stockRate: evalRes.stockRate,
      completionRate: evalRes.completionRate,
      effectiveRate: evalRes.effectiveRate,
      systemResponse: evalRes.systemResponse,
      recommendation: lgu.recommendation || evalRes.systemResponse,
      lastReportedAt: lastDate !== 'N/A' ? lastDate : lgu.lastReportedAt,
      isActive: lgu.isActive !== false
    };
  });

  // Sort alphabetically by municipality (A to Z) to ensure consistent ordering with dropdowns
  return result.sort((a, b) => a.municipality.localeCompare(b.municipality));
}
