import { supabase } from '../lib/supabase';

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

export interface OutgoingPayload {
  drNumber: string;
  dateAllocated: string;
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
  txHash?: string;
  walletAddress?: string;
}

export interface OutgoingUpdatePayload {
  amountApproved?: number;
  deliveryStatus?: string;
  allocatedBatches?: { batchTokenId: string; quantity: number }[];
  senderGps?: string;
  receiverGps?: string;
  txHash?: string;
  handoverContractId?: string;
  senderSignature?: string;
  receiverSignature?: string;
  walletAddress?: string;
}

export interface TruckLiveLocation {
  truck_id: string;
  dr_number?: string | null;
  latitude: number;
  longitude: number;
  gps_text: string;
  accuracy?: number | null;
  tx_hash?: string | null;
  wallet_address?: string | null;
  proof_mode?: string | null;
  updated_at?: string | null;
}

export interface TruckerReleaseRecord {
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
}

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
    const [incomingResult, outgoingResult] = await Promise.all([
      supabase.from('incoming_manifests').select('*').order('created_at', { ascending: false }),
      supabase.from('outgoing_requests').select('*').order('created_at', { ascending: false })
    ]);

    throwIfError(incomingResult.error, 'Failed to fetch incoming manifests');
    throwIfError(outgoingResult.error, 'Failed to fetch outgoing requests');

    return {
      incoming: incomingResult.data ?? [],
      outgoing: outgoingResult.data ?? []
    };
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
        tx_hash: payload.txHash,
        wallet_address: payload.walletAddress
      })
      .select('id')
      .single();

    throwIfError(error, 'Failed to create outgoing request');
    return data;
  },

  async updateOutgoing(drNumber: string, payload: OutgoingUpdatePayload) {
    const updates = definedOnly({
      amount_approved: payload.amountApproved,
      delivery_status: payload.deliveryStatus,
      allocated_batches: payload.allocatedBatches,
      sender_gps: payload.senderGps,
      receiver_gps: payload.receiverGps,
      tx_hash: payload.txHash,
      handover_contract_id: payload.handoverContractId,
      sender_signature: payload.senderSignature,
      receiver_signature: payload.receiverSignature,
      wallet_address: payload.walletAddress
    });

    const { error } = await supabase
      .from('outgoing_requests')
      .update(updates)
      .eq('dr_number', drNumber);

    throwIfError(error, 'Failed to update outgoing request');
    return { ok: true };
  },

  async markHandoverAccepted(drNumber: string, receiverGps: string, txHash?: string) {
    const { error } = await supabase
      .from('outgoing_requests')
      .update({ delivery_status: 'Accepted', receiver_gps: receiverGps, tx_hash: txHash })
      .eq('dr_number', drNumber);

    throwIfError(error, 'Failed to mark handover as accepted');
    return { ok: true };
  },

  async getTruckerReleases(drNumber?: string | null) {
    let query = supabase
      .from('outgoing_requests')
      .select('dr_number,date_allocated,lgu_name,province,municipality,category,amount_requested,amount_approved,warehouse_source,delivery_mode,delivery_status,incident_code,allocated_batches,handover_contract_id')
      .ilike('delivery_mode', 'truck')
      .in('delivery_status', ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered'])
      .order('created_at', { ascending: false });

    if (drNumber) {
      query = query.eq('dr_number', drNumber);
    }

    const { data, error } = await query;
    throwIfError(error, 'Failed to fetch trucker releases');
    return (data ?? []) as TruckerReleaseRecord[];
  },

  async getTruckLiveLocations() {
    const { data, error } = await supabase
      .from('truck_live_locations')
      .select('*')
      .order('updated_at', { ascending: false });

    throwIfError(error, 'Failed to fetch truck live locations');
    return (data ?? []) as TruckLiveLocation[];
  },

  async upsertTruckLiveLocation(payload: TruckLiveLocation) {
    const { error } = await supabase
      .from('truck_live_locations')
      .upsert(payload, { onConflict: 'truck_id' });

    throwIfError(error, 'Failed to save truck live location');
    return { ok: true };
  },

  subscribeDashboard(onChange: () => void) {
    const channel = supabase
      .channel('dashboard-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incoming_manifests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outgoing_requests' }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeTruckLiveLocations(onChange: (location: TruckLiveLocation) => void) {
    const channel = supabase
      .channel('truck-live-location-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'truck_live_locations' }, (payload) => {
        if (payload.new) onChange(payload.new as TruckLiveLocation);
      })
      .subscribe();

    backendApi.getTruckLiveLocations()
      .then((locations) => locations.forEach(onChange))
      .catch((error) => console.error('Failed to load truck live locations', error));

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
