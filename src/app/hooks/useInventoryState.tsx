import { useEffect, useState } from 'react';
import {
  backendApi,
  type LguRecord,
  type ProvinceRecord,
  type WarehouseRecord,
  type SupplySourceRecord,
  type KitTypeRecord
} from '../services/backendApi';
import { blockchain, generateBatchTokenId } from '../services/blockchain';
import { findPanayLgu } from '../data/panayLguDirectory';

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
export type PriorityColor = 'Red' | 'Yellow' | 'Green';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
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
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: OutgoingStatus;
  incidentCode: string;
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

const makeAudit = (action: string, details: string, txHash?: string): AuditEvent => ({
  id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  timestamp: nowStamp(),
  actor: 'DSWD FO VI Logistics Officer',
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
    mintedAt: row.minted_at ?? undefined
  } satisfies Omit<IncomingGoods, 'auditTrail'>;

  return {
    ...item,
    manifestHash: item.manifestHash || makeManifestHash(item),
    auditTrail: [makeAudit('Loaded from Supabase', `Incoming manifest restored from database as ${item.status}.`, item.blockchainTxHash)]
  };
};


const computePriority = (report: Pick<LGUPriorityReport, 'foodPacks' | 'affectedFamilies' | 'damageIndex'>) => {
  const stockScore = report.foodPacks < 150 ? 45 : report.foodPacks < 300 ? 25 : 8;
  const demandScore = Math.min(35, Math.round(report.affectedFamilies / 30));
  const damageScore = Math.round(report.damageIndex * 0.2);
  const urgencyScore = Math.min(100, stockScore + demandScore + damageScore);
  const priorityColor: PriorityColor = urgencyScore >= 75 ? 'Red' : urgencyScore >= 50 ? 'Yellow' : 'Green';

  return {
    urgencyScore,
    priorityColor,
    recommendation:
      priorityColor === 'Red'
        ? 'Immediate restocking and dispatch recommended.'
        : priorityColor === 'Yellow'
        ? 'Prepare allocation; monitor within 24 hours.'
        : 'Sufficient stock; continue monitoring.'
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
  const priorityColor = row.priority_color === 'Red' || row.priority_color === 'Yellow' || row.priority_color === 'Green'
    ? row.priority_color
    : computed.priorityColor;

  return {
    ...base,
    urgencyScore: row.urgency_score ?? computed.urgencyScore,
    priorityColor,
    recommendation: row.recommendation ?? computed.recommendation
  };
};

export const deduplicateLguPriorityReports = (reports: LGUPriorityReport[]): LGUPriorityReport[] => {
  const map = new Map<string, LGUPriorityReport>();

  for (const report of reports) {
    const rawMuni = report.municipality || report.lguName || '';
    const canonical = findPanayLgu(rawMuni, report.province)?.municipality ?? rawMuni.trim();
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

const mapOutgoingRequest = (row: OutgoingRequestRow): OutgoingRelease => ({
  drNumber: row.dr_number ?? row.id,
  dateAllocated: row.date_allocated ?? '',
  lguId: row.lgu_id ?? undefined,
  lguName: row.lgu_name ?? '',
  province: row.province ?? '',
  municipality: row.municipality ?? '',
  fnfiCategory: row.category ?? '',
  amountRequested: row.amount_requested ?? 0,
  amountApproved: row.amount_approved ?? 0,
  warehouseSource: row.warehouse_source ?? '',
  deliveryMode: row.delivery_mode ?? '',
  deliveryStatus: isOutgoingStatus(row.delivery_status) ? row.delivery_status : 'Allocating',
  incidentCode: row.incident_code ?? '',
  allocatedBatches: (row.allocated_batches ?? []).flatMap(entry => {
    if (!entry?.batchTokenId || !entry.quantity) return [];
    return [{ batchTokenId: entry.batchTokenId, quantity: entry.quantity }];
  }),
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
  auditTrail: [makeAudit('Loaded from Supabase', `Outgoing request restored from database as ${row.delivery_status ?? 'Allocating'}.`, row.tx_hash ?? undefined)]
});

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
  const categoryNames = kitTypes.length > 0
    ? kitTypes.map(k => k.name)
    : [
        'Family Food Pack',
        'Hygiene Kit',
        'Sleeping Kit',
        'Kitchen Kit',
        'Family Kit',
        'Laminated Sacks',
        'Ready-to-Eat Food (RTEF)'
      ];

  const itemsMap = new Map<string, InventoryItem>();

  categoryNames.forEach(category => {
    let warehouseA = 0;
    let warehouseB = 0;
    const warehouseBreakdown: Record<string, number> = {};
    let totalStock = 0;

    warehouses.forEach((wh, idx) => {
      let stock = 0;
      const catLower = category.toLowerCase();
      if (catLower.includes('food pack')) stock = wh.foodPacks;
      else if (catLower.includes('hygiene')) stock = wh.hygieneKits;
      else if (catLower.includes('sleeping')) stock = wh.sleepingKits;
      else if (catLower.includes('kitchen')) stock = wh.kitchenKits;
      else if (catLower.includes('family kit')) stock = wh.familyKits;
      else if (catLower.includes('sack')) stock = wh.laminatedSacks;
      else if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) stock = wh.rtef;
      else if (wh.currentStock && wh.currentStock[category] !== undefined) stock = wh.currentStock[category];

      warehouseBreakdown[wh.name] = stock;
      totalStock += stock;

      if (idx === 0) warehouseA = stock;
      if (idx === 1) warehouseB = stock;
    });

    itemsMap.set(category, {
      category,
      warehouseA,
      warehouseB,
      totalStock,
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

export function useInventoryState(enabled = true) {
  const [integrationMode, setIntegrationMode] = useState<'backend' | 'mock'>('mock');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([]);
  const [outgoingReleasesList, setOutgoingReleasesList] = useState<OutgoingRelease[]>([]);
  const [lguPriorityReports, setLguPriorityReports] = useState<LGUPriorityReport[]>([]);
  const [discrepancyReports, setDiscrepancyReports] = useState<DiscrepancyReport[]>([]);

  // Master relational data directly from Supabase
  const [provincesList, setProvincesList] = useState<ProvinceRecord[]>([]);
  const [warehousesList, setWarehousesList] = useState<WarehouseRecord[]>([]);
  const [supplySourcesList, setSupplySourcesList] = useState<SupplySourceRecord[]>([]);
  const [kitTypesList, setKitTypesList] = useState<KitTypeRecord[]>([]);
  const [lgusList, setLgusList] = useState<LguRecord[]>([]);

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
    setInventory(prev => {
      const existingItem = prev.find(item => item.category === category);
      if (existingItem) {
        return prev.map(item =>
          item.category === category
            ? {
                ...item,
                warehouseA: warehouse.toLowerCase().includes('oton') ? item.warehouseA + quantity : item.warehouseA,
                warehouseB: warehouse.toLowerCase().includes('pototan') ? item.warehouseB + quantity : item.warehouseB,
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
          category,
          warehouseA: warehouse.toLowerCase().includes('oton') ? quantity : 0,
          warehouseB: warehouse.toLowerCase().includes('pototan') ? quantity : 0,
          totalStock: quantity,
          warehouseBreakdown: { [warehouse]: quantity }
        }
      ];
    });
  };

  const deductStock = (category: string, warehouse: WarehouseName, quantity: number): boolean => {
    const item = inventory.find(i => i.category === category);
    if (!item) return false;

    const currentStock = item.warehouseBreakdown?.[warehouse] ??
      (warehouse.toLowerCase().includes('oton') ? item.warehouseA : item.warehouseB);
    if (currentStock < quantity) return false;

    setInventory(prev =>
      prev.map(it =>
        it.category === category
          ? {
              ...it,
              warehouseA: warehouse.toLowerCase().includes('oton') ? Math.max(0, it.warehouseA - quantity) : it.warehouseA,
              warehouseB: warehouse.toLowerCase().includes('pototan') ? Math.max(0, it.warehouseB - quantity) : it.warehouseB,
              totalStock: Math.max(0, (it.totalStock || 0) - quantity),
              warehouseBreakdown: {
                ...(it.warehouseBreakdown || {}),
                [warehouse]: Math.max(0, ((it.warehouseBreakdown || {})[warehouse] || 0) - quantity)
              }
            }
          : it
      )
    );

    return true;
  };

  const getAvailableStock = (category: string, warehouse: WarehouseName): number => {
    const targetWh = warehousesList.find(w => w.name.toLowerCase() === warehouse.toLowerCase());
    if (targetWh) {
      const catLower = category.toLowerCase();
      if (catLower.includes('food pack')) return targetWh.foodPacks;
      if (catLower.includes('hygiene')) return targetWh.hygieneKits;
      if (catLower.includes('sleeping')) return targetWh.sleepingKits;
      if (catLower.includes('kitchen')) return targetWh.kitchenKits;
      if (catLower.includes('family kit')) return targetWh.familyKits;
      if (catLower.includes('sack')) return targetWh.laminatedSacks;
      if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) return targetWh.rtef;
      if (targetWh.currentStock && targetWh.currentStock[category] !== undefined) return targetWh.currentStock[category];
    }
    const item = inventory.find(i => i.category.toLowerCase() === category.toLowerCase());
    return item?.warehouseBreakdown?.[warehouse] || (warehouse.toLowerCase().includes('oton') ? item?.warehouseA : item?.warehouseB) || 0;
  };

  const addIncomingGoods = (newGoods: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => {
    const nextIndex = incomingGoodsList.reduce((max, entry) => {
      const match = entry.id.match(/INC-\d{4}-(\d+)/i);
      if (!match) return max;
      const value = Number.parseInt(match[1], 10);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
    const newId = `INC-2026-${String(nextIndex).padStart(3, '0')}`;
    const goodsWithId: IncomingGoods = {
      ...newGoods,
      id: newId,
      status: 'Draft',
      manifestHash: makeManifestHash(newGoods),
      auditTrail: [makeAudit('Draft Created', 'Incoming manifest saved as editable draft. No blockchain minting yet.')]
    };
    setIncomingGoodsList(prev => [goodsWithId, ...prev]);
    backendApi.createIncoming({
      ...newGoods,
      manifestNumber: newId,
      status: 'Draft',
      manifestHash: goodsWithId.manifestHash
    }).then(() => {
      setIntegrationMode('backend');
    }).catch(error => {
      logBackendError('Create incoming manifest')(error);
      setIntegrationMode('mock');
    });
  };

  const updateIncomingGoods = (id: string, patch: Partial<IncomingGoods>) => {
    setIncomingGoodsList(prev => prev.map(item => {
      if (item.id !== id || item.status === 'Minted') return item;
      const updated = { ...item, ...patch };
      return {
        ...updated,
        manifestHash: makeManifestHash(updated),
        auditTrail: [makeAudit('Edited', 'Pre-tokenization record edited to correct human encoding error.'), ...item.auditTrail]
      };
    }));
  };

  const submitIncomingForVerification = (id: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id && item.status === 'Draft'
      ? { ...item, status: 'Pending Verification', auditTrail: [makeAudit('Submitted for Verification', 'Draft locked for warehouse review.'), ...item.auditTrail] }
      : item));
    backendApi.updateIncoming(id, { status: 'Pending Verification' }).catch(error => {
      logBackendError('Submit incoming manifest')(error);
      setIntegrationMode('mock');
    });
  };

  const verifyIncomingReceipt = (id: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id && item.status === 'Pending Verification'
      ? { ...item, status: 'Verified', verifiedBy: 'Warehouse Supervisor', auditTrail: [makeAudit('Verified', 'Physical count and manifest details verified.'), ...item.auditTrail] }
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
      logBackendError('Mint batch token with MetaMask')(error);
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
          auditTrail: [makeAudit('Batch Token Minted', `Manifest hash ${incoming.manifestHash} minted as ${tokenId}.`, proof.hash), ...incoming.auditTrail]
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

    return { ok: true, message: `${tokenId} minted and stock posted via ${proof.mode === 'contract' ? 'blockchain transaction' : 'MetaMask signature proof'}.` };
  };

  const requestIncomingCorrection = (id: string, note: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id
      ? { ...item, status: 'Correction Requested', correctionNote: note, auditTrail: [makeAudit('Correction Requested', note), ...item.auditTrail] }
      : item));
    backendApi.updateIncoming(id, { status: 'Correction Requested' }).catch(error => {
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
    const newDR = `DR-2026-${String(nextIndex).padStart(3, '0')}`;
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
      auditTrail: [makeAudit('Release Draft Created', 'Outgoing request saved before blockchain custody transfer.')]
    };
    setOutgoingReleasesList(prev => [releaseWithDR, ...prev]);
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
        auditTrail: [makeAudit('Edited', 'Pre-handover release details edited before immutable custody event.'), ...release.auditTrail]
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
      logBackendError('Mint and authorize release with MetaMask')(error);
      return { ok: false, message: toFriendlyTxError(error, 'Authorization and batch minting failed. Please connect Admin MetaMask.') };
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
          auditTrail: [makeAudit('Release Minted & Authorized', `Admin authorized dispatch and minted batch ${batchTokenId} on blockchain.`, proof.hash), ...item.auditTrail]
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
    } else if (release.sourceType === 'LGU' && release.warehouseSource) {
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

    const senderGps = release.warehouseSource === 'Pototan Main Warehouse' ? '11.0039, 122.5364' : '10.6922, 122.4731';
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
      logBackendError('Sign release with MetaMask')(error);
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
          auditTrail: [makeAudit('Sender Signed Handover', 'Warehouse signed release; GPS origin captured and custody transfer opened.', proof.hash), ...item.auditTrail]
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
    return { ok: true, message: `Sender signature recorded via ${proof.mode === 'contract' ? 'blockchain transaction' : 'MetaMask signature proof'}.` };
  };

  const markInTransit = (drNumber: string) => {
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber && item.deliveryStatus === 'Released'
      ? { ...item, deliveryStatus: 'In Transit', auditTrail: [makeAudit('In Transit', 'Shipment is moving to destination LGU.'), ...item.auditTrail] }
      : item));
    backendApi.updateOutgoing(drNumber, { deliveryStatus: 'In Transit' }).catch(error => {
      logBackendError('Mark outgoing in transit')(error);
      setIntegrationMode('mock');
    });
  };

  const receiverAcceptWithGps = async (drNumber: string, actorRole: UserRole = 'LGUReceiver') => {
    if (actorRole !== 'LGUReceiver') return { ok: false, message: 'RBAC: only LGUReceiver can confirm receipt.' };
    const targetDrUpper = drNumber.trim().toUpperCase();
    const release = outgoingReleasesList.find(item => item.drNumber.trim().toUpperCase() === targetDrUpper);
    if (!release) return { ok: false, message: 'Release not found.' };
    const canonicalDr = release.drNumber;

    // Strict Chain of Custody Validation:
    // LGU cannot receive shipments directly from Admin without Receiver transit
    if (!['In Transit', 'Delivered'].includes(release.deliveryStatus)) {
      return {
        ok: false,
        message: `Chain of Custody Violation: Shipment ${canonicalDr} is currently "${release.deliveryStatus}". It must be picked up and scanned into transit by the designated receiver before the LGU can accept it.`
      };
    }

    const lguLookup = findPanayLgu(release?.destinationAddress || release?.lguName || release?.municipality || '', release?.province);
    const latestGps = release?.receiverGps || (lguLookup ? `${lguLookup.lat}, ${lguLookup.lng}` : '10.7202, 122.5621');
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
      const msg = confErr?.message || 'MetaMask confirmation failed or was cancelled.';
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
          auditTrail: [makeAudit('Receiver Accepted', 'LGU signed receipt; GPS coordinates captured and custody transfer completed.', proof.hash), ...item.auditTrail]
        }
      : item));
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

    return { ok: true, message: `Receiver confirmation recorded via ${proof.mode === 'contract' ? 'blockchain transaction' : 'MetaMask signature proof'}.` };
  };


  const submitLGUInventoryReport = async (input: LGUInventoryReportInput) => {
    try {
      await blockchain.requireConnectedWalletRole('LGUReceiver');
    } catch (error) {
      return { ok: false, message: toFriendlyTxError(error, 'Connect the LGUReceiver MetaMask wallet to submit this report.') };
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
          setIncomingGoodsList(incoming.map(mapIncomingManifest));
          setOutgoingReleasesList(outgoing.map(mapOutgoingRequest));
          setDiscrepancyReports((discrepancyRows ?? []).map(mapDiscrepancyReport));
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
        setLgusList(lgus);
        setProvincesList(provinces);
        setWarehousesList(warehouses);
        setSupplySourcesList(sources);
        setKitTypesList(kits);

        const reportsFromLgus: LGUPriorityReport[] = lgus.map(l => ({
          id: l.id,
          municipality: l.municipality,
          province: l.province,
          lguName: l.lguName || `${l.municipality} Municipal Office`,
          foodPacks: l.foodPacks,
          hygieneKits: l.hygieneKits,
          familyKits: l.familyKits,
          affectedFamilies: l.affectedFamilies,
          damageIndex: l.damageIndex,
          urgencyScore: l.urgencyScore,
          priorityColor: l.priorityColor,
          recommendation: l.recommendation,
          reportedAt: l.lastReportedAt || l.updatedAt || new Date().toISOString()
        }));
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
      const reportsFromLgus: LGUPriorityReport[] = list.map(l => ({
        id: l.id,
        municipality: l.municipality,
        province: l.province,
        lguName: l.lguName || `${l.municipality} Municipal Office`,
        foodPacks: l.foodPacks,
        hygieneKits: l.hygieneKits,
        familyKits: l.familyKits,
        affectedFamilies: l.affectedFamilies,
        damageIndex: l.damageIndex,
        urgencyScore: l.urgencyScore,
        priorityColor: l.priorityColor,
        recommendation: l.recommendation,
        reportedAt: l.lastReportedAt || l.updatedAt || new Date().toISOString()
      }));
      setLguPriorityReports(reportsFromLgus);
    } catch (err) {
      console.warn('Failed to refresh lgus:', err);
    }
  };

  const requestOutgoingCorrection = (drNumber: string, note: string) => {
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

  return {
    inventory,
    incomingGoodsList,
    outgoingReleasesList,
    lguPriorityReports,
    discrepancyReports,
    lgusList,
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
    integrationMode
  };
}
