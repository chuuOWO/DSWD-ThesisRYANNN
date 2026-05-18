import { useEffect, useMemo, useState } from 'react';
import { backendApi } from '../services/backendApi';
import { blockchain } from '../services/blockchain';

export interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
}

export type WarehouseName = 'Oton Main Warehouse' | 'Pototan Main Warehouse';
export type IncomingStatus = 'Draft' | 'Pending Verification' | 'Verified' | 'Minted' | 'Correction Requested' | 'Rejected';
export type OutgoingStatus = 'Draft' | 'Allocating' | 'Approved' | 'Packed' | 'Released' | 'In Transit' | 'Delivered' | 'Accepted' | 'Distributed' | 'Correction Requested' | 'Cancelled';
export type PriorityColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
export type PriorityLevel = 'Severe' | 'Low' | 'Medium' | 'Adequate';

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

export interface OutgoingRelease {
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
  deliveryStatus: OutgoingStatus;
  incidentCode: string;
  allocatedBatchTokenIds: string[];
  handoverContractId?: string;
  senderSignature?: string;
  receiverSignature?: string;
  senderGps?: string;
  receiverGps?: string;
  blockchainTxHash?: string;
  correctionNote?: string;
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
  priorityLevel: PriorityLevel;
  stockRate: number;
  recommendation: string;
}

export interface LGUMonitoringStatus {
  lguName: string;
  stockRate: number;
  indicatorColor: PriorityColor;
  priorityLevel: PriorityLevel;
  systemResponse: string;
}

/**
 * Priority Logic Engine
 * Evaluates current stock percentage and maps it directly to four-tier parameters
 * Thresholds: RED (<25%), ORANGE (25-50%), YELLOW (51-74%), GREEN (75%+)
 */
export function calculateLGUPriority(stockRate: number): {
  color: PriorityColor;
  level: PriorityLevel;
  response: string;
} {
  if (stockRate < 25) {
    return {
      color: 'RED',
      level: 'Severe',
      response: 'Immediate Dispatch'
    };
  } else if (stockRate <= 50) {
    return {
      color: 'ORANGE',
      level: 'Low',
      response: 'Immediate Dispatch / Emergency Flag'
    };
  } else if (stockRate < 75) {
    return {
      color: 'YELLOW',
      level: 'Medium',
      response: 'Active Monitoring / Scheduled Dispatch'
    };
  } else {
    return {
      color: 'GREEN',
      level: 'Adequate',
      response: 'Standard Monitoring / Low Priority'
    };
  }
}

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

const makeTxHash = (prefix: string) => `0x${prefix}${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;

const isMainWarehouse = (warehouse: string): warehouse is WarehouseName =>
  warehouse === 'Oton Main Warehouse' || warehouse === 'Pototan Main Warehouse';

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

type OutgoingRequestRow = {
  id: string;
  dr_number?: string | null;
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
  sender_gps?: string | null;
  receiver_gps?: string | null;
  tx_hash?: string | null;
  handover_contract_id?: string | null;
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

const mapOutgoingRequest = (row: OutgoingRequestRow): OutgoingRelease => ({
  drNumber: row.dr_number ?? row.id,
  dateAllocated: row.date_allocated ?? '',
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
  allocatedBatchTokenIds: [],
  handoverContractId: row.handover_contract_id ?? undefined,
  senderSignature: row.sender_signature ?? undefined,
  receiverSignature: row.receiver_signature ?? undefined,
  senderGps: row.sender_gps ?? undefined,
  receiverGps: row.receiver_gps ?? undefined,
  blockchainTxHash: row.tx_hash ?? undefined,
  auditTrail: [makeAudit('Loaded from Supabase', `Outgoing request restored from database as ${row.delivery_status ?? 'Allocating'}.`, row.tx_hash ?? undefined)]
});

const emptyInventoryItem = (category: string): InventoryItem => ({
  category,
  warehouseA: 0,
  warehouseB: 0
});

const calculateAvailableInventory = (incoming: IncomingGoods[], outgoing: OutgoingRelease[]): InventoryItem[] => {
  const stock = new Map<string, InventoryItem>();

  const ensureItem = (category: string) => {
    if (!stock.has(category)) {
      stock.set(category, emptyInventoryItem(category));
    }
    return stock.get(category)!;
  };

  incoming.forEach(item => {
    if (item.status !== 'Minted' || item.destinationType !== 'Warehouse' || !isMainWarehouse(item.destination)) return;

    const stockItem = ensureItem(item.fnfiCategory);
    if (item.destination === 'Oton Main Warehouse') {
      stockItem.warehouseA += item.quantity;
    } else {
      stockItem.warehouseB += item.quantity;
    }
  });

  outgoing.forEach(release => {
    const consumesStock = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'].includes(release.deliveryStatus);
    if (!consumesStock || !isMainWarehouse(release.warehouseSource)) return;

    const stockItem = ensureItem(release.fnfiCategory);
    const quantity = release.amountApproved || release.amountRequested;
    if (release.warehouseSource === 'Oton Main Warehouse') {
      stockItem.warehouseA = Math.max(0, stockItem.warehouseA - quantity);
    } else {
      stockItem.warehouseB = Math.max(0, stockItem.warehouseB - quantity);
    }
  });

  return Array.from(stock.values()).sort((a, b) => a.category.localeCompare(b.category));
};

const logBackendError = (action: string) => (error: unknown) => {
  console.error(`${action} did not persist to Supabase`, error);
};

export function useInventoryState() {
  const [integrationMode, setIntegrationMode] = useState<'backend' | 'mock'>('mock');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([]);

  const [outgoingReleasesList, setOutgoingReleasesList] = useState<OutgoingRelease[]>([]);

  const lguPriorityReports: LGUPriorityReport[] = useMemo(() => {
    const reports = [
      { id: 'LGU-001', lguName: 'Leon Municipal Office', municipality: 'Leon', province: 'Iloilo', foodPacks: 95, hygieneKits: 80, familyKits: 50, affectedFamilies: 920, damageIndex: 88 },
      { id: 'LGU-002', lguName: 'Miag-ao Municipal Office', municipality: 'Miag-ao', province: 'Iloilo', foodPacks: 220, hygieneKits: 180, familyKits: 120, affectedFamilies: 610, damageIndex: 62 },
      { id: 'LGU-003', lguName: 'Banate Municipal Office', municipality: 'Banate', province: 'Iloilo', foodPacks: 180, hygieneKits: 120, familyKits: 90, affectedFamilies: 750, damageIndex: 73 },
      { id: 'LGU-004', lguName: 'Guinhol Municipal Office', municipality: 'Guinhol', province: 'Iloilo', foodPacks: 130, hygieneKits: 90, familyKits: 70, affectedFamilies: 840, damageIndex: 81 },
      { id: 'LGU-005', lguName: 'Iloilo City Government', municipality: 'Iloilo City', province: 'Iloilo', foodPacks: 700, hygieneKits: 500, familyKits: 350, affectedFamilies: 480, damageIndex: 35 }
    ];

    return reports.map(report => {
      const totalItems = report.foodPacks + report.hygieneKits + report.familyKits;
      const stockRate = Math.round((totalItems / report.affectedFamilies) * 100);
      const { color, level, response } = calculateLGUPriority(stockRate);
      const urgencyScore = 100 - stockRate;

      return {
        ...report,
        reportedAt: '2026-05-15 08:00',
        stockRate,
        urgencyScore,
        priorityColor: color,
        priorityLevel: level,
        recommendation: response
      };
    }).sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, []);

  useEffect(() => {
    setInventory(calculateAvailableInventory(incomingGoodsList, outgoingReleasesList));
  }, [incomingGoodsList, outgoingReleasesList]);

  const addStock = (category: string, warehouse: WarehouseName, quantity: number) => {
    setInventory(prev => {
      const existingItem = prev.find(item => item.category === category);

      if (existingItem) {
        return prev.map(item =>
          item.category === category
            ? {
                ...item,
                warehouseA: warehouse === 'Oton Main Warehouse' ? item.warehouseA + quantity : item.warehouseA,
                warehouseB: warehouse === 'Pototan Main Warehouse' ? item.warehouseB + quantity : item.warehouseB
              }
            : item
        );
      }

      return [
        ...prev,
        {
          category,
          warehouseA: warehouse === 'Oton Main Warehouse' ? quantity : 0,
          warehouseB: warehouse === 'Pototan Main Warehouse' ? quantity : 0
        }
      ];
    });
  };

  const deductStock = (category: string, warehouse: WarehouseName, quantity: number): boolean => {
    const item = inventory.find(i => i.category === category);
    if (!item) return false;

    const currentStock = warehouse === 'Oton Main Warehouse' ? item.warehouseA : item.warehouseB;
    if (currentStock < quantity) return false;

    setInventory(prev =>
      prev.map(item =>
        item.category === category
          ? {
              ...item,
              warehouseA: warehouse === 'Oton Main Warehouse' ? item.warehouseA - quantity : item.warehouseA,
              warehouseB: warehouse === 'Pototan Main Warehouse' ? item.warehouseB - quantity : item.warehouseB
            }
          : item
      )
    );

    return true;
  };

  const getAvailableStock = (category: string, warehouse: WarehouseName): number => {
    const item = inventory.find(i => i.category === category);
    if (!item) return 0;
    return warehouse === 'Oton Main Warehouse' ? item.warehouseA : item.warehouseB;
  };

  const addIncomingGoods = (newGoods: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => {
    const newId = `INC-2026-${String(incomingGoodsList.length + 1).padStart(3, '0')}`;
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

  const mintBatchToken = async (id: string) => {
    const item = incomingGoodsList.find(item => item.id === id);
    if (!item || item.status !== 'Verified') return { ok: false, message: 'Only verified manifests can be minted.' };

    const duplicate = incomingGoodsList.find(other => other.id !== id && other.status === 'Minted' && other.manifestHash === item.manifestHash);
    if (duplicate) return { ok: false, message: `Duplicate manifest detected. Existing token: ${duplicate.batchTokenId}` };

    const tokenId = `BATCH-2026-${String(incomingGoodsList.filter(i => i.batchTokenId).length + 1).padStart(3, '0')}`;
    let proof;

    try {
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
      return { ok: false, message: error instanceof Error ? error.message : 'MetaMask minting was cancelled or failed.' };
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
  };

  const addOutgoingRelease = (newRelease: Omit<OutgoingRelease, 'drNumber' | 'allocatedBatchTokenIds' | 'auditTrail'>) => {
    const newDR = `DR-2026-${String(outgoingReleasesList.length + 1).padStart(3, '0')}`;
    const status: OutgoingStatus = newRelease.deliveryStatus === 'Released' ? 'Approved' : newRelease.deliveryStatus;
    const releaseWithDR: OutgoingRelease = {
      ...newRelease,
      deliveryStatus: status,
      drNumber: newDR,
      amountApproved: status === 'Draft' || status === 'Allocating' ? 0 : newRelease.amountApproved,
      allocatedBatchTokenIds: [],
      auditTrail: [makeAudit('Release Draft Created', 'Outgoing request saved before blockchain custody transfer.')]
    };
    setOutgoingReleasesList(prev => [releaseWithDR, ...prev]);
    backendApi.createOutgoing({
      ...newRelease,
      drNumber: newDR,
      deliveryStatus: 'Allocating'
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
  };

  const approveAllocation = (drNumber: string, amountApproved: number) => {
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release) return { ok: false, message: 'Release not found.' };
    if (amountApproved <= 0 || amountApproved > release.amountRequested) return { ok: false, message: 'Approved amount must be between 1 and requested amount.' };
    if (isMainWarehouse(release.warehouseSource) && getAvailableStock(release.fnfiCategory, release.warehouseSource) < amountApproved) {
      return { ok: false, message: 'Insufficient available warehouse stock.' };
    }

    const availableTokens = incomingGoodsList
      .filter(item => item.status === 'Minted' && item.fnfiCategory === release.fnfiCategory)
      .map(item => item.batchTokenId!)
      .filter(Boolean);

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? {
          ...item,
          amountApproved,
          deliveryStatus: 'Approved',
          allocatedBatchTokenIds: availableTokens.slice(0, 2),
          auditTrail: [makeAudit('Allocation Approved', 'Stock reserved and tokenized batches assigned; no custody transfer yet.'), ...item.auditTrail]
        }
      : item));
    backendApi.updateOutgoing(drNumber, {
      amountApproved,
      deliveryStatus: 'Approved'
    }).catch(error => {
      logBackendError('Approve outgoing allocation')(error);
      setIntegrationMode('mock');
    });
    return { ok: true, message: 'Allocation approved and token batches assigned.' };
  };

  const senderSignAndRelease = async (drNumber: string) => {
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release || !['Approved', 'Packed'].includes(release.deliveryStatus)) return { ok: false, message: 'Only approved/packed releases can be signed by sender.' };

    const senderGps = release.warehouseSource === 'Pototan Main Warehouse' ? '11.0039, 122.5364' : '10.6922, 122.4731';
    const handoverContractId = `HANDOVER-${drNumber.replace('DR-', '')}`;
    let proof;

    try {
      proof = await blockchain.signRelease({
        drNumber,
        handoverContractId,
        category: release.fnfiCategory,
        quantity: release.amountApproved || release.amountRequested,
        from: release.warehouseSource,
        to: release.lguName,
        gps: senderGps
      });
    } catch (error) {
      logBackendError('Sign release with MetaMask')(error);
      return { ok: false, message: error instanceof Error ? error.message : 'MetaMask release signing was cancelled or failed.' };
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

  const receiverAcceptWithGps = async (drNumber: string) => {
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release) return { ok: false, message: 'Release not found.' };
    const latestGps = release?.municipality === 'Miag-ao' ? '10.6415, 122.2352' : release?.municipality === 'Banate' ? '11.0022, 122.8174' : '10.7202, 122.5621';
    const handoverContractId = release.handoverContractId ?? `HANDOVER-${drNumber.replace('DR-', '')}`;
    let proof;

    try {
      proof = await blockchain.confirmReceipt({
        drNumber,
        handoverContractId,
        category: release.fnfiCategory,
        quantity: release.amountApproved || release.amountRequested,
        from: release.warehouseSource,
        to: release.lguName,
        gps: latestGps
      });
    } catch (error) {
      logBackendError('Confirm receipt with MetaMask')(error);
      return { ok: false, message: error instanceof Error ? error.message : 'MetaMask receipt confirmation was cancelled or failed.' };
    }

    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber && ['Released', 'In Transit', 'Delivered'].includes(item.deliveryStatus)
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
    backendApi.updateOutgoing(drNumber, {
      deliveryStatus: 'Accepted',
      receiverGps: latestGps,
      txHash: proof.hash,
      handoverContractId,
      receiverSignature: proof.hash,
      walletAddress: proof.walletAddress
    }).catch(error => {
      logBackendError('Accept outgoing handover')(error);
      setIntegrationMode('mock');
    });

    return { ok: true, message: `Receiver confirmation recorded via ${proof.mode === 'contract' ? 'blockchain transaction' : 'MetaMask signature proof'}.` };
  };

  useEffect(() => {
    const loadDashboard = () => backendApi.getDashboard()
      .then(({ incoming, outgoing }) => {
        setIncomingGoodsList(incoming.map(mapIncomingManifest));
        setOutgoingReleasesList(outgoing.map(mapOutgoingRequest));
        setIntegrationMode('backend');
      })
      .catch(() => setIntegrationMode('mock'));

    loadDashboard();
    const unsubscribe = backendApi.subscribeDashboard(loadDashboard);

    return unsubscribe;
  }, []);

  const requestOutgoingCorrection = (drNumber: string, note: string) => {
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? { ...item, deliveryStatus: 'Correction Requested', correctionNote: note, auditTrail: [makeAudit('Correction Requested', note), ...item.auditTrail] }
      : item));
  };

  return {
    inventory,
    incomingGoodsList,
    outgoingReleasesList,
    lguPriorityReports,
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
    requestOutgoingCorrection
    ,
    integrationMode
  };
}
