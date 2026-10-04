import { supabase } from '../lib/supabase';
import { PANAY_LGUS } from '../data/panayLguDirectory';

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
  priorityColor: 'Red' | 'Yellow' | 'Green';
  affectedFamilies: number;
  damageIndex: number;
  recommendation: string;
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
  initialStock?: {
    'Food Pack'?: number;
    'Hygiene Kit'?: number;
    'Family Kit'?: number;
    'Sleeping Kit'?: number;
    'Kitchen Kit'?: number;
    'Laminated Sack'?: number;
    'RTEF'?: number;
  };
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
  priorityColor: 'Red' | 'Yellow' | 'Green';
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
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  }
};

const definedOnly = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

export const backendApi = {
  async getDashboard() {
    const [incomingResult, outgoingResult, lguReportsResult, discrepancyResult, lgusResult] = await Promise.all([
      supabase.from('incoming_manifests').select('*').order('created_at', { ascending: false }),
      supabase.from('outgoing_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('lgu_inventory_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('discrepancy_reports').select('*').order('reported_at', { ascending: false }),
      supabase.from('lgus').select('*').eq('is_active', true).order('province', { ascending: true })
    ]);

    throwIfError(incomingResult.error, 'Failed to fetch incoming manifests');
    throwIfError(outgoingResult.error, 'Failed to fetch outgoing requests');

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
      lgus: lgusResult.error ? [] : lgusResult.data ?? []
    };
  },

  async getLgus(): Promise<LguRecord[]> {
    try {
      const { data, error } = await supabase
        .from('lgus')
        .select('*')
        .eq('is_active', true)
        .order('province', { ascending: true })
        .order('municipality', { ascending: true });

      if (error || !data || data.length === 0) {
        return PANAY_LGUS.map(l => ({
          id: `STATIC-${l.municipality.toUpperCase().replace(/\s+/g, '-')}`,
          municipality: l.municipality,
          province: l.province,
          lguName: l.defaultFacility,
          contactPerson: '',
          contactNumber: '',
          latitude: l.lat,
          longitude: l.lng,
          remarks: '',
          isActive: true,
          foodPacks: 0,
          hygieneKits: 0,
          sleepingKits: 0,
          kitchenKits: 0,
          familyKits: 0,
          laminatedSacks: 0,
          rtef: 0,
          urgencyScore: 20,
          priorityColor: 'Green' as const,
          affectedFamilies: 0,
          damageIndex: 0,
          recommendation: 'Sufficient stock on hand.'
        }));
      }

      return data.map((row: Record<string, any>) => {
        const foodPacks = Number(row.food_packs ?? 0);
        const hygieneKits = Number(row.hygiene_kits ?? 0);
        const sleepingKits = Number(row.sleeping_kits ?? 0);
        const kitchenKits = Number(row.kitchen_kits ?? 0);
        const familyKits = Number(row.family_kits ?? 0);
        const laminatedSacks = Number(row.laminated_sacks ?? 0);
        const rtef = Number(row.rtef ?? 0);

        const urgencyScore = Number(row.urgency_score ?? (foodPacks < 100 ? 85 : foodPacks < 300 ? 50 : 20));
        const priorityColor: 'Red' | 'Yellow' | 'Green' = (row.priority_color as 'Red' | 'Yellow' | 'Green') || (foodPacks < 100 ? 'Red' : foodPacks < 300 ? 'Yellow' : 'Green');

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
          recommendation: String(row.recommendation ?? (priorityColor === 'Red' ? 'Immediate replenishment requested.' : 'Sufficient stock on hand.')),
          lastReportedAt: row.last_reported_at || row.updated_at,
          currentStock: {
            'Food Pack': foodPacks,
            'Hygiene Kit': hygieneKits,
            'Sleeping Kit': sleepingKits,
            'Kitchen Kit': kitchenKits,
            'Family Kit': familyKits,
            'Laminated Sack': laminatedSacks,
            'RTEF': rtef
          },
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });
    } catch {
      return PANAY_LGUS.map(l => ({
        id: `STATIC-${l.municipality.toUpperCase().replace(/\s+/g, '-')}`,
        municipality: l.municipality,
        province: l.province,
        lguName: l.defaultFacility,
        contactPerson: '',
        contactNumber: '',
        latitude: l.lat,
        longitude: l.lng,
        remarks: '',
        isActive: true,
        foodPacks: 0,
        hygieneKits: 0,
        sleepingKits: 0,
        kitchenKits: 0,
        familyKits: 0,
        laminatedSacks: 0,
        rtef: 0,
        urgencyScore: 20,
        priorityColor: 'Green' as const,
        affectedFamilies: 0,
        damageIndex: 0,
        recommendation: 'Sufficient stock on hand.'
      }));
    }
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
        food_packs: payload.initialStock?.['Food Pack'] || 0,
        hygiene_kits: payload.initialStock?.['Hygiene Kit'] || 0,
        sleeping_kits: payload.initialStock?.['Sleeping Kit'] || 0,
        kitchen_kits: payload.initialStock?.['Kitchen Kit'] || 0,
        family_kits: payload.initialStock?.['Family Kit'] || 0,
        laminated_sacks: payload.initialStock?.['Laminated Sack'] || 0,
        rtef: payload.initialStock?.['RTEF'] || 0,
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

    if (payload.initialStock) {
      if (payload.initialStock['Food Pack'] !== undefined) updates.food_packs = payload.initialStock['Food Pack'];
      if (payload.initialStock['Hygiene Kit'] !== undefined) updates.hygiene_kits = payload.initialStock['Hygiene Kit'];
      if (payload.initialStock['Sleeping Kit'] !== undefined) updates.sleeping_kits = payload.initialStock['Sleeping Kit'];
      if (payload.initialStock['Kitchen Kit'] !== undefined) updates.kitchen_kits = payload.initialStock['Kitchen Kit'];
      if (payload.initialStock['Family Kit'] !== undefined) updates.family_kits = payload.initialStock['Family Kit'];
      if (payload.initialStock['Laminated Sack'] !== undefined) updates.laminated_sacks = payload.initialStock['Laminated Sack'];
      if (payload.initialStock['RTEF'] !== undefined) updates.rtef = payload.initialStock['RTEF'];
      updates.last_reported_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('lgus')
      .update(updates)
      .eq('id', id);

    throwIfError(error, 'Failed to update LGU');

    if (payload.initialStock && payload.municipality) {
      try {
        await supabase
          .from('lgu_inventory_reports')
          .insert({
            lgu_id: id,
            municipality: payload.municipality.trim(),
            province: payload.province?.trim() || 'Iloilo',
            lgu_name: payload.lguName?.trim() || `${payload.municipality.trim()} Municipal Office`,
            food_packs: payload.initialStock['Food Pack'] || 0,
            hygiene_kits: payload.initialStock['Hygiene Kit'] || 0,
            family_kits: payload.initialStock['Family Kit'] || 0,
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
      wallet_address: payload.walletAddress
    });

    const { error } = await supabase
      .from('incoming_manifests')
      .update(updates)
      .eq('manifest_number', manifestNumber);

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
          last_reported_at: new Date().toISOString()
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
      throwIfError(error, 'Failed to fetch batch counter');
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

    // 3. Record or update inventory for this LGU in lgu_inventory_reports
    try {
      let muni = (params.municipality || params.lguName || '').trim();
      const matchedDirectoryLgu = PANAY_LGUS.find(
        (l) =>
          l.municipality.toLowerCase() === muni.toLowerCase() ||
          muni.toLowerCase().includes(l.municipality.toLowerCase()) ||
          l.municipality.toLowerCase().includes(muni.toLowerCase())
      );

      if (matchedDirectoryLgu) {
        muni = matchedDirectoryLgu.municipality;
      } else {
        muni = muni.split('(')[0].replace(/municipal.*|city.*|office.*|government.*|evacuation.*|hall.*|warehouse.*/i, '').trim();
      }

      const prov = params.province || matchedDirectoryLgu?.province || 'Iloilo';
      const isFood = params.category.toLowerCase().includes('food');
      const isHygiene = params.category.toLowerCase().includes('hygiene');
      const isFamily = params.category.toLowerCase().includes('family');

      // Check existing report for this municipality
      const { data: existing } = await supabase
        .from('lgu_inventory_reports')
        .select('*')
        .ilike('municipality', muni)
        .order('reported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const foodPacks = (existing?.food_packs ?? 0) + (isFood ? params.quantity : 0);
      const hygieneKits = (existing?.hygiene_kits ?? 0) + (isHygiene ? params.quantity : 0);
      const familyKits = (existing?.family_kits ?? 0) + (isFamily ? params.quantity : 0);

      await supabase.from('lgu_inventory_reports').insert({
        municipality: muni,
        province: prov,
        lgu_name: muni,
        food_packs: foodPacks,
        hygiene_kits: hygieneKits,
        family_kits: familyKits,
        affected_families: existing?.affected_families ?? 100,
        damage_index: existing?.damage_index ?? 10,
        urgency_score: Math.max(10, (existing?.urgency_score ?? 30) - 15),
        priority_color: foodPacks > 300 ? 'Green' : foodPacks > 100 ? 'Yellow' : 'Red',
        recommendation: `Received ${params.quantity} ${params.category} via ${params.drNumber}. Live stock updated.`,
        reported_at: new Date().toISOString()
      });

      // Also update public.lgus directly
      const lguStockUpdate: Record<string, unknown> = {
        last_reported_at: new Date().toISOString()
      };
      if (isFood) lguStockUpdate.food_packs = foodPacks;
      if (isHygiene) lguStockUpdate.hygiene_kits = hygieneKits;
      if (isFamily) lguStockUpdate.family_kits = familyKits;

      await supabase
        .from('lgus')
        .update(lguStockUpdate)
        .ilike('municipality', muni);
    } catch (invErr) {
      console.warn('Failed to update LGU inventory report and lgus table:', invErr);
    }

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
    throwIfError(error, 'Failed to fetch receiver releases');
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
        await supabase
          .from('outgoing_requests')
          .update({ delivery_status: 'Delivered' })
          .eq('dr_number', drNumber);
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

  subscribeDashboard(onChange: () => void) {
    const channelName = `dashboard-db-changes-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lgus' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incoming_manifests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outgoing_requests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'truck_live_locations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lgu_inventory_reports' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discrepancy_reports' }, onChange)
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

    const channelName = `truck-live-locations-${Math.random().toString(36).slice(2, 9)}`;
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
