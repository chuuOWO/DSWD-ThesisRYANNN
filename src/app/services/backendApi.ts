import { supabase } from '../lib/supabase';
import {
  DEFAULT_PANAY_LGUS,
  DEFAULT_KIT_TYPES,
  DEFAULT_PROVINCES,
  DEFAULT_WAREHOUSES,
  DEFAULT_SUPPLY_SOURCES,
  normalizeLguName
} from '../lib/lguMatching';
import { evaluatePriorityIndicator } from '../lib/priorityLogic';
import { normalizeCategoryName } from '../lib/lguSync';
import { formatUserErrorMessage } from '../lib/errorUtils';
import { parseIncidentInfo } from '../lib/incidentHelper';
import { formatOutgoingReference } from '../lib/referenceCodeHelper';
import { blockchain } from './blockchain';

function getDrVariants(code: string): [string, string] {
  const clean = code.trim();
  const alt = clean.startsWith('INC-')
    ? `DR-${clean.slice(4)}`
    : (clean.startsWith('DR-') ? `INC-${clean.slice(3)}` : clean);
  return [clean, alt];
}

export type IncomingRecordStatus = 'Draft' | 'Pending Verification' | 'Verified' | 'Correction Requested' | 'Rejected' | 'Cancelled';

export interface IncomingPayload {
  manifestNumber: string;
  dateReceived: string;
  fnfiCategory: string;
  quantity: number;
  unitType: string;
  expirationDate: string;
  source: string;
  destinationType: 'Warehouse' | 'LGU';
  destination: string;
  incidentCode?: string;
  supplySourceId?: string;
  kitTypeId?: string;
  destinationWarehouseId?: string;
  destinationLguId?: string;
  status?: IncomingRecordStatus;
  manifestHash?: string;
  txHash?: string;
  walletAddress?: string;
}

export interface IncomingUpdatePayload {
  status?: IncomingRecordStatus;
  manifestHash?: string;
  txHash?: string;
  batchTokenId?: string;
  mintedAt?: string;
  walletAddress?: string;
  incidentCode?: string;
  category?: string;
  quantity?: number;
  unitType?: string;
  expirationDate?: string;
  source?: string;
  destinationType?: string;
  destination?: string;
  correctionNote?: string;
  verifiedBy?: string;
  verifiedByProfileId?: string;
}

export interface ProvinceRecord {
  id: string;
  name: string;
  region: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseRecord {
  id: string;
  name: string;
  province: string;
  municipality: string;
  capacityPacks: number;
  latitude: number;
  longitude: number;
  foodPacks: number;
  hygieneKits: number;
  sleepingKits: number;
  kitchenKits: number;
  familyKits: number;
  laminatedSacks: number;
  rtef: number;
  isActive: boolean;
  currentStock: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseInput {
  name: string;
  province: string;
  municipality: string;
  capacityPacks: number;
  latitude: number;
  longitude: number;
  initialStock?: Record<string, number>;
}

export interface SupplySourceRecord {
  id: string;
  name: string;
  shortCode: string;
  facilityType: string;
  region: string;
  location: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplySourceInput {
  name: string;
  shortCode: string;
  facilityType: string;
  region: string;
  location: string;
}

export interface KitTypeRecord {
  id: string;
  name: string;
  category: 'Food Item' | 'Non-Food Item';
  unitType: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KitTypeInput {
  name: string;
  category: 'Food Item' | 'Non-Food Item';
  unitType: string;
  description: string;
}

export interface TruckRecord {
  truckId: string;
  plateNumber: string;
  model: string;
  capacityKg: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TruckInput {
  truckId: string;
  plateNumber: string;
  model: string;
  capacityKg: number;
  isActive?: boolean;
}

export interface IncidentRecord {
  incidentCode: string;
  disasterName: string;
  disasterType: string;
  declaredAt?: string;
  status: 'Active' | 'Monitoring' | 'Closed';
  region: string;
}

export interface InventoryBatchRecord {
  batchTokenId: string;
  incomingManifestId?: string;
  kitTypeId?: string;
  kitName?: string;
  initialQuantity: number;
  remainingQuantity: number;
  warehouseId?: string;
  lguId?: string;
  expirationDate?: string;
  manifestHash?: string;
  mintedByProfileId?: string;
  mintedAt?: string;
}

export interface ExpiryDateBatch {
  batchTokenId: string;
  batchNumber: string;
  expirationDate: string;
  daysToExpiry: number;
  quantityAvailable: number;
  kitTypeId?: string;
  kitName?: string;
  warehouseId?: string;
  warehouseName?: string;
  lguId?: string;
  lguName?: string;
  sourceType?: 'Warehouse' | 'LGU';
}

export interface OutgoingBatchAllocationRecord {
  id: string;
  outgoingRequestId: string;
  batchTokenId: string;
  allocatedQuantity: number;
  allocatedAt: string;
}

export interface WarehouseStockRecord {
  warehouseId: string;
  kitTypeId: string;
  kitName?: string;
  quantity: number;
  updatedAt: string;
}

export interface LguStockRecord {
  lguId: string;
  kitTypeId: string;
  kitName?: string;
  quantity: number;
  updatedAt: string;
}

export interface StockLedgerInput {
  facilityType: 'Warehouse' | 'LGU';
  warehouseId?: string;
  lguId?: string;
  kitTypeId: string;
  deltaQuantity: number;
  balanceAfter: number;
  movementType: 'INTAKE_VERIFIED' | 'RELEASE_DISPATCHED' | 'AID_RECEIVED' | 'MUTUAL_AID_OUT' | 'AUDIT_CORRECTION';
  referenceManifestId?: string;
  referenceDrId?: string;
  actorProfileId?: string;
}

export interface CustodyHopRecord {
  id: string;
  outgoingRequestId: string;
  sequence: number;
  fromDriverProfileId?: string;
  toDriverProfileId: string;
  fromTruckId?: string;
  toTruckId?: string;
  gpsCoordinates: string;
  note?: string;
  txHash?: string;
  transferredAt: string;
}

export const DEFAULT_TRUCKS: TruckRecord[] = [
  { truckId: 'TRUCK-01', plateNumber: 'SAA-1001', model: 'Isuzu Forward 6-Wheeler (5-Ton)', capacityKg: 5000, isActive: true },
  { truckId: 'TRUCK-02', plateNumber: 'SAA-1002', model: 'Isuzu Forward 6-Wheeler (5-Ton)', capacityKg: 5000, isActive: true },
  { truckId: 'TRUCK-03', plateNumber: 'SAA-1003', model: 'Hino 500 Series (6-Ton)', capacityKg: 6000, isActive: true },
  { truckId: 'TRUCK-04', plateNumber: 'SAA-1004', model: 'Hino 500 Series (6-Ton)', capacityKg: 6000, isActive: true },
  { truckId: 'TRUCK-05', plateNumber: 'SAA-1005', model: 'Fuso Fighter (7-Ton Heavy)', capacityKg: 7000, isActive: true },
  { truckId: 'TRUCK-06', plateNumber: 'SAA-1006', model: 'Fuso Fighter (7-Ton Heavy)', capacityKg: 7000, isActive: true },
  { truckId: 'TRUCK-07', plateNumber: 'SAA-1007', model: 'Isuzu Elf Light Cargo (3-Ton)', capacityKg: 3000, isActive: true },
  { truckId: 'TRUCK-08', plateNumber: 'SAA-1008', model: 'Isuzu Elf Light Cargo (3-Ton)', capacityKg: 3000, isActive: true },
  { truckId: 'TRUCK-09', plateNumber: 'SAA-1009', model: 'Mitsubishi Canter (3-Ton)', capacityKg: 3000, isActive: true },
  { truckId: 'TRUCK-10', plateNumber: 'SAA-1010', model: 'Mitsubishi Canter (3-Ton)', capacityKg: 3000, isActive: true }
];

export const DEFAULT_INCIDENTS: IncidentRecord[] = [
  { incidentCode: 'INC-2026-PREPOSITION', disasterName: 'Regular Disaster Preparedness & Buffer Prepositioning', disasterType: 'Relief Prepositioning / Augmentation', status: 'Active', region: 'Region VI (Western Visayas)' },
  { incidentCode: 'INC-2026-TY-01', disasterName: 'Typhoon Auring (Tropical Cyclone Relief Operation)', disasterType: 'Typhoon / Tropical Cyclone', status: 'Active', region: 'Region VI (Western Visayas)' },
  { incidentCode: 'INC-2026-FLD-01', disasterName: 'Western Visayas Monsoon Inundation & Flash Floods', disasterType: 'Flood / Inundation', status: 'Active', region: 'Region VI (Western Visayas)' },
  { incidentCode: 'INC-2026-EQ-01', disasterName: 'Panay Central Fault Seismic Movement', disasterType: 'Earthquake', status: 'Active', region: 'Region VI (Western Visayas)' }
];

export interface LguRecord {
  id: string;
  municipality: string;
  province: string;
  lguName: string;
  contactPerson?: string;
  contactNumber?: string;
  latitude: number;
  longitude: number;
  remarks?: string;
  isActive?: boolean;
  foodPacks: number;
  hygieneKits: number;
  sleepingKits: number;
  kitchenKits: number;
  familyKits: number;
  laminatedSacks: number;
  rtef: number;
  urgencyScore: number;
  priorityColor: 'Red' | 'Orange' | 'Yellow' | 'Green';
  affectedFamilies: number;
  damageIndex: number;
  recommendation: string;
  maxStock?: number;
  lastReportedAt?: string;
  currentStock?: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export interface LguInput {
  municipality: string;
  province: string;
  lguName: string;
  contactPerson?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
  remarks?: string;
  maxStock?: number;
  initialStock?: Record<string, number>;
  affectedFamilies?: number;
}

export interface OutgoingPayload {
  drNumber: string;
  dateAllocated: string;
  lguId?: string;
  lgu_id?: string;
  destinationLguId?: string;
  destination_lgu_id?: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  category?: string;
  amountRequested: number;
  amountApproved: number;
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus?: string;
  incidentCode: string;
  incidentDate?: string;
  reportReason?: string;
  allocatedBatches?: { batchTokenId: string; quantity: number }[];
  senderGps?: string;
  receiverGps?: string;
  destinationAddress?: string;
  destination_address?: string;
  txHash?: string;
  walletAddress?: string;
  assignedTruckId?: string | null;
  assigned_truck_id?: string | null;
  assignedEscortProfileId?: string | null;
  assigned_driver_profile_id?: string | null;
  sourceWarehouseId?: string | null;
  source_warehouse_id?: string | null;
  sourceLguId?: string | null;
  source_lgu_id?: string | null;
  kitTypeId?: string | null;
  kit_type_id?: string | null;
  sourceType?: 'Warehouse' | 'LGU';
  source_type?: 'Warehouse' | 'LGU';
  deliveryPriority?: number;
  delivery_priority?: number;
  isHeld?: boolean;
  is_held?: boolean;
  correctionNote?: string;
  correction_note?: string;
}

export interface LGUInventoryReportPayload {
  municipality: string;
  province: string;
  lguName: string;
  foodPacks: number;
  hygieneKits: number;
  familyKits: number;
  affectedFamilies: number;
  damageIndex: number;
  urgencyScore: number;
  priorityColor: 'Red' | 'Orange' | 'Yellow' | 'Green';
  recommendation: string;
  lguId?: string;
  reportedByProfileId?: string;
}

export interface DiscrepancyReportPayload {
  reportType: 'Incoming' | 'Outgoing';
  manifestNumber?: string;
  drNumber?: string;
  note: string;
  reportedByRole?: string;
  reportedByWallet?: string;
  reportedByProfileId?: string;
}

export interface ActivityLogRecord {
  id: string;
  actorId?: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actorWallet?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  metadata?: Record<string, unknown>;
  txHash?: string;
  createdAt: string;
}

export interface ActivityLogInput {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  actorWallet?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
  metadata?: Record<string, unknown>;
  txHash?: string;
}

export interface EscortProfile {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  phone?: string;
  truckId?: string;
}

export interface OutgoingUpdatePayload {
  amountApproved?: number;
  amountRequested?: number;
  amount_requested?: number;
  deliveryStatus?: string;
  allocatedBatches?: { batchTokenId: string; quantity: number }[];
  senderGps?: string;
  receiverGps?: string;
  destinationAddress?: string;
  destination_address?: string;
  txHash?: string;
  handoverContractId?: string;
  adminSignature?: string;
  admin_signature?: string;
  senderSignature?: string;
  receiverSignature?: string;
  walletAddress?: string;
  assignedTruckId?: string | null;
  assigned_truck_id?: string | null;
  assignedEscortProfileId?: string | null;
  assignedDriverProfileId?: string | null;
  assigned_driver_profile_id?: string | null;
  deliveryPriority?: number;
  delivery_priority?: number;
  isHeld?: boolean;
  is_held?: boolean;
  correctionNote?: string;
  correction_note?: string;
  approvedByProfileId?: string | null;
  dispatchedByProfileId?: string | null;
  receivedByProfileId?: string | null;
}

export interface TruckLiveLocation {
  truck_id: string;
  current_dr_number?: string | null;
  driver_profile_id?: string | null;
  destination_lgu_id?: string | null;
  status?: 'In Transit' | 'Loading' | 'Delivered' | 'Idle' | string | null;
  speed?: number | null;
  heading?: number | null;
  latitude: number;
  longitude: number;
  gps_text: string;
  accuracy?: number | null;
  wallet_address?: string | null;
  updated_at?: string | null;
}

export interface ReceiverReleaseRecord {
  id?: string | null;
  dr_number: string;
  date_allocated?: string | null;
  created_at?: string | null;
  lgu_id?: string | null;
  destination_lgu_id?: string | null;
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
  handover_contract_id?: string | null;
  assigned_truck_id?: string | null;
  assigned_driver_profile_id?: string | null;
  tx_hash?: string | null;
  wallet_address?: string | null;
  receiver_gps?: string | null;
  sender_gps?: string | null;
  destination_address?: string | null;
  source_type?: string | null;
  delivery_priority?: number | null;
  is_held?: boolean | null;
}

export type EscortReleaseRecord = ReceiverReleaseRecord;
export type TruckerReleaseRecord = EscortReleaseRecord;

const throwIfError = (error: unknown, context: string) => {
  if (error) {
    const message = formatUserErrorMessage(error);
    throw new Error(`${context}: ${message}`);
  }
};

export const isUuid = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(val).trim()));

const definedOnly = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

export const backendApi = {
  async resolveWarehouseId(nameOrId?: string | null): Promise<string | null> {
    if (isUuid(nameOrId)) return nameOrId!;
    const target = (nameOrId || '').toLowerCase().trim();
    if (!target) return null;
    const { data } = await supabase.from('warehouses').select('id, name');
    if (data && data.length > 0) {
      const match = data.find(w => w.name.toLowerCase() === target || target.includes(w.name.toLowerCase()) || w.name.toLowerCase().includes(target));
      if (match) return match.id;
    }
    return null;
  },

  async resolveLguId(municipalityOrId?: string | null): Promise<string | null> {
    if (isUuid(municipalityOrId)) return municipalityOrId!;
    const target = (municipalityOrId || '').toLowerCase().trim();
    if (!target) return null;
    const { data } = await supabase.from('lgus').select('id, municipality, lgu_name');
    if (data && data.length > 0) {
      const match = data.find(l =>
        l.municipality.toLowerCase() === target ||
        (l.lgu_name && l.lgu_name.toLowerCase().includes(target)) ||
        target.includes(l.municipality.toLowerCase())
      );
      if (match) return match.id;
    }
    return null;
  },

  async resolveKitTypeId(nameOrId?: string | null): Promise<string | null> {
    if (isUuid(nameOrId)) return nameOrId!;
    const target = (nameOrId || '').toLowerCase().trim();
    if (!target) return null;
    const canonical = normalizeCategoryName(target).toLowerCase();
    const { data } = await supabase.from('kit_types').select('id, name');
    if (data && data.length > 0) {
      const match = data.find(k => {
        const kName = k.name.toLowerCase();
        const kCanonical = normalizeCategoryName(kName).toLowerCase();
        return kName === target ||
               kCanonical === canonical ||
               kName.includes(target) ||
               target.includes(kName) ||
               kCanonical.includes(canonical) ||
               canonical.includes(kCanonical);
      });
      if (match) return match.id;
    }
    return null;
  },

  async resolveSupplySourceId(nameOrId?: string | null): Promise<string | null> {
    if (isUuid(nameOrId)) return nameOrId!;
    if (!nameOrId) return null;
    const target = nameOrId.toLowerCase().trim();
    const { data } = await supabase.from('supply_sources').select('id, name, short_code');
    if (data && data.length > 0) {
      const match = data.find(s =>
        (s.name && s.name.toLowerCase() === target) ||
        (s.short_code && s.short_code.toLowerCase() === target)
      );
      if (match) return match.id;
    }
    return null;
  },

  async ensureIncidentExists(rawCode?: string | null): Promise<string> {
    const cleanCode = (parseIncidentInfo(rawCode).incidentCode || rawCode || '').trim();
    if (!cleanCode) return 'INC-2026-PREPOSITION';

    try {
      const { data: existing } = await supabase
        .from('incidents')
        .select('incident_code')
        .eq('incident_code', cleanCode)
        .maybeSingle();

      if (!existing) {
        await supabase.from('incidents').insert({
          incident_code: cleanCode,
          disaster_name: cleanCode.startsWith('RIS-') ? `Request & Issue Slip ${cleanCode}` : `Disaster Incident ${cleanCode}`,
          disaster_type: cleanCode.startsWith('RIS-') ? 'Relief Augmentation / Slip' : 'Relief Operation',
          status: 'Active'
        });
      }
      return cleanCode;
    } catch {
      return 'INC-2026-PREPOSITION';
    }
  },

  async getDashboard() {
    const [
      incomingResult,
      outgoingResult,
      lguReportsResult,
      discrepancyResult,
      lgusResult,
      provincesResult,
      warehousesResult,
      sourcesResult,
      kitsResult,
      trucksResult,
      incidentsResult,
      warehouseStockResult,
      lguStockResult,
      batchesResult
    ] = await Promise.all([
      supabase.from('incoming_manifests').select('*').order('created_at', { ascending: false }),
      supabase.from('outgoing_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('lgu_inventory_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('discrepancy_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('lgus').select('*').order('province', { ascending: true }),
      supabase.from('provinces').select('*').order('name', { ascending: true }),
      supabase.from('warehouses').select('*').order('name', { ascending: true }),
      supabase.from('supply_sources').select('*').order('name', { ascending: true }),
      supabase.from('kit_types').select('*').order('name', { ascending: true }),
      supabase.from('trucks').select('*').order('truck_id', { ascending: true }),
      supabase.from('incidents').select('*').order('declared_at', { ascending: false }),
      supabase.from('warehouse_stock').select('*'),
      supabase.from('lgu_stock').select('*'),
      supabase.from('inventory_batches').select('*').order('minted_at', { ascending: false })
    ]);

    throwIfError(incomingResult.error, 'Unable to load incoming manifests');
    throwIfError(outgoingResult.error, 'Unable to load outgoing requests');

    return {
      incoming: incomingResult.data ?? [],
      outgoing: outgoingResult.data ?? [],
      lguReports: lguReportsResult.error ? [] : lguReportsResult.data ?? [],
      discrepancyReports: discrepancyResult.error ? [] : discrepancyResult.data ?? [],
      lgus: lgusResult.error ? [] : lgusResult.data ?? [],
      provinces: provincesResult.error ? [] : provincesResult.data ?? [],
      warehouses: warehousesResult.error ? [] : warehousesResult.data ?? [],
      sources: sourcesResult.error ? [] : sourcesResult.data ?? [],
      kits: kitsResult.error ? [] : kitsResult.data ?? [],
      trucks: trucksResult.error || !trucksResult.data?.length ? DEFAULT_TRUCKS : trucksResult.data.map((r: any) => ({
        truckId: String(r.truck_id || r.trk_truck_id),
        plateNumber: String(r.plate_number || r.trk_plate_number),
        model: String(r.model || r.trk_model || 'DSWD Relief Cargo Truck'),
        capacityKg: Number(r.capacity_kg || r.trk_capacity_kg || 5000),
        isActive: Boolean(r.is_active ?? r.trk_is_active ?? true),
        createdAt: r.created_at || r.trk_created_at,
        updatedAt: r.updated_at || r.trk_updated_at
      })),
      incidents: incidentsResult.error || !incidentsResult.data?.length ? DEFAULT_INCIDENTS : incidentsResult.data.map((r: any) => ({
        incidentCode: String(r.incident_code || r.incd_incident_code),
        disasterName: String(r.disaster_name || r.incd_disaster_name),
        disasterType: String(r.disaster_type || r.incd_disaster_type),
        declaredAt: r.declared_at || r.incd_declared_at,
        status: (r.status || r.incd_status || 'Active') as 'Active' | 'Monitoring' | 'Closed',
        region: String(r.region || r.incd_region || 'Region VI (Western Visayas)')
      })),
      warehouseStock: warehouseStockResult.error ? [] : (warehouseStockResult.data ?? []).map((r: any) => ({
        warehouseId: String(r.warehouse_id || r.wst_warehouse_id),
        kitTypeId: String(r.kit_type_id || r.wst_kit_type_id),
        quantity: Number(r.quantity || r.wst_quantity || 0),
        updatedAt: String(r.updated_at || r.wst_updated_at || new Date().toISOString())
      })),
      lguStock: lguStockResult.error ? [] : (lguStockResult.data ?? []).map((r: any) => ({
        lguId: String(r.lgu_id || r.lst_lgu_id),
        kitTypeId: String(r.kit_type_id || r.lst_kit_type_id),
        quantity: Number(r.quantity || r.lst_quantity || 0),
        updatedAt: String(r.updated_at || r.lst_updated_at || new Date().toISOString())
      })),
      batches: batchesResult.error ? [] : (batchesResult.data ?? []).map((r: any) => ({
        batchTokenId: String(r.batch_token_id || r.bat_batch_token_id),
        incomingManifestId: r.incoming_manifest_id || r.bat_incoming_manifest_id,
        kitTypeId: r.kit_type_id || r.bat_kit_type_id,
        initialQuantity: Number(r.initial_quantity || r.bat_initial_quantity || 0),
        remainingQuantity: Number(r.remaining_quantity || r.bat_remaining_quantity || 0),
        warehouseId: r.warehouse_id || r.bat_warehouse_id,
        lguId: r.lgu_id || r.bat_lgu_id,
        expirationDate: r.expiration_date || r.bat_expiration_date,
        manifestHash: r.manifest_hash || r.bat_manifest_hash,
        mintedByProfileId: r.minted_by_profile_id || r.bat_minted_by_profile_id,
        mintedAt: r.minted_at || r.bat_minted_at
      }))
    };
  },

  // --- PROVINCES ---
  async getProvinces(includeArchived = false): Promise<ProvinceRecord[]> {
    try {
      let query = supabase
        .from('provinces')
        .select('*')
        .order('name', { ascending: true });

      if (!includeArchived) {
        query = query.neq('is_active', false);
      }

      const { data, error } = await query;

      if (error) {
        return DEFAULT_PROVINCES;
      }

      const rows = data ?? [];
      const filtered = includeArchived ? rows : rows.filter((r: any) => r.is_active !== false);

      return filtered.map(row => ({
        id: String(row.id),
        name: String(row.name),
        region: String(row.region ?? 'Region VI (Western Visayas)'),
        isActive: Boolean(row.is_active ?? true),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch {
      return DEFAULT_PROVINCES;
    }
  },

  async createProvince(name: string, region = 'Region VI (Western Visayas)'): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('provinces')
      .insert({ name: name.trim(), region: region.trim(), is_active: true })
      .select('id')
      .single();
    throwIfError(error, 'Failed to create province');
    return data;
  },

  async updateProvince(id: string, name: string, region?: string): Promise<{ ok: boolean }> {
    const updates: Record<string, unknown> = {
      name: name.trim(),
      updated_at: new Date().toISOString()
    };
    if (region && region.trim()) updates.region = region.trim();
    const { error } = await supabase
      .from('provinces')
      .update(updates)
      .eq('id', id);
    throwIfError(error, 'Failed to update province');
    return { ok: true };
  },

  async deleteProvince(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('provinces')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to archive province');
    return { ok: true };
  },

  async restoreProvince(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('provinces')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to restore province');
    return { ok: true };
  },

  async permanentDeleteProvince(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('provinces')
      .delete()
      .eq('id', id);
    throwIfError(error, 'Failed to permanently delete province');
    return { ok: true };
  },

  async deleteProvincesBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from('provinces')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', ids);
    throwIfError(error, 'Failed to batch archive provinces');
    return { ok: true };
  },

  async restoreProvincesBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from('provinces')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .in('id', ids);
    throwIfError(error, 'Failed to batch restore provinces');
    return { ok: true };
  },

  // --- WAREHOUSES ---
  async getWarehouses(): Promise<WarehouseRecord[]> {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return DEFAULT_WAREHOUSES;
      }

      const activeWh = (data ?? []).filter((r: any) => r.is_active !== false);

      return activeWh.map(row => {
      const foodPacks = Number(row.food_packs ?? 0);
      const hygieneKits = Number(row.hygiene_kits ?? 0);
      const sleepingKits = Number(row.sleeping_kits ?? 0);
      const kitchenKits = Number(row.kitchen_kits ?? 0);
      const familyKits = Number(row.family_kits ?? 0);
      const laminatedSacks = Number(row.laminated_sacks ?? 0);
      const rtef = Number(row.rtef ?? 0);

      const rawStock = (row.current_stock && typeof row.current_stock === 'object') ? row.current_stock : {};
      const stockMerged: Record<string, number> = {
        'Family Food Pack': foodPacks,
        'Hygiene Kit': hygieneKits,
        'Sleeping Kit': sleepingKits,
        'Kitchen Kit': kitchenKits,
        'Family Kit': familyKits,
        'Laminated Sacks': laminatedSacks,
        'Ready-to-Eat Food (RTEF)': rtef,
        ...rawStock
      };

      return {
        id: String(row.id),
        name: String(row.name),
        province: String(row.province),
        municipality: String(row.municipality),
        capacityPacks: Number(row.capacity_packs ?? 50000),
        latitude: Number(row.latitude ?? 10.6975),
        longitude: Number(row.longitude ?? 122.4764),
        foodPacks,
        hygieneKits,
        sleepingKits,
        kitchenKits,
        familyKits,
        laminatedSacks,
        rtef,
        isActive: Boolean(row.is_active ?? true),
        currentStock: stockMerged,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });
    } catch {
      return DEFAULT_WAREHOUSES;
    }
  },

  async createWarehouse(payload: WarehouseInput): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('warehouses')
      .insert({
        name: payload.name.trim(),
        province: payload.province.trim(),
        municipality: payload.municipality.trim(),
        capacity_packs: payload.capacityPacks ?? 50000,
        latitude: payload.latitude ?? 10.6975,
        longitude: payload.longitude ?? 122.4764,
        food_packs: payload.initialStock?.['Family Food Pack'] ?? payload.initialStock?.['Food Pack'] ?? 0,
        hygiene_kits: payload.initialStock?.['Hygiene Kit'] || 0,
        sleeping_kits: payload.initialStock?.['Sleeping Kit'] || 0,
        kitchen_kits: payload.initialStock?.['Kitchen Kit'] || 0,
        family_kits: payload.initialStock?.['Family Kit'] || 0,
        laminated_sacks: payload.initialStock?.['Laminated Sacks'] ?? payload.initialStock?.['Laminated Sack'] ?? 0,
        rtef: payload.initialStock?.['Ready-to-Eat Food (RTEF)'] ?? payload.initialStock?.['RTEF'] ?? 0,
        current_stock: payload.initialStock || {},
        is_active: true
      })
      .select('id')
      .single();
    throwIfError(error, 'Failed to create warehouse');
    return data;
  },

  async updateWarehouse(id: string, payload: Partial<WarehouseInput>): Promise<{ ok: boolean }> {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.province !== undefined) updates.province = payload.province.trim();
    if (payload.municipality !== undefined) updates.municipality = payload.municipality.trim();
    if (payload.capacityPacks !== undefined) updates.capacity_packs = payload.capacityPacks;
    if (payload.latitude !== undefined) updates.latitude = payload.latitude;
    if (payload.longitude !== undefined) updates.longitude = payload.longitude;

    if (payload.initialStock) {
      updates.current_stock = payload.initialStock;
      if (payload.initialStock['Family Food Pack'] !== undefined) updates.food_packs = payload.initialStock['Family Food Pack'];
      else if (payload.initialStock['Food Pack'] !== undefined) updates.food_packs = payload.initialStock['Food Pack'];
      if (payload.initialStock['Hygiene Kit'] !== undefined) updates.hygiene_kits = payload.initialStock['Hygiene Kit'];
      if (payload.initialStock['Sleeping Kit'] !== undefined) updates.sleeping_kits = payload.initialStock['Sleeping Kit'];
      if (payload.initialStock['Kitchen Kit'] !== undefined) updates.kitchen_kits = payload.initialStock['Kitchen Kit'];
      if (payload.initialStock['Family Kit'] !== undefined) updates.family_kits = payload.initialStock['Family Kit'];
      if (payload.initialStock['Laminated Sacks'] !== undefined) updates.laminated_sacks = payload.initialStock['Laminated Sacks'];
      else if (payload.initialStock['Laminated Sack'] !== undefined) updates.laminated_sacks = payload.initialStock['Laminated Sack'];
      if (payload.initialStock['Ready-to-Eat Food (RTEF)'] !== undefined) updates.rtef = payload.initialStock['Ready-to-Eat Food (RTEF)'];
      else if (payload.initialStock['RTEF'] !== undefined) updates.rtef = payload.initialStock['RTEF'];
    }

    const { error } = await supabase.from('warehouses').update(updates).eq('id', id);
    throwIfError(error, 'Failed to update warehouse');
    return { ok: true };
  },

  async deleteWarehouse(id: string): Promise<{ ok: boolean; softDeleted?: boolean }> {
    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('warehouses')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        throwIfError(softErr, 'Failed to archive warehouse');
        return { ok: true, softDeleted: true };
      }
      throwIfError(error, 'Failed to delete warehouse');
    }
    return { ok: true, softDeleted: false };
  },

  async deleteWarehousesBatch(ids: string[]): Promise<{ ok: boolean; softDeletedCount?: number }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('warehouses').delete().in('id', ids);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('warehouses')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', ids);
        throwIfError(softErr, 'Failed to batch archive warehouses');
        return { ok: true, softDeletedCount: ids.length };
      }
      throwIfError(error, 'Failed to batch delete warehouses');
    }
    return { ok: true };
  },

  async restoreWarehouse(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('warehouses')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to restore warehouse');
    return { ok: true };
  },

  async deductWarehouseStock(warehouseName: string, category: string, quantity: number): Promise<{ ok: boolean }> {
    try {
      const cleanName = warehouseName.replace(/main|warehouse/gi, '').trim();
      const { data: wh } = await supabase
        .from('warehouses')
        .select('*')
        .ilike('name', `%${cleanName}%`)
        .limit(1)
        .maybeSingle();

      if (!wh) {
        console.warn(`Warehouse "${warehouseName}" not found for stock deduction.`);
        return { ok: false };
      }

      const catLower = category.toLowerCase();
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      let nextColVal = 0;
      if (catLower.includes('food pack') || catLower === 'food pack') {
        updates.food_packs = Math.max(0, (wh.food_packs || 0) - quantity);
        nextColVal = Number(updates.food_packs);
      } else if (catLower.includes('hygiene') || catLower === 'hygiene kit') {
        updates.hygiene_kits = Math.max(0, (wh.hygiene_kits || 0) - quantity);
        nextColVal = Number(updates.hygiene_kits);
      } else if (catLower.includes('sleeping') || catLower === 'sleeping kit') {
        updates.sleeping_kits = Math.max(0, (wh.sleeping_kits || 0) - quantity);
        nextColVal = Number(updates.sleeping_kits);
      } else if (catLower.includes('kitchen') || catLower === 'kitchen kit') {
        updates.kitchen_kits = Math.max(0, (wh.kitchen_kits || 0) - quantity);
        nextColVal = Number(updates.kitchen_kits);
      } else if (catLower.includes('family kit') || catLower === 'family kit') {
        updates.family_kits = Math.max(0, (wh.family_kits || 0) - quantity);
        nextColVal = Number(updates.family_kits);
      } else if (catLower.includes('sack') || catLower === 'laminated sack') {
        updates.laminated_sacks = Math.max(0, (wh.laminated_sacks || 0) - quantity);
        nextColVal = Number(updates.laminated_sacks);
      } else if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) {
        updates.rtef = Math.max(0, (wh.rtef || 0) - quantity);
        nextColVal = Number(updates.rtef);
      }

      const canonical = normalizeCategoryName(category);
      const stockMap = { ...(wh.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined
        ? Number(stockMap[canonical])
        : (canonical === 'Family Food Pack' && stockMap['Food Pack'] !== undefined
            ? Number(stockMap['Food Pack'])
            : (Number(stockMap[category]) || 0));
      const nextVal = Math.max(0, currentVal - quantity);
      stockMap[canonical] = nextVal;
      if (canonical === 'Family Food Pack' && 'Food Pack' in stockMap) {
        delete stockMap['Food Pack'];
      }
      updates.current_stock = stockMap;

      const { error } = await supabase.from('warehouses').update(updates).eq('id', wh.id);
      if (error) {
        console.error('Failed to deduct warehouse stock:', error.message);
        return { ok: false };
      }

      const kitId = await this.resolveKitTypeId(category);
      if (kitId) {
        await supabase.from('warehouse_stock').upsert(
          {
            warehouse_id: wh.id,
            kit_type_id: kitId,
            quantity: nextColVal || nextVal,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'warehouse_id, kit_type_id' }
        );
      }

      return { ok: true };
    } catch (err) {
      console.error('Error in deductWarehouseStock:', err);
      return { ok: false };
    }
  },

  async addWarehouseStock(warehouseName: string, category: string, quantity: number): Promise<{ ok: boolean }> {
    try {
      const cleanName = warehouseName.replace(/main|warehouse/gi, '').trim();
      const { data: wh } = await supabase
        .from('warehouses')
        .select('*')
        .ilike('name', `%${cleanName}%`)
        .limit(1)
        .maybeSingle();

      if (!wh) {
        console.warn(`Warehouse "${warehouseName}" not found for stock addition.`);
        return { ok: false };
      }

      const catLower = category.toLowerCase();
      const canonical = normalizeCategoryName(category);
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      let nextColVal = 0;
      if (catLower.includes('food pack') || catLower === 'food pack' || canonical === 'Food Pack') {
        updates.food_packs = (wh.food_packs || 0) + quantity;
        nextColVal = Number(updates.food_packs);
      } else if (catLower.includes('hygiene') || catLower === 'hygiene kit' || canonical === 'Hygiene Kit') {
        updates.hygiene_kits = (wh.hygiene_kits || 0) + quantity;
        nextColVal = Number(updates.hygiene_kits);
      } else if (catLower.includes('sleeping') || catLower === 'sleeping kit' || canonical === 'Sleeping Kit') {
        updates.sleeping_kits = (wh.sleeping_kits || 0) + quantity;
        nextColVal = Number(updates.sleeping_kits);
      } else if (catLower.includes('kitchen') || catLower === 'kitchen kit' || canonical === 'Kitchen Kit') {
        updates.kitchen_kits = (wh.kitchen_kits || 0) + quantity;
        nextColVal = Number(updates.kitchen_kits);
      } else if (catLower.includes('family kit') || catLower === 'family kit' || canonical === 'Family Kit') {
        updates.family_kits = (wh.family_kits || 0) + quantity;
        nextColVal = Number(updates.family_kits);
      } else if (catLower.includes('sack') || catLower === 'laminated sack' || canonical === 'Laminated Sack') {
        updates.laminated_sacks = (wh.laminated_sacks || 0) + quantity;
        nextColVal = Number(updates.laminated_sacks);
      } else if (catLower.includes('rtef') || catLower.includes('ready-to-eat') || canonical === 'RTEF') {
        updates.rtef = (wh.rtef || 0) + quantity;
        nextColVal = Number(updates.rtef);
      }

      const stockMap = { ...(wh.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined
        ? Number(stockMap[canonical])
        : (canonical === 'Family Food Pack' && stockMap['Food Pack'] !== undefined
            ? Number(stockMap['Food Pack'])
            : (Number(stockMap[category]) || 0));
      const nextVal = currentVal + quantity;
      stockMap[canonical] = nextVal;
      if (canonical === 'Family Food Pack' && 'Food Pack' in stockMap) {
        delete stockMap['Food Pack'];
      }
      updates.current_stock = stockMap;

      const { error } = await supabase.from('warehouses').update(updates).eq('id', wh.id);
      if (error) {
        console.error('Failed to add warehouse stock:', error.message);
        return { ok: false };
      }

      const kitId = await this.resolveKitTypeId(category);
      if (kitId) {
        await supabase.from('warehouse_stock').upsert(
          {
            warehouse_id: wh.id,
            kit_type_id: kitId,
            quantity: nextColVal || nextVal,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'warehouse_id, kit_type_id' }
        );
      }

      return { ok: true };
    } catch (err) {
      console.error('Error in addWarehouseStock:', err);
      return { ok: false };
    }
  },

  async deductLguStock(municipality: string, category: string, quantity: number): Promise<{ ok: boolean }> {
    try {
      const cleanMuni = municipality.trim();
      let query = supabase
        .from('lgus')
        .select('*')
        .ilike('municipality', cleanMuni);
      let { data: lgu } = await query.limit(1).maybeSingle();

      if (!lgu) {
        const norm = normalizeLguName(cleanMuni);
        if (norm) {
          const { data: fallbackLgu } = await supabase
            .from('lgus')
            .select('*')
            .ilike('municipality', norm)
            .limit(1)
            .maybeSingle();
          lgu = fallbackLgu;
        }
      }

      if (!lgu) {
        console.warn(`LGU "${cleanMuni}" not found for stock deduction.`);
        return { ok: false };
      }

      const canonical = normalizeCategoryName(category);
      const catLower = (category || '').toLowerCase();
      const kitId = await this.resolveKitTypeId(category);

      const { data: stockRows } = await supabase
        .from('lgu_stock')
        .select('kit_type_id, quantity')
        .eq('lgu_id', lgu.id);

      const stockMapByKit = new Map<string, number>();
      if (stockRows) {
        stockRows.forEach((r: any) => stockMapByKit.set(r.kit_type_id, Number(r.quantity) || 0));
      }

      const { data: latestRep } = await supabase
        .from('lgu_inventory_reports')
        .select('food_packs, hygiene_kits, family_kits')
        .eq('lgu_id', lgu.id)
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const foodKitId = await this.resolveKitTypeId('Family Food Pack');
      const hygieneKitId = await this.resolveKitTypeId('Hygiene Kit');
      const familyKitId = await this.resolveKitTypeId('Family Kit');

      let foodPacks = stockMapByKit.get(foodKitId || '') ?? latestRep?.food_packs ?? lgu.food_packs ?? 0;
      let hygieneKits = stockMapByKit.get(hygieneKitId || '') ?? latestRep?.hygiene_kits ?? lgu.hygiene_kits ?? 0;
      let familyKits = stockMapByKit.get(familyKitId || '') ?? latestRep?.family_kits ?? lgu.family_kits ?? 0;
      let rtef = lgu.rtef ?? 0;

      let nextKitVal = 0;
      if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) {
        rtef = Math.max(0, rtef - quantity);
        nextKitVal = rtef;
      } else if (canonical === 'Food Pack' || canonical === 'Family Food Pack' || catLower.includes('food pack')) {
        foodPacks = Math.max(0, foodPacks - quantity);
        nextKitVal = foodPacks;
      } else if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) {
        hygieneKits = Math.max(0, hygieneKits - quantity);
        nextKitVal = hygieneKits;
      } else if (canonical === 'Family Kit' || catLower.includes('family')) {
        familyKits = Math.max(0, familyKits - quantity);
        nextKitVal = familyKits;
      } else {
        foodPacks = Math.max(0, foodPacks - quantity);
        nextKitVal = foodPacks;
      }

      const stockMap = { ...(lgu.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined
        ? Number(stockMap[canonical])
        : (canonical === 'Family Food Pack' && stockMap['Food Pack'] !== undefined
            ? Number(stockMap['Food Pack'])
            : (Number(stockMap[category]) || 0));
      const nextVal = Math.max(0, currentVal - quantity);
      stockMap[canonical] = nextVal;
      if (canonical === 'Family Food Pack' && 'Food Pack' in stockMap) {
        delete stockMap['Food Pack'];
      }

      const evalRes = evaluatePriorityIndicator({
        targetQuota: Number(lgu.max_stock ?? 3000),
        foodPacks,
        affectedFamilies: Number(lgu.affected_families ?? 0),
        damageIndex: Number(lgu.damage_index ?? 0)
      });

      const baseUpdates: Record<string, unknown> = {
        urgency_score: evalRes.urgencyScore,
        priority_color: evalRes.priorityColor,
        recommendation: evalRes.recommendation,
        last_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const fullUpdates: Record<string, unknown> = {
        ...baseUpdates,
        food_packs: foodPacks,
        hygiene_kits: hygieneKits,
        family_kits: familyKits,
        rtef,
        current_stock: stockMap
      };

      const { error: updErr } = await supabase.from('lgus').update(fullUpdates).eq('id', lgu.id);
      if (updErr) {
        await supabase.from('lgus').update(baseUpdates).eq('id', lgu.id);
      }

      if (kitId) {
        await supabase.from('lgu_stock').upsert(
          {
            lgu_id: lgu.id,
            kit_type_id: kitId,
            quantity: nextKitVal,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'lgu_id, kit_type_id' }
        );
      }

      await supabase.from('lgu_inventory_reports').insert({
        lgu_id: lgu.id,
        municipality: lgu.municipality,
        province: lgu.province,
        lgu_name: lgu.lgu_name,
        food_packs: foodPacks,
        hygiene_kits: hygieneKits,
        family_kits: familyKits,
        affected_families: Number(lgu.affected_families ?? 0),
        damage_index: Number(lgu.damage_index ?? 0),
        urgency_score: evalRes.urgencyScore,
        priority_color: evalRes.priorityColor,
        recommendation: evalRes.recommendation,
        reported_at: new Date().toISOString()
      });

      await this.appendStockLedger({
        facilityType: 'LGU',
        lguId: lgu.id,
        kitTypeId: kitId || category,
        deltaQuantity: -quantity,
        balanceAfter: nextKitVal,
        movementType: 'MUTUAL_AID_OUT'
      });

      return { ok: true };
    } catch (err) {
      console.warn('Failed to deduct LGU stock:', err);
      return { ok: false };
    }
  },

  async addLguStock(municipality: string, category: string, quantity: number, province?: string): Promise<{ ok: boolean }> {
    try {
      const cleanMuni = municipality.trim();
      let query = supabase
        .from('lgus')
        .select('*')
        .ilike('municipality', cleanMuni);
      if (province && province.trim()) {
        query = query.ilike('province', province.trim());
      }
      let { data: lgu } = await query.limit(1).maybeSingle();

      if (!lgu) {
        const norm = normalizeLguName(cleanMuni);
        if (norm) {
          const { data: fallbackLgu } = await supabase
            .from('lgus')
            .select('*')
            .ilike('municipality', norm)
            .limit(1)
            .maybeSingle();
          lgu = fallbackLgu;
        }
      }

      if (!lgu) {
        console.warn(`LGU "${cleanMuni}" not found for stock addition.`);
        return { ok: false };
      }

      const canonical = normalizeCategoryName(category);
      const catLower = (category || '').toLowerCase();
      const kitId = await this.resolveKitTypeId(category);

      const { data: stockRows } = await supabase
        .from('lgu_stock')
        .select('kit_type_id, quantity')
        .eq('lgu_id', lgu.id);

      const stockMapByKit = new Map<string, number>();
      if (stockRows) {
        stockRows.forEach((r: any) => stockMapByKit.set(r.kit_type_id, Number(r.quantity) || 0));
      }

      const { data: latestRep } = await supabase
        .from('lgu_inventory_reports')
        .select('food_packs, hygiene_kits, family_kits')
        .eq('lgu_id', lgu.id)
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const foodKitId = await this.resolveKitTypeId('Family Food Pack');
      const hygieneKitId = await this.resolveKitTypeId('Hygiene Kit');
      const familyKitId = await this.resolveKitTypeId('Family Kit');

      let foodPacks = stockMapByKit.get(foodKitId || '') ?? latestRep?.food_packs ?? lgu.food_packs ?? 0;
      let hygieneKits = stockMapByKit.get(hygieneKitId || '') ?? latestRep?.hygiene_kits ?? lgu.hygiene_kits ?? 0;
      let familyKits = stockMapByKit.get(familyKitId || '') ?? latestRep?.family_kits ?? lgu.family_kits ?? 0;
      let rtef = lgu.rtef ?? 0;

      let nextKitVal = 0;
      if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) {
        rtef = rtef + quantity;
        nextKitVal = rtef;
      } else if (canonical === 'Food Pack' || canonical === 'Family Food Pack' || catLower.includes('food pack')) {
        foodPacks = foodPacks + quantity;
        nextKitVal = foodPacks;
      } else if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) {
        hygieneKits = hygieneKits + quantity;
        nextKitVal = hygieneKits;
      } else if (canonical === 'Family Kit' || catLower.includes('family')) {
        familyKits = familyKits + quantity;
        nextKitVal = familyKits;
      } else {
        foodPacks = foodPacks + quantity;
        nextKitVal = foodPacks;
      }

      const stockMap = { ...(lgu.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined
        ? Number(stockMap[canonical])
        : (canonical === 'Family Food Pack' && stockMap['Food Pack'] !== undefined
            ? Number(stockMap['Food Pack'])
            : (Number(stockMap[category]) || 0));
      const nextVal = currentVal + quantity;
      stockMap[canonical] = nextVal;
      if (canonical === 'Family Food Pack' && 'Food Pack' in stockMap) {
        delete stockMap['Food Pack'];
      }

      const evalRes = evaluatePriorityIndicator({
        targetQuota: Number(lgu.max_stock ?? 3000),
        foodPacks,
        affectedFamilies: Number(lgu.affected_families ?? 0),
        damageIndex: Number(lgu.damage_index ?? 0)
      });

      const baseUpdates: Record<string, unknown> = {
        urgency_score: evalRes.urgencyScore,
        priority_color: evalRes.priorityColor,
        recommendation: evalRes.recommendation,
        last_reported_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const fullUpdates: Record<string, unknown> = {
        ...baseUpdates,
        food_packs: foodPacks,
        hygiene_kits: hygieneKits,
        family_kits: familyKits,
        rtef,
        current_stock: stockMap
      };

      const { error: updErr } = await supabase.from('lgus').update(fullUpdates).eq('id', lgu.id);
      if (updErr) {
        await supabase.from('lgus').update(baseUpdates).eq('id', lgu.id);
      }

      if (kitId) {
        await supabase.from('lgu_stock').upsert(
          {
            lgu_id: lgu.id,
            kit_type_id: kitId,
            quantity: nextKitVal,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'lgu_id, kit_type_id' }
        );
      }

      await supabase.from('lgu_inventory_reports').insert({
        lgu_id: lgu.id,
        municipality: lgu.municipality,
        province: lgu.province,
        lgu_name: lgu.lgu_name,
        food_packs: foodPacks,
        hygiene_kits: hygieneKits,
        family_kits: familyKits,
        affected_families: Number(lgu.affected_families ?? 0),
        damage_index: Number(lgu.damage_index ?? 0),
        urgency_score: evalRes.urgencyScore,
        priority_color: evalRes.priorityColor,
        recommendation: evalRes.recommendation,
        reported_at: new Date().toISOString()
      });

      await this.appendStockLedger({
        facilityType: 'LGU',
        lguId: lgu.id,
        kitTypeId: kitId || category,
        deltaQuantity: quantity,
        balanceAfter: nextKitVal,
        movementType: 'INTAKE_VERIFIED'
      });

      return { ok: true };
    } catch (err) {
      console.warn('Failed to add LGU stock:', err);
      return { ok: false };
    }
  },

  async emergencyCorrectLguStock(
    lguId: string,
    stockUpdates: Record<string, number>,
    reason: string,
    actorName?: string
  ): Promise<{ ok: boolean; message?: string }> {
    const canonicalUpdates: Record<string, number> = {};
    Object.entries(stockUpdates).forEach(([k, v]) => {
      const canonical = normalizeCategoryName(k);
      const val = Number(v) || 0;
      if (canonical) {
        canonicalUpdates[canonical] = val;
      }
      canonicalUpdates[k] = val;
    });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_reported_at: new Date().toISOString()
    };

    try {
      const { data: currentLgu } = await supabase
        .from('lgus')
        .select('id, municipality, province, lgu_name, max_stock, affected_families, damage_index')
        .eq('id', lguId)
        .maybeSingle();

      if (currentLgu) {
        const targetQuota = Number(currentLgu.max_stock ?? 3000);
        const evalFood = canonicalUpdates['Food Pack'] !== undefined ? Number(canonicalUpdates['Food Pack']) : 0;
        const evalRes = evaluatePriorityIndicator({
          foodPacks: evalFood,
          affectedFamilies: Number(currentLgu.affected_families ?? 0),
          targetQuota
        });
        updates.urgency_score = evalRes.urgencyScore;
        updates.priority_color = evalRes.priorityColor;
        updates.recommendation = evalRes.systemResponse;

        await supabase.from('lgu_inventory_reports').insert({
          lgu_id: currentLgu.id,
          municipality: currentLgu.municipality,
          province: currentLgu.province,
          lgu_name: currentLgu.lgu_name,
          food_packs: canonicalUpdates['Food Pack'] || 0,
          hygiene_kits: canonicalUpdates['Hygiene Kit'] || 0,
          family_kits: canonicalUpdates['Family Kit'] || 0,
          affected_families: Number(currentLgu.affected_families ?? 0),
          damage_index: Number(currentLgu.damage_index ?? 0),
          urgency_score: evalRes.urgencyScore,
          priority_color: evalRes.priorityColor,
          recommendation: evalRes.systemResponse,
          reported_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('LGU emergency report warning:', err);
    }

    const { error } = await supabase
      .from('lgus')
      .update(updates)
      .eq('id', lguId);

    throwIfError(error, 'Failed to update LGU in database');

    await this.logActivity({
      action: 'STOCK_CORRECTION',
      entityType: 'LGU',
      entityId: lguId,
      actorName: actorName || 'Admin',
      details: `Emergency stock correction for LGU: ${reason.trim()}. Adjusted stock: ${JSON.stringify(stockUpdates)}`
    }).catch(() => {});

    return { ok: true, message: 'LGU stock overridden and audit log saved.' };
  },

  // --- SUPPLY SOURCES ---
  async getSupplySources(): Promise<SupplySourceRecord[]> {
    try {
      const { data, error } = await supabase
        .from('supply_sources')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return DEFAULT_SUPPLY_SOURCES;
      }

      const activeSources = (data ?? []).filter((r: any) => r.is_active !== false);

      return activeSources.map(row => ({
        id: String(row.id),
        name: String(row.name),
        shortCode: String(row.short_code ?? row.name),
        facilityType: String(row.facility_type ?? 'National Resource Center'),
        region: String(row.region ?? 'Region VII (Central Visayas)'),
        location: String(row.location ?? ''),
        isActive: Boolean(row.is_active ?? true),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch {
      return DEFAULT_SUPPLY_SOURCES;
    }
  },

  async createSupplySource(payload: SupplySourceInput): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('supply_sources')
      .insert({
        name: payload.name.trim(),
        short_code: payload.shortCode.trim(),
        facility_type: payload.facilityType.trim(),
        region: payload.region.trim(),
        location: payload.location.trim(),
        is_active: true
      })
      .select('id')
      .single();
    throwIfError(error, 'Failed to create supply source');
    return data;
  },

  async updateSupplySource(id: string, payload: Partial<SupplySourceInput>): Promise<{ ok: boolean }> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.shortCode !== undefined) updates.short_code = payload.shortCode.trim();
    if (payload.facilityType !== undefined) updates.facility_type = payload.facilityType.trim();
    if (payload.region !== undefined) updates.region = payload.region.trim();
    if (payload.location !== undefined) updates.location = payload.location.trim();

    const { error } = await supabase
      .from('supply_sources')
      .update(updates)
      .eq('id', id);
    throwIfError(error, 'Failed to update supply source');
    return { ok: true };
  },

  async deleteSupplySource(id: string): Promise<{ ok: boolean; softDeleted?: boolean }> {
    const { error } = await supabase.from('supply_sources').delete().eq('id', id);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('supply_sources')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        throwIfError(softErr, 'Failed to archive supply source');
        return { ok: true, softDeleted: true };
      }
      throwIfError(error, 'Failed to delete supply source');
    }
    return { ok: true, softDeleted: false };
  },

  async deleteSupplySourcesBatch(ids: string[]): Promise<{ ok: boolean; softDeletedCount?: number }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('supply_sources').delete().in('id', ids);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('supply_sources')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', ids);
        throwIfError(softErr, 'Failed to batch archive supply sources');
        return { ok: true, softDeletedCount: ids.length };
      }
      throwIfError(error, 'Failed to batch delete supply sources');
    }
    return { ok: true };
  },

  async restoreSupplySource(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('supply_sources')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to restore supply source');
    return { ok: true };
  },

  // --- KIT TYPES ---
  async getKitTypes(includeArchived = false): Promise<KitTypeRecord[]> {
    try {
      const { data, error } = await supabase
        .from('kit_types')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return includeArchived ? DEFAULT_KIT_TYPES : DEFAULT_KIT_TYPES.filter(k => k.isActive !== false);
      }

      const activeKits = includeArchived ? (data ?? []) : (data ?? []).filter((r: any) => r.is_active !== false);

      return activeKits.map(row => ({
        id: String(row.id),
        name: String(row.name),
        category: row.category === 'Food Item' ? 'Food Item' : 'Non-Food Item',
        unitType: String(row.unit_type ?? 'packs'),
        description: String(row.description ?? ''),
        isActive: Boolean(row.is_active ?? true),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch {
      return includeArchived ? DEFAULT_KIT_TYPES : DEFAULT_KIT_TYPES.filter(k => k.isActive !== false);
    }
  },

  async createKitType(payload: KitTypeInput): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('kit_types')
      .insert({
        name: payload.name.trim(),
        category: payload.category,
        unit_type: payload.unitType.trim(),
        description: payload.description.trim(),
        is_active: true
      })
      .select('id')
      .single();
    throwIfError(error, 'Failed to create kit type');
    return data;
  },

  async updateKitType(id: string, payload: Partial<KitTypeInput>): Promise<{ ok: boolean }> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.unitType !== undefined) updates.unit_type = payload.unitType.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();

    const { error } = await supabase
      .from('kit_types')
      .update(updates)
      .eq('id', id);
    throwIfError(error, 'Failed to update kit type');
    return { ok: true };
  },

  async deleteKitType(id: string): Promise<{ ok: boolean; softDeleted?: boolean }> {
    const { error } = await supabase.from('kit_types').delete().eq('id', id);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('kit_types')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        throwIfError(softErr, 'Failed to archive kit type');
        return { ok: true, softDeleted: true };
      }
      throwIfError(error, 'Failed to delete kit type');
    }
    return { ok: true, softDeleted: false };
  },

  async deleteKitTypesBatch(ids: string[]): Promise<{ ok: boolean; softDeletedCount?: number }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('kit_types').delete().in('id', ids);
    if (error) {
      if (error.code === '23503' || error.message?.includes('foreign key constraint') || error.message?.includes('violates foreign key')) {
        const { error: softErr } = await supabase
          .from('kit_types')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', ids);
        throwIfError(softErr, 'Failed to batch archive kit types');
        return { ok: true, softDeletedCount: ids.length };
      }
      throwIfError(error, 'Failed to batch delete kit types');
    }
    return { ok: true };
  },

  async restoreKitType(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('kit_types')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to restore kit type');
    return { ok: true };
  },

  // --- LGUS ---
  async getLgus(provinceFilter?: string, includeArchived = false): Promise<LguRecord[]> {
    const filteredDefaults = (provinceFilter && provinceFilter !== 'All')
      ? DEFAULT_PANAY_LGUS.filter(l => l.province.toLowerCase() === provinceFilter.trim().toLowerCase())
      : DEFAULT_PANAY_LGUS;

    try {
      let query = supabase
        .from('lgus')
        .select('*');

      if (provinceFilter && provinceFilter !== 'All') {
        query = query.ilike('province', provinceFilter.trim());
      }

      if (!includeArchived) {
        query = query.neq('is_active', false);
      }

      const { data, error } = await query
        .order('province', { ascending: true })
        .order('municipality', { ascending: true });

      if (error || !data || data.length === 0) {
        if (error) {
          console.warn('Could not fetch LGUs from Supabase, using authoritative regional directory:', error.message);
        }
        return includeArchived ? filteredDefaults : filteredDefaults.filter(l => l.isActive !== false);
      }

      const activeRows = includeArchived ? data : (data ?? []).filter((r: any) => r.is_active !== false);

      const reportsMap = new Map<string, any>();
      try {
        const { data: latestReports } = await supabase
          .from('lgu_inventory_reports')
          .select('lgu_id, municipality, food_packs, hygiene_kits, family_kits, reported_at')
          .order('reported_at', { ascending: false });
        if (latestReports) {
          for (const rep of latestReports) {
            const keyById = rep.lgu_id;
            const keyByMuni = rep.municipality?.trim().toLowerCase();
            if (keyById && !reportsMap.has(keyById)) {
              reportsMap.set(keyById, rep);
            }
            if (keyByMuni && !reportsMap.has(keyByMuni)) {
              reportsMap.set(keyByMuni, rep);
            }
          }
        }
      } catch {}

      return activeRows.map((row: Record<string, any>) => {
        const rawStock = (row.current_stock && typeof row.current_stock === 'object') ? row.current_stock : {};

        let extractedFoodPacks = Number(row.food_packs ?? 0);
        let extractedHygieneKits = Number(row.hygiene_kits ?? 0);
        let extractedSleepingKits = Number(row.sleeping_kits ?? 0);
        let extractedKitchenKits = Number(row.kitchen_kits ?? 0);
        let extractedFamilyKits = Number(row.family_kits ?? 0);
        let extractedLaminatedSacks = Number(row.laminated_sacks ?? 0);
        let extractedRtef = Number(row.rtef ?? 0);

        const rep = reportsMap.get(row.id) || reportsMap.get(String(row.municipality || '').trim().toLowerCase());
        if (rep) {
          extractedFoodPacks = Number(rep.food_packs ?? 0);
          extractedHygieneKits = Number(rep.hygiene_kits ?? 0);
          extractedFamilyKits = Number(rep.family_kits ?? 0);
        }

        Object.entries(rawStock).forEach(([key, val]) => {
          const canonical = normalizeCategoryName(key);
          const num = Number(val) || 0;
          if (canonical === 'Family Food Pack' || canonical === 'Food Pack') extractedFoodPacks = Math.max(extractedFoodPacks, num);
          else if (canonical === 'Hygiene Kit') extractedHygieneKits = Math.max(extractedHygieneKits, num);
          else if (canonical === 'Sleeping Kit') extractedSleepingKits = Math.max(extractedSleepingKits, num);
          else if (canonical === 'Kitchen Kit') extractedKitchenKits = Math.max(extractedKitchenKits, num);
          else if (canonical === 'Family Kit') extractedFamilyKits = Math.max(extractedFamilyKits, num);
          else if (canonical === 'Laminated Sacks' || canonical === 'Laminated Sack') extractedLaminatedSacks = Math.max(extractedLaminatedSacks, num);
          else if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF') extractedRtef = Math.max(extractedRtef, num);
        });

        const foodPacks = extractedFoodPacks;
        const hygieneKits = extractedHygieneKits;
        const sleepingKits = extractedSleepingKits;
        const kitchenKits = extractedKitchenKits;
        const familyKits = extractedFamilyKits;
        const laminatedSacks = extractedLaminatedSacks;
        const rtef = extractedRtef;

        const maxStock = Number(row.max_stock ?? 3000);
        const evalRes = evaluatePriorityIndicator({
          foodPacks,
          affectedFamilies: Number(row.affected_families ?? 0),
          targetQuota: maxStock
        });

        const urgencyScore = Number(row.urgency_score ?? evalRes.urgencyScore);
        const priorityColor: 'Red' | 'Yellow' | 'Green' | 'Orange' = (row.priority_color as any) || evalRes.priorityColor;

        const stockMerged: Record<string, number> = {
          'Family Food Pack': foodPacks,
          'Hygiene Kit': hygieneKits,
          'Sleeping Kit': sleepingKits,
          'Kitchen Kit': kitchenKits,
          'Family Kit': familyKits,
          'Laminated Sacks': laminatedSacks,
          'Ready-to-Eat Food (RTEF)': rtef
        };

        // Also preserve custom / dynamic non-standard categories
        Object.entries(rawStock).forEach(([key, val]) => {
          const canonical = normalizeCategoryName(key);
          if (!['Family Food Pack', 'Food Pack', 'Hygiene Kit', 'Sleeping Kit', 'Kitchen Kit', 'Family Kit', 'Laminated Sacks', 'Laminated Sack', 'Ready-to-Eat Food (RTEF)', 'RTEF'].includes(canonical)) {
            stockMerged[canonical || key] = Number(val) || 0;
          }
        });

        return {
          id: String(row.id),
          municipality: String(row.municipality),
          province: String(row.province),
          lguName: String(row.lgu_name),
          contactPerson: String(row.contact_person ?? ''),
          contactNumber: String(row.contact_number ?? ''),
          latitude: Number(row.latitude ?? 10.7870),
          longitude: Number(row.longitude ?? 122.3892),
          remarks: String(row.remarks ?? ''),
          isActive: Boolean(row.is_active ?? true),
          foodPacks,
          hygieneKits,
          sleepingKits,
          kitchenKits,
          familyKits,
          laminatedSacks,
          rtef,
          urgencyScore,
          priorityColor,
          affectedFamilies: Number(row.affected_families ?? 0),
          damageIndex: Number(row.damage_index ?? 0),
          maxStock: Number(row.max_stock ?? 3000),
          recommendation: String(row.recommendation ?? (priorityColor === 'Red' ? 'Immediate replenishment requested.' : 'Sufficient stock on hand.')),
          lastReportedAt: row.last_reported_at || row.updated_at,
          currentStock: stockMerged,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });
    } catch (err) {
      console.warn('Error in getLgus, falling back to authoritative regional directory:', err);
      return filteredDefaults;
    }
  },

  async deleteLgu(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('lgus')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to archive LGU');
    return { ok: true };
  },

  async restoreLgu(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase
      .from('lgus')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    throwIfError(error, 'Failed to restore LGU');
    return { ok: true };
  },

  async permanentDeleteLgu(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('lgus').delete().eq('id', id);
    throwIfError(error, 'Failed to permanently delete LGU');
    return { ok: true };
  },

  async deleteLgusBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from('lgus')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', ids);
    throwIfError(error, 'Failed to batch archive LGUs');
    return { ok: true };
  },

  async restoreLgusBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase
      .from('lgus')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .in('id', ids);
    throwIfError(error, 'Failed to batch restore LGUs');
    return { ok: true };
  },

  async createLgu(payload: LguInput): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('lgus')
      .insert({
        municipality: payload.municipality.trim(),
        province: payload.province.trim(),
        lgu_name: payload.lguName.trim(),
        contact_person: payload.contactPerson?.trim() || '',
        contact_number: payload.contactNumber?.trim() || '',
        latitude: payload.latitude ?? 10.7870,
        longitude: payload.longitude ?? 122.3892,
        remarks: payload.remarks?.trim() || '',
        max_stock: payload.maxStock !== undefined ? Number(payload.maxStock) || 3000 : 3000,
        last_reported_at: new Date().toISOString(),
        is_active: true
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create LGU in master directory');

    if (payload.initialStock) {
      try {
        await supabase
          .from('lgu_inventory_reports')
          .insert({
            lgu_id: data.id,
            municipality: payload.municipality.trim(),
            province: payload.province.trim(),
            lgu_name: payload.lguName.trim(),
            food_packs: payload.initialStock['Family Food Pack'] ?? payload.initialStock['Food Pack'] ?? 0,
            hygiene_kits: payload.initialStock['Hygiene Kit'] || 0,
            family_kits: payload.initialStock['Family Kit'] || 0,
            reported_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn('Initial stock baseline creation warning:', err);
      }
    }

    return data;
  },

  async updateLgu(id: string, payload: Partial<LguInput>): Promise<{ ok: boolean }> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (payload.lguName !== undefined) updates.lgu_name = payload.lguName.trim();
    if (payload.province !== undefined) updates.province = payload.province.trim();
    if (payload.municipality !== undefined) updates.municipality = payload.municipality.trim();
    if (payload.contactPerson !== undefined) updates.contact_person = payload.contactPerson.trim();
    if (payload.contactNumber !== undefined) updates.contact_number = payload.contactNumber.trim();
    if (payload.latitude !== undefined) updates.latitude = payload.latitude;
    if (payload.longitude !== undefined) updates.longitude = payload.longitude;
    if (payload.remarks !== undefined) updates.remarks = payload.remarks.trim();
    if (payload.maxStock !== undefined) updates.max_stock = Number(payload.maxStock) || 3000;

    const { error } = await supabase
      .from('lgus')
      .update(updates)
      .eq('id', id);

    throwIfError(error, 'Failed to update LGU');

    if (payload.initialStock && payload.municipality) {
      try {
        const canonicalInitial: Record<string, number> = {};
        Object.entries(payload.initialStock).forEach(([k, v]) => {
          const canonical = normalizeCategoryName(k);
          const val = Number(v) || 0;
          if (canonical) canonicalInitial[canonical] = val;
          canonicalInitial[k] = val;
        });

        const foodReport = canonicalInitial['Family Food Pack'] ?? canonicalInitial['Food Pack'] ?? 0;
        const hygieneReport = canonicalInitial['Hygiene Kit'] || 0;
        const familyReport = canonicalInitial['Family Kit'] || 0;
        await supabase
          .from('lgu_inventory_reports')
          .insert({
            lgu_id: id,
            municipality: payload.municipality.trim(),
            province: payload.province?.trim() || 'Iloilo',
            lgu_name: payload.lguName?.trim() || `${payload.municipality.trim()} Municipal Office`,
            food_packs: foodReport,
            hygiene_kits: hygieneReport,
            family_kits: familyReport,
            reported_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn('Updated stock baseline warning:', err);
      }
    }

    return { ok: true };
  },

  async getLguPriorityReports(municipality?: string) {
    try {
      let query = supabase
        .from('lgu_inventory_reports')
        .select('*')
        .order('reported_at', { ascending: false });

      if (municipality) {
        query = query.ilike('municipality', `%${municipality.trim()}%`);
      }

      const { data, error } = await query;
      if (error) return [];
      return (data ?? []).map((row: Record<string, any>) => ({
        id: String(row.id ?? ''),
        lguName: String(row.lgu_name ?? row.municipality ?? ''),
        municipality: String(row.municipality ?? ''),
        province: String(row.province ?? ''),
        foodPacks: Number(row.food_packs ?? 0),
        hygieneKits: Number(row.hygiene_kits ?? 0),
        familyKits: Number(row.family_kits ?? 0),
        affectedFamilies: Number(row.affected_families ?? 0),
        damageIndex: Number(row.damage_index ?? 0),
        urgencyScore: Number(row.urgency_score ?? 0),
        priorityColor: String(row.priority_color ?? 'Green'),
        recommendation: String(row.recommendation ?? ''),
        reportedAt: String(row.reported_at ?? new Date().toISOString())
      }));
    } catch {
      return [];
    }
  },

  async createIncoming(payload: IncomingPayload) {
    // 1. Resolve destination warehouse or LGU ID to satisfy chk_incoming_dest_mutex
    let destWhId = payload.destinationWarehouseId || null;
    let destLguId = payload.destinationLguId || null;

    if (payload.destinationType === 'Warehouse') {
      destLguId = null;
      if (!isUuid(destWhId)) {
        destWhId = await this.resolveWarehouseId(payload.destination || destWhId);
      }
    } else {
      destWhId = null;
      if (!isUuid(destLguId)) {
        destLguId = await this.resolveLguId(payload.destination || destLguId);
      }
    }

    // 2. Resolve kit type and supply source IDs
    let kitId = isUuid(payload.kitTypeId) ? payload.kitTypeId : await this.resolveKitTypeId(payload.fnfiCategory || payload.kitTypeId);
    let sourceId = isUuid(payload.supplySourceId) ? payload.supplySourceId : await this.resolveSupplySourceId(payload.source || payload.supplySourceId);

    // 3. Clean and ensure incident/RIS code exists in incidents table to prevent FK 23503 errors
    const rawIncident = payload.incidentCode?.trim();
    let effectiveIncident: string | null = null;
    if (rawIncident) {
      const parsed = parseIncidentInfo(rawIncident).incidentCode || rawIncident;
      effectiveIncident = await this.ensureIncidentExists(parsed);
    }

    const rawManifest = (payload.manifestNumber || '').trim().toUpperCase();
    const finalManifest = rawManifest.startsWith('RIS-') || rawManifest.startsWith('DR-')
      ? rawManifest
      : (rawManifest ? `RIS-${rawManifest}` : `RIS-${Date.now()}`);

    const insertPayload: Record<string, any> = {
      manifest_number: finalManifest,
      date_received: payload.dateReceived || new Date().toISOString().split('T')[0],
      category: payload.fnfiCategory || 'Family Food Pack',
      quantity: Number(payload.quantity) || 1,
      unit_type: payload.unitType || 'packs',
      expiration_date: payload.expirationDate || null,
      source: payload.source || '',
      destination_type: payload.destinationType || 'Warehouse',
      destination: payload.destination || '',
      incident_code: effectiveIncident,
      status: payload.status ?? 'Draft',
      manifest_hash: payload.manifestHash || '',
      supply_source_id: sourceId || null,
      kit_type_id: kitId || null,
      destination_warehouse_id: destWhId || null,
      destination_lgu_id: destLguId || null
    };

    const { data, error } = await supabase
      .from('incoming_manifests')
      .insert(insertPayload)
      .select('id')
      .single();

    throwIfError(error, 'Failed to create incoming manifest');
    return data;
  },

  async updateIncoming(manifestNumber: string, payload: IncomingUpdatePayload) {
    let cleanIncident: string | undefined = undefined;
    if (payload.incidentCode !== undefined) {
      const parsed = parseIncidentInfo(payload.incidentCode).incidentCode || payload.incidentCode?.trim();
      if (parsed) {
        cleanIncident = await this.ensureIncidentExists(parsed);
      }
    }

    const updates = definedOnly({
      status: payload.status,
      manifest_hash: payload.manifestHash,
      incident_code: cleanIncident,
      category: payload.category,
      quantity: payload.quantity,
      unit_type: payload.unitType,
      expiration_date: payload.expirationDate,
      source: payload.source,
      destination_type: payload.destinationType,
      destination: payload.destination,
      correction_note: payload.correctionNote,
      verified_by: payload.verifiedBy,
      verified_by_profile_id: isUuid(payload.verifiedByProfileId) ? payload.verifiedByProfileId : undefined
    });

    const { error } = await supabase
      .from('incoming_manifests')
      .update(updates)
      .eq('manifest_number', manifestNumber);

    throwIfError(error, 'Failed to update incoming manifest');
    return { ok: true };
  },

  async createOutgoing(payload: OutgoingPayload) {
    // 1. Prepare parallel lookups
    const isSourceWh = (payload.sourceType ?? payload.source_type ?? 'Warehouse') === 'Warehouse';
    const rawSrcWhId = payload.sourceWarehouseId ?? payload.source_warehouse_id ?? null;
    const rawSrcLguId = payload.sourceLguId ?? payload.source_lgu_id ?? null;

    const resolveSourcePromise = (async () => {
      let srcWhId = rawSrcWhId;
      let srcLguId = rawSrcLguId;
      if (isSourceWh) {
        srcLguId = null;
        if (!isUuid(srcWhId)) {
          srcWhId = await this.resolveWarehouseId(payload.warehouseSource || srcWhId);
        }
      } else {
        srcWhId = null;
        if (!isUuid(srcLguId)) {
          srcLguId = await this.resolveLguId(payload.warehouseSource || srcLguId);
        }
      }
      return { srcWhId, srcLguId };
    })();

    const rawDestLguId = payload.destinationLguId ?? payload.destination_lgu_id ?? payload.lguId ?? payload.lgu_id ?? null;
    const resolveDestPromise = isUuid(rawDestLguId)
      ? Promise.resolve(rawDestLguId)
      : this.resolveLguId(payload.municipality || payload.lguName || rawDestLguId);

    const rawKitId = payload.kitTypeId ?? payload.kit_type_id ?? null;
    const resolveKitPromise = isUuid(rawKitId)
      ? Promise.resolve(rawKitId)
      : this.resolveKitTypeId(payload.fnfiCategory || payload.category || rawKitId);

    const rawIncident = payload.incidentCode?.trim();
    const resolveIncidentPromise = rawIncident
      ? (async () => {
          const parsed = parseIncidentInfo(rawIncident).incidentCode || rawIncident;
          return await this.ensureIncidentExists(parsed);
        })()
      : Promise.resolve(null);

    const rawOutgoingCode = (payload.drNumber || '').trim().toUpperCase();
    const resolveCodePromise = (async () => {
      if (rawOutgoingCode.startsWith('INC-')) return rawOutgoingCode;
      if (rawOutgoingCode.startsWith('DR-')) return `INC-${rawOutgoingCode.slice(3)}`;
      if (rawOutgoingCode) return `INC-${rawOutgoingCode}`;
      return await this.generateNextDrNumber();
    })();

    // Await all 5 resolutions concurrently in parallel
    const [
      { srcWhId, srcLguId },
      destLguId,
      kitId,
      effectiveIncident,
      finalOutgoingCode
    ] = await Promise.all([
      resolveSourcePromise,
      resolveDestPromise,
      resolveKitPromise,
      resolveIncidentPromise,
      resolveCodePromise
    ]);

    // 4. Resolve truck (must be valid truck_id or null)
    const rawTruck = payload.assignedTruckId ?? payload.assigned_truck_id;
    const truckId = rawTruck?.trim() ? rawTruck.trim() : null;

    // 5. Resolve escort profile ID (must be a valid UUID or null to prevent 22P02 errors)
    const rawDriverId = payload.assignedEscortProfileId ?? payload.assigned_driver_profile_id;
    const driverProfileId = isUuid(rawDriverId) ? rawDriverId : null;

    const insertPayload: Record<string, any> = {
      dr_number: finalOutgoingCode,
      date_allocated: payload.dateAllocated || new Date().toISOString().split('T')[0],
      source_type: isSourceWh ? 'Warehouse' : 'LGU',
      source_warehouse_id: srcWhId || null,
      source_lgu_id: srcLguId || null,
      lgu_id: destLguId,
      destination_lgu_id: destLguId || null,
      kit_type_id: kitId || null,
      amount_requested: Number(payload.amountRequested) || 1,
      amount_approved: Number(payload.amountApproved ?? payload.amountRequested ?? 0),
      warehouse_source: payload.warehouseSource || 'DSWD Logistics Hub',
      delivery_mode: payload.deliveryMode || 'DSWD Assigned Receiver',
      delivery_status: payload.deliveryStatus ?? 'Allocating',
      incident_code: effectiveIncident,
      allocated_batches: payload.allocatedBatches ?? [],
      sender_gps: payload.senderGps || '',
      receiver_gps: payload.receiverGps || '',
      destination_address: payload.destinationAddress ?? payload.destination_address ?? '',
      tx_hash: payload.txHash || '',
      wallet_address: payload.walletAddress || '',
      assigned_truck_id: truckId,
      assigned_driver_profile_id: driverProfileId,
      lgu_name: payload.lguName || '',
      province: payload.province || '',
      municipality: payload.municipality || '',
      category: payload.fnfiCategory || payload.category || 'Family Food Pack',
      delivery_priority: Number(payload.deliveryPriority ?? 0),
      is_held: Boolean(payload.isHeld ?? false),
      correction_note: payload.correctionNote || ''
    };

    const { data, error } = await supabase
      .from('outgoing_requests')
      .insert(insertPayload)
      .select('id')
      .single();

    throwIfError(error, 'Failed to create outgoing request');
    return data;
  },

  async updateOutgoing(drNumber: string, payload: OutgoingUpdatePayload) {
    const rawTruck = payload.assignedTruckId ?? payload.assigned_truck_id;
    const cleanTruck = rawTruck !== undefined ? (rawTruck?.trim() || null) : undefined;

    const updates = definedOnly({
      amount_approved: payload.amountApproved,
      amount_requested: payload.amountRequested ?? payload.amount_requested,
      delivery_status: payload.deliveryStatus,
      allocated_batches: payload.allocatedBatches,
      sender_gps: payload.senderGps,
      receiver_gps: payload.receiverGps,
      destination_address: payload.destinationAddress ?? payload.destination_address,
      tx_hash: payload.txHash ?? payload.adminSignature,
      handover_contract_id: payload.handoverContractId,
      sender_signature: payload.senderSignature,
      receiver_signature: payload.receiverSignature,
      wallet_address: payload.walletAddress,
      assigned_truck_id: cleanTruck,
      correction_note: payload.correctionNote,
      approved_by_profile_id: isUuid(payload.approvedByProfileId) ? payload.approvedByProfileId : undefined,
      dispatched_by_profile_id: isUuid(payload.dispatchedByProfileId) ? payload.dispatchedByProfileId : undefined,
      received_by_profile_id: isUuid(payload.receivedByProfileId) ? payload.receivedByProfileId : undefined
    });

    const [cleanDr, altDr] = getDrVariants(drNumber);
    let targetId: string | null = null;
    if (isUuid(drNumber)) {
      const { data: byId } = await supabase.from('outgoing_requests').select('id').eq('id', drNumber).maybeSingle();
      if (byId?.id) targetId = byId.id;
    }
    if (!targetId) {
      const { data: rows } = await supabase
        .from('outgoing_requests')
        .select('id, delivery_status')
        .or(`dr_number.eq.${cleanDr},dr_number.eq.${altDr},dr_number.ilike.${cleanDr}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (rows && rows.length > 0) {
        const activeRow = rows.find((r) => ['Delivered', 'In Transit', 'Released', 'Approved', 'Packed', 'Allocating', 'Draft'].includes(r.delivery_status));
        targetId = activeRow?.id || rows[0].id;
      }
    }

    const { error } = targetId
      ? await supabase.from('outgoing_requests').update(updates).eq('id', targetId)
      : await supabase.from('outgoing_requests').update(updates).ilike('dr_number', cleanDr);

    throwIfError(error, 'Failed to update outgoing request');
    return { ok: true };
  },

  async cancelOutgoingRequest(drNumber: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const [canonicalDr, altDr] = getDrVariants(drNumber);
      const { data: releaseRow, error: fetchErr } = await supabase
        .from('outgoing_requests')
        .select('*')
        .or(`dr_number.eq.${canonicalDr},dr_number.eq.${altDr}`)
        .maybeSingle();

      if (fetchErr || !releaseRow) {
        return { ok: false, message: 'Outgoing release not found.' };
      }

      if (!['Draft', 'Allocating'].includes(releaseRow.delivery_status)) {
        return { ok: false, message: 'Only pre-approval releases (Draft or Allocating) can be cancelled.' };
      }

      // 1. Delete any outgoing_batch_allocations reservations for this DR
      await supabase
        .from('outgoing_batch_allocations')
        .delete()
        .or(`outgoing_request_id.eq.${releaseRow.dr_number},outgoing_request_id.eq.${canonicalDr}`);

      // 2. Update outgoing_requests to Cancelled
      const { error: updateErr } = await supabase
        .from('outgoing_requests')
        .update({
          delivery_status: 'Cancelled',
          allocated_batches: [],
          amount_approved: 0,
          admin_signature: '',
          tx_hash: ''
        })
        .eq('id', releaseRow.id);

      if (updateErr) {
        throw updateErr;
      }

      return { ok: true };
    } catch (err: any) {
      console.error('cancelOutgoingRequest error:', err);
      return { ok: false, message: err?.message || 'Failed to cancel outgoing request' };
    }
  },


  async createLGUInventoryReport(payload: LGUInventoryReportPayload) {
    let resolvedLguId = isUuid(payload.lguId) ? payload.lguId : null;
    if (!resolvedLguId) {
      resolvedLguId = await this.resolveLguId(payload.municipality || payload.lguName);
    }
    const reportedByProfileId = isUuid(payload.reportedByProfileId) ? payload.reportedByProfileId : null;

    const { data, error } = await supabase
      .from('lgu_inventory_reports')
      .insert({
        lgu_id: resolvedLguId || null,
        reported_by_profile_id: reportedByProfileId || null,
        municipality: payload.municipality,
        province: payload.province,
        lgu_name: payload.lguName,
        reported_at: new Date().toISOString(),
        food_packs: payload.foodPacks,
        hygiene_kits: payload.hygieneKits,
        family_kits: payload.familyKits,
        affected_families: payload.affectedFamilies,
        damage_index: payload.damageIndex,
        urgency_score: payload.urgencyScore,
        priority_color: payload.priorityColor,
        recommendation: payload.recommendation
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create LGU inventory report');

    // Update authoritative metrics on public.lgus (trigger also handles this)
    try {
      await supabase
        .from('lgus')
        .update({
          affected_families: payload.affectedFamilies,
          damage_index: payload.damageIndex,
          urgency_score: payload.urgencyScore,
          priority_color: payload.priorityColor,
          recommendation: payload.recommendation,
          last_reported_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .ilike('municipality', payload.municipality.trim());
    } catch (lguErr) {
      console.warn('Failed to update public.lgus metrics on inventory report:', lguErr);
    }

    return data;
  },

  async updatePackagePriority(drNumber: string, priority: number, isHeld?: boolean) {
    const updates: Record<string, unknown> = {
      delivery_priority: priority
    };
    if (isHeld !== undefined) {
      updates.is_held = isHeld;
    }
    const { error } = await supabase
      .from('outgoing_requests')
      .update(updates)
      .ilike('dr_number', drNumber.trim());

    if (error) {
      console.warn('Failed to update package priority in database:', error.message);
    }
    return { ok: true };
  },

  async createDiscrepancyReport(payload: DiscrepancyReportPayload) {
    const reportType = payload.reportType === 'Incoming' ? 'Incoming' : 'Outgoing';
    let manifestNumber: string | null = null;
    let drNumber: string | null = null;

    if (reportType === 'Incoming') {
      const rawManifest = payload.manifestNumber?.trim();
      if (rawManifest) {
        let clean = rawManifest;
        if (isUuid(clean)) {
          const { data: mRow } = await supabase.from('incoming_manifests').select('manifest_number').eq('id', clean).maybeSingle();
          if (mRow?.manifest_number) clean = mRow.manifest_number;
        }
        manifestNumber = clean;
      }
    } else {
      const rawDr = payload.drNumber?.trim();
      if (rawDr) {
        let clean = rawDr;
        if (isUuid(clean)) {
          const { data: dRow } = await supabase.from('outgoing_requests').select('dr_number').eq('id', clean).maybeSingle();
          if (dRow?.dr_number) clean = dRow.dr_number;
        }
        drNumber = clean;
      }
    }

    const reportedByProfileId = isUuid((payload as any).reportedByProfileId) ? (payload as any).reportedByProfileId : null;

    const { data, error } = await supabase
      .from('discrepancy_reports')
      .insert({
        report_type: reportType,
        manifest_number: manifestNumber,
        dr_number: drNumber,
        reported_by_profile_id: reportedByProfileId,
        note: payload.note || 'Discrepancy reported',
        reported_by_role: payload.reportedByRole || null,
        reported_by_wallet: payload.reportedByWallet || null
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create discrepancy report');
    return data;
  },

  async getNextBatchIndex() {
    const { data, error } = await supabase
      .from('app_counters')
      .select('value')
      .eq('key', 'batch_index')
      .maybeSingle();

    if (error) {
      throwIfError(error, 'Unable to load batch counter');
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from('app_counters')
        .insert({ key: 'batch_index', value: 0 })
        .select('key')
        .single();

      throwIfError(insertError, 'Failed to initialize batch counter');
    }

    const currentValue = (data as { value?: number } | null)?.value ?? 0;
    const nextValue = currentValue + 1;

    const { error: updateError } = await supabase
      .from('app_counters')
      .update({ value: nextValue, updated_at: new Date().toISOString() })
      .eq('key', 'batch_index');

    throwIfError(updateError, 'Failed to update batch counter');
    return nextValue;
  },

  async getNextManifestIndex() {
    try {
      const { data, error } = await supabase
        .from('app_counters')
        .select('value')
        .eq('key', 'manifest_index')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const nextValue = ((data as { value?: number } | null)?.value ?? 0) + 1;
      await supabase
        .from('app_counters')
        .update({ value: nextValue, updated_at: new Date().toISOString() })
        .eq('key', 'manifest_index');
      return nextValue;
    } catch {
      return null;
    }
  },

  async getNextDrIndex(): Promise<number> {
    try {
      const [counterRes, outReqsRes, onChainCount] = await Promise.all([
        Promise.resolve(
          supabase
            .from('app_counters')
            .select('value')
            .eq('key', 'dr_index')
            .maybeSingle()
        ).catch(() => ({ data: null })),
        Promise.resolve(
          supabase
            .from('outgoing_requests')
            .select('dr_number')
            .order('created_at', { ascending: false })
            .limit(50)
        ).catch(() => ({ data: null })),
        blockchain.getCurrentHandoverCount().catch(() => 0n)
      ]);

      let maxIndex = (counterRes.data as { value?: number } | null)?.value ?? 0;

      if (outReqsRes.data) {
        for (const req of outReqsRes.data) {
          const match = req.dr_number?.match(/(?:DR|INC)-\d{4}-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxIndex) {
              maxIndex = num;
            }
          }
        }
      }

      if (Number(onChainCount) > maxIndex) {
        maxIndex = Number(onChainCount);
      }

      const nextValue = Math.max(maxIndex, 0) + 1;
      // Background the counter upsert so it does not block the caller
      Promise.resolve(
        supabase
          .from('app_counters')
          .upsert({ key: 'dr_index', value: nextValue, updated_at: new Date().toISOString() })
      ).catch((err) => console.warn('Counter upsert notice:', err));

      return nextValue;
    } catch {
      return 1;
    }
  },

  async generateNextDrNumber(): Promise<string> {
    const nextIdx = await this.getNextDrIndex();
    const year = new Date().getFullYear();
    const safeIdx = nextIdx && nextIdx > 0 ? nextIdx : 1;
    return `INC-${year}-${String(safeIdx).padStart(3, '0')}`;
  },

  async generateNextIncNumber(): Promise<string> {
    return this.generateNextDrNumber();
  },

  async markHandoverAccepted(drNumber: string, receiverGps: string, txHash?: string) {
    const [cleanDr, altDr] = getDrVariants(drNumber);
    const { data: matched } = await supabase
      .from('outgoing_requests')
      .select('id')
      .or(`dr_number.eq.${cleanDr},dr_number.eq.${altDr}`)
      .maybeSingle();

    const { error } = matched?.id
      ? await supabase.from('outgoing_requests').update({ delivery_status: 'Accepted', receiver_gps: receiverGps, tx_hash: txHash }).eq('id', matched.id)
      : await supabase.from('outgoing_requests').update({ delivery_status: 'Accepted', receiver_gps: receiverGps, tx_hash: txHash }).ilike('dr_number', cleanDr);

    throwIfError(error, 'Failed to mark handover as accepted');
    return { ok: true };
  },

  async recordLguReceipt(params: {
    drNumber: string;
    lguName: string;
    municipality?: string;
    province?: string;
    category: string;
    quantity: number;
    receiverGps?: string;
    receiverSignature?: string;
    txHash?: string;
  }) {
    // 1. Mark outgoing request as Accepted
    const updates: Record<string, unknown> = {
      delivery_status: 'Accepted'
    };
    if (params.receiverGps) updates.receiver_gps = params.receiverGps;
    if (params.receiverSignature) updates.receiver_signature = params.receiverSignature;
    if (params.txHash) updates.tx_hash = params.txHash;

    const [cleanDr, altDr] = getDrVariants(params.drNumber);
    const { data: matched } = await supabase
      .from('outgoing_requests')
      .select('id')
      .or(`dr_number.eq.${cleanDr},dr_number.eq.${altDr}`)
      .maybeSingle();

    const { error: outError } = matched?.id
      ? await supabase.from('outgoing_requests').update(updates).eq('id', matched.id)
      : await supabase.from('outgoing_requests').update(updates).ilike('dr_number', cleanDr);

    if (outError) {
      console.warn('Failed to update outgoing request on LGU receipt:', outError.message);
    }

    // 2. Mark truck live location done so it disappears from live map
    await this.markTruckLiveLocationDoneByDr(cleanDr);

    // Note: Outgoing delivery confirmation strictly confirms receipt and does NOT mutate LGU warehouse inventory.
    // Stock is stored exclusively via incoming goods intake or explicit physical stock audit reports.
    return { ok: true };
  },

  async getReceiverReleases(receiverId?: string | null) {
    let query = supabase
      .from('outgoing_requests')
      .select('id,dr_number,date_allocated,created_at,lgu_id,destination_lgu_id,lgu_name,province,municipality,category,amount_requested,amount_approved,warehouse_source,delivery_mode,delivery_status,incident_code,allocated_batches,handover_contract_id,assigned_truck_id,assigned_driver_profile_id,tx_hash,wallet_address,sender_gps,receiver_gps,destination_address,delivery_priority,is_held')
      .in('delivery_status', ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'])
      .order('created_at', { ascending: false });

    if (receiverId) {
      query = query.or(`assigned_truck_id.eq.${receiverId},assigned_truck_id.is.null,assigned_truck_id.eq.`);
    }

    const { data, error } = await query;
    throwIfError(error, 'Unable to load receiver releases');
    return (data ?? []).map((r) => ({
      ...r,
      dr_number: formatOutgoingReference({ incidentCode: r.incident_code, drNumber: r.dr_number })
    })) as ReceiverReleaseRecord[];
  },

  async getEscortReleases(receiverOrEscortId?: string | null) {
    return this.getReceiverReleases(receiverOrEscortId);
  },

  async getTruckerReleases(truckId?: string | null) {
    return this.getEscortReleases(truckId);
  },

  async assignEscortAndTruckToRelease(
    drNumber: string,
    truckId: string | null,
    escortProfileId?: string | null,
    deliveryStatus: string = 'In Transit'
  ) {
    const cleanTruck = truckId?.trim() ? truckId.trim() : null;
    const cleanEscort = isUuid(escortProfileId) ? escortProfileId : null;
    const updates: Record<string, unknown> = {
      assigned_truck_id: cleanTruck,
      assigned_driver_profile_id: cleanEscort
    };
    if (deliveryStatus) {
      updates.delivery_status = deliveryStatus;
    }
    const [cleanDr, altDr] = getDrVariants(drNumber);
    const { data: matched } = await supabase
      .from('outgoing_requests')
      .select('id')
      .or(`dr_number.eq.${cleanDr},dr_number.eq.${altDr}`)
      .maybeSingle();

    let { error } = matched?.id
      ? await supabase.from('outgoing_requests').update(updates).eq('id', matched.id)
      : await supabase.from('outgoing_requests').update(updates).ilike('dr_number', cleanDr);

    if (error && (error.code === '42703' || error.message?.includes('assigned_driver_profile_id'))) {
      const fallbackUpdates: Record<string, unknown> = { assigned_truck_id: cleanTruck };
      if (deliveryStatus) fallbackUpdates.delivery_status = deliveryStatus;
      const retry = await supabase.from('outgoing_requests').update(fallbackUpdates).eq('dr_number', drNumber);
      error = retry.error;
    }

    throwIfError(error, 'Failed to assign escort and truck to release');
    return { ok: true };
  },

  async assignTruckToRelease(drNumber: string, truckId: string | null, deliveryStatus: string = 'In Transit') {
    return this.assignEscortAndTruckToRelease(drNumber, truckId, null, deliveryStatus);
  },

  async getTruckLiveLocations(): Promise<TruckLiveLocation[]> {
    try {
      const { data, error } = await supabase
        .from('truck_live_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) return [];
      return (data ?? []) as TruckLiveLocation[];
    } catch {
      return [];
    }
  },

  async upsertTruckLiveLocation(payload: TruckLiveLocation) {
    try {
      let cleanTruck = String(payload.truck_id || '').trim().toUpperCase();
      if (!cleanTruck || cleanTruck.startsWith('RCVR-') || cleanTruck.includes('HANDLER') || cleanTruck.startsWith('0X') || cleanTruck.length < 2) {
        return { ok: false };
      }
      const trkMatch = cleanTruck.match(/^TRK-?0*(\d+)$/i);
      if (trkMatch) {
        cleanTruck = `TRUCK-${trkMatch[1].padStart(2, '0')}`;
      }

      // Ensure truck exists in trucks table so foreign key constraint is satisfied
      try {
        const { data: existingTruck } = await supabase
          .from('trucks')
          .select('truck_id')
          .or(`truck_id.eq.${cleanTruck},plate_number.eq.${cleanTruck}`)
          .maybeSingle();

        if (existingTruck?.truck_id) {
          cleanTruck = existingTruck.truck_id;
        } else {
          await supabase.from('trucks').upsert({
            truck_id: cleanTruck,
            plate_number: cleanTruck,
            model: 'DSWD Relief Cargo Truck',
            capacity_kg: 5000,
            is_active: true
          }, { onConflict: 'truck_id' });
        }
      } catch {}

      let cleanDr = payload.current_dr_number?.trim() || null;
      if (cleanDr) {
        const { data: drExists } = await supabase
          .from('outgoing_requests')
          .select('dr_number')
          .ilike('dr_number', cleanDr)
          .maybeSingle();
        if (!drExists) {
          cleanDr = null;
        }
      }

      const driverProfileId = isUuid(payload.driver_profile_id) ? payload.driver_profile_id : null;
      const destLguId = isUuid((payload as any).destination_lgu_id) ? (payload as any).destination_lgu_id : null;

      const sanitizedPayload: Record<string, unknown> = {
        truck_id: cleanTruck,
        current_dr_number: cleanDr,
        destination_lgu_id: destLguId,
        driver_profile_id: driverProfileId,
        status: payload.status ?? 'In Transit',
        speed: Number(payload.speed) || 0,
        heading: Number(payload.heading) || 0,
        latitude: Number(payload.latitude) || 10.7202,
        longitude: Number(payload.longitude) || 122.5621,
        gps_text: payload.gps_text || `${payload.latitude}, ${payload.longitude}`,
        accuracy: payload.accuracy !== undefined ? Number(payload.accuracy) : null,
        wallet_address: payload.wallet_address ?? null,
        updated_at: payload.updated_at || new Date().toISOString()
      };

      const { error } = await supabase
        .from('truck_live_locations')
        .upsert(sanitizedPayload, { onConflict: 'truck_id' });
      if (error) {
        console.warn('upsertTruckLiveLocation warning:', error.message);
      }
    } catch (err) {
      console.warn('upsertTruckLiveLocation error:', err);
    }
    return { ok: true };
  },

  async markTruckLiveLocationDone(truckId: string, drNumber?: string) {
    try {
      if (truckId && truckId.trim()) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .ilike('truck_id', truckId.trim());
      }
      if (drNumber && drNumber.trim()) {
        await this.markTruckLiveLocationDoneByDr(drNumber);
      }
    } catch (error) {
      console.warn('Failed to clean up truck live location:', error);
    }
    return { ok: true };
  },

  async markTruckLiveLocationDoneByDr(drNumber: string) {
    try {
      const [cleanDr, altDr] = getDrVariants(drNumber);
      const { data } = await supabase
        .from('outgoing_requests')
        .select('assigned_truck_id')
        .or(`dr_number.eq.${cleanDr},dr_number.eq.${altDr}`)
        .maybeSingle();

      if (data?.assigned_truck_id) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .eq('truck_id', data.assigned_truck_id);
      }
    } catch (error) {
      console.warn('Failed to clean up truck live location by DR:', error);
    }
    return { ok: true };
  },

  async deleteTruckLiveLocation(truckId: string): Promise<{ ok: boolean }> {
    try {
      const cleanId = truckId.trim();
      const { error } = await supabase
        .from('truck_live_locations')
        .delete()
        .eq('truck_id', cleanId);
      if (error) {
        console.warn('Failed to delete truck live location:', error.message);
        return { ok: false };
      }
      return { ok: true };
    } catch (err) {
      console.warn('Error deleting truck live location:', err);
      return { ok: false };
    }
  },

  // --- ACTIVITY LOGS ---
  async logActivity(entry: ActivityLogInput): Promise<{ ok: boolean }> {
    try {
      let actorId = entry.actorId;
      let actorName = entry.actorName;
      let actorEmail = entry.actorEmail;
      let actorRole = entry.actorRole;
      let actorWallet = entry.actorWallet;

      if (!actorEmail || !actorName || !actorRole || !actorWallet) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          actorId = actorId || user.id;
          actorEmail = actorEmail || user.email || 'system@dswd.gov.ph';
          const metaName = (user.user_metadata?.first_name || user.user_metadata?.last_name)
            ? `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim()
            : user.user_metadata?.full_name;
          actorName = actorName || metaName;
          actorRole = actorRole || user.user_metadata?.role;
          actorWallet = actorWallet || user.user_metadata?.wallet_address;

          if (!actorName || !actorRole || !actorWallet) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('first_name, last_name, role, wallet_address, email')
              .eq('id', user.id)
              .maybeSingle();
            if (prof) {
              const computedName = `${prof.first_name || ''} ${prof.last_name || ''}`.trim();
              actorName = actorName || computedName || prof.email;
              actorRole = actorRole || prof.role;
              actorWallet = actorWallet || prof.wallet_address;
              actorEmail = actorEmail || prof.email;
            }
          }
        }
      }


      const { error } = await supabase
        .from('activity_logs')
        .insert({
          actor_id: isUuid(actorId) ? actorId : null,
          actor_name: actorName || 'System User',
          actor_email: actorEmail || 'system@dswd.gov.ph',
          actor_role: actorRole || 'system',
          actor_wallet: actorWallet || null,
          action: entry.action,
          entity_type: entry.entityType,
          entity_id: entry.entityId || null,
          details: entry.details,
          metadata: entry.metadata || {},
          tx_hash: entry.txHash || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn('Could not insert activity log:', error.message);
        return { ok: false };
      }
      return { ok: true };
    } catch (err) {
      console.warn('logActivity exception:', err);
      return { ok: false };
    }
  },

  async getActivityLogs(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    actorEmail?: string;
  }): Promise<ActivityLogRecord[]> {
    try {
      const limit = options?.limit ?? 100;
      const offset = options?.offset ?? 0;

      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (options?.action && options.action !== 'all') {
        query = query.eq('action', options.action);
      }

      if (options?.entityType && options.entityType !== 'all') {
        query = query.eq('entity_type', options.entityType);
      }

      if (options?.actorId) {
        query = query.or(`actor_id.eq.${options.actorId},entity_id.eq.${options.actorId}`);
      } else if (options?.actorEmail) {
        query = query.ilike('actor_email', options.actorEmail.trim());
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching activity logs:', error.message);
        return [];
      }

      let rows = (data ?? []).map((r: any) => ({
        id: String(r.id),
        actorId: r.actor_id,
        actorName: String(r.actor_name || 'System'),
        actorEmail: String(r.actor_email || ''),
        actorRole: String(r.actor_role || ''),
        actorWallet: r.actor_wallet,
        action: String(r.action),
        entityType: String(r.entity_type),
        entityId: r.entity_id,
        details: String(r.details || ''),
        metadata: (r.metadata && typeof r.metadata === 'object') ? r.metadata : {},
        txHash: r.tx_hash,
        createdAt: String(r.created_at)
      }));

      if (options?.search && options.search.trim()) {
        const q = options.search.trim().toLowerCase();
        rows = rows.filter(r =>
          r.actorName.toLowerCase().includes(q) ||
          r.actorEmail.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q) ||
          r.entityType.toLowerCase().includes(q) ||
          (r.entityId && r.entityId.toLowerCase().includes(q)) ||
          r.details.toLowerCase().includes(q) ||
          (r.txHash && r.txHash.toLowerCase().includes(q))
        );
      }

      return rows;
    } catch (err) {
      console.warn('getActivityLogs exception:', err);
      return [];
    }
  },

  async getUserActivityLogs(userId: string, email?: string, limit: number = 100): Promise<ActivityLogRecord[]> {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (email && email.trim()) {
        query = query.or(`actor_id.eq.${userId},entity_id.eq.${userId},actor_email.ilike.${email.trim()}`);
      } else {
        query = query.or(`actor_id.eq.${userId},entity_id.eq.${userId}`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('getUserActivityLogs error:', error.message);
        return [];
      }
      return (data ?? []).map((r: any) => ({
        id: String(r.id),
        actorId: r.actor_id,
        actorName: String(r.actor_name || 'System'),
        actorEmail: String(r.actor_email || ''),
        actorRole: String(r.actor_role || ''),
        actorWallet: r.actor_wallet,
        action: String(r.action),
        entityType: String(r.entity_type),
        entityId: r.entity_id,
        details: String(r.details || ''),
        metadata: (r.metadata && typeof r.metadata === 'object') ? r.metadata : {},
        txHash: r.tx_hash,
        createdAt: String(r.created_at)
      }));
    } catch (err) {
      console.warn('getUserActivityLogs exception:', err);
      return [];
    }
  },

  // --- V3 NORMALIZED PIPELINE METHODS ---

  async getTrucks(includeInactive: boolean = false): Promise<TruckRecord[]> {
    try {
      let query = supabase.from('trucks').select('*').order('truck_id', { ascending: true });
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return DEFAULT_TRUCKS.filter(t => includeInactive || t.isActive);
      }
      return data.map((t: any) => ({
        truckId: t.truck_id || t.trk_truck_id,
        plateNumber: t.plate_number || t.trk_plate_number,
        model: t.model || t.trk_model,
        capacityKg: Number(t.capacity_kg || t.trk_capacity_kg || 5000),
        isActive: Boolean(t.is_active ?? t.trk_is_active ?? true),
        createdAt: t.created_at || t.trk_created_at,
        updatedAt: t.updated_at || t.trk_updated_at
      }));
    } catch {
      return DEFAULT_TRUCKS.filter(t => includeInactive || t.isActive);
    }
  },

  async ensureTruckExists(truckIdOrPlate: string, model?: string): Promise<TruckRecord> {
    const cleanPlate = (truckIdOrPlate || '').trim().toUpperCase();
    if (!cleanPlate) {
      throw new Error('Valid truck ID or plate number is required');
    }
    const cleanModel = model?.trim() || 'DSWD Relief Cargo Vehicle';
    const now = new Date().toISOString();

    try {
      const { data: existing } = await supabase
        .from('trucks')
        .select('*')
        .or(`truck_id.eq.${cleanPlate},plate_number.eq.${cleanPlate}`)
        .maybeSingle();

      if (existing) {
        return {
          truckId: existing.truck_id,
          plateNumber: existing.plate_number,
          model: existing.model,
          capacityKg: Number(existing.capacity_kg || 5000),
          isActive: Boolean(existing.is_active ?? true),
          createdAt: existing.created_at || now,
          updatedAt: existing.updated_at || now
        };
      }

      const { data: inserted, error } = await supabase
        .from('trucks')
        .upsert({
          truck_id: cleanPlate,
          plate_number: cleanPlate,
          model: cleanModel,
          capacity_kg: 5000,
          is_active: true,
          created_at: now,
          updated_at: now
        }, { onConflict: 'truck_id' })
        .select('*')
        .single();

      if (error) {
        console.warn('ensureTruckExists upsert warning:', error.message);
      }

      return {
        truckId: inserted?.truck_id || cleanPlate,
        plateNumber: inserted?.plate_number || cleanPlate,
        model: inserted?.model || cleanModel,
        capacityKg: 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
    } catch (err) {
      console.warn('ensureTruckExists error:', err);
      return {
        truckId: cleanPlate,
        plateNumber: cleanPlate,
        model: cleanModel,
        capacityKg: 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
    }
  },

  async createTruck(payload: TruckInput): Promise<TruckRecord> {
    const cleanId = payload.truckId.trim().toUpperCase();
    const cleanPlate = payload.plateNumber.trim().toUpperCase();
    const cleanModel = payload.model.trim();
    const cleanCapacity = Math.max(1, Math.round(Number(payload.capacityKg) || 5000));
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('trucks')
      .insert({
        truck_id: cleanId,
        plate_number: cleanPlate,
        model: cleanModel,
        capacity_kg: cleanCapacity,
        is_active: payload.isActive ?? true,
        created_at: now,
        updated_at: now
      })
      .select('*')
      .single();

    throwIfError(error, 'Failed to register vehicle in convoy fleet registry');

    return {
      truckId: data.truck_id || cleanId,
      plateNumber: data.plate_number || cleanPlate,
      model: data.model || cleanModel,
      capacityKg: Number(data.capacity_kg || cleanCapacity),
      isActive: Boolean(data.is_active ?? true),
      createdAt: data.created_at || now,
      updatedAt: data.updated_at || now
    };
  },

  async updateTruck(truckId: string, payload: Partial<Omit<TruckInput, 'truckId'>>): Promise<{ ok: boolean }> {
    const cleanId = truckId.trim().toUpperCase();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (payload.plateNumber !== undefined) updates.plate_number = payload.plateNumber.trim().toUpperCase();
    if (payload.model !== undefined) updates.model = payload.model.trim();
    if (payload.capacityKg !== undefined) updates.capacity_kg = Math.max(1, Math.round(Number(payload.capacityKg) || 5000));
    if (payload.isActive !== undefined) updates.is_active = Boolean(payload.isActive);

    const { error } = await supabase
      .from('trucks')
      .update(updates)
      .eq('truck_id', cleanId);

    throwIfError(error, 'Failed to update convoy vehicle details');
    return { ok: true };
  },

  async archiveTruck(truckId: string): Promise<{ ok: boolean }> {
    const cleanId = truckId.trim().toUpperCase();
    const { error } = await supabase
      .from('trucks')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('truck_id', cleanId);

    throwIfError(error, 'Failed to archive convoy vehicle');
    return { ok: true };
  },

  async restoreTruck(truckId: string): Promise<{ ok: boolean }> {
    const cleanId = truckId.trim().toUpperCase();
    const { error } = await supabase
      .from('trucks')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('truck_id', cleanId);

    throwIfError(error, 'Failed to restore convoy vehicle');
    return { ok: true };
  },

  async getIncidents(includeClosed: boolean = false): Promise<IncidentRecord[]> {
    try {
      let query = supabase.from('incidents').select('*').order('incident_code', { ascending: true });
      if (!includeClosed) {
        query = query.neq('status', 'Closed');
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return DEFAULT_INCIDENTS.filter(i => includeClosed || i.status !== 'Closed');
      }
      return data.map((i: any) => ({
        incidentCode: i.incident_code || i.incd_incident_code,
        disasterName: i.disaster_name || i.incd_disaster_name,
        disasterType: i.disaster_type || i.incd_disaster_type,
        declaredAt: i.declared_at || i.incd_declared_at,
        status: (i.status || i.incd_status || 'Active') as 'Active' | 'Monitoring' | 'Closed',
        region: i.region || i.incd_region || 'Region VI (Western Visayas)'
      }));
    } catch {
      return DEFAULT_INCIDENTS.filter(i => includeClosed || i.status !== 'Closed');
    }
  },

  async getWarehouseStock(warehouseId?: string): Promise<WarehouseStockRecord[]> {
    try {
      let query = supabase.from('warehouse_stock').select('*');
      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        const warehouses = await this.getWarehouses();
        const fallbackStock: WarehouseStockRecord[] = [];
        warehouses.forEach(w => {
          if (warehouseId && w.id !== warehouseId) return;
          Object.entries(w.currentStock || {}).forEach(([kitName, qty]) => {
            fallbackStock.push({
              warehouseId: w.id,
              kitTypeId: kitName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              kitName,
              quantity: Number(qty) || 0,
              updatedAt: w.updatedAt || new Date().toISOString()
            });
          });
        });
        return fallbackStock;
      }
      return data.map((r: any) => ({
        warehouseId: r.warehouse_id || r.wst_warehouse_id,
        kitTypeId: r.kit_type_id || r.wst_kit_type_id,
        kitName: r.kit_type_id || r.wst_kit_type_id,
        quantity: Number(r.quantity || r.wst_quantity || 0),
        updatedAt: r.updated_at || r.wst_updated_at || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  },

  async getLguStock(lguId?: string): Promise<LguStockRecord[]> {
    try {
      let query = supabase.from('lgu_stock').select('*');
      if (lguId) {
        query = query.eq('lgu_id', lguId);
      }
      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        const lgus = await this.getLgus();
        const fallbackStock: LguStockRecord[] = [];
        lgus.forEach(l => {
          if (lguId && l.id !== lguId) return;
          Object.entries(l.currentStock || {}).forEach(([kitName, qty]) => {
            fallbackStock.push({
              lguId: l.id,
              kitTypeId: kitName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              kitName,
              quantity: Number(qty) || 0,
              updatedAt: l.updatedAt || new Date().toISOString()
            });
          });
        });
        return fallbackStock;
      }
      return data.map((r: any) => ({
        lguId: r.lgu_id || r.lst_lgu_id,
        kitTypeId: r.kit_type_id || r.lst_kit_type_id,
        kitName: r.kit_type_id || r.lst_kit_type_id,
        quantity: Number(r.quantity || r.lst_quantity || 0),
        updatedAt: r.updated_at || r.lst_updated_at || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  },

  async appendStockLedger(entry: any): Promise<{ ok: boolean }> {
    try {
      let facilityType: 'Warehouse' | 'LGU' = 'Warehouse';
      if (entry.facilityType === 'Warehouse' || entry.facilityType === 'LGU') {
        facilityType = entry.facilityType;
      } else if (entry.destinationLguId || entry.lguId || entry.movementType === 'LGU_RECEIVED' || entry.movementType === 'AID_RECEIVED') {
        facilityType = 'LGU';
      }

      let whId: string | null = null;
      let lguId: string | null = null;

      if (facilityType === 'Warehouse') {
        const rawWh = entry.warehouseId || entry.destinationWarehouseId || entry.warehouseSource;
        if (isUuid(rawWh)) {
          whId = rawWh;
        } else if (rawWh) {
          whId = await this.resolveWarehouseId(rawWh);
        }
      } else {
        const rawLgu = entry.lguId || entry.destinationLguId || entry.lguName || entry.municipality;
        if (isUuid(rawLgu)) {
          lguId = rawLgu;
        } else if (rawLgu) {
          lguId = await this.resolveLguId(rawLgu);
        }
      }

      let kitId = entry.kitTypeId;
      if (!isUuid(kitId)) {
        kitId = await this.resolveKitTypeId(entry.category || entry.fnfiCategory || entry.kitTypeId || 'Family Food Pack');
      }

      let movementType: 'INTAKE_VERIFIED' | 'RELEASE_DISPATCHED' | 'AID_RECEIVED' | 'MUTUAL_AID_OUT' | 'AUDIT_CORRECTION';
      const rawMovement = String(entry.movementType || '');
      if (rawMovement === 'INTAKE_VERIFIED' || rawMovement === 'RELEASE_DISPATCHED' || rawMovement === 'AID_RECEIVED' || rawMovement === 'MUTUAL_AID_OUT' || rawMovement === 'AUDIT_CORRECTION') {
        movementType = rawMovement;
      } else if (rawMovement === 'LGU_RECEIVED' || rawMovement === 'TRANSFER_IN') {
        movementType = 'AID_RECEIVED';
      } else if (rawMovement === 'CUSTODY_TRANSFER' || rawMovement === 'TRANSFER_OUT') {
        movementType = 'MUTUAL_AID_OUT';
      } else {
        movementType = 'AUDIT_CORRECTION';
      }

      const delta = Number(entry.deltaQuantity ?? entry.quantityChange ?? 0);
      const balanceAfter = Math.max(0, Number(entry.balanceAfter ?? Math.abs(delta)));

      let refManifestId: string | null = null;
      if (isUuid(entry.referenceManifestId)) {
        refManifestId = entry.referenceManifestId;
      } else if (entry.referenceManifestId || entry.manifestNumber) {
        const mNum = entry.manifestNumber || entry.referenceManifestId;
        const { data: mRow } = await supabase.from('incoming_manifests').select('id').ilike('manifest_number', String(mNum).trim()).maybeSingle();
        refManifestId = mRow?.id || null;
      }

      let refDrId: string | null = null;
      if (isUuid(entry.referenceDrId)) {
        refDrId = entry.referenceDrId;
      } else if (entry.referenceDrId || entry.drNumber || entry.outgoingRequestId) {
        const drNum = entry.referenceDrId || entry.drNumber || entry.outgoingRequestId;
        const { data: dRow } = await supabase.from('outgoing_requests').select('id').ilike('dr_number', String(drNum).trim()).maybeSingle();
        refDrId = dRow?.id || null;
      }

      const actorProfileId = isUuid(entry.actorProfileId)
        ? entry.actorProfileId
        : (isUuid(entry.performedByProfileId) ? entry.performedByProfileId : null);

      const { error } = await supabase.from('stock_ledger').insert({
        facility_type: facilityType,
        warehouse_id: whId,
        lgu_id: lguId,
        kit_type_id: kitId,
        delta_quantity: delta,
        balance_after: balanceAfter,
        movement_type: movementType,
        reference_manifest_id: refManifestId,
        reference_dr_id: refDrId,
        actor_profile_id: actorProfileId,
        created_at: new Date().toISOString()
      });
      if (error) {
        console.warn('appendStockLedger warning:', error.message);
      }
      return { ok: true };
    } catch (err) {
      console.warn('appendStockLedger exception:', err);
      return { ok: true };
    }
  },

  async getStockLedgerForLgu(lguId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('stock_ledger')
        .select(`
          id,
          facility_type,
          lgu_id,
          kit_type_id,
          delta_quantity,
          balance_after,
          movement_type,
          created_at,
          reference_manifest_id,
          reference_dr_id,
          kit_types:kit_type_id(name)
        `)
        .eq('lgu_id', lguId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('getStockLedgerForLgu error:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('getStockLedgerForLgu exception:', e);
      return [];
    }
  },

  async getLguInventoryReports(lguId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('lgu_inventory_reports')
        .select('*')
        .eq('lgu_id', lguId)
        .order('reported_at', { ascending: false });

      if (error) {
        console.warn('getLguInventoryReports error:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('getLguInventoryReports exception:', e);
      return [];
    }
  },

  async getInventoryBatches(filters?: { warehouseId?: string; lguId?: string; kitTypeId?: string }): Promise<InventoryBatchRecord[]> {
    try {
      let query = supabase.from('inventory_batches').select('*').order('minted_at', { ascending: false });
      if (filters?.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);
      if (filters?.lguId) query = query.eq('lgu_id', filters.lguId);
      if (filters?.kitTypeId) query = query.eq('kit_type_id', filters.kitTypeId);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        const { data: manifests } = await supabase
          .from('incoming_manifests')
          .select('*')
          .in('status', ['Verified', 'Minted']);
        if (!manifests) return [];
        return manifests.map((m: any) => ({
          batchTokenId: m.manifest_number ? `BATCH-${m.manifest_number}` : m.id,
          incomingManifestId: m.id || m.manifest_number,
          kitTypeId: m.kit_type_id || m.category,
          kitName: m.category,
          initialQuantity: Number(m.quantity ?? 0),
          remainingQuantity: Number(m.quantity ?? 0),
          warehouseId: m.destination_warehouse_id,
          lguId: m.destination_lgu_id,
          expirationDate: m.expiration_date,
          manifestHash: m.manifest_hash,
          mintedByProfileId: m.verified_by_profile_id,
          mintedAt: m.created_at
        }));
      }
      return data.map((b: any) => ({
        batchTokenId: b.batch_token_id || b.bat_batch_token_id,
        incomingManifestId: b.incoming_manifest_id || b.bat_incoming_manifest_id,
        kitTypeId: b.kit_type_id || b.bat_kit_type_id,
        kitName: b.kit_type_id || b.bat_kit_type_id,
        initialQuantity: Number(b.initial_quantity || b.bat_initial_quantity || 0),
        remainingQuantity: Number(b.remaining_quantity || b.bat_remaining_quantity || 0),
        warehouseId: b.warehouse_id || b.bat_warehouse_id,
        lguId: b.lgu_id || b.bat_lgu_id,
        expirationDate: b.expiration_date || b.bat_expiration_date,
        manifestHash: b.manifest_hash || b.bat_manifest_hash,
        mintedByProfileId: b.minted_by_profile_id || b.bat_minted_by_profile_id,
        mintedAt: b.minted_at || b.bat_minted_at
      }));
    } catch {
      return [];
    }
  },

  async createInventoryBatch(batch: Partial<InventoryBatchRecord>): Promise<{ batchTokenId: string }> {
    const tokenId = batch.batchTokenId || `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    try {
      const kitId = isUuid(batch.kitTypeId) ? batch.kitTypeId : await this.resolveKitTypeId(batch.kitTypeId);
      const whId = isUuid(batch.warehouseId) ? batch.warehouseId : (batch.warehouseId ? await this.resolveWarehouseId(batch.warehouseId) : null);
      const lguId = isUuid(batch.lguId) ? batch.lguId : (batch.lguId ? await this.resolveLguId(batch.lguId) : null);
      const profileId = isUuid(batch.mintedByProfileId) ? batch.mintedByProfileId : null;

      let incManifestId = isUuid(batch.incomingManifestId) ? batch.incomingManifestId : null;
      if (!incManifestId && batch.incomingManifestId) {
        const { data: incRow } = await supabase
          .from('incoming_manifests')
          .select('id')
          .eq('manifest_number', String(batch.incomingManifestId).trim())
          .maybeSingle();
        if (incRow?.id) incManifestId = incRow.id;
      }

      const { error } = await supabase.from('inventory_batches').insert({
        batch_token_id: tokenId,
        incoming_manifest_id: incManifestId,
        kit_type_id: kitId,
        initial_quantity: batch.initialQuantity || 0,
        remaining_quantity: batch.remainingQuantity ?? batch.initialQuantity ?? 0,
        warehouse_id: whId,
        lgu_id: lguId,
        expiration_date: batch.expirationDate || null,
        manifest_hash: batch.manifestHash || null,
        minted_by_profile_id: profileId,
        minted_at: batch.mintedAt || new Date().toISOString()
      });
      if (error) {
        console.warn('createInventoryBatch warning:', error.message);
      }
    } catch (err) {
      console.warn('createInventoryBatch exception:', err);
    }
    return { batchTokenId: tokenId };
  },

  async getBatchAllocations(drNumber?: string): Promise<OutgoingBatchAllocationRecord[]> {
    try {
      let query = supabase.from('outgoing_batch_allocations').select('*').order('allocated_at', { ascending: false });
      if (drNumber) {
        query = query.eq('outgoing_request_id', drNumber);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((a: any) => ({
        id: a.id,
        outgoingRequestId: a.outgoing_request_id,
        batchTokenId: a.batch_token_id,
        allocatedQuantity: Number(a.allocated_quantity ?? 0),
        allocatedAt: a.allocated_at
      }));
    } catch {
      return [];
    }
  },

  async allocateBatchesToRequest(drNumber: string, allocations: { batchTokenId: string; quantity: number }[]): Promise<{ ok: boolean }> {
    try {
      let canonicalDr = drNumber.trim();
      if (isUuid(canonicalDr)) {
        const { data: dRow } = await supabase.from('outgoing_requests').select('dr_number').eq('id', canonicalDr).maybeSingle();
        if (dRow?.dr_number) canonicalDr = dRow.dr_number;
      }

      for (const alloc of allocations) {
        await supabase.from('outgoing_batch_allocations').insert({
          outgoing_request_id: canonicalDr,
          batch_token_id: alloc.batchTokenId,
          allocated_quantity: alloc.quantity,
          allocated_at: new Date().toISOString()
        });

        let batchRow: { batch_token_id: string; remaining_quantity: number } | null = null;
        if (alloc.batchTokenId) {
          const { data } = await supabase
            .from('inventory_batches')
            .select('batch_token_id, remaining_quantity')
            .eq('batch_token_id', alloc.batchTokenId)
            .maybeSingle();
          if (data) batchRow = data;
        }

        if (!batchRow && (alloc as any).batchNumber) {
          const { data } = await supabase
            .from('inventory_batches')
            .select('batch_token_id, remaining_quantity')
            .ilike('batch_token_id', `%${(alloc as any).batchNumber}%`)
            .maybeSingle();
          if (data) batchRow = data;
        }

        if (batchRow) {
          const newQty = Math.max(0, Number(batchRow.remaining_quantity ?? 0) - alloc.quantity);
          await supabase
            .from('inventory_batches')
            .update({ remaining_quantity: newQty })
            .eq('batch_token_id', batchRow.batch_token_id);
        }
      }
      return { ok: true };
    } catch (err) {
      console.warn('allocateBatchesToRequest warning:', err);
      return { ok: true };
    }
  },

  async getStockByExpirationDate(params: {
    categoryName: string;
    sourceType: 'Warehouse' | 'LGU';
    sourceName: string;
  }): Promise<ExpiryDateBatch[]> {
    try {
      const kitTypeId = await this.resolveKitTypeId(params.categoryName);
      let warehouseId: string | null = null;
      let lguId: string | null = null;

      if (params.sourceType === 'Warehouse') {
        warehouseId = await this.resolveWarehouseId(params.sourceName);
      } else {
        lguId = await this.resolveLguId(params.sourceName);
      }

      let query = supabase
        .from('inventory_batches')
        .select('batch_token_id, incoming_manifest_id, kit_type_id, remaining_quantity, expiration_date, warehouse_id, lgu_id')
        .gt('remaining_quantity', 0)
        .order('expiration_date', { ascending: true, nullsFirst: false });

      if (kitTypeId) query = query.eq('kit_type_id', kitTypeId);
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      if (lguId) query = query.eq('lgu_id', lguId);

      const { data, error } = await query;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (data && data.length > 0) {
        return data.map((b: any) => {
          let days = 999;
          if (b.expiration_date) {
            const exp = new Date(b.expiration_date);
            exp.setHours(0, 0, 0, 0);
            days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }
          return {
            batchTokenId: b.batch_token_id,
            batchNumber: b.batch_token_id.replace(/^BATCH-/, ''),
            expirationDate: b.expiration_date || 'No Expiry Set',
            daysToExpiry: days,
            quantityAvailable: Number(b.remaining_quantity || 0),
            kitTypeId: b.kit_type_id,
            kitName: params.categoryName,
            warehouseId: b.warehouse_id,
            warehouseName: params.sourceType === 'Warehouse' ? params.sourceName : undefined,
            lguId: b.lgu_id,
            lguName: params.sourceType === 'LGU' ? params.sourceName : undefined
          };
        });
      }

      // Fallback: Check verified incoming manifests if no rows in inventory_batches
      let mQuery = supabase
        .from('incoming_manifests')
        .select('*')
        .in('status', ['Verified', 'Minted'])
        .gt('quantity', 0)
        .ilike('category', `%${params.categoryName}%`)
        .order('expiration_date', { ascending: true });

      if (warehouseId) mQuery = mQuery.eq('destination_warehouse_id', warehouseId);
      if (lguId) mQuery = mQuery.eq('destination_lgu_id', lguId);

      const { data: manifests } = await mQuery;
      if (!manifests || manifests.length === 0) return [];

      return manifests.map((m: any) => {
        let days = 999;
        if (m.expiration_date) {
          const exp = new Date(m.expiration_date);
          exp.setHours(0, 0, 0, 0);
          days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        return {
          batchTokenId: `BATCH-${m.manifest_number || m.id}`,
          batchNumber: m.manifest_number || m.id,
          expirationDate: m.expiration_date || 'No Expiry Set',
          daysToExpiry: days,
          quantityAvailable: Number(m.quantity || 0),
          kitTypeId: m.kit_type_id || kitTypeId,
          kitName: m.category || params.categoryName,
          warehouseId: m.destination_warehouse_id,
          lguId: m.destination_lgu_id
        };
      });
    } catch (err) {
      console.warn('getStockByExpirationDate error:', err);
      return [];
    }
  },

  async applyDateBatchDeductions(
    drNumber: string,
    allocations: { batchTokenId: string; expirationDate?: string; quantity: number }[],
    sourceType: 'Warehouse' | 'LGU',
    sourceName: string,
    categoryName: string
  ): Promise<{ ok: boolean }> {
    try {
      let canonicalDr = drNumber.trim();
      if (isUuid(canonicalDr)) {
        const { data: dRow } = await supabase.from('outgoing_requests').select('dr_number').eq('id', canonicalDr).maybeSingle();
        if (dRow?.dr_number) canonicalDr = dRow.dr_number;
      }

      const totalQuantity = allocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
      if (totalQuantity <= 0) return { ok: true };

      // 1. Deduct each specific batch in inventory_batches and insert into outgoing_batch_allocations
      for (const alloc of allocations) {
        if (!alloc.quantity || alloc.quantity <= 0) continue;

        let batchRow: { batch_token_id: string; remaining_quantity: number } | null = null;
        if (alloc.batchTokenId) {
          const { data } = await supabase
            .from('inventory_batches')
            .select('batch_token_id, remaining_quantity')
            .eq('batch_token_id', alloc.batchTokenId)
            .maybeSingle();
          if (data) batchRow = data;
        }

        if (!batchRow && (alloc as any).batchNumber) {
          const { data } = await supabase
            .from('inventory_batches')
            .select('batch_token_id, remaining_quantity')
            .ilike('batch_token_id', `%${(alloc as any).batchNumber}%`)
            .maybeSingle();
          if (data) batchRow = data;
        }

        if (batchRow) {
          const newQty = Math.max(0, Number(batchRow.remaining_quantity || 0) - alloc.quantity);
          await supabase
            .from('inventory_batches')
            .update({ remaining_quantity: newQty })
            .eq('batch_token_id', batchRow.batch_token_id);
        }

        await supabase
          .from('outgoing_batch_allocations')
          .insert({
            outgoing_request_id: canonicalDr,
            batch_token_id: batchRow ? batchRow.batch_token_id : alloc.batchTokenId,
            allocated_quantity: alloc.quantity,
            allocated_at: new Date().toISOString()
          });
      }

      // 2. Deduct facility aggregate stock
      if (sourceType === 'Warehouse') {
        await this.deductWarehouseStock(sourceName, categoryName, totalQuantity);
      } else {
        await this.deductLguStock(sourceName, categoryName, totalQuantity);
      }

      // 3. Update outgoing_requests snapshot
      await supabase
        .from('outgoing_requests')
        .update({
          allocated_batches: allocations
        })
        .ilike('dr_number', canonicalDr);

      return { ok: true };
    } catch (err) {
      console.warn('applyDateBatchDeductions error:', err);
      return { ok: false };
    }
  },

  async getCustodyHops(drNumber?: string): Promise<CustodyHopRecord[]> {
    try {
      let query = supabase.from('custody_hops').select('*').order('sequence', { ascending: true });
      if (drNumber) {
        query = query.eq('outgoing_request_id', drNumber);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      return data.map((h: any) => ({
        id: h.id,
        outgoingRequestId: h.outgoing_request_id,
        sequence: Number(h.sequence ?? 1),
        fromDriverProfileId: h.from_driver_profile_id,
        toDriverProfileId: h.to_driver_profile_id,
        fromTruckId: h.from_truck_id,
        toTruckId: h.to_truck_id,
        gpsCoordinates: h.gps_coordinates,
        note: h.note,
        txHash: h.tx_hash,
        transferredAt: h.transferred_at
      }));
    } catch {
      return [];
    }
  },

  async recordCustodyHop(hop: any): Promise<{ ok: boolean }> {
    try {
      const drNumber = String(hop.outgoingRequestId || hop.drNumber || '').trim();
      if (!drNumber) return { ok: true };

      let canonicalDr = drNumber;
      if (isUuid(canonicalDr)) {
        const { data: outReq } = await supabase
          .from('outgoing_requests')
          .select('dr_number')
          .eq('id', canonicalDr)
          .maybeSingle();
        if (outReq?.dr_number) {
          canonicalDr = outReq.dr_number;
        }
      }

      const { data: existingDr } = await supabase
        .from('outgoing_requests')
        .select('dr_number')
        .ilike('dr_number', canonicalDr)
        .maybeSingle();

      if (!existingDr) {
        console.warn(`recordCustodyHop: outgoing request ${canonicalDr} not found in database.`);
        return { ok: true };
      }

      let toDriverId = hop.toDriverProfileId;
      if (!isUuid(toDriverId)) {
        const { data: anyProf } = await supabase
          .from('profiles')
          .select('id')
          .or('role.eq.receiver,role.eq.driver,role.eq.escort,role.ilike.%escort%')
          .limit(1)
          .maybeSingle();
        toDriverId = anyProf?.id || null;
      }

      if (!toDriverId) {
        console.warn('recordCustodyHop: no valid to_driver_profile_id UUID available.');
        return { ok: true };
      }

      const fromDriverId = isUuid(hop.fromDriverProfileId) ? hop.fromDriverProfileId : null;
      const fromTruck = hop.fromTruckId?.trim() ? hop.fromTruckId.trim() : null;
      const toTruck = hop.toTruckId?.trim() ? hop.toTruckId.trim() : null;
      const gps = hop.gpsCoordinates || hop.gps_coordinates || '10.7202, 122.5621';
      const note = hop.note || hop.notes || null;
      const txHash = hop.txHash || hop.blockchainTxHash || null;
      const seq = Math.max(1, Math.floor(Number(hop.sequence || 1)));

      const { error } = await supabase.from('custody_hops').insert({
        outgoing_request_id: existingDr.dr_number,
        sequence: seq,
        from_driver_profile_id: fromDriverId,
        to_driver_profile_id: toDriverId,
        from_truck_id: fromTruck,
        to_truck_id: toTruck,
        gps_coordinates: gps,
        note: note,
        tx_hash: txHash,
        transferred_at: hop.transferredAt || new Date().toISOString()
      });

      if (error) {
        console.warn('recordCustodyHop warning:', error.message);
      }
      return { ok: true };
    } catch (err) {
      console.warn('recordCustodyHop exception:', err);
      return { ok: true };
    }
  },

  async getEscortProfiles(): Promise<EscortProfile[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, email, phone_number, truck_id')
        .order('first_name', { ascending: true });

      if (error || !data || data.length === 0) {
        return [
          { id: 'escort-01', fullName: 'Officer Mark Santos (Lead Escort)', role: 'escort', email: 'mark.escort@dswd6.gov.ph', phone: '0917-111-2222', truckId: 'TRUCK-01' },
          { id: 'escort-02', fullName: 'Officer Carlos Reyes (Convoy Escort)', role: 'escort', email: 'carlos.escort@dswd6.gov.ph', phone: '0917-222-3333', truckId: 'TRUCK-02' },
          { id: 'escort-03', fullName: 'Officer Maria Elena Gomez (Field Escort)', role: 'escort', email: 'elena.escort@dswd6.gov.ph', phone: '0917-333-4444', truckId: 'TRUCK-03' },
          { id: 'escort-04', fullName: 'Officer Roberto Tan (Preposition Escort)', role: 'escort', email: 'roberto.escort@dswd6.gov.ph', phone: '0917-444-5555', truckId: 'TRUCK-04' }
        ];
      }
      return data.map((p: any) => {
        const computedName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
        return {
          id: p.id,
          fullName: computedName || p.email || 'Relief Escort Officer',
          role: p.role,
          email: p.email,
          phone: p.phone_number || p.phone,
          truckId: p.truck_id
        };
      });
    } catch {
      return [
        { id: 'escort-01', fullName: 'Officer Mark Santos (Lead Escort)', role: 'escort', email: 'mark.escort@dswd6.gov.ph', phone: '0917-111-2222', truckId: 'TRUCK-01' },
        { id: 'escort-02', fullName: 'Officer Carlos Reyes (Convoy Escort)', role: 'escort', email: 'carlos.escort@dswd6.gov.ph', phone: '0917-222-3333', truckId: 'TRUCK-02' },
        { id: 'escort-03', fullName: 'Officer Maria Elena Gomez (Field Escort)', role: 'escort', email: 'elena.escort@dswd6.gov.ph', phone: '0917-333-4444', truckId: 'TRUCK-03' },
        { id: 'escort-04', fullName: 'Officer Roberto Tan (Preposition Escort)', role: 'escort', email: 'roberto.escort@dswd6.gov.ph', phone: '0917-444-5555', truckId: 'TRUCK-04' }
      ];
    }
  },

  subscribeDashboard(onChange: () => void) {
    const channelName = `dashboard-db-changes-${crypto.randomUUID().slice(0, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lgus' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incoming_manifests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outgoing_requests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'truck_live_locations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lgu_inventory_reports' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discrepancy_reports' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'provinces' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_sources' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kit_types' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lgu_stock' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outgoing_batch_allocations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custody_hops' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeActivityLogs(onChange: () => void) {
    const channelName = `activity-logs-${crypto.randomUUID().slice(0, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeTruckLiveLocations(
    onUpsert: (location: TruckLiveLocation) => void,
    onDelete?: (truckId: string) => void
  ) {
    backendApi.getTruckLiveLocations()
      .then((locations) => locations.forEach(onUpsert))
      .catch(() => {});

    const channelName = `truck-live-locations-${crypto.randomUUID().slice(0, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'truck_live_locations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { truck_id?: string })?.truck_id;
          if (deletedId && onDelete) {
            onDelete(deletedId);
          }
        } else if (payload.new && typeof payload.new === 'object') {
          onUpsert(payload.new as TruckLiveLocation);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
