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
  incidentCode: string;
  status?: 'Draft' | 'Pending Verification' | 'Verified' | 'Minted';
  manifestHash?: string;
  txHash?: string;
  walletAddress?: string;
}

export interface IncomingUpdatePayload {
  status?: 'Draft' | 'Pending Verification' | 'Verified' | 'Minted' | 'Correction Requested' | 'Rejected';
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
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
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
}

export interface DiscrepancyReportPayload {
  reportType: 'Incoming' | 'Outgoing';
  manifestNumber?: string;
  drNumber?: string;
  note: string;
  reportedByRole?: string;
  reportedByWallet?: string;
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
}

export interface TruckLiveLocation {
  truck_id: string;
  current_dr_number?: string | null;
  shipment_id?: string | null;
  destination_lgu_id?: string | null;
  destination_name?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
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
  dr_number: string;
  date_allocated?: string | null;
  created_at?: string | null;
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
  tx_hash?: string | null;
  wallet_address?: string | null;
  receiver_gps?: string | null;
  destination_address?: string | null;
  delivery_priority?: number | null;
  is_held?: boolean | null;
}

export type TruckerReleaseRecord = ReceiverReleaseRecord;

const throwIfError = (error: unknown, context: string) => {
  if (error) {
    const message = formatUserErrorMessage(error);
    throw new Error(`${context}: ${message}`);
  }
};

const definedOnly = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

export const backendApi = {
  async getDashboard() {
    const [incomingResult, outgoingResult, lguReportsResult, discrepancyResult, lgusResult, provincesResult, warehousesResult, sourcesResult, kitsResult] = await Promise.all([
      supabase.from('incoming_manifests').select('*').order('created_at', { ascending: false }),
      supabase.from('outgoing_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('lgu_inventory_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('discrepancy_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('lgus').select('*').eq('is_active', true).order('province', { ascending: true }),
      supabase.from('provinces').select('*').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('warehouses').select('*').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('supply_sources').select('*').eq('is_active', true).order('name', { ascending: true }),
      supabase.from('kit_types').select('*').eq('is_active', true).order('name', { ascending: true })
    ]);

    throwIfError(incomingResult.error, 'Unable to load incoming manifests');
    throwIfError(outgoingResult.error, 'Unable to load outgoing requests');

    if (lguReportsResult.error) {
      console.warn('LGU inventory reports are not available yet. Run supabase-schema-patch.sql to create lgu_inventory_reports.', lguReportsResult.error);
    }
    if (discrepancyResult.error) {
      console.warn('Discrepancy reports are not available yet. Run supabase-schema-patch.sql to create discrepancy_reports.', discrepancyResult.error);
    }
    if (lgusResult.error) {
      console.warn('Master LGUs table is not available yet. Run supabase-schema-patch.sql to create public.lgus.', lgusResult.error);
    }

    return {
      incoming: incomingResult.data ?? [],
      outgoing: outgoingResult.data ?? [],
      lguReports: lguReportsResult.error ? [] : lguReportsResult.data ?? [],
      discrepancyReports: discrepancyResult.error ? [] : discrepancyResult.data ?? [],
      lgus: lgusResult.error ? [] : lgusResult.data ?? [],
      provinces: provincesResult.error ? [] : provincesResult.data ?? [],
      warehouses: warehousesResult.error ? [] : warehousesResult.data ?? [],
      sources: sourcesResult.error ? [] : sourcesResult.data ?? [],
      kits: kitsResult.error ? [] : kitsResult.data ?? []
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
        'Food Pack': foodPacks,
        'Hygiene Kit': hygieneKits,
        'Sleeping Kit': sleepingKits,
        'Kitchen Kit': kitchenKits,
        'Family Kit': familyKits,
        'Laminated Sack': laminatedSacks,
        'RTEF': rtef,
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
        food_packs: payload.initialStock?.['Food Pack'] || 0,
        hygiene_kits: payload.initialStock?.['Hygiene Kit'] || 0,
        sleeping_kits: payload.initialStock?.['Sleeping Kit'] || 0,
        kitchen_kits: payload.initialStock?.['Kitchen Kit'] || 0,
        family_kits: payload.initialStock?.['Family Kit'] || 0,
        laminated_sacks: payload.initialStock?.['Laminated Sack'] || 0,
        rtef: payload.initialStock?.['RTEF'] || 0,
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
      if (payload.initialStock['Food Pack'] !== undefined) updates.food_packs = payload.initialStock['Food Pack'];
      if (payload.initialStock['Hygiene Kit'] !== undefined) updates.hygiene_kits = payload.initialStock['Hygiene Kit'];
      if (payload.initialStock['Sleeping Kit'] !== undefined) updates.sleeping_kits = payload.initialStock['Sleeping Kit'];
      if (payload.initialStock['Kitchen Kit'] !== undefined) updates.kitchen_kits = payload.initialStock['Kitchen Kit'];
      if (payload.initialStock['Family Kit'] !== undefined) updates.family_kits = payload.initialStock['Family Kit'];
      if (payload.initialStock['Laminated Sack'] !== undefined) updates.laminated_sacks = payload.initialStock['Laminated Sack'];
      if (payload.initialStock['RTEF'] !== undefined) updates.rtef = payload.initialStock['RTEF'];
    }

    const { error } = await supabase.from('warehouses').update(updates).eq('id', id);
    throwIfError(error, 'Failed to update warehouse');
    return { ok: true };
  },

  async deleteWarehouse(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('warehouses').delete().eq('id', id);
    throwIfError(error, 'Failed to delete warehouse');
    return { ok: true };
  },

  async deleteWarehousesBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('warehouses').delete().in('id', ids);
    throwIfError(error, 'Failed to batch delete warehouses');
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

      if (catLower.includes('food pack') || catLower === 'food pack') {
        updates.food_packs = Math.max(0, (wh.food_packs || 0) - quantity);
      } else if (catLower.includes('hygiene') || catLower === 'hygiene kit') {
        updates.hygiene_kits = Math.max(0, (wh.hygiene_kits || 0) - quantity);
      } else if (catLower.includes('sleeping') || catLower === 'sleeping kit') {
        updates.sleeping_kits = Math.max(0, (wh.sleeping_kits || 0) - quantity);
      } else if (catLower.includes('kitchen') || catLower === 'kitchen kit') {
        updates.kitchen_kits = Math.max(0, (wh.kitchen_kits || 0) - quantity);
      } else if (catLower.includes('family kit') || catLower === 'family kit') {
        updates.family_kits = Math.max(0, (wh.family_kits || 0) - quantity);
      } else if (catLower.includes('sack') || catLower === 'laminated sack') {
        updates.laminated_sacks = Math.max(0, (wh.laminated_sacks || 0) - quantity);
      } else if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) {
        updates.rtef = Math.max(0, (wh.rtef || 0) - quantity);
      }

      const canonical = normalizeCategoryName(category);
      const stockMap = { ...(wh.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined ? Number(stockMap[canonical]) : (Number(stockMap[category]) || 0);
      const nextVal = Math.max(0, currentVal - quantity);
      if (canonical) stockMap[canonical] = nextVal;
      stockMap[category] = nextVal;
      updates.current_stock = stockMap;

      const { error } = await supabase.from('warehouses').update(updates).eq('id', wh.id);
      if (error) {
        console.error('Failed to deduct warehouse stock:', error.message);
        return { ok: false };
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

      if (catLower.includes('food pack') || catLower === 'food pack' || canonical === 'Food Pack') {
        updates.food_packs = (wh.food_packs || 0) + quantity;
      } else if (catLower.includes('hygiene') || catLower === 'hygiene kit' || canonical === 'Hygiene Kit') {
        updates.hygiene_kits = (wh.hygiene_kits || 0) + quantity;
      } else if (catLower.includes('sleeping') || catLower === 'sleeping kit' || canonical === 'Sleeping Kit') {
        updates.sleeping_kits = (wh.sleeping_kits || 0) + quantity;
      } else if (catLower.includes('kitchen') || catLower === 'kitchen kit' || canonical === 'Kitchen Kit') {
        updates.kitchen_kits = (wh.kitchen_kits || 0) + quantity;
      } else if (catLower.includes('family kit') || catLower === 'family kit' || canonical === 'Family Kit') {
        updates.family_kits = (wh.family_kits || 0) + quantity;
      } else if (catLower.includes('sack') || catLower === 'laminated sack' || canonical === 'Laminated Sack') {
        updates.laminated_sacks = (wh.laminated_sacks || 0) + quantity;
      } else if (catLower.includes('rtef') || catLower.includes('ready-to-eat') || canonical === 'RTEF') {
        updates.rtef = (wh.rtef || 0) + quantity;
      }

      const stockMap = { ...(wh.current_stock || {}) };
      const currentVal = stockMap[canonical] !== undefined ? Number(stockMap[canonical]) : (Number(stockMap[category]) || 0);
      const nextVal = currentVal + quantity;
      if (canonical) stockMap[canonical] = nextVal;
      stockMap[category] = nextVal;
      updates.current_stock = stockMap;

      const { error } = await supabase.from('warehouses').update(updates).eq('id', wh.id);
      if (error) {
        console.error('Failed to add warehouse stock:', error.message);
        return { ok: false };
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
      const { data: lgu } = await supabase
        .from('lgus')
        .select('*')
        .ilike('municipality', cleanMuni)
        .limit(1)
        .maybeSingle();

      if (!lgu) return { ok: false };

      const catLower = category.toLowerCase();
      const updates: Record<string, unknown> = {
        last_reported_at: new Date().toISOString()
      };

      if (catLower.includes('food')) {
        updates.food_packs = Math.max(0, (lgu.food_packs || 0) - quantity);
      } else if (catLower.includes('hygiene')) {
        updates.hygiene_kits = Math.max(0, (lgu.hygiene_kits || 0) - quantity);
      } else if (catLower.includes('family')) {
        updates.family_kits = Math.max(0, (lgu.family_kits || 0) - quantity);
      } else if (catLower.includes('sleeping')) {
        updates.sleeping_kits = Math.max(0, (lgu.sleeping_kits || 0) - quantity);
      }

      const stockMap = { ...(lgu.current_stock || {}) };
      stockMap[category] = Math.max(0, (stockMap[category] || 0) - quantity);
      updates.current_stock = stockMap;

      await supabase.from('lgus').update(updates).eq('id', lgu.id);
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

      const catLower = category.toLowerCase();
      const canonical = normalizeCategoryName(category);
      const updates: Record<string, unknown> = {
        last_reported_at: new Date().toISOString()
      };

      if (catLower.includes('food') || canonical === 'Food Pack') {
        updates.food_packs = (lgu.food_packs || 0) + quantity;
      } else if (catLower.includes('hygiene') || canonical === 'Hygiene Kit') {
        updates.hygiene_kits = (lgu.hygiene_kits || 0) + quantity;
      } else if (catLower.includes('family') || canonical === 'Family Kit') {
        updates.family_kits = (lgu.family_kits || 0) + quantity;
      } else if (catLower.includes('sleeping') || canonical === 'Sleeping Kit') {
        updates.sleeping_kits = (lgu.sleeping_kits || 0) + quantity;
      } else if (catLower.includes('kitchen') || canonical === 'Kitchen Kit') {
        updates.kitchen_kits = (lgu.kitchen_kits || 0) + quantity;
      } else if (catLower.includes('sack') || canonical === 'Laminated Sack') {
        updates.laminated_sacks = (lgu.laminated_sacks || 0) + quantity;
      } else if (catLower.includes('rtef') || canonical === 'RTEF') {
        updates.rtef = (lgu.rtef || 0) + quantity;
      }

      const stockMap = { ...(lgu.current_stock || {}) };
      const canonicalKey = canonical || category;
      stockMap[canonicalKey] = (stockMap[canonicalKey] || 0) + quantity;
      if (category !== canonicalKey) {
        stockMap[category] = stockMap[canonicalKey];
      }
      updates.current_stock = stockMap;

      const updatedFoodPacks = updates.food_packs !== undefined ? Number(updates.food_packs) : Number(lgu.food_packs || 0);
      const maxStock = Number(lgu.max_stock ?? 3000);
      const evalRes = evaluatePriorityIndicator({
        foodPacks: updatedFoodPacks,
        affectedFamilies: Number(lgu.affected_families ?? 0),
        targetQuota: maxStock
      });
      updates.urgency_score = evalRes.urgencyScore;
      updates.priority_color = evalRes.priorityColor;
      updates.recommendation = evalRes.systemResponse;

      const { error } = await supabase.from('lgus').update(updates).eq('id', lgu.id);
      if (error) {
        console.warn('Failed to update LGU stock:', error.message);
        return { ok: false };
      }
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
      current_stock: canonicalUpdates,
      updated_at: new Date().toISOString(),
      last_reported_at: new Date().toISOString()
    };
    if (canonicalUpdates['Food Pack'] !== undefined) updates.food_packs = canonicalUpdates['Food Pack'];
    if (canonicalUpdates['Hygiene Kit'] !== undefined) updates.hygiene_kits = canonicalUpdates['Hygiene Kit'];
    if (canonicalUpdates['Sleeping Kit'] !== undefined) updates.sleeping_kits = canonicalUpdates['Sleeping Kit'];
    if (canonicalUpdates['Kitchen Kit'] !== undefined) updates.kitchen_kits = canonicalUpdates['Kitchen Kit'];
    if (canonicalUpdates['Family Kit'] !== undefined) updates.family_kits = canonicalUpdates['Family Kit'];
    if (canonicalUpdates['Laminated Sack'] !== undefined) updates.laminated_sacks = canonicalUpdates['Laminated Sack'];
    if (canonicalUpdates['RTEF'] !== undefined) updates.rtef = canonicalUpdates['RTEF'];

    try {
      const { data: currentLgu } = await supabase.from('lgus').select('max_stock, affected_families, food_packs').eq('id', lguId).maybeSingle();
      if (currentLgu) {
        const targetQuota = Number(currentLgu.max_stock ?? 3000);
        const evalFood = canonicalUpdates['Food Pack'] !== undefined ? Number(canonicalUpdates['Food Pack']) : Number(currentLgu.food_packs ?? 0);
        const evalRes = evaluatePriorityIndicator({
          foodPacks: evalFood,
          affectedFamilies: Number(currentLgu.affected_families ?? 0),
          targetQuota
        });
        updates.urgency_score = evalRes.urgencyScore;
        updates.priority_color = evalRes.priorityColor;
        updates.recommendation = evalRes.systemResponse;
      }
    } catch {}

    const { error } = await supabase
      .from('lgus')
      .update(updates)
      .eq('id', lguId);

    throwIfError(error, 'Failed to update LGU stock in database');

    try {
      await supabase.from('discrepancy_reports').insert({
        report_type: 'Emergency LGU Stock Correction',
        manifest_number: `EMERGENCY-LGU-${lguId.slice(0, 8)}`,
        note: `Emergency correction by ${actorName || 'Admin'}: ${reason.trim()}. Adjusted stock: ${JSON.stringify(stockUpdates)}`
      });
    } catch (discErr) {
      console.warn('Could not record emergency discrepancy log:', discErr);
    }

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

  async deleteSupplySource(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('supply_sources').delete().eq('id', id);
    throwIfError(error, 'Failed to delete supply source');
    return { ok: true };
  },

  async deleteSupplySourcesBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('supply_sources').delete().in('id', ids);
    throwIfError(error, 'Failed to batch delete supply sources');
    return { ok: true };
  },

  // --- KIT TYPES ---
  async getKitTypes(): Promise<KitTypeRecord[]> {
    try {
      const { data, error } = await supabase
        .from('kit_types')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return DEFAULT_KIT_TYPES;
      }

      const activeKits = (data ?? []).filter((r: any) => r.is_active !== false);

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
      return DEFAULT_KIT_TYPES;
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

  async deleteKitType(id: string): Promise<{ ok: boolean }> {
    const { error } = await supabase.from('kit_types').delete().eq('id', id);
    throwIfError(error, 'Failed to delete kit type');
    return { ok: true };
  },

  async deleteKitTypesBatch(ids: string[]): Promise<{ ok: boolean }> {
    if (ids.length === 0) return { ok: true };
    const { error } = await supabase.from('kit_types').delete().in('id', ids);
    throwIfError(error, 'Failed to batch delete kit types');
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

      return activeRows.map((row: Record<string, any>) => {
        const rawStock = (row.current_stock && typeof row.current_stock === 'object') ? row.current_stock : {};

        let extractedFoodPacks = Number(row.food_packs ?? 0);
        let extractedHygieneKits = Number(row.hygiene_kits ?? 0);
        let extractedSleepingKits = Number(row.sleeping_kits ?? 0);
        let extractedKitchenKits = Number(row.kitchen_kits ?? 0);
        let extractedFamilyKits = Number(row.family_kits ?? 0);
        let extractedLaminatedSacks = Number(row.laminated_sacks ?? 0);
        let extractedRtef = Number(row.rtef ?? 0);

        Object.entries(rawStock).forEach(([key, val]) => {
          const canonical = normalizeCategoryName(key);
          const num = Number(val) || 0;
          if (canonical === 'Food Pack') extractedFoodPacks = Math.max(extractedFoodPacks, num);
          else if (canonical === 'Hygiene Kit') extractedHygieneKits = Math.max(extractedHygieneKits, num);
          else if (canonical === 'Sleeping Kit') extractedSleepingKits = Math.max(extractedSleepingKits, num);
          else if (canonical === 'Kitchen Kit') extractedKitchenKits = Math.max(extractedKitchenKits, num);
          else if (canonical === 'Family Kit') extractedFamilyKits = Math.max(extractedFamilyKits, num);
          else if (canonical === 'Laminated Sack') extractedLaminatedSacks = Math.max(extractedLaminatedSacks, num);
          else if (canonical === 'RTEF') extractedRtef = Math.max(extractedRtef, num);
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
          'Food Pack': foodPacks,
          'Hygiene Kit': hygieneKits,
          'Sleeping Kit': sleepingKits,
          'Kitchen Kit': kitchenKits,
          'Family Kit': familyKits,
          'Laminated Sack': laminatedSacks,
          'RTEF': rtef
        };

        // Also preserve custom / dynamic non-standard categories
        Object.entries(rawStock).forEach(([key, val]) => {
          const canonical = normalizeCategoryName(key);
          if (!['Food Pack', 'Hygiene Kit', 'Sleeping Kit', 'Kitchen Kit', 'Family Kit', 'Laminated Sack', 'RTEF'].includes(canonical)) {
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
        food_packs: payload.initialStock?.['Food Pack'] || 0,
        hygiene_kits: payload.initialStock?.['Hygiene Kit'] || 0,
        sleeping_kits: payload.initialStock?.['Sleeping Kit'] || 0,
        kitchen_kits: payload.initialStock?.['Kitchen Kit'] || 0,
        family_kits: payload.initialStock?.['Family Kit'] || 0,
        laminated_sacks: payload.initialStock?.['Laminated Sack'] || 0,
        rtef: payload.initialStock?.['RTEF'] || 0,
        current_stock: payload.initialStock || {},
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
            food_packs: payload.initialStock['Food Pack'] || 0,
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

    if (payload.initialStock) {
      const canonicalInitial: Record<string, number> = {};
      Object.entries(payload.initialStock).forEach(([k, v]) => {
        const canonical = normalizeCategoryName(k);
        const val = Number(v) || 0;
        if (canonical) canonicalInitial[canonical] = val;
        canonicalInitial[k] = val;
      });

      updates.current_stock = canonicalInitial;
      if (canonicalInitial['Food Pack'] !== undefined) updates.food_packs = canonicalInitial['Food Pack'];
      if (canonicalInitial['Hygiene Kit'] !== undefined) updates.hygiene_kits = canonicalInitial['Hygiene Kit'];
      if (canonicalInitial['Sleeping Kit'] !== undefined) updates.sleeping_kits = canonicalInitial['Sleeping Kit'];
      if (canonicalInitial['Kitchen Kit'] !== undefined) updates.kitchen_kits = canonicalInitial['Kitchen Kit'];
      if (canonicalInitial['Family Kit'] !== undefined) updates.family_kits = canonicalInitial['Family Kit'];
      if (canonicalInitial['Laminated Sack'] !== undefined) updates.laminated_sacks = canonicalInitial['Laminated Sack'];
      if (canonicalInitial['RTEF'] !== undefined) updates.rtef = canonicalInitial['RTEF'];
      updates.last_reported_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('lgus')
      .update(updates)
      .eq('id', id);

    throwIfError(error, 'Failed to update LGU');

    if (payload.initialStock && payload.municipality) {
      try {
        const foodReport = updates.food_packs !== undefined ? Number(updates.food_packs) : 0;
        const hygieneReport = updates.hygiene_kits !== undefined ? Number(updates.hygiene_kits) : 0;
        const familyReport = updates.family_kits !== undefined ? Number(updates.family_kits) : 0;
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
    const { data, error } = await supabase
      .from('incoming_manifests')
      .insert({
        manifest_number: payload.manifestNumber,
        date_received: payload.dateReceived,
        category: payload.fnfiCategory,
        quantity: payload.quantity,
        unit_type: payload.unitType,
        expiration_date: payload.expirationDate,
        source: payload.source,
        destination_type: payload.destinationType,
        destination: payload.destination,
        incident_code: payload.incidentCode,
        status: payload.status ?? 'Draft',
        manifest_hash: payload.manifestHash,
        tx_hash: payload.txHash,
        wallet_address: payload.walletAddress
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create incoming manifest');
    return data;
  },

  async updateIncoming(manifestNumber: string, payload: IncomingUpdatePayload) {
    const updates = definedOnly({
      status: payload.status,
      manifest_hash: payload.manifestHash,
      tx_hash: payload.txHash,
      batch_token_id: payload.batchTokenId,
      minted_at: payload.mintedAt,
      wallet_address: payload.walletAddress,
      incident_code: payload.incidentCode,
      category: payload.category,
      quantity: payload.quantity,
      unit_type: payload.unitType,
      expiration_date: payload.expirationDate,
      source: payload.source,
      destination_type: payload.destinationType,
      destination: payload.destination,
      correction_note: payload.correctionNote
    });

    let { error } = await supabase
      .from('incoming_manifests')
      .update(updates)
      .eq('manifest_number', manifestNumber);

    if (error && (error.message?.includes('correction_note') || (error as any).code === '42703')) {
      const { correction_note, ...rest } = updates;
      const retry = await supabase
        .from('incoming_manifests')
        .update(rest)
        .eq('manifest_number', manifestNumber);
      error = retry.error;
    }

    throwIfError(error, 'Failed to update incoming manifest');
    return { ok: true };
  },

  async createOutgoing(payload: OutgoingPayload) {
    const { data, error } = await supabase
      .from('outgoing_requests')
      .insert({
        dr_number: payload.drNumber,
        date_allocated: payload.dateAllocated,
        lgu_id: payload.lguId ?? payload.lgu_id ?? null,
        lgu_name: payload.lguName,
        province: payload.province,
        municipality: payload.municipality,
        category: payload.fnfiCategory,
        amount_requested: payload.amountRequested,
        amount_approved: payload.amountApproved,
        warehouse_source: payload.warehouseSource,
        delivery_mode: payload.deliveryMode,
        delivery_status: payload.deliveryStatus ?? 'Allocating',
        incident_code: payload.incidentCode,
        allocated_batches: payload.allocatedBatches,
        sender_gps: payload.senderGps,
        receiver_gps: payload.receiverGps,
        destination_address: payload.destinationAddress ?? payload.destination_address,
        tx_hash: payload.txHash,
        wallet_address: payload.walletAddress,
        assigned_truck_id: payload.assignedTruckId ?? payload.assigned_truck_id ?? null
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create outgoing request');
    return data;
  },

  async updateOutgoing(drNumber: string, payload: OutgoingUpdatePayload) {
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
      assigned_truck_id: payload.assignedTruckId ?? payload.assigned_truck_id
    });

    const { error } = await supabase
      .from('outgoing_requests')
      .update(updates)
      .ilike('dr_number', drNumber.trim());

    throwIfError(error, 'Failed to update outgoing request');
    return { ok: true };
  },


  async createLGUInventoryReport(payload: LGUInventoryReportPayload) {
    const { data, error } = await supabase
      .from('lgu_inventory_reports')
      .insert({
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

    // Materialize authoritative stock & priority metrics into public.lgus
    try {
      const { data: existingLgu } = await supabase
        .from('lgus')
        .select('current_stock')
        .ilike('municipality', payload.municipality.trim())
        .maybeSingle();

      const nextStock: Record<string, number> = { ...(existingLgu?.current_stock || {}) };
      nextStock['Food Pack'] = payload.foodPacks;
      nextStock['Hygiene Kit'] = payload.hygieneKits;
      nextStock['Family Kit'] = payload.familyKits;

      await supabase
        .from('lgus')
        .update({
          food_packs: payload.foodPacks,
          hygiene_kits: payload.hygieneKits,
          family_kits: payload.familyKits,
          affected_families: payload.affectedFamilies,
          damage_index: payload.damageIndex,
          urgency_score: payload.urgencyScore,
          priority_color: payload.priorityColor,
          recommendation: payload.recommendation,
          last_reported_at: new Date().toISOString(),
          current_stock: nextStock
        })
        .ilike('municipality', payload.municipality.trim());
    } catch (lguErr) {
      console.warn('Failed to update public.lgus on inventory report:', lguErr);
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
    const { data, error } = await supabase
      .from('discrepancy_reports')
      .insert({
        report_type: payload.reportType,
        manifest_number: payload.manifestNumber,
        dr_number: payload.drNumber,
        note: payload.note,
        reported_by_role: payload.reportedByRole,
        reported_by_wallet: payload.reportedByWallet
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

  async getNextDrIndex() {
    try {
      const { data, error } = await supabase
        .from('app_counters')
        .select('value')
        .eq('key', 'dr_index')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const nextValue = ((data as { value?: number } | null)?.value ?? 0) + 1;
      await supabase
        .from('app_counters')
        .update({ value: nextValue, updated_at: new Date().toISOString() })
        .eq('key', 'dr_index');
      return nextValue;
    } catch {
      return null;
    }
  },

  async markHandoverAccepted(drNumber: string, receiverGps: string, txHash?: string) {
    const { error } = await supabase
      .from('outgoing_requests')
      .update({ delivery_status: 'Accepted', receiver_gps: receiverGps, tx_hash: txHash })
      .eq('dr_number', drNumber);

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

    const cleanDr = params.drNumber.trim();
    const { error: outError } = await supabase
      .from('outgoing_requests')
      .update(updates)
      .ilike('dr_number', cleanDr);

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
      .select('dr_number,date_allocated,lgu_name,province,municipality,category,amount_requested,amount_approved,warehouse_source,delivery_mode,delivery_status,incident_code,allocated_batches,handover_contract_id,assigned_truck_id,tx_hash,wallet_address,receiver_gps,destination_address')
      .or('delivery_mode.ilike.truck,delivery_mode.eq.Direct Delivery')
      .in('delivery_status', ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered'])
      .order('created_at', { ascending: false });

    if (receiverId) {
      query = query.or(`assigned_truck_id.eq.${receiverId},assigned_truck_id.is.null`);
    }

    const { data, error } = await query;
    throwIfError(error, 'Unable to load receiver releases');
    return (data ?? []) as ReceiverReleaseRecord[];
  },

  async getTruckerReleases(truckId?: string | null) {
    return this.getReceiverReleases(truckId);
  },

  async assignTruckToRelease(drNumber: string, truckId: string | null, deliveryStatus: string = 'In Transit') {
    const updates: Record<string, unknown> = {
      assigned_truck_id: truckId
    };
    if (deliveryStatus) {
      updates.delivery_status = deliveryStatus;
    }
    const { error } = await supabase
      .from('outgoing_requests')
      .update(updates)
      .eq('dr_number', drNumber);

    throwIfError(error, 'Failed to assign truck to release');
    return { ok: true };
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
      const sanitizedPayload: Record<string, unknown> = {
        truck_id: payload.truck_id,
        current_dr_number: payload.current_dr_number ?? null,
        shipment_id: payload.shipment_id ?? payload.current_dr_number ?? null,
        destination_lgu_id: payload.destination_lgu_id ?? null,
        destination_name: payload.destination_name ?? null,
        driver_name: payload.driver_name ?? null,
        driver_phone: payload.driver_phone ?? null,
        status: payload.status ?? 'In Transit',
        speed: payload.speed ?? 0,
        heading: payload.heading ?? 0,
        latitude: payload.latitude,
        longitude: payload.longitude,
        gps_text: payload.gps_text,
        accuracy: payload.accuracy ?? null,
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
      if (drNumber) {
        const { data: release } = await supabase
          .from('outgoing_requests')
          .select('municipality, lgu_name, category, amount_approved, amount_requested, province')
          .eq('dr_number', drNumber)
          .maybeSingle();

        await supabase
          .from('outgoing_requests')
          .update({ delivery_status: 'Delivered' })
          .eq('dr_number', drNumber);

        if (release) {
          const targetMuni = release.municipality || release.lgu_name;
          const targetQty = release.amount_approved || release.amount_requested || 0;
          if (targetMuni && targetQty > 0 && release.category) {
            await backendApi.addLguStock(targetMuni, release.category, targetQty, release.province);
          }
        }
      } else {
        await supabase
          .from('outgoing_requests')
          .update({ delivery_status: 'Delivered' })
          .eq('assigned_truck_id', truckId);
      }
    } catch (error) {
      console.warn('Failed to mark delivery done:', error);
    }
    return { ok: true };
  },

  async markTruckLiveLocationDoneByDr(drNumber: string) {
    try {
      const cleanDr = drNumber.trim();
      const { data } = await supabase
        .from('outgoing_requests')
        .select('assigned_truck_id')
        .ilike('dr_number', cleanDr)
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

      if (!actorEmail || !actorName) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          actorId = actorId || user.id;
          actorEmail = actorEmail || user.email || 'system@dswd.gov.ph';
          actorName = actorName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          actorRole = actorRole || user.user_metadata?.role || 'user';
          actorWallet = actorWallet || user.user_metadata?.wallet_address;
        }
      }

      const { error } = await supabase
        .from('activity_logs')
        .insert({
          actor_id: actorId || null,
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
