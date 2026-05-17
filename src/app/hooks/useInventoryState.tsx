import { useMemo, useState } from 'react';

export interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
}

export type WarehouseName = 'Oton Main Warehouse' | 'Pototan Main Warehouse';
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
  recommendation: string;
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

export function useInventoryState() {
  const [inventory, setInventory] = useState<InventoryItem[]>([
    { category: 'Food Pack', warehouseA: 1500, warehouseB: 1200 },
    { category: 'Hygiene Kit', warehouseA: 800, warehouseB: 500 },
    { category: 'Sleeping Kit', warehouseA: 400, warehouseB: 300 },
    { category: 'Kitchen Kit', warehouseA: 300, warehouseB: 200 },
    { category: 'Family Kit', warehouseA: 600, warehouseB: 400 },
    { category: 'Laminated Sack', warehouseA: 2000, warehouseB: 1500 },
    { category: 'RTEF', warehouseA: 250, warehouseB: 150 }
  ]);

  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>(() => {
    const seed: Omit<IncomingGoods, 'manifestHash' | 'auditTrail'>[] = [
      {
        id: 'INC-2026-001',
        dateReceived: '2026-05-10',
        fnfiCategory: 'Food Pack',
        quantity: 1000,
        unitType: 'pcs',
        expirationDate: '2026-11-10',
        source: 'VDRC',
        destinationType: 'Warehouse',
        destination: 'Oton Main Warehouse',
        incidentCode: 'Good condition',
        status: 'Minted',
        batchTokenId: 'BATCH-2026-001',
        blockchainTxHash: '0xBTCH001A9F4E',
        verifiedBy: 'Warehouse Supervisor',
        mintedAt: '2026-05-10 09:30'
      },
      {
        id: 'INC-2026-002',
        dateReceived: '2026-05-11',
        fnfiCategory: 'Hygiene Kit',
        quantity: 500,
        unitType: 'pcs',
        expirationDate: '2027-05-11',
        source: 'Luzon Disaster Resource Center',
        destinationType: 'LGU',
        destination: 'Leon',
        incidentCode: 'Direct LGU augmentation',
        status: 'Pending Verification'
      },
      {
        id: 'INC-2026-003',
        dateReceived: '2026-05-12',
        fnfiCategory: 'Sleeping Kit',
        quantity: 300,
        unitType: 'sets',
        expirationDate: '2028-05-12',
        source: 'Others',
        destinationType: 'Warehouse',
        destination: 'Pototan Main Warehouse',
        incidentCode: 'For encoding review',
        status: 'Draft'
      }
    ];

    return seed.map(item => ({
      ...item,
      manifestHash: makeManifestHash(item),
      auditTrail: [makeAudit('Seed Record', `${item.id} initialized as ${item.status}`)]
    }));
  });

  const [outgoingReleasesList, setOutgoingReleasesList] = useState<OutgoingRelease[]>([
    {
      drNumber: 'DR-2026-001',
      dateAllocated: '2026-05-12',
      lguName: 'Leon Municipal Office',
      province: 'Iloilo',
      municipality: 'Leon',
      fnfiCategory: 'Food Pack',
      amountRequested: 500,
      amountApproved: 500,
      warehouseSource: 'Oton Main Warehouse',
      deliveryMode: 'Truck',
      deliveryStatus: 'Accepted',
      incidentCode: 'Emergency relief',
      allocatedBatchTokenIds: ['BATCH-2026-001'],
      handoverContractId: 'HANDOVER-2026-001',
      senderSignature: 'SIG-SENDER-LEON-001',
      receiverSignature: 'SIG-RECEIVER-LEON-001',
      senderGps: '10.6922, 122.4731',
      receiverGps: '10.7808, 122.3895',
      blockchainTxHash: '0xHAND0019C3B',
      auditTrail: [makeAudit('Receiver Accepted', 'Leon LGU accepted 500 Food Packs with GPS proof.', '0xHAND0019C3B')]
    },
    {
      drNumber: 'DR-2026-002',
      dateAllocated: '2026-05-12',
      lguName: 'Miag-ao Municipal Office',
      province: 'Iloilo',
      municipality: 'Miag-ao',
      fnfiCategory: 'Hygiene Kit',
      amountRequested: 300,
      amountApproved: 300,
      warehouseSource: 'Pototan Main Warehouse',
      deliveryMode: 'Truck',
      deliveryStatus: 'Released',
      incidentCode: 'Flood response',
      allocatedBatchTokenIds: [],
      handoverContractId: 'HANDOVER-2026-002',
      senderSignature: 'SIG-SENDER-MIAGAO-002',
      senderGps: '11.0039, 122.5364',
      blockchainTxHash: '0xHAND002A712',
      auditTrail: [makeAudit('Sender Signed', 'Warehouse released goods; waiting for LGU acceptance.', '0xHAND002A712')]
    },
    {
      drNumber: 'DR-2026-003',
      dateAllocated: '2026-05-13',
      lguName: 'Banate Municipal Office',
      province: 'Iloilo',
      municipality: 'Banate',
      fnfiCategory: 'Sleeping Kit',
      amountRequested: 200,
      amountApproved: 0,
      warehouseSource: 'Pototan Main Warehouse',
      deliveryMode: 'Pick-up',
      deliveryStatus: 'Allocating',
      incidentCode: 'Stock-based prioritization request',
      allocatedBatchTokenIds: [],
      auditTrail: [makeAudit('Allocation Created', 'Request queued for stock validation and supervisor approval.')]
    }
  ]);

  const lguPriorityReports: LGUPriorityReport[] = useMemo(() => {
    const reports = [
      { id: 'LGU-001', lguName: 'Leon Municipal Office', municipality: 'Leon', province: 'Iloilo', foodPacks: 95, hygieneKits: 80, familyKits: 50, affectedFamilies: 920, damageIndex: 88 },
      { id: 'LGU-002', lguName: 'Miag-ao Municipal Office', municipality: 'Miag-ao', province: 'Iloilo', foodPacks: 220, hygieneKits: 180, familyKits: 120, affectedFamilies: 610, damageIndex: 62 },
      { id: 'LGU-003', lguName: 'Banate Municipal Office', municipality: 'Banate', province: 'Iloilo', foodPacks: 180, hygieneKits: 120, familyKits: 90, affectedFamilies: 750, damageIndex: 73 },
      { id: 'LGU-004', lguName: 'Guinhol Municipal Office', municipality: 'Guinhol', province: 'Iloilo', foodPacks: 130, hygieneKits: 90, familyKits: 70, affectedFamilies: 840, damageIndex: 81 },
      { id: 'LGU-005', lguName: 'Iloilo City Government', municipality: 'Iloilo City', province: 'Iloilo', foodPacks: 700, hygieneKits: 500, familyKits: 350, affectedFamilies: 480, damageIndex: 35 }
    ];

    return reports.map(report => {
      const stockScore = report.foodPacks < 150 ? 45 : report.foodPacks < 300 ? 25 : 8;
      const demandScore = Math.min(35, Math.round(report.affectedFamilies / 30));
      const damageScore = Math.round(report.damageIndex * 0.2);
      const urgencyScore = Math.min(100, stockScore + demandScore + damageScore);
      const priorityColor: PriorityColor = urgencyScore >= 75 ? 'Red' : urgencyScore >= 50 ? 'Yellow' : 'Green';

      return {
        ...report,
        reportedAt: '2026-05-15 08:00',
        urgencyScore,
        priorityColor,
        recommendation:
          priorityColor === 'Red'
            ? 'Immediate restocking and dispatch recommended.'
            : priorityColor === 'Yellow'
            ? 'Prepare allocation; monitor within 24 hours.'
            : 'Sufficient stock; continue monitoring.'
      };
    }).sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, []);

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
  };

  const verifyIncomingReceipt = (id: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id && item.status === 'Pending Verification'
      ? { ...item, status: 'Verified', verifiedBy: 'Warehouse Supervisor', auditTrail: [makeAudit('Verified', 'Physical count and manifest details verified.'), ...item.auditTrail] }
      : item));
  };

  const mintBatchToken = (id: string) => {
    const item = incomingGoodsList.find(item => item.id === id);
    if (!item || item.status !== 'Verified') return { ok: false, message: 'Only verified manifests can be minted.' };

    const duplicate = incomingGoodsList.find(other => other.id !== id && other.status === 'Minted' && other.manifestHash === item.manifestHash);
    if (duplicate) return { ok: false, message: `Duplicate manifest detected. Existing token: ${duplicate.batchTokenId}` };

    const tokenId = `BATCH-2026-${String(incomingGoodsList.filter(i => i.batchTokenId).length + 1).padStart(3, '0')}`;
    const txHash = makeTxHash('BATCH');

    if (item.destinationType === 'Warehouse' && isMainWarehouse(item.destination)) {
      addStock(item.fnfiCategory, item.destination, item.quantity);
    }

    setIncomingGoodsList(prev => prev.map(incoming => incoming.id === id
      ? {
          ...incoming,
          status: 'Minted',
          batchTokenId: tokenId,
          blockchainTxHash: txHash,
          mintedAt: nowStamp(),
          auditTrail: [makeAudit('Batch Token Minted', `Manifest hash ${incoming.manifestHash} minted as ${tokenId}.`, txHash), ...incoming.auditTrail]
        }
      : incoming));

    return { ok: true, message: `${tokenId} minted and stock posted.` };
  };

  const requestIncomingCorrection = (id: string, note: string) => {
    setIncomingGoodsList(prev => prev.map(item => item.id === id
      ? { ...item, status: 'Correction Requested', correctionNote: note, auditTrail: [makeAudit('Correction Requested', note), ...item.auditTrail] }
      : item));
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
    return { ok: true, message: 'Allocation approved and token batches assigned.' };
  };

  const senderSignAndRelease = (drNumber: string) => {
    const release = outgoingReleasesList.find(item => item.drNumber === drNumber);
    if (!release || !['Approved', 'Packed'].includes(release.deliveryStatus)) return { ok: false, message: 'Only approved/packed releases can be signed by sender.' };

    if (isMainWarehouse(release.warehouseSource)) {
      const success = deductStock(release.fnfiCategory, release.warehouseSource, release.amountApproved);
      if (!success) return { ok: false, message: 'Insufficient stock during release.' };
    }

    const txHash = makeTxHash('HAND');
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber
      ? {
          ...item,
          deliveryStatus: 'Released',
          handoverContractId: `HANDOVER-${drNumber.replace('DR-', '')}`,
          senderSignature: `SIG-SENDER-${drNumber}`,
          senderGps: item.warehouseSource === 'Pototan Main Warehouse' ? '11.0039, 122.5364' : '10.6922, 122.4731',
          blockchainTxHash: txHash,
          auditTrail: [makeAudit('Sender Signed Handover', 'Warehouse signed release; GPS origin captured and custody transfer opened.', txHash), ...item.auditTrail]
        }
      : item));
    return { ok: true, message: 'Sender signature recorded and handover contract opened.' };
  };

  const markInTransit = (drNumber: string) => {
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber && item.deliveryStatus === 'Released'
      ? { ...item, deliveryStatus: 'In Transit', auditTrail: [makeAudit('In Transit', 'Shipment is moving to destination LGU.'), ...item.auditTrail] }
      : item));
  };

  const receiverAcceptWithGps = (drNumber: string) => {
    const txHash = makeTxHash('ACPT');
    setOutgoingReleasesList(prev => prev.map(item => item.drNumber === drNumber && ['Released', 'In Transit', 'Delivered'].includes(item.deliveryStatus)
      ? {
          ...item,
          deliveryStatus: 'Accepted',
          receiverSignature: `SIG-RECEIVER-${drNumber}`,
          receiverGps: item.municipality === 'Miag-ao' ? '10.6415, 122.2352' : item.municipality === 'Banate' ? '11.0022, 122.8174' : '10.7202, 122.5621',
          blockchainTxHash: txHash,
          auditTrail: [makeAudit('Receiver Accepted', 'LGU signed receipt; GPS coordinates captured and custody transfer completed.', txHash), ...item.auditTrail]
        }
      : item));
  };

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
  };
}
