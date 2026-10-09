import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  backendApi,
  type LguRecord,
  type LguInput,
  type ProvinceRecord,
  type WarehouseRecord,
  type SupplySourceRecord,
  type KitTypeRecord
} from '../services/backendApi';
import { blockchain, generateBatchTokenId } from '../services/blockchain';
import { computeSynchronizedLgus, type SynchronizedLgu, normalizeCategoryName } from '../lib/lguSync';
import {
  findMatchingLgu,
  normalizeLguName,
  DEFAULT_PANAY_LGUS,
  DEFAULT_KIT_TYPES,
  DEFAULT_PROVINCES,
  DEFAULT_WAREHOUSES,
  DEFAULT_SUPPLY_SOURCES
} from '../lib/lguMatching';
import { parseIncidentInfo } from '../lib/incidentHelper';
import { evaluatePriorityIndicator, type PriorityColor, type PriorityLevel } from '../lib/priorityLogic';

export interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
  totalStock?: number;
  warehouseBreakdown?: Record<string, number>;
}

export type UserRole = 'Admin' | 'Receiver' | 'LGUReceiver' | 'Unregistered';

export type WarehouseName = string;
export type IncomingStatus = 'Draft' | 'Pending Verification' | 'Verified' | 'Minted' | 'Correction Requested' | 'Rejected';
export type OutgoingStatus = 'Draft' | 'Allocating' | 'Approved' | 'Packed' | 'Released' | 'In Transit' | 'Delivered' | 'Accepted' | 'Distributed' | 'Correction Requested' | 'Cancelled';
export type { PriorityColor, PriorityLevel };

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  role?: string;
  action: string;
  details: string;
  txHash?: string;
}

export interface IncomingGoods {
  id: string;
  dateReceived: string;
  fnfiCategory: string;
  quantity: number;
  unitType: string;
  expirationDate: string;
  source: string;
  destinationType: 'Warehouse' | 'LGU';
  destination: string;
  incidentCode: string;
  status: IncomingStatus;
  manifestHash: string;
  batchTokenId?: string;
  blockchainTxHash?: string;
  correctionNote?: string;
  verifiedBy?: string;
  mintedAt?: string;
  auditTrail: AuditEvent[];
}

export interface BatchAllocation {
  batchTokenId: string;
  quantity: number;
}

export interface OutgoingRelease {
  drNumber: string;
  dateAllocated: string;
  lguId?: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  amountRequested: number;
  amountApproved: number;
  sourceType?: 'Warehouse' | 'LGU';
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: OutgoingStatus;
  incidentCode: string;
  incidentDate?: string;
  reportReason?: string;
  allocatedBatches: BatchAllocation[];
  handoverContractId?: string;
  adminSignature?: string;
  senderSignature?: string;
  receiverSignature?: string;
  senderGps?: string;
  receiverGps?: string;
  destinationAddress?: string;
  blockchainTxHash?: string;
  correctionNote?: string;
  assignedTruckId?: string | null;
  assigned_truck_id?: string | null;
  auditTrail: AuditEvent[];
}

export interface LGUPriorityReport {
  id: string;
  lguId?: string;
  municipality: string;
  province: string;
  lguName: string;
  reportedAt: string;
  foodPacks: number;
  hygieneKits: number;
  familyKits: number;
  affectedFamilies: number;
  damageIndex: number;
  urgencyScore: number;
  priorityColor: PriorityColor;
  priorityLevel?: PriorityLevel;
  maxStock?: number;
  stockRate?: number;
  completionRate?: number;
  effectiveRate?: number;
  systemResponse?: string;
  recommendation: string;
}

export interface DiscrepancyReport {
  id: string;
  reportType: 'Incoming' | 'Outgoing';
  manifestNumber?: string;
  drNumber?: string;
  note: string;
  reportedByRole?: string;
  reportedByWallet?: string;
  reportedAt: string;
}

export type LGUInventoryReportInput = Omit<LGUPriorityReport, 'id' | 'reportedAt' | 'urgencyScore' | 'priorityColor' | 'recommendation'>;

const nowStamp = () => new Date().toLocaleString('en-PH', { hour12: false });

const makeAudit = (
  action: string,
  details: string,
  txHash?: string,
  actor?: { name?: string; role?: string }
): AuditEvent => ({
  id: `AUD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  timestamp: nowStamp(),
  actor: actor?.name || 'System / Unattributed',
  role: actor?.role,
  action,
  details,
  txHash
});

const makeManifestHash = (item: Pick<IncomingGoods, 'dateReceived' | 'fnfiCategory' | 'quantity' | 'expirationDate' | 'source' | 'destination'>) => {
  const raw = `${item.dateReceived}|${item.fnfiCategory}|${item.quantity}|${item.expirationDate}|${item.source}|${item.destination}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `MANIFEST-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
};

const normalizeWarehouseName = (value: string): WarehouseName | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'oton main warehouse' || normalized === 'oton warehouse' || normalized === 'oton') {
    return 'Oton Main Warehouse';
  }
  if (normalized === 'pototan main warehouse' || normalized === 'pototan warehouse' || normalized === 'pototan') {
    return 'Pototan Main Warehouse';
  }
  return null;
};

const isMainWarehouse = (warehouse: string): warehouse is WarehouseName =>
  normalizeWarehouseName(warehouse) !== null;

const isIncomingStatus = (status: unknown): status is IncomingStatus =>
  typeof status === 'string' && ['Draft', 'Pending Verification', 'Verified', 'Minted', 'Correction Requested', 'Rejected'].includes(status);

const isOutgoingStatus = (status: unknown): status is OutgoingStatus =>
  typeof status === 'string' && ['Draft', 'Allocating', 'Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed', 'Correction Requested', 'Cancelled'].includes(status);

type IncomingManifestRow = {
  id: string;
  manifest_number?: string | null;
  date_received?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit_type?: string | null;
  expiration_date?: string | null;
  source?: string | null;
  destination_type?: string | null;
  destination?: string | null;
  incident_code?: string | null;
  status?: string | null;
  manifest_hash?: string | null;
  tx_hash?: string | null;
  batch_token_id?: string | null;
  minted_at?: string | null;
  wallet_address?: string | null;
  correction_note?: string | null;
  created_at?: string | null;
};

type LGUInventoryReportRow = {
  id: string;
  municipality?: string | null;
  province?: string | null;
  lgu_name?: string | null;
  reported_at?: string | null;
  food_packs?: number | null;
  hygiene_kits?: number | null;
  family_kits?: number | null;
  affected_families?: number | null;
  damage_index?: number | null;
  urgency_score?: number | null;
  priority_color?: string | null;
  recommendation?: string | null;
  created_at?: string | null;
};

type DiscrepancyReportRow = {
  id: string;
  report_type?: string | null;
  manifest_number?: string | null;
  dr_number?: string | null;
  note?: string | null;
  reported_by_role?: string | null;
  reported_by_wallet?: string | null;
  reported_at?: string | null;
  created_at?: string | null;
};

type OutgoingRequestRow = {
  id: string;
  dr_number?: string | null;
  date_allocated?: string | null;
  lgu_id?: string | null;
  lgu_name?: string | null;
  province?: string | null;
  municipality?: string | null;
  category?: string | null;
  amount_requested?: number | null;
  amount_approved?: number | null;
  warehouse_source?: string | null;
  delivery_mode?: string | null;
  delivery_status?: string | null;
  incident_code?: string | null;
  allocated_batches?: { batchTokenId?: string | null; quantity?: number | null }[] | null;
  sender_gps?: string | null;
  receiver_gps?: string | null;
  destination_address?: string | null;
  assigned_truck_id?: string | null;
  tx_hash?: string | null;
  handover_contract_id?: string | null;
  admin_signature?: string | null;
  sender_signature?: string | null;
  receiver_signature?: string | null;
  wallet_address?: string | null;
  created_at?: string | null;
};

const mapIncomingManifest = (row: IncomingManifestRow): IncomingGoods => {
  const item = {
    id: row.manifest_number ?? row.id,
    dateReceived: row.date_received ?? '',
    fnfiCategory: row.category ?? '',
    quantity: row.quantity ?? 0,
    unitType: row.unit_type ?? '',
    expirationDate: row.expiration_date ?? '',
    source: row.source ?? '',
    destinationType: row.destination_type === 'LGU' ? 'LGU' : 'Warehouse',
    destination: row.destination ?? '',
    incidentCode: row.incident_code ?? '',
    status: isIncomingStatus(row.status) ? row.status : 'Draft',
    manifestHash: row.manifest_hash ?? '',
    batchTokenId: row.batch_token_id ?? undefined,
    blockchainTxHash: row.tx_hash ?? undefined,
    mintedAt: row.minted_at ?? undefined,
    correctionNote: row.correction_note ?? undefined
  } satisfies Omit<IncomingGoods, 'auditTrail'>;

  return {
    ...item,
    manifestHash: item.manifestHash || makeManifestHash(item),
    auditTrail: []
  };
};


const computePriority = (report: Pick<LGUPriorityReport, 'foodPacks' | 'affectedFamilies' | 'damageIndex'>) => {
  const evalRes = evaluatePriorityIndicator({
    foodPacks: report.foodPacks,
    affectedFamilies: report.affectedFamilies
  });

  return {
    urgencyScore: evalRes.urgencyScore,
    priorityColor: evalRes.priorityColor,
    priorityLevel: evalRes.priorityLevel,
    stockRate: evalRes.stockRate,
    completionRate: evalRes.completionRate,
    effectiveRate: evalRes.effectiveRate,
    systemResponse: evalRes.systemResponse,
    recommendation: evalRes.systemResponse
  };
};

const mapLGUInventoryReport = (row: LGUInventoryReportRow): LGUPriorityReport => {
  const base = {
    id: row.id,
    municipality: row.municipality ?? '',
    province: row.province ?? '',
    lguName: row.lgu_name ?? '',
    reportedAt: row.reported_at ?? row.created_at ?? nowStamp(),
    foodPacks: row.food_packs ?? 0,
    hygieneKits: row.hygiene_kits ?? 0,
    familyKits: row.family_kits ?? 0,
    affectedFamilies: row.affected_families ?? 0,
    damageIndex: row.damage_index ?? 0
  };
  const computed = computePriority(base);
  const priorityColor = (row.priority_color === 'Red' || row.priority_color === 'Orange' || row.priority_color === 'Yellow' || row.priority_color === 'Green')
    ? row.priority_color
    : computed.priorityColor;

  return {
    ...base,
    urgencyScore: row.urgency_score ?? computed.urgencyScore,
    priorityColor,
    priorityLevel: computed.priorityLevel,
    stockRate: computed.stockRate,
    completionRate: computed.completionRate,
    effectiveRate: computed.effectiveRate,
    systemResponse: computed.systemResponse,
    recommendation: row.recommendation ?? computed.recommendation
  };
};

export const deduplicateLguPriorityReports = (reports: LGUPriorityReport[], lgus?: LguRecord[]): LGUPriorityReport[] => {
  const map = new Map<string, LGUPriorityReport>();

  for (const report of reports) {
    const rawMuni = report.municipality || report.lguName || '';
    const matched = lgus && lgus.length > 0 ? findMatchingLgu(lgus, rawMuni, report.province) : undefined;
    const canonical = matched?.municipality ?? (normalizeLguName(rawMuni) ? rawMuni.trim() : rawMuni.trim());
    if (!canonical) continue;

    const key = canonical.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...report, municipality: canonical });
    } else {
      const existingTime = new Date(existing.reportedAt || 0).getTime();
      const currentTime = new Date(report.reportedAt || 0).getTime();
      if (currentTime > existingTime) {
        map.set(key, { ...report, municipality: canonical });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.urgencyScore - a.urgencyScore);
};

const mapOutgoingRequest = (row: OutgoingRequestRow): OutgoingRelease => {
  const rawBatches = Array.isArray(row.allocated_batches)
    ? row.allocated_batches
    : typeof row.allocated_batches === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(row.allocated_batches);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
    : [];

  const allocatedBatches: BatchAllocation[] = rawBatches.flatMap((entry: any) => {
    const tokenId = entry?.batchTokenId || entry?.batch_token_id;
    const qty = Number(entry?.quantity ?? 0);
    if (!tokenId || qty <= 0) return [];
    return [{ batchTokenId: String(tokenId), quantity: qty }];
  });

  return {
    drNumber: row.dr_number ?? row.id,
    dateAllocated: row.date_allocated ?? '',
    lguId: row.lgu_id ?? undefined,
    lguName: row.lgu_name ?? '',
    province: row.province ?? '',
    municipality: row.municipality ?? '',
    fnfiCategory: row.category ?? '',
    amountRequested: Number(row.amount_requested ?? 0),
    amountApproved: Number(row.amount_approved ?? 0),
    warehouseSource: row.warehouse_source ?? '',
    deliveryMode: row.delivery_mode ?? '',
    deliveryStatus: isOutgoingStatus(row.delivery_status) ? row.delivery_status : 'Allocating',
    incidentCode: row.incident_code ?? '',
    incidentDate: parseIncidentInfo(row.incident_code).incidentDate || row.date_allocated || undefined,
    reportReason: parseIncidentInfo(row.incident_code).reportReason || undefined,
    allocatedBatches,
    handoverContractId: row.handover_contract_id ?? undefined,
    adminSignature: row.tx_hash ?? row.admin_signature ?? undefined,
    senderSignature: row.sender_signature ?? undefined,
    receiverSignature: row.receiver_signature ?? undefined,
    senderGps: row.sender_gps ?? undefined,
    receiverGps: row.receiver_gps ?? undefined,
    destinationAddress: row.destination_address ?? undefined,
    assignedTruckId: row.assigned_truck_id ?? undefined,
    assigned_truck_id: row.assigned_truck_id ?? undefined,
    blockchainTxHash: row.tx_hash ?? undefined,
    auditTrail: []
  };
};

const mapDiscrepancyReport = (row: DiscrepancyReportRow): DiscrepancyReport => ({
  id: row.id,
  reportType: row.report_type === 'Outgoing' ? 'Outgoing' : 'Incoming',
  manifestNumber: row.manifest_number ?? undefined,
  drNumber: row.dr_number ?? undefined,
  note: row.note ?? '',
  reportedByRole: row.reported_by_role ?? undefined,
  reportedByWallet: row.reported_by_wallet ?? undefined,
  reportedAt: row.reported_at ?? row.created_at ?? nowStamp()
});

const emptyInventoryItem = (category: string): InventoryItem => ({
  category,
  warehouseA: 0,
  warehouseB: 0
});

const calculateWarehouseInventory = (warehouses: WarehouseRecord[], kitTypes: KitTypeRecord[]): InventoryItem[] => {
  const STANDARD_CATEGORIES = ['Food Pack', 'Hygiene Kit', 'Sleeping Kit', 'Kitchen Kit', 'Family Kit', 'Laminated Sack', 'RTEF'];
  const canonicalCategories = new Set<string>(STANDARD_CATEGORIES);

  // Add custom kit types from database
  kitTypes.forEach(k => {
    if (k.name && k.isActive !== false) {
      const canonical = normalizeCategoryName(k.name);
      if (!STANDARD_CATEGORIES.includes(canonical)) {
        canonicalCategories.add(canonical || k.name.trim());
      }
    }
  });

  // Add any custom items found in warehouse currentStock
  warehouses.forEach(wh => {
    if (wh.currentStock) {
      Object.keys(wh.currentStock).forEach(cat => {
        const canonical = normalizeCategoryName(cat);
        if (!STANDARD_CATEGORIES.includes(canonical)) {
          canonicalCategories.add(canonical || cat.trim());
        }
      });
    }
  });

  const categoryNames = Array.from(canonicalCategories);
  const itemsMap = new Map<string, InventoryItem>();

  categoryNames.forEach(category => {
    let warehouseA = 0;
    let warehouseB = 0;
    const warehouseBreakdown: Record<string, number> = {};
    let totalStock = 0;

    warehouses.forEach((wh, idx) => {
      let stock = 0;
      const catLower = category.toLowerCase();
      if (category === 'Food Pack' || catLower.includes('food pack')) stock = Number(wh.foodPacks ?? 0);
      else if (category === 'Hygiene Kit' || catLower.includes('hygiene')) stock = Number(wh.hygieneKits ?? 0);
      else if (category === 'Sleeping Kit' || catLower.includes('sleeping')) stock = Number(wh.sleepingKits ?? 0);
      else if (category === 'Kitchen Kit' || catLower.includes('kitchen')) stock = Number(wh.kitchenKits ?? 0);
      else if (category === 'Family Kit' || catLower.includes('family kit')) stock = Number(wh.familyKits ?? 0);
      else if (category === 'Laminated Sack' || catLower.includes('sack')) stock = Number(wh.laminatedSacks ?? 0);
      else if (category === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) stock = Number(wh.rtef ?? 0);
      else if (wh.currentStock && wh.currentStock[category] !== undefined) stock = Number(wh.currentStock[category] ?? 0);
      else stock = 0;

      if (!Number.isFinite(stock)) stock = 0;

      warehouseBreakdown[wh.name] = stock;
      totalStock += stock;

      if (idx === 0) warehouseA = stock;
      if (idx === 1) warehouseB = stock;
    });

    itemsMap.set(category, {
      category,
      warehouseA: Number(warehouseA || 0),
      warehouseB: Number(warehouseB || 0),
      totalStock: Number(totalStock || 0),
      warehouseBreakdown
    });
  });

  return Array.from(itemsMap.values());
};

const logBackendError = (action: string) => (error: unknown) => {
  console.error(`${action} did not persist to Supabase`, error);
};

const toFriendlyTxError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const code = (error as { code?: string | number }).code;
    if (code === 4001 || code === 'ACTION_REJECTED') {
      return 'Transaction cancelled.';
    }

    if (error instanceof Error && error.message) {
      const message = error.message.split('\n')[0].trim();
      return message || fallback;
    }
  }
  return fallback;
};

export interface ActorProfile {
  fullName?: string;
  email?: string;
  role?: string;
}

export function useInventoryState(enabled = true, actorProfile?: ActorProfile | null) {
  const [integrationMode, setIntegrationMode] = useState<'backend' | 'mock'>('mock');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const currentActor = useMemo(() => {
    if (!actorProfile) return { name: 'System / Unattributed', role: 'System' };
    return {
      name: actorProfile.fullName || actorProfile.email || 'Authenticated Personnel',
      role: actorProfile.role || 'Personnel'
    };
  }, [actorProfile]);

  const audit = (action: string, details: string, txHash?: string) =>
    makeAudit(action, details, txHash, currentActor);

  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([]);
  const [outgoingReleasesList, setOutgoingReleasesList] = useState<OutgoingRelease[]>([]);
  const [lguPriorityReports, setLguPriorityReports] = useState<LGUPriorityReport[]>([]);
  const [discrepancyReports, setDiscrepancyReports] = useState<DiscrepancyReport[]>([]);

  // Master relational data directly from Supabase (with safe operational defaults)
  const [provincesList, setProvincesList] = useState<ProvinceRecord[]>(DEFAULT_PROVINCES);
  const [warehousesList, setWarehousesList] = useState<WarehouseRecord[]>(DEFAULT_WAREHOUSES);
  const [supplySourcesList, setSupplySourcesList] = useState<SupplySourceRecord[]>(DEFAULT_SUPPLY_SOURCES);
  const [kitTypesList, setKitTypesList] = useState<KitTypeRecord[]>(DEFAULT_KIT_TYPES);
  const [lgusList, setLgusList] = useState<LguRecord[]>(DEFAULT_PANAY_LGUS);

  const [adminActionsEnabled, setAdminActionsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dswd_admin_actions_enabled') === 'true';
  });

  const setAdminActionsEnabled = useCallback((enabled: boolean) => {
    setAdminActionsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dswd_admin_actions_enabled', String(enabled));
      window.dispatchEvent(new CustomEvent('dswd_admin_actions_changed', { detail: { enabled } }));
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dswd_admin_actions_enabled') {
        setAdminActionsEnabledState(e.newValue === 'true');
      }
    };
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setAdminActionsEnabledState(customEvent.detail.enabled);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dswd_admin_actions_changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dswd_admin_actions_changed', handleCustomChange);
    };
  }, []);

  // Inventory is derived from the authoritative warehouses table
  useEffect(() => {
    setInventory(calculateWarehouseInventory(warehousesList, kitTypesList));
  }, [warehousesList, kitTypesList]);

  const refreshProvinces = async () => {
    try {
      const list = await backendApi.getProvinces();
      setProvincesList(list);
    } catch (err) {
      console.warn('Failed to refresh provinces:', err);
    }
  };

  const refreshWarehouses = async () => {
    try {
      const list = await backendApi.getWarehouses();
      setWarehousesList(list);
    } catch (err) {
      console.warn('Failed to refresh warehouses:', err);
    }
  };

  const refreshSupplySources = async () => {
    try {
      const list = await backendApi.getSupplySources();
      setSupplySourcesList(list);
    } catch (err) {
      console.warn('Failed to refresh supply sources:', err);
    }
  };

  const refreshKitTypes = async () => {
    try {
      const list = await backendApi.getKitTypes();
      setKitTypesList(list);
    } catch (err) {
      console.warn('Failed to refresh kit types:', err);
    }
  };

  const addStock = (category: string, warehouse: WarehouseName, quantity: number) => {
    const canonical = normalizeCategoryName(category);
    const isOton = warehouse.toLowerCase().includes('oton');
    const isPototan = warehouse.toLowerCase().includes('pototan');

    // 1. Update authoritative warehousesList state in memory
    setWarehousesList(prev => prev.map(wh => {
      const match = wh.name.toLowerCase().includes(isOton ? 'oton' : 'pototan');
      if (!match) return wh;

      const catLower = category.toLowerCase();
      const updated = { ...wh };
      if (canonical === 'Food Pack' || catLower.includes('food pack')) updated.foodPacks = (updated.foodPacks || 0) + quantity;
      else if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) updated.hygieneKits = (updated.hygieneKits || 0) + quantity;
      else if (canonical === 'Sleeping Kit' || catLower.includes('sleeping')) updated.sleepingKits = (updated.sleepingKits || 0) + quantity;
      else if (canonical === 'Kitchen Kit' || catLower.includes('kitchen')) updated.kitchenKits = (updated.kitchenKits || 0) + quantity;
      else if (canonical === 'Family Kit' || catLower.includes('family kit')) updated.familyKits = (updated.familyKits || 0) + quantity;
      else if (canonical === 'Laminated Sack' || catLower.includes('sack')) updated.laminatedSacks = (updated.laminatedSacks || 0) + quantity;
      else if (canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) updated.rtef = (updated.rtef || 0) + quantity;

      const currentMap = { ...(updated.currentStock || {}) };
      const curVal = currentMap[canonical] !== undefined ? currentMap[canonical] : (currentMap[category] ?? 0);
      const nextVal = curVal + quantity;
      if (canonical) currentMap[canonical] = nextVal;
      currentMap[category] = nextVal;
      updated.currentStock = currentMap;
      return updated;
    }));

    // 2. Update inventory state immediately
    setInventory(prev => {
      const existingItem = prev.find(item => normalizeCategoryName(item.category) === canonical || item.category.toLowerCase() === category.toLowerCase());
      if (existingItem) {
        return prev.map(item =>
          (normalizeCategoryName(item.category) === canonical || item.category.toLowerCase() === category.toLowerCase())
            ? {
                ...item,
                warehouseA: isOton ? item.warehouseA + quantity : item.warehouseA,
                warehouseB: isPototan ? item.warehouseB + quantity : item.warehouseB,
                totalStock: (item.totalStock || 0) + quantity,
                warehouseBreakdown: {
                  ...(item.warehouseBreakdown || {}),
                  [warehouse]: ((item.warehouseBreakdown || {})[warehouse] || 0) + quantity
                }
              }
            : item
        );
      }
      return [
        ...prev,
        {
          category: canonical || category,
          warehouseA: isOton ? quantity : 0,
          warehouseB: isPototan ? quantity : 0,
          totalStock: quantity,
          warehouseBreakdown: { [warehouse]: quantity }
        }
      ];
    });

    // 3. Persist to Supabase warehouses table
    backendApi.addWarehouseStock(warehouse, category, quantity).catch(err => {
      console.warn('backendApi.addWarehouseStock error:', err);
    });
  };

  const deductStock = (category: string, warehouse: WarehouseName, quantity: number): boolean => {
    const canonical = normalizeCategoryName(category);
    const item = inventory.find(i => normalizeCategoryName(i.category) === canonical || i.category.toLowerCase() === category.toLowerCase());
    if (!item) return false;

    const currentStock = item.warehouseBreakdown?.[warehouse] ??
      (warehouse.toLowerCase().includes('oton') ? item.warehouseA : item.warehouseB);
    if (currentStock < quantity) return false;

    const isOton = warehouse.toLowerCase().includes('oton');
    const isPototan = warehouse.toLowerCase().includes('pototan');

    setWarehousesList(prev => prev.map(wh => {
      const match = wh.name.toLowerCase().includes(isOton ? 'oton' : 'pototan');
      if (!match) return wh;

      const catLower = category.toLowerCase();
      const updated = { ...wh };
      if (canonical === 'Food Pack' || catLower.includes('food pack')) updated.foodPacks = Math.max(0, (updated.foodPacks || 0) - quantity);
      else if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) updated.hygieneKits = Math.max(0, (updated.hygieneKits || 0) - quantity);
      else if (canonical === 'Sleeping Kit' || catLower.includes('sleeping')) updated.sleepingKits = Math.max(0, (updated.sleepingKits || 0) - quantity);
      else if (canonical === 'Kitchen Kit' || catLower.includes('kitchen')) updated.kitchenKits = Math.max(0, (updated.kitchenKits || 0) - quantity);
      else if (canonical === 'Family Kit' || catLower.includes('family kit')) updated.familyKits = Math.max(0, (updated.familyKits || 0) - quantity);
      else if (canonical === 'Laminated Sack' || catLower.includes('sack')) updated.laminatedSacks = Math.max(0, (updated.laminatedSacks || 0) - quantity);
      else if (canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) updated.rtef = Math.max(0, (updated.rtef || 0) - quantity);

      const currentMap = { ...(updated.currentStock || {}) };
      const curVal = currentMap[canonical] !== undefined ? currentMap[canonical] : (currentMap[category] ?? 0);
      const nextVal = Math.max(0, curVal - quantity);
      if (canonical) currentMap[canonical] = nextVal;
      currentMap[category] = nextVal;
      updated.currentStock = currentMap;
      return updated;
    }));

    setInventory(prev =>
      prev.map(it =>
        (normalizeCategoryName(it.category) === canonical || it.category.toLowerCase() === category.toLowerCase())
          ? {
              ...it,
              warehouseA: isOton ? Math.max(0, it.warehouseA - quantity) : it.warehouseA,
              warehouseB: isPototan ? Math.max(0, it.warehouseB - quantity) : it.warehouseB,
              totalStock: Math.max(0, (it.totalStock || 0) - quantity),
              warehouseBreakdown: {
                ...(it.warehouseBreakdown || {}),
                [warehouse]: Math.max(0, ((it.warehouseBreakdown || {})[warehouse] || 0) - quantity)
              }
            }
          : it
      )
    );

    backendApi.deductWarehouseStock(warehouse, category, quantity).catch(err => {
      console.warn('backendApi.deductWarehouseStock error:', err);
    });

    return true;
  };

  const getAvailableStock = (category: string, warehouse: WarehouseName): number => {
    const canonical = normalizeCategoryName(category);
    const targetWh = warehousesList.find(w => w.name.toLowerCase() === warehouse.toLowerCase());
    if (targetWh) {
      const catLower = category.toLowerCase();
      if (canonical === 'Food Pack' || catLower.includes('food pack')) return targetWh.foodPacks;
      if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) return targetWh.hygieneKits;
      if (canonical === 'Sleeping Kit' || catLower.includes('sleeping')) return targetWh.sleepingKits;
      if (canonical === 'Kitchen Kit' || catLower.includes('kitchen')) return targetWh.kitchenKits;
      if (canonical === 'Family Kit' || catLower.includes('family kit')) return targetWh.familyKits;
      if (canonical === 'Laminated Sack' || catLower.includes('sack')) return targetWh.laminatedSacks;
      if (canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) return targetWh.rtef;
      if (targetWh.currentStock) {
        if (targetWh.currentStock[category] !== undefined) return targetWh.currentStock[category];
        if (targetWh.currentStock[canonical] !== undefined) return targetWh.currentStock[canonical];
      }
    }
    const item = inventory.find(i => normalizeCategoryName(i.category) === canonical || i.category.toLowerCase() === category.toLowerCase());
    return item?.warehouseBreakdown?.[warehouse] || (warehouse.toLowerCase().includes('oton') ? item?.warehouseA : item?.warehouseB) || 0;
  };

  const addLguStock = (municipality: string, category: string, quantity: number, province?: string) => {
    const targetNorm = normalizeLguName(municipality);
    const catLower = category.toLowerCase();
    const canonical = normalizeCategoryName(category);

    setLgusList(prev => prev.map(lgu => {
      const lguNorm = normalizeLguName(lgu.municipality);
      const matchMuni = lgu.municipality.toLowerCase() === municipality.toLowerCase()
        || (targetNorm.length > 0 && lguNorm.length > 0 && targetNorm === lguNorm)
        || lgu.municipality.toLowerCase().includes(targetNorm)
        || targetNorm.includes(lgu.municipality.toLowerCase());
      const matchProv = !province || lgu.province.toLowerCase() === province.toLowerCase();
      if (!matchMuni || !matchProv) return lgu;

      const updated = { ...lgu };
      if (catLower.includes('food') || canonical === 'Food Pack') updated.foodPacks = (updated.foodPacks || 0) + quantity;
      else if (catLower.includes('hygiene') || canonical === 'Hygiene Kit') updated.hygieneKits = (updated.hygieneKits || 0) + quantity;
      else if (catLower.includes('family') || canonical === 'Family Kit') updated.familyKits = (updated.familyKits || 0) + quantity;
      else if (catLower.includes('sleeping') || canonical === 'Sleeping Kit') updated.sleepingKits = (updated.sleepingKits || 0) + quantity;
      else if (catLower.includes('kitchen') || canonical === 'Kitchen Kit') updated.kitchenKits = (updated.kitchenKits || 0) + quantity;
      else if (catLower.includes('sack') || canonical === 'Laminated Sack') updated.laminatedSacks = (updated.laminatedSacks || 0) + quantity;
      else if (catLower.includes('rtef') || canonical === 'RTEF') updated.rtef = (updated.rtef || 0) + quantity;

      const currentMap = { ...(updated.currentStock || {}) };
      const canonicalKey = canonical || category;
      currentMap[canonicalKey] = (currentMap[canonicalKey] || 0) + quantity;
      if (category !== canonicalKey) {
        currentMap[category] = currentMap[canonicalKey];
      }
      updated.currentStock = currentMap;
      return updated;
    }));

    setLguPriorityReports(prev => prev.map(rep => {
      const repNorm = normalizeLguName(rep.municipality);
      const matchMuni = rep.municipality.toLowerCase() === municipality.toLowerCase()
        || (targetNorm.length > 0 && repNorm.length > 0 && targetNorm === repNorm)
        || rep.municipality.toLowerCase().includes(targetNorm)
        || targetNorm.includes(rep.municipality.toLowerCase());
      const matchProv = !province || rep.province.toLowerCase() === province.toLowerCase();
      if (!matchMuni || !matchProv) return rep;

      const isFood = catLower.includes('food') || canonical === 'Food Pack';
      const updatedFood = isFood ? (rep.foodPacks || 0) + quantity : rep.foodPacks;
      const updatedHygiene = (catLower.includes('hygiene') || canonical === 'Hygiene Kit') ? (rep.hygieneKits || 0) + quantity : rep.hygieneKits;
      const updatedFamily = (catLower.includes('family') || canonical === 'Family Kit') ? (rep.familyKits || 0) + quantity : rep.familyKits;
      const maxStock = Number(rep.maxStock) > 0 ? Number(rep.maxStock) : 3000;

      const evalRes = evaluatePriorityIndicator({
        foodPacks: updatedFood,
        affectedFamilies: rep.affectedFamilies,
        targetQuota: maxStock
      });

      return {
        ...rep,
        foodPacks: updatedFood,
        hygieneKits: updatedHygiene,
        familyKits: updatedFamily,
        urgencyScore: evalRes.urgencyScore,
        priorityColor: evalRes.priorityColor,
        priorityLevel: evalRes.priorityLevel,
        stockRate: evalRes.stockRate,
        completionRate: evalRes.completionRate,
        effectiveRate: evalRes.effectiveRate,
        systemResponse: evalRes.systemResponse
      };
    }));

    backendApi.addLguStock(municipality, category, quantity, province).catch(err => {
      console.warn('backendApi.addLguStock error:', err);
    });
  };

  const editLgu = async (id: string, updates: Partial<LguInput>): Promise<{ ok: boolean; message: string }> => {
    try {
      setLgusList(prev => prev.map(lgu => {
        if (lgu.id !== id) return lgu;
        const initial = updates.initialStock || {};
        const canonicalInitial: Record<string, number> = {};
        Object.entries(initial).forEach(([k, v]) => {
          const canonical = normalizeCategoryName(k);
          const val = Number(v) || 0;
          if (canonical) canonicalInitial[canonical] = val;
          canonicalInitial[k] = val;
        });

        const nextCurrentStock = updates.initialStock
          ? { ...(lgu.currentStock || {}), ...canonicalInitial }
          : lgu.currentStock;

        return {
          ...lgu,
          ...updates,
          foodPacks: canonicalInitial['Food Pack'] !== undefined ? canonicalInitial['Food Pack'] : lgu.foodPacks,
          hygieneKits: canonicalInitial['Hygiene Kit'] !== undefined ? canonicalInitial['Hygiene Kit'] : lgu.hygieneKits,
          sleepingKits: canonicalInitial['Sleeping Kit'] !== undefined ? canonicalInitial['Sleeping Kit'] : lgu.sleepingKits,
          kitchenKits: canonicalInitial['Kitchen Kit'] !== undefined ? canonicalInitial['Kitchen Kit'] : lgu.kitchenKits,
          familyKits: canonicalInitial['Family Kit'] !== undefined ? canonicalInitial['Family Kit'] : lgu.familyKits,
          laminatedSacks: canonicalInitial['Laminated Sack'] !== undefined ? canonicalInitial['Laminated Sack'] : lgu.laminatedSacks,
          rtef: canonicalInitial['RTEF'] !== undefined ? canonicalInitial['RTEF'] : lgu.rtef,
          maxStock: updates.maxStock !== undefined ? Number(updates.maxStock) || 3000 : (lgu.maxStock ?? 3000),
          currentStock: nextCurrentStock
        };
      }));

      setLguPriorityReports(prev => prev.map(rep => {
        if (rep.id !== id && rep.municipality.toLowerCase() !== (updates.municipality || '').toLowerCase()) return rep;
        const targetLgu = lgusList.find(l => l.id === id);
        const updatedFood = updates.initialStock?.['Food Pack'] !== undefined ? updates.initialStock['Food Pack'] : rep.foodPacks;
        const maxStock = updates.maxStock !== undefined ? Number(updates.maxStock) || 3000 : (Number(rep.maxStock) || Number(targetLgu?.maxStock) || 3000);
        const affectedFamilies = updates.affectedFamilies !== undefined ? Number(updates.affectedFamilies) : rep.affectedFamilies;
        const evalRes = evaluatePriorityIndicator({
          foodPacks: updatedFood,
          affectedFamilies,
          targetQuota: maxStock
        });
        return {
          ...rep,
          foodPacks: updatedFood,
          hygieneKits: updates.initialStock?.['Hygiene Kit'] !== undefined ? updates.initialStock['Hygiene Kit'] : rep.hygieneKits,
          familyKits: updates.initialStock?.['Family Kit'] !== undefined ? updates.initialStock['Family Kit'] : rep.familyKits,
          maxStock,
          urgencyScore: evalRes.urgencyScore,
          priorityColor: evalRes.priorityColor,
          priorityLevel: evalRes.priorityLevel,
          stockRate: evalRes.stockRate,
          completionRate: evalRes.completionRate,
          effectiveRate: evalRes.effectiveRate,
          systemResponse: evalRes.systemResponse
        };
      }));

      await backendApi.updateLgu(id, updates);
      return { ok: true, message: 'LGU profile updated successfully.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to update LGU in database.' };
    }
  };

  const addLgu = async (input: LguInput): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await backendApi.createLgu(input);
      const newRecord: LguRecord = {
        id: res.id,
        municipality: input.municipality,
        province: input.province,
        lguName: input.lguName,
        latitude: input.latitude ?? 10.7870,
        longitude: input.longitude ?? 122.3892,
        contactPerson: input.contactPerson || '',
        contactNumber: input.contactNumber || '',
        remarks: input.remarks || '',
        maxStock: input.maxStock !== undefined ? Number(input.maxStock) || 3000 : 3000,
        currentStock: input.initialStock || {},
        foodPacks: input.initialStock?.['Food Pack'] || 0,
        hygieneKits: input.initialStock?.['Hygiene Kit'] || 0,
        familyKits: input.initialStock?.['Family Kit'] || 0,
        sleepingKits: input.initialStock?.['Sleeping Kit'] || 0,
        kitchenKits: input.initialStock?.['Kitchen Kit'] || 0,
        laminatedSacks: input.initialStock?.['Laminated Sack'] || 0,
        rtef: input.initialStock?.['RTEF'] || 0,
        urgencyScore: 20,
        priorityColor: 'Green',
        recommendation: 'Stable baseline stock',
        affectedFamilies: input.affectedFamilies || 0,
        damageIndex: 0,
        isActive: true
      };
      setLgusList(prev => [...prev, newRecord]);
      return { ok: true, message: 'LGU created successfully.' };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to create LGU in database.' };
    }
  };

  const addIncomingGoods = (newGoods: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => {
    const nextIndex = incomingGoodsList.reduce((max, entry) => {
      const match = entry.id.match(/INC-\d{4}-(\d+)/i);
      if (!match) return max;
      const value = Number.parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
    const year = new Date().getFullYear();
    const newId = `INC-${year}-${String(nextIndex).padStart(3, '0')}`;
    const isLgu = newGoods.destinationType === 'LGU';
    const initialStatus: IncomingStatus = isLgu ? 'Verified' : 'Draft';
    const auditMessage = isLgu
      ? `Direct delivery of ${newGoods.quantity} ${newGoods.unitType} of ${newGoods.fnfiCategory} stocked to ${newGoods.destination} inventory.`
      : 'Incoming manifest saved as editable draft awaiting physical warehouse inspection.';

    const goodsWithId: IncomingGoods = {
      ...newGoods,
      id: newId,
      status: initialStatus,
      manifestHash: makeManifestHash(newGoods),
      verifiedBy: isLgu ? currentActor.name : undefined,
      auditTrail: [audit(isLgu ? 'Stocked to LGU' : 'Draft Created', auditMessage)]
    };
    setIncomingGoodsList(prev => [goodsWithId, ...prev]);

    // If destination is an LGU, add directly to that LGU's inventory
    if (isLgu) {
      addLguStock(newGoods.destination, newGoods.fnfiCategory, newGoods.quantity);
    } else if (newGoods.destinationType === 'Warehouse') {
      const whName = isMainWarehouse(newGoods.destination)
        ? newGoods.destination
        : (normalizeWarehouseName(newGoods.destination) || 'Oton Main Warehouse');
      addStock(newGoods.fnfiCategory, whName as WarehouseName, newGoods.quantity);
    }

    backendApi.createIncoming({
      ...newGoods,
      manifestNumber: newId,
      status: initialStatus,
      manifestHash: goodsWithId.manifestHash
    }).then(() => {
      setIntegrationMode('backend');
    }).catch(error => {
      logBackendError('Create incoming manifest')(error);
      setIntegrationMode('mock');
    });
  };

  const updateIncomingGoods = (id: string, patch: Partial<IncomingGoods>) => {
    const existing = incomingGoodsList.find(item => item.id === id);

    setIncomingGoodsList(prev => prev.map(item => {
      if (item.id !== id || item.status === 'Minted') return item;
      const updated = { ...item, ...patch };
      return {
        ...updated,
        manifestHash: makeManifestHash(updated),
        auditTrail: [audit('Edited', 'Draft receiving record edited to correct human encoding error.'), ...item.auditTrail]
      };
    }));

    // Adjust stock difference if quantity changed
    if (existing && patch.quantity !== undefined && patch.quantity !== existing.quantity) {
      const diff = patch.quantity - existing.quantity;
      const cat = patch.fnfiCategory || existing.fnfiCategory;
      const dest = patch.destination || existing.destination;
      const destType = patch.destinationType || existing.destinationType;
      if (destType === 'Warehouse') {
        const whName = isMainWarehouse(dest) ? dest : (normalizeWarehouseName(dest) || 'Oton Main Warehouse');
        addStock(cat, whName as WarehouseName, diff);
      } else if (destType === 'LGU') {
        addLguStock(dest, cat, diff);
      }
    }

    backendApi.updateIncoming(id, {
      status: patch.status,
      incidentCode: patch.incidentCode,
      category: patch.fnfiCategory,
      quantity: patch.quantity,
      unitType: patch.unitType,
      expirationDate: patch.expirationDate,
      source: patch.source,
      destinationType: patch.destinationType,
      destination: patch.destination,
      correctionNote: patch.correctionNote
    }).catch(error => {
      logBackendError('Update incoming goods')(error);
      setIntegrationMode('mock');
    });
  };

  const submitIncomingForVerification = (id: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id && item.status === 'Draft'
      ? { ...item, status: 'Pending Verification', auditTrail: [audit('Submitted for Verification', 'Draft locked for warehouse review.'), ...item.auditTrail] }
      : item));
    backendApi.updateIncoming(id, { status: 'Pending Verification' }).catch(error => {
      logBackendError('Submit incoming manifest')(error);
      setIntegrationMode('mock');
    });
  };

  const verifyIncomingReceipt = (id: string) => {
    const target = incomingGoodsList.find(item => item.id === id);
    if (target && target.destinationType === 'LGU') {
      addLguStock(target.destination, target.fnfiCategory, target.quantity);
    }

    setIncomingGoodsList(prev => prev.map(item => item.id === id && item.status === 'Pending Verification'
      ? { ...item, status: 'Verified', verifiedBy: currentActor.name, auditTrail: [audit('Verified', `Physical count and manifest details verified by ${currentActor.name}.`), ...item.auditTrail] }
      : item));
    backendApi.updateIncoming(id, { status: 'Verified' }).catch(error => {
      logBackendError('Verify incoming manifest')(error);
      setIntegrationMode('mock');
    });
  };

  const mintBatchToken = async (id: string, actorRole: UserRole = 'Admin') => {
    if (actorRole !== 'Admin') return { ok: false, message: 'RBAC: only Admin can post/mint a batch token.' };
    const item = incomingGoodsList.find(item => item.id === id);
    if (!item || item.status !== 'Verified') return { ok: false, message: 'Only verified manifests can be minted.' };
    if (item.destinationType === 'LGU') {
      return { ok: false, message: 'Direct LGU deliveries are stocked directly and do not require blockchain tokens.' };
    }

    const duplicate = incomingGoodsList.find(other => other.id !== id && other.status === 'Minted' && other.manifestHash === item.manifestHash);
    if (duplicate) {
      const duplicateRef = duplicate.batchTokenId ? `${duplicate.id} (${duplicate.batchTokenId})` : duplicate.id;
      return {
        ok: false,
        message: `Duplicate manifest detected. Existing token: ${duplicateRef}. Debug: manifestHash=${item.manifestHash}`
      };
    }

    const fallbackIndex = incomingGoodsList.reduce((max, entry) => {
      if (!entry.batchTokenId) return max;
      const match = entry.batchTokenId.match(/BATCH-\d{4}-(\d+)/i);
      if (!match) return max;
      const value = Number.parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;

    let nextBatchIndex = fallbackIndex;
    try {
      nextBatchIndex = await backendApi.getNextBatchIndex();
      setIntegrationMode('backend');
    } catch (error) {
      logBackendError('Fetch batch counter')(error);
      setIntegrationMode('mock');
    }

    const tokenId = generateBatchTokenId();
    let proof;

    try {
      await blockchain.requireConnectedWalletRole('Admin');
      proof = await blockchain.mintBatchToken({
        manifestNumber: item.id,
        batchTokenId: tokenId,
        manifestHash: item.manifestHash,
        category: item.fnfiCategory,
        quantity: item.quantity,
        destination: item.destination
      });
    } catch (error) {
      logBackendError('Mint batch token on blockchain')(error);
      const baseMessage = toFriendlyTxError(error, 'Minting failed. Please try again.');
      return { ok: false, message: `${baseMessage} Debug: manifestHash=${item.manifestHash} batchTokenId=${tokenId}` };
    }

    const mintedAt = nowStamp();

    setIncomingGoodsList(prev => prev.map(incoming => incoming.id === id
      ? {
          ...incoming,
          status: 'Minted',
          batchTokenId: tokenId,
          blockchainTxHash: proof.hash,
          mintedAt,
          auditTrail: [audit('Batch Token Minted', `Manifest hash ${incoming.manifestHash} minted as ${tokenId}.`, proof.hash), ...incoming.auditTrail]
        }
      : incoming));

    backendApi.updateIncoming(id, {
      status: 'Minted',
      manifestHash: item.manifestHash,
      txHash: proof.hash,
      batchTokenId: tokenId,
      mintedAt,
      walletAddress: proof.walletAddress
    }).catch(error => {
      logBackendError('Mint incoming manifest')(error);
      setIntegrationMode('mock');
    });

    return { ok: true, message: `${tokenId} minted and stock posted via ${proof.mode === 'contract' ? 'blockchain transaction' : 'cryptographic signature proof'}.` };
  };

  const requestIncomingCorrection = (id: string, note: string) => {
    const newReport: DiscrepancyReport = {
      id: `DISC-${Date.now()}`,
      reportType: 'Incoming',
      manifestNumber: id,
      note,
      reportedAt: nowStamp()
    };
    setDiscrepancyReports(prev => [newReport, ...prev]);

    setIncomingGoodsList(prev => prev.map(item => item.id === id
      ? { ...item, status: 'Correction Requested', correctionNote: note, auditTrail: [audit('Correction Requested', note), ...item.auditTrail] }
      : item));
    backendApi.updateIncoming(id, { status: 'Correction Requested', correctionNote: note }).catch(error => {
      logBackendError('Request incoming correction')(error);
      setIntegrationMode('mock');
    });
    backendApi.createDiscrepancyReport({
      reportType: 'Incoming',
      manifestNumber: id,
      note
    }).catch(error => {
      logBackendError('Create incoming discrepancy report')(error);
      setIntegrationMode('mock');
    });
  };

  const addOutgoingRelease = (newRelease: Omit<OutgoingRelease, 'drNumber' | 'allocatedBatches' | 'auditTrail'>) => {
    const nextIndex = outgoingReleasesList.reduce((max, release) => {
      const match = release.drNumber.match(/DR-\d{4}-(\d+)/i);
      if (!match) return max;
      const value = Number.parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
    const year = new Date().getFullYear();
    const newDR = `DR-${year}-${String(nextIndex).padStart(3, '0')}`;
    const status: OutgoingStatus = newRelease.deliveryStatus === 'Released' ? 'Approved' : (newRelease.deliveryStatus || 'Allocating');
    const matchedLgu = lgusList.find(l =>
      (newRelease.lguId && l.id === newRelease.lguId) ||
      (newRelease.municipality && l.municipality.toLowerCase() === newRelease.municipality.toLowerCase()) ||
      (newRelease.lguName && l.lguName.toLowerCase() === newRelease.lguName.toLowerCase())
    );
    const resolvedLguId = newRelease.lguId || (matchedLgu ? matchedLgu.id : undefined);

    const releaseWithDR: OutgoingRelease = {
      ...newRelease,
      lguId: resolvedLguId,
      deliveryStatus: status,
      drNumber: newDR,
      amountApproved: status === 'Draft' || status === 'Allocating' ? 0 : newRelease.amountApproved,
      allocatedBatches: [],
      auditTrail: [audit('Release Draft Created', 'Outgoing request saved before blockchain custody transfer.')]
    };
    setOutgoingReleasesList(prev => [releaseWithDR, ...prev]);

    // Immediately deduct source stock upon dispatch if release is pre-approved or released
    const approvedQty = status === 'Draft' || status === 'Allocating' ? 0 : (newRelease.amountApproved || newRelease.amountRequested || 0);
    if (approvedQty > 0 && newRelease.deliveryMode !== 'Direct Delivery') {
      if (isMainWarehouse(newRelease.warehouseSource)) {
        backendApi.deductWarehouseStock(newRelease.warehouseSource, newRelease.fnfiCategory, approvedQty)
          .catch(err => console.warn('Supabase deductWarehouseStock error:', err));
        deductStock(newRelease.fnfiCategory, newRelease.warehouseSource, approvedQty);
      } else if (newRelease.warehouseSource && (newRelease.sourceType === 'LGU' || !isMainWarehouse(newRelease.warehouseSource))) {
        backendApi.deductLguStock(newRelease.warehouseSource, newRelease.fnfiCategory, approvedQty)
          .catch(err => console.warn('Supabase deductLguStock error:', err));
      }
    }

    backendApi.createOutgoing({
      ...newRelease,
      lguId: resolvedLguId,
      drNumber: newDR,
      amountApproved: newRelease.amountApproved,
      deliveryStatus: status,
      receiverGps: newRelease.receiverGps,
      destinationAddress: newRelease.destinationAddress
    }).then(() => {
      setIntegrationMode('backend');
    }).catch(error => {
      logBackendError('Create outgoing request')(error);
      setIntegrationMode('mock');
    });
  };

  const updateOutgoingRelease = (drNumber: string, patch: Partial<OutgoingRelease>) => {
    setOutgoingReleasesList(prev => prev.map(release => {
      if (release.drNumber !== drNumber || ['Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'].includes(release.deliveryStatus)) return release;
      return {
        ...release,
        ...patch,
        auditTrail: [audit('Edited', 'Pre-handover release details edited before immutable custody event.'), ...release.auditTrail]
      };
    }));

    void backendApi.updateOutgoing(drNumber, {
      amountApproved: patch.amountApproved,
      deliveryStatus: patch.deliveryStatus,
      allocatedBatches: patch.allocatedBatches,
      receiverGps: patch.receiverGps,
      destinationAddress: patch.destinationAddress
    }).catch(err => console.warn('Supabase updateOutgoing error:', err));
  };

  const approveAllocation = async (drNumber: string, amountApproved: number): Promise<{ ok: boolean; message: string }> => {
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release) return { ok: false, message: 'Release not found.' };
    if (amountApproved <= 0 || amountApproved > release.amountRequested) {
      return { ok: false, message: 'Approved amount must be between 1 and requested amount.' };
    }

    // Validate available regional warehouse stock
    if (isMainWarehouse(release.warehouseSource) && getAvailableStock(release.fnfiCategory, release.warehouseSource) < amountApproved) {
      return { ok: false, message: 'Insufficient available warehouse stock.' };
    }

    const batchTokenId = generateBatchTokenId();
    let proof;

    try {
      await blockchain.requireConnectedWalletRole('Admin');
      proof = await blockchain.mintAndAuthorizeRelease({
        drNumber: release.drNumber,
        batchTokenId,
        category: release.fnfiCategory,
        quantity: amountApproved,
        warehouseSource: release.warehouseSource,
        lguName: release.lguName
      });
    } catch (error) {
      logBackendError('Mint and authorize release on blockchain')(error);
      return { ok: false, message: toFriendlyTxError(error, 'Authorization and batch minting failed. Administrator privileges required.') };
    }

    const allocations: BatchAllocation[] = [{ batchTokenId, quantity: amountApproved }];

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? {
          ...item,
          amountApproved,
          deliveryStatus: 'Approved',
          allocatedBatches: allocations,
          adminSignature: proof.hash,
          blockchainTxHash: proof.hash,
          auditTrail: [audit('Release Minted & Authorized', `Admin authorized dispatch and minted batch ${batchTokenId} on blockchain.`, proof.hash), ...item.auditTrail]
        }
      : item));

    try {
      await backendApi.updateOutgoing(drNumber, {
        amountApproved,
        deliveryStatus: 'Approved',
        allocatedBatches: allocations,
        txHash: proof.hash,
        adminSignature: proof.hash,
        walletAddress: proof.walletAddress
      });
      setIntegrationMode('backend');
    } catch (error) {
      logBackendError('Approve outgoing allocation')(error);
      setIntegrationMode('mock');
    }

    // Deduct stock from the source warehouse or source LGU in Supabase & local state
    if (isMainWarehouse(release.warehouseSource)) {
      backendApi.deductWarehouseStock(release.warehouseSource, release.fnfiCategory, amountApproved)
        .catch(err => console.warn('Supabase deductWarehouseStock error:', err));

      setWarehousesList(prev => {
        const updated = prev.map(wh => {
          const matchName = release.warehouseSource.replace(/main|warehouse/gi, '').trim().toLowerCase();
          if (!wh.name.toLowerCase().includes(matchName)) return wh;
          const catLower = release.fnfiCategory.toLowerCase();
          const newWh = { ...wh };
          if (catLower.includes('food pack')) newWh.foodPacks = Math.max(0, wh.foodPacks - amountApproved);
          else if (catLower.includes('hygiene')) newWh.hygieneKits = Math.max(0, wh.hygieneKits - amountApproved);
          else if (catLower.includes('sleeping')) newWh.sleepingKits = Math.max(0, wh.sleepingKits - amountApproved);
          else if (catLower.includes('kitchen')) newWh.kitchenKits = Math.max(0, wh.kitchenKits - amountApproved);
          else if (catLower.includes('family kit')) newWh.familyKits = Math.max(0, wh.familyKits - amountApproved);
          else if (catLower.includes('sack')) newWh.laminatedSacks = Math.max(0, wh.laminatedSacks - amountApproved);
          else if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) newWh.rtef = Math.max(0, wh.rtef - amountApproved);

          if (newWh.currentStock && newWh.currentStock[release.fnfiCategory] !== undefined) {
            newWh.currentStock = {
              ...newWh.currentStock,
              [release.fnfiCategory]: Math.max(0, newWh.currentStock[release.fnfiCategory] - amountApproved)
            };
          }
          return newWh;
        });
        setInventory(calculateWarehouseInventory(updated, kitTypesList));
        return updated;
      });
    } else if (release.warehouseSource && (release.sourceType === 'LGU' || !isMainWarehouse(release.warehouseSource))) {
      backendApi.deductLguStock(release.warehouseSource, release.fnfiCategory, amountApproved)
        .catch(err => console.warn('Supabase deductLguStock error:', err));
    }

    return { ok: true, message: `Release approved! Batch token ${batchTokenId} minted on blockchain with Admin signature.` };
  };

  const senderSignAndRelease = async (drNumber: string, actorRole: UserRole = 'Receiver') => {
    if (actorRole !== 'Receiver') return { ok: false, message: 'RBAC: only Receiver can sign warehouse release.' };
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release || !['Approved', 'Packed'].includes(release.deliveryStatus)) return { ok: false, message: 'Only approved/packed releases can be signed by sender.' };
    if (release.allocatedBatches.length === 0) {
      return { ok: false, message: 'No batch allocations found for this release.' };
    }

    const targetWarehouse = warehousesList.find(w => w.name.toLowerCase() === (release.warehouseSource || '').toLowerCase());
    const senderGps = targetWarehouse
      ? `${targetWarehouse.latitude.toFixed(5)}, ${targetWarehouse.longitude.toFixed(5)}`
      : '10.6975, 122.4764'; // Authoritative Oton main warehouse origin coordinate
    const handoverContractId = `HANDOVER-${drNumber.replace('DR-', '')}`;
    let proof;

    try {
      await blockchain.requireConnectedWalletRole('Receiver');
      await blockchain.assertBatchTokensExist(release.allocatedBatches.map(batch => batch.batchTokenId));
      proof = await blockchain.signRelease({
        drNumber,
        handoverContractId,
        category: release.fnfiCategory,
        quantity: release.amountApproved || release.amountRequested,
        batchTokenIds: release.allocatedBatches.map(batch => batch.batchTokenId),
        batchQuantities: release.allocatedBatches.map(batch => batch.quantity),
        from: release.warehouseSource,
        to: release.lguName,
        gps: senderGps
      });
    } catch (error) {
      logBackendError('Sign release on blockchain')(error);
      return { ok: false, message: toFriendlyTxError(error, 'Sign release failed. Please try again.') };
    }

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? {
          ...item,
          deliveryStatus: 'Released',
          handoverContractId,
          senderSignature: proof.hash,
          senderGps,
          blockchainTxHash: proof.hash,
          auditTrail: [audit('Sender Signed Handover', 'Warehouse signed release; GPS origin captured and custody transfer opened.', proof.hash), ...item.auditTrail]
        }
      : item));
    backendApi.updateOutgoing(drNumber, {
      deliveryStatus: 'Released',
      senderGps,
      txHash: proof.hash,
      handoverContractId,
      senderSignature: proof.hash,
      walletAddress: proof.walletAddress
    }).catch(error => {
      logBackendError('Sign outgoing release')(error);
      setIntegrationMode('mock');
    });
    return { ok: true, message: `Sender signature recorded via ${proof.mode === 'contract' ? 'blockchain transaction' : 'cryptographic signature proof'}.` };
  };

  const markInTransit = (drNumber: string) => {
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber && item.deliveryStatus === 'Released'
      ? { ...item, deliveryStatus: 'In Transit', auditTrail: [audit('In Transit', 'Shipment is moving to destination LGU.'), ...item.auditTrail] }
      : item));
    backendApi.updateOutgoing(drNumber, { deliveryStatus: 'In Transit' }).catch(error => {
      logBackendError('Mark outgoing in transit')(error);
      setIntegrationMode('mock');
    });
  };

  const receiverAcceptWithGps = async (
    drNumber: string,
    actorRole: UserRole = 'LGUReceiver',
    actorLguMunicipality?: string,
    explicitGps?: string
  ) => {
    if (actorRole !== 'LGUReceiver') return { ok: false, message: 'RBAC: only LGUReceiver can confirm receipt.' };
    const targetDrUpper = drNumber.trim().toUpperCase();
    const release = outgoingReleasesList.find(item => item.drNumber.trim().toUpperCase() === targetDrUpper);
    if (!release) return { ok: false, message: 'Release not found.' };
    const canonicalDr = release.drNumber;

    // Strict Destination Validation:
    if (actorLguMunicipality && actorLguMunicipality.trim()) {
      const cleanActorMuni = actorLguMunicipality.trim().toLowerCase();
      const releaseMuni = (release.municipality || '').trim().toLowerCase();
      const releaseLgu = (release.lguName || '').trim().toLowerCase();
      const releaseDest = (release.destinationAddress || '').trim().toLowerCase();

      const matches = releaseMuni.includes(cleanActorMuni) ||
                      cleanActorMuni.includes(releaseMuni) ||
                      releaseLgu.includes(cleanActorMuni) ||
                      cleanActorMuni.includes(releaseLgu) ||
                      releaseDest.includes(cleanActorMuni);

      if (!matches) {
        return {
          ok: false,
          message: `Mismatched Destination: Shipment ${canonicalDr} is designated for "${release.municipality || release.lguName || 'another LGU'}", not ${actorLguMunicipality}. Receipt rejected.`
        };
      }
    }

    // Strict Chain of Custody Validation:
    // LGU cannot receive shipments directly from Admin without Receiver transit
    if (!['In Transit', 'Delivered'].includes(release.deliveryStatus)) {
      return {
        ok: false,
        message: `Chain of Custody Violation: Shipment ${canonicalDr} is currently "${release.deliveryStatus}". It must be picked up and scanned into transit by the designated receiver before the LGU can accept it.`
      };
    }

    const lguLookup = findMatchingLgu(lgusList, release?.destinationAddress || release?.lguName || release?.municipality || '', release?.province);
    const latestGps = explicitGps || release?.receiverGps || (lguLookup ? `${lguLookup.latitude.toFixed(5)}, ${lguLookup.longitude.toFixed(5)}` : '10.7202, 122.5621');
    const handoverContractId = release.handoverContractId ?? `HANDOVER-${canonicalDr.replace('DR-', '')}`;
    let proof: { hash: string; walletAddress: string; mode: 'contract' | 'signature' };

    try {
      proof = await blockchain.confirmReceipt({
        drNumber: canonicalDr,
        handoverContractId,
        destination: release.lguName,
        gps: latestGps
      });
    } catch (confErr: any) {
      console.warn('LGU confirmReceipt error:', confErr);
      const msg = confErr?.message || 'Blockchain confirmation failed or was cancelled.';
      return { ok: false, message: msg };
    }

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber.trim().toUpperCase() === targetDrUpper && ['In Transit', 'Delivered'].includes(item.deliveryStatus)
      ? {
          ...item,
          deliveryStatus: 'Accepted',
          handoverContractId,
          receiverSignature: proof.hash,
          receiverGps: latestGps,
          blockchainTxHash: proof.hash,
          auditTrail: [audit('Receiver Accepted', 'LGU signed receipt; GPS coordinates captured and custody transfer completed.', proof.hash), ...item.auditTrail]
        }
      : item));
    // Note: Outgoing delivery confirmation strictly confirms receipt and does NOT store goods into LGU inventory.
    // LGU warehouse stock is stored strictly via incoming goods intake or explicit physical stock audit reports.

    backendApi.updateOutgoing(canonicalDr, {
      deliveryStatus: 'Accepted',
      receiverGps: latestGps,
      txHash: proof.hash,
      handoverContractId,
      receiverSignature: proof.hash,
      walletAddress: proof.walletAddress
    }).then(() => {
      backendApi.markTruckLiveLocationDoneByDr(canonicalDr).catch(() => {});
    }).catch(error => {
      logBackendError('Accept outgoing handover')(error);
    });

    return { ok: true, message: `Receiver confirmation recorded via ${proof.mode === 'contract' ? 'blockchain transaction' : 'cryptographic signature proof'}.` };
  };

  const emergencyCorrectLguStock = async (
    lguId: string,
    newStock: Record<string, number>,
    reason: string
  ): Promise<{ ok: boolean; message: string }> => {
    try {
      const targetLgu = lgusList.find(l => l.id === lguId);
      if (!targetLgu) {
        return { ok: false, message: 'LGU not found.' };
      }

      const canonicalNewStock: Record<string, number> = {};
      Object.entries(newStock).forEach(([k, v]) => {
        const canonical = normalizeCategoryName(k);
        const val = Number(v) || 0;
        if (canonical) canonicalNewStock[canonical] = val;
        canonicalNewStock[k] = val;
      });

      await backendApi.emergencyCorrectLguStock(
        lguId,
        canonicalNewStock,
        reason,
        currentActor.name
      );

      // Update in-memory lgusList state immediately
      setLgusList(prev => prev.map(lgu => {
        if (lgu.id !== lguId && lgu.municipality.toLowerCase() !== targetLgu.municipality.toLowerCase()) return lgu;
        return {
          ...lgu,
          foodPacks: canonicalNewStock['Food Pack'] !== undefined ? canonicalNewStock['Food Pack'] : lgu.foodPacks,
          hygieneKits: canonicalNewStock['Hygiene Kit'] !== undefined ? canonicalNewStock['Hygiene Kit'] : lgu.hygieneKits,
          familyKits: canonicalNewStock['Family Kit'] !== undefined ? canonicalNewStock['Family Kit'] : lgu.familyKits,
          sleepingKits: canonicalNewStock['Sleeping Kit'] !== undefined ? canonicalNewStock['Sleeping Kit'] : lgu.sleepingKits,
          kitchenKits: canonicalNewStock['Kitchen Kit'] !== undefined ? canonicalNewStock['Kitchen Kit'] : lgu.kitchenKits,
          laminatedSacks: canonicalNewStock['Laminated Sack'] !== undefined ? canonicalNewStock['Laminated Sack'] : lgu.laminatedSacks,
          rtef: canonicalNewStock['RTEF'] !== undefined ? canonicalNewStock['RTEF'] : lgu.rtef,
          currentStock: {
            ...(lgu.currentStock || {}),
            ...canonicalNewStock
          }
        };
      }));

      // Update in-memory lguPriorityReports state immediately
      setLguPriorityReports(prev => prev.map(rep => {
        if (rep.id !== lguId && rep.municipality.toLowerCase() !== targetLgu.municipality.toLowerCase()) return rep;
        const updatedFood = canonicalNewStock['Food Pack'] !== undefined ? canonicalNewStock['Food Pack'] : rep.foodPacks;
        const maxStock = Number(rep.maxStock) > 0 ? Number(rep.maxStock) : (Number(targetLgu.maxStock) > 0 ? Number(targetLgu.maxStock) : 3000);
        const evalRes = evaluatePriorityIndicator({
          foodPacks: updatedFood,
          affectedFamilies: rep.affectedFamilies,
          targetQuota: maxStock
        });
        return {
          ...rep,
          foodPacks: updatedFood,
          hygieneKits: canonicalNewStock['Hygiene Kit'] !== undefined ? canonicalNewStock['Hygiene Kit'] : rep.hygieneKits,
          familyKits: canonicalNewStock['Family Kit'] !== undefined ? canonicalNewStock['Family Kit'] : rep.familyKits,
          maxStock,
          urgencyScore: evalRes.urgencyScore,
          priorityColor: evalRes.priorityColor,
          priorityLevel: evalRes.priorityLevel,
          stockRate: evalRes.stockRate,
          completionRate: evalRes.completionRate,
          effectiveRate: evalRes.effectiveRate,
          systemResponse: evalRes.systemResponse
        };
      }));

      // Refresh full DB record in background to ensure all calculated fields are in sync
      void refreshLgus();

      return {
        ok: true,
        message: `Emergency stock correction successfully applied for ${targetLgu.municipality}, ${targetLgu.province}.`
      };
    } catch (err: any) {
      console.error('Emergency stock correction failed:', err);
      return {
        ok: false,
        message: err?.message || 'Failed to update LGU stock in database.'
      };
    }
  };

  const submitLGUInventoryReport = async (input: LGUInventoryReportInput) => {
    try {
      await blockchain.requireConnectedWalletRole('LGUReceiver');
    } catch (error) {
      return { ok: false, message: toFriendlyTxError(error, 'LGUReceiver privileges required to submit this report.') };
    }

    const computed = computePriority(input);
    const optimistic: LGUPriorityReport = {
      ...input,
      id: `LGU-RPT-${Date.now()}`,
      reportedAt: nowStamp(),
      ...computed
    };

    setLguPriorityReports(prev => deduplicateLguPriorityReports([optimistic, ...prev]));

    try {
      await backendApi.createLGUInventoryReport({ ...input, ...computed });
      setIntegrationMode('backend');
      return { ok: true, message: 'LGU inventory report submitted to Supabase and priority score recalculated.' };
    } catch (error) {
      logBackendError('Create LGU inventory report')(error);
      setIntegrationMode('mock');
      return { ok: false, message: 'Report is visible locally, but Supabase persistence failed. Check lgu_inventory_reports schema/RLS.' };
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;

    const loadDashboard = () => {
      backendApi.getDashboard()
        .then(({ incoming, outgoing, discrepancyReports: discrepancyRows }) => {
          const discList = (discrepancyRows ?? []).map(mapDiscrepancyReport);
          setDiscrepancyReports(discList);
          setIncomingGoodsList(incoming.map(row => {
            const mapped = mapIncomingManifest(row);
            if (!mapped.correctionNote) {
              const matchedDisc = discList.find(d => d.reportType === 'Incoming' && (d.manifestNumber === mapped.id || d.manifestNumber === row.manifest_number));
              if (matchedDisc) mapped.correctionNote = matchedDisc.note;
            }
            return mapped;
          }));
          setOutgoingReleasesList(outgoing.map(row => {
            const mapped = mapOutgoingRequest(row);
            if (!mapped.correctionNote) {
              const matchedDisc = discList.find(d => d.reportType === 'Outgoing' && (d.drNumber === mapped.drNumber || d.drNumber === row.dr_number));
              if (matchedDisc) mapped.correctionNote = matchedDisc.note;
            }
            return mapped;
          }));
          setIntegrationMode('backend');
        })
        .catch(() => setIntegrationMode('mock'));

      Promise.all([
        backendApi.getLgus(),
        backendApi.getProvinces(),
        backendApi.getWarehouses(),
        backendApi.getSupplySources(),
        backendApi.getKitTypes()
      ]).then(([lgus, provinces, warehouses, sources, kits]) => {
        const resolvedLgus = (lgus && lgus.length > 0) ? lgus : DEFAULT_PANAY_LGUS;
        setLgusList(resolvedLgus);
        if (provinces && provinces.length > 0) setProvincesList(provinces);
        if (warehouses && warehouses.length > 0) setWarehousesList(warehouses);
        if (sources && sources.length > 0) setSupplySourcesList(sources);
        if (kits && kits.length > 0) setKitTypesList(kits);

        const reportsFromLgus: LGUPriorityReport[] = resolvedLgus.map(l => {
          const maxStock = Number(l.maxStock) > 0 ? Number(l.maxStock) : 3000;
          const evalRes = evaluatePriorityIndicator({
            foodPacks: l.foodPacks,
            affectedFamilies: l.affectedFamilies,
            targetQuota: maxStock
          });
          return {
            id: l.id,
            lguId: l.id,
            municipality: l.municipality,
            province: l.province,
            lguName: l.lguName || `${l.municipality} Municipal Office`,
            foodPacks: l.foodPacks,
            hygieneKits: l.hygieneKits,
            familyKits: l.familyKits,
            affectedFamilies: l.affectedFamilies,
            damageIndex: l.damageIndex,
            maxStock,
            urgencyScore: evalRes.urgencyScore,
            priorityColor: evalRes.priorityColor,
            priorityLevel: evalRes.priorityLevel,
            stockRate: evalRes.stockRate,
            completionRate: evalRes.completionRate,
            effectiveRate: evalRes.effectiveRate,
            systemResponse: evalRes.systemResponse,
            recommendation: l.recommendation || evalRes.systemResponse,
            reportedAt: l.lastReportedAt || l.updatedAt || new Date().toISOString()
          };
        });
        setLguPriorityReports(reportsFromLgus);
      }).catch(err => console.warn('Failed to load master tables:', err));
    };

    loadDashboard();
    const unsubscribe = backendApi.subscribeDashboard(loadDashboard);
    const pollTimer = setInterval(loadDashboard, 5000);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
    };
  }, [enabled]);

  const refreshLgus = async () => {
    try {
      const list = await backendApi.getLgus();
      setLgusList(list);
      const reportsFromLgus: LGUPriorityReport[] = list.map(l => {
        const maxStock = Number(l.maxStock) > 0 ? Number(l.maxStock) : 3000;
        const evalRes = evaluatePriorityIndicator({
          foodPacks: l.foodPacks,
          affectedFamilies: l.affectedFamilies,
          targetQuota: maxStock
        });
        return {
          id: l.id,
          lguId: l.id,
          municipality: l.municipality,
          province: l.province,
          lguName: l.lguName || `${l.municipality} Municipal Office`,
          foodPacks: l.foodPacks,
          hygieneKits: l.hygieneKits,
          familyKits: l.familyKits,
          affectedFamilies: l.affectedFamilies,
          damageIndex: l.damageIndex,
          maxStock,
          urgencyScore: evalRes.urgencyScore,
          priorityColor: evalRes.priorityColor,
          priorityLevel: evalRes.priorityLevel,
          stockRate: evalRes.stockRate,
          completionRate: evalRes.completionRate,
          effectiveRate: evalRes.effectiveRate,
          systemResponse: evalRes.systemResponse,
          recommendation: l.recommendation || evalRes.systemResponse,
          reportedAt: l.lastReportedAt || l.updatedAt || new Date().toISOString()
        };
      });
      setLguPriorityReports(reportsFromLgus);
    } catch (err) {
      console.warn('Failed to refresh lgus:', err);
    }
  };

  const requestOutgoingCorrection = (drNumber: string, note: string) => {
    const newReport: DiscrepancyReport = {
      id: `DISC-${Date.now()}`,
      reportType: 'Outgoing',
      drNumber,
      note,
      reportedAt: nowStamp()
    };
    setDiscrepancyReports(prev => [newReport, ...prev]);

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? { ...item, deliveryStatus: 'Correction Requested', correctionNote: note, auditTrail: [makeAudit('Correction Requested', note), ...item.auditTrail] }
      : item));
    backendApi.updateOutgoing(drNumber, { deliveryStatus: 'Correction Requested' }).catch(error => {
      logBackendError('Request outgoing correction')(error);
      setIntegrationMode('mock');
    });
    backendApi.createDiscrepancyReport({
      reportType: 'Outgoing',
      drNumber,
      note
    }).catch(error => {
      logBackendError('Create outgoing discrepancy report')(error);
      setIntegrationMode('mock');
    });
  };

  const synchronizedLgusList = useMemo<SynchronizedLgu[]>(() => {
    return computeSynchronizedLgus({
      masterLgus: lgusList,
      outgoingReleases: outgoingReleasesList,
      incomingGoods: incomingGoodsList,
      lguPriorityReports: lguPriorityReports
    });
  }, [lgusList, outgoingReleasesList, incomingGoodsList, lguPriorityReports]);

  return {
    inventory,
    incomingGoodsList,
    outgoingReleasesList,
    lguPriorityReports,
    discrepancyReports,
    lgusList: synchronizedLgusList,
    synchronizedLgusList,
    addLgu,
    editLgu,
    provincesList,
    warehousesList,
    supplySourcesList,
    kitTypesList,
    refreshLgus,
    refreshProvinces,
    refreshWarehouses,
    refreshSupplySources,
    refreshKitTypes,
    addStock,
    addLguStock,
    emergencyCorrectLguStock,
    deductStock,
    getAvailableStock,
    addIncomingGoods,
    updateIncomingGoods,
    submitIncomingForVerification,
    verifyIncomingReceipt,
    mintBatchToken,
    requestIncomingCorrection,
    addOutgoingRelease,
    updateOutgoingRelease,
    approveAllocation,
    senderSignAndRelease,
    markInTransit,
    receiverAcceptWithGps,
    requestOutgoingCorrection,
    submitLGUInventoryReport,
    integrationMode,
    adminActionsEnabled,
    setAdminActionsEnabled
  };
}
