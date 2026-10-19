import { useMemo, useState } from 'react';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight, Edit, FileCheck2, Package, Plus, RotateCcw, Search, ShieldCheck, TruckIcon, X, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { AddIncomingGoodsModal, type IncomingGoodsForm } from '../modals/AddIncomingGoodsModal';
import { ReplenishLguModal, type LguReplenishPayload } from '../modals/ReplenishLguModal';
import { SuccessModal } from '../modals/SuccessModal';
import type { DiscrepancyReport, IncomingGoods, IncomingStatus, UserRole, WarehouseName } from '../../hooks/useInventoryState';
import type { WarehouseRecord, SupplySourceRecord, KitTypeRecord, LguRecord, ProvinceRecord, InventoryBatchRecord } from '../../services/backendApi';
import {
  EXPIRY_THRESHOLDS,
  getDaysRemaining,
  getExpiryTier,
  getExpiryBadgeConfig
} from '../../lib/expiryConstants';
import {
  type CommodityTypeFilter,
  matchesCommodityFilter
} from '../../lib/commodityClassification';
import { useGuideMode } from '../../contexts/GuideContext';

interface InventoryState {
  incomingGoodsList: IncomingGoods[];
  inventoryBatchesList?: InventoryBatchRecord[];
  discrepancyReports: DiscrepancyReport[];
  warehousesList?: WarehouseRecord[];
  supplySourcesList?: SupplySourceRecord[];
  kitTypesList?: KitTypeRecord[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  addIncomingGoods: (data: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => void;
  replenishLguTransfer?: (payload: LguReplenishPayload) => Promise<{ ok: boolean; message?: string }> | void;
  getAvailableStock?: (category: string, warehouse: WarehouseName) => number;
  updateIncomingGoods: (id: string, patch: Partial<IncomingGoods>) => void;
  submitIncomingForVerification: (id: string) => void;
  verifyIncomingReceipt: (id: string) => void;
  cancelIncomingGoods?: (id: string) => Promise<{ ok: boolean; message?: string }> | void;
  requestIncomingCorrection: (id: string, note: string) => void;
}

interface IncomingModuleProps {
  inventoryState: InventoryState;
  currentRole: UserRole;
}

const statusStyles: Record<IncomingStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  'Pending Verification': 'bg-yellow-100 text-yellow-800',
  Verified: 'bg-green-100 text-green-700',
  'Correction Requested': 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500 line-through'
};

const statusLabels: Record<IncomingStatus, string> = {
  Draft: 'Draft',
  'Pending Verification': 'For Verification',
  Verified: 'Verified & Stocked',
  'Correction Requested': 'Correction Filed',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled'
};

const canEdit = (status: IncomingStatus) => ['Draft', 'Pending Verification', 'Correction Requested'].includes(status);

const friendlyResult = (message: string) =>
  message
    .replace(/manifest hash/gi, 'delivery reference');

const friendlyAuditDetails = (details = '') =>
  details
    .replace(/No blockchain minting yet\./gi, 'Recorded as draft warehouse receiving entry.')
    .replace(/Pre-tokenization record/gi, 'Draft receiving record')
    .replace(/manifest hash/gi, 'delivery reference');

type IncomingAction = 'verify' | 'correction' | 'cancel' | 'message';

interface IncomingActionModalState {
  type: IncomingAction;
  item?: IncomingGoods;
  quantity?: number;
  note?: string;
  message?: string;
}

export function IncomingModule({ inventoryState, currentRole }: IncomingModuleProps) {
  const { showDescriptions } = useGuideMode();
  const {
    incomingGoodsList,
    inventoryBatchesList = [],
    addIncomingGoods,
    replenishLguTransfer,
    getAvailableStock,
    updateIncomingGoods,
    verifyIncomingReceipt,
    cancelIncomingGoods,
    requestIncomingCorrection,
    warehousesList = [],
    supplySourcesList = [],
    kitTypesList = [],
    lgusList = [],
    provincesList = []
  } = inventoryState;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [editingIncoming, setEditingIncoming] = useState<IncomingGoods | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [commodityTypeFilter, setCommodityTypeFilter] = useState<CommodityTypeFilter>('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [actionModal, setActionModal] = useState<IncomingActionModalState | null>(null);

  const isArchivedDestination = (destination?: string, destinationType?: string) => {
    if (!destination) return false;
    const dest = destination.trim().toLowerCase();
    if (destinationType === 'Warehouse' || dest.includes('warehouse')) {
      const wh = warehousesList.find(w => w.name.toLowerCase() === dest);
      return wh ? wh.isActive === false : false;
    }
    if (lgusList.length > 0) {
      const matched = lgusList.find(l =>
        l.municipality.toLowerCase() === dest ||
        l.lguName.toLowerCase().includes(dest)
      );
      if (!matched || matched.isActive === false) return true;
    }
    return false;
  };

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    warehousesList?.forEach(w => {
      if (w.name?.trim()) set.add(w.name.trim());
    });
    lgusList?.forEach(l => {
      if (l.municipality?.trim()) set.add(l.municipality.trim());
    });
    incomingGoodsList.forEach(item => {
      if (item.destination?.trim()) set.add(item.destination.trim());
    });
    return Array.from(set).sort();
  }, [warehousesList, lgusList, incomingGoodsList]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    kitTypesList?.forEach(k => {
      if (k.name?.trim()) set.add(k.name.trim());
    });
    incomingGoodsList.forEach(item => {
      if (item.fnfiCategory?.trim()) set.add(item.fnfiCategory.trim());
    });
    return Array.from(set).sort();
  }, [kitTypesList, incomingGoodsList]);

  const handleAddGoods = (newGoods: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => {
    addIncomingGoods(newGoods);
    setShowAddModal(false);
    showResult(`Incoming shipment of ${newGoods.quantity.toLocaleString()} ${newGoods.unitType} of ${newGoods.fnfiCategory} has been recorded successfully.`);
  };

  const handleReplenishSubmit = async (payload: LguReplenishPayload) => {
    if (replenishLguTransfer) {
      const res = await replenishLguTransfer(payload);
      setShowReplenishModal(false);
      if (res && res.message) {
        showResult(res.message);
      } else {
        showResult(`Successfully replenished ${payload.destinationMunicipality} with ${payload.quantity.toLocaleString()} ${payload.unitType || 'packs'} of ${payload.fnfiCategory} from ${payload.sourceName}.`);
      }
    }
  };

  const handleEditGoods = (updatedGoods: IncomingGoodsForm) => {
    if (!editingIncoming) return;
    const itemTarget = editingIncoming;
    updateIncomingGoods(itemTarget.id, {
      manifestNumber: updatedGoods.manifestNumber,
      dateReceived: updatedGoods.dateReceived,
      fnfiCategory: updatedGoods.fnfiCategory,
      quantity: updatedGoods.quantity,
      unitType: updatedGoods.unitType,
      expirationDate: updatedGoods.expirationDate,
      source: updatedGoods.source,
      destinationType: updatedGoods.destinationType,
      destination: updatedGoods.destination
    });
    setEditingIncoming(null);
    showResult(`Incoming record ${itemTarget.id} updated successfully.`);
  };

  const openActionModal = (type: IncomingAction, item: IncomingGoods) => {
    setActionModal({
      type,
      item,
      quantity: item.quantity,
      note: item.correctionNote || ''
    });
  };

  const closeActionModal = () => setActionModal(null);

  const autoCloseDelayMs = 1800;

  const showResult = (message: string, autoClose = false) => {
    setActionModal({ type: 'message', message });
    if (autoClose) {
      setTimeout(() => {
        setActionModal(null);
      }, autoCloseDelayMs);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionModal?.item) return;
    const item = actionModal.item;

    if (actionModal.type === 'verify') {
      verifyIncomingReceipt(item.id);
      showResult(`Physical receipt for ${item.id} (${item.quantity.toLocaleString()} ${item.unitType} of ${item.fnfiCategory}) confirmed and added to ${item.destinationType === 'LGU' ? item.destination + ' LGU' : 'warehouse'} stock.`);
      return;
    }

    if (actionModal.type === 'cancel') {
      if (item.status === 'Verified') {
        showResult('Verified stock has already been added to inventory and cannot be cancelled.');
        return;
      }
      if (cancelIncomingGoods) {
        await cancelIncomingGoods(item.id);
      }
      showResult(`Incoming delivery record ${item.id} has been cancelled.`);
      return;
    }

    if (actionModal.type === 'correction') {
      if (actionModal.note) requestIncomingCorrection(item.id, actionModal.note);
      showResult(`Correction report filed for incoming record ${item.id}.`);
      return;
    }
  };

  const nearExpirationItems = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return incomingGoodsList.filter(item => {
      const expirationDate = new Date(item.expirationDate);
      return expirationDate <= thirtyDaysFromNow && expirationDate >= today;
    });
  }, [incomingGoodsList]);

  const filteredGoods = incomingGoodsList.filter(item => {
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (item.incidentCode || '').toLowerCase().includes(q) ||
      (item.fnfiCategory || '').toLowerCase().includes(q) ||
      (item.source || '').toLowerCase().includes(q) ||
      (item.id || '').toLowerCase().includes(q) ||
      (item.destination || '').toLowerCase().includes(q) ||
      (item.manifestHash || '').toLowerCase().includes(q) ||
      (item.batchTokenId || '').toLowerCase().includes(q);

    const matchesWarehouse = selectedWarehouse === 'All' || item.destination === selectedWarehouse;
    const matchesCategory = selectedCategory === 'All' || item.fnfiCategory === selectedCategory;
    const matchesCommodity = matchesCommodityFilter(item.fnfiCategory, commodityTypeFilter);

    return matchesSearch && matchesWarehouse && matchesCategory && matchesCommodity;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredGoods.length / pageSize));
  const paginatedGoods = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGoods.slice(start, start + pageSize);
  }, [filteredGoods, currentPage, pageSize]);

  const postedCount = incomingGoodsList.filter(item => item.status === 'Verified' && matchesCommodityFilter(item.fnfiCategory, commodityTypeFilter)).length;
  const pendingCount = incomingGoodsList.filter(item => (item.status === 'Pending Verification' || item.status === 'Draft') && matchesCommodityFilter(item.fnfiCategory, commodityTypeFilter)).length;
  const warehouseTotalQty = incomingGoodsList
    .filter(item => item.destinationType === 'Warehouse' && item.status === 'Verified' && matchesCommodityFilter(item.fnfiCategory, commodityTypeFilter))
    .reduce((sum, item) => sum + item.quantity, 0);

  // FEFO shelf-life tracking for verified incoming batches sorted by earliest expiration
  const fefoWatchlist = useMemo(() => {
    // Only verified incoming batches represent usable inventory in the warehouse
    const verifiedItems = incomingGoodsList.filter(
      item => item.status === 'Verified' && Boolean(item.expirationDate)
    );

    const itemsWithDays = verifiedItems
      .map(item => {
        const daysRemaining = getDaysRemaining(item.expirationDate);
        const tier = getExpiryTier(item.expirationDate);

        // Match against live inventory_batches to get remainingQuantity
        const matchedBatch = inventoryBatchesList.find(b =>
          (item.batchTokenId && b.batchTokenId === item.batchTokenId) ||
          (item.manifestHash && b.manifestHash && b.manifestHash === item.manifestHash) ||
          (b.batchTokenId && (b.batchTokenId === item.id || b.batchTokenId.includes(item.id))) ||
          (b.incomingManifestId && (b.incomingManifestId === item.id || b.incomingManifestId.includes(item.id)))
        );

        const remainingQuantity = matchedBatch
          ? Math.max(0, Number(matchedBatch.remainingQuantity || 0))
          : Number(item.quantity || 0);

        return {
          ...item,
          daysRemaining,
          tier,
          remainingQuantity
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const criticalItems = itemsWithDays.filter(i => i.tier === 'critical');
    const moderateItems = itemsWithDays.filter(i => i.tier === 'moderate');
    const safeItems = itemsWithDays.filter(i => i.tier === 'safe');

    const criticalCount = criticalItems.length;
    const criticalQty = criticalItems.reduce((sum, i) => sum + Number(i.remainingQuantity ?? i.quantity ?? 0), 0);

    const moderateCount = moderateItems.length;
    const moderateQty = moderateItems.reduce((sum, i) => sum + Number(i.remainingQuantity ?? i.quantity ?? 0), 0);

    const safeCount = safeItems.length;
    const safeQty = safeItems.reduce((sum, i) => sum + Number(i.remainingQuantity ?? i.quantity ?? 0), 0);

    return {
      all: itemsWithDays,
      earliest: itemsWithDays.slice(0, 5),
      criticalCount,
      criticalQty,
      moderateCount,
      moderateQty,
      safeCount,
      safeQty
    };
  }, [incomingGoodsList, inventoryBatchesList]);

  // Most recent 5 incoming deliveries for the activity stream
  const recentIntakes = useMemo(() => {
    return [...incomingGoodsList]
      .sort((a, b) => new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime())
      .slice(0, 5);
  }, [incomingGoodsList]);

  // Verification lifecycle pipeline counts
  const pipelineStats = useMemo(() => {
    const draft = incomingGoodsList.filter(i => i.status === 'Draft').length;
    const pending = incomingGoodsList.filter(i => i.status === 'Pending Verification' || i.status === 'Draft').length;
    const verified = incomingGoodsList.filter(i => i.status === 'Verified').length;
    const correction = incomingGoodsList.filter(i => i.status === 'Correction Requested').length;
    const cancelled = incomingGoodsList.filter(i => i.status === 'Cancelled').length;
    return { draft, pending, verified, correction, cancelled };
  }, [incomingGoodsList]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Incoming Goods Receiving</h1>
            {showDescriptions && (
              <p className="text-sm text-blue-100 mt-1">
                Record deliveries, inspect physical shipments, and add verified supplies to warehouse inventory.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowReplenishModal(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
              title="Replenish LGU from warehouse or another LGU"
            >
              <TruckIcon className="w-5 h-5" />
              Replenish LGU
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 bg-white text-blue-700 px-5 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Add Incoming Delivery
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Incoming Records</p>
              <p className="text-2xl font-bold text-gray-900">{incomingGoodsList.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Verified Deliveries</p>
              <p className="text-2xl font-bold text-green-600">{postedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <FileCheck2 className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">For Physical Review</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Warehouse Stock Received</p>
              <p className="text-2xl font-bold text-purple-600">{warehouseTotalQty.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {nearExpirationItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-bold text-amber-900 text-sm">Expiration Watch</h3>
          <p className="text-sm text-amber-800 mt-1">
            {nearExpirationItems.length} incoming batch{nearExpirationItems.length === 1 ? '' : 'es'} will expire within 30 days.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RIS code, manifest ID, batch, source..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={commodityTypeFilter}
            onChange={(e) => {
              setCommodityTypeFilter(e.target.value as CommodityTypeFilter);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
          >
            <option value="All">All Classifications</option>
            <option value="Food Items">Food Items (FFP & RTEF)</option>
            <option value="Non-Food Items">Non-Food Items (NFIs)</option>
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
          >
            <option value="All">All Destinations</option>
            {destinationOptions.map(dest => (
              <option key={dest} value={dest}>{dest}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
          >
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">RIS Number</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Goods</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Destination</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Stocking Status</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedGoods.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors align-top">
                  {/* RIS Number - Document Intake Slip */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <p className="font-bold text-sm text-gray-900 font-mono">{item.manifestNumber || item.id}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                      <Calendar className="w-3 h-3 text-gray-400" /> {item.dateReceived}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{item.fnfiCategory}</p>
                    <p className="text-sm text-gray-700">{item.quantity.toLocaleString()} {item.unitType}</p>
                    <p className="text-xs text-gray-500">Exp: {item.expirationDate}</p>
                    <p className="text-xs text-gray-500">Source: {item.source}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.destinationType === 'Warehouse'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.destinationType === 'Warehouse' ? 'Warehouse' : 'LGU'}
                      </span>
                      <span className="font-semibold text-sm text-gray-900">{item.destination}</span>
                      {isArchivedDestination(item.destination, item.destinationType) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                          Archived
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyles[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    {item.verifiedBy && <p className="text-xs text-gray-500 mt-1.5">Verified by {item.verifiedBy}</p>}
                    {item.correctionNote && (
                      <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs shadow-xs max-w-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>Correction Note:</span>
                        </div>
                        <p className="mt-1 text-amber-900 font-medium whitespace-pre-wrap leading-relaxed">{item.correctionNote}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {item.status === 'Verified' ? (
                      <div className="space-y-1">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          Stocked in {item.destination}
                        </span>
                        <p className="text-xs text-gray-500">Verified: {item.dateReceived}</p>
                      </div>
                    ) : item.status === 'Pending Verification' || item.status === 'Draft' ? (
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                        Awaiting Physical Check
                      </span>
                    ) : item.status === 'Cancelled' ? (
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 line-through">
                        Cancelled
                      </span>
                    ) : (
                      <p className="text-sm text-gray-400">{item.status}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canEdit(item.status) && (
                        <button
                          onClick={() => {
                            if (!canEdit(item.status)) {
                              setActionModal({
                                type: 'message',
                                message: 'This verified batch record can no longer be edited directly. Please file a correction record.'
                              });
                              return;
                            }
                            setEditingIncoming(item);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {['Draft', 'Pending Verification'].includes(item.status) && (
                        <button
                          onClick={() => openActionModal('verify', item)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer"
                          title="Stock and verify physical incoming delivery"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Stock and Verify
                        </button>
                      )}
                      {item.status !== 'Verified' && item.status !== 'Cancelled' && item.status !== 'Rejected' && (
                        <button
                          onClick={() => openActionModal('cancel', item)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 transition cursor-pointer"
                          title="Cancel incoming stock delivery"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                      {['Verified', 'Correction Requested'].includes(item.status) && (
                        <button onClick={() => openActionModal('correction', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 cursor-pointer">
                          <RotateCcw className="w-3 h-3" /> Correction
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredGoods.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No incoming goods found</p>
          </div>
        ) : (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing{' '}
              <span className="font-bold text-gray-900">
                {filteredGoods.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(currentPage * pageSize, filteredGoods.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredGoods.length}</span> incoming records
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="font-bold text-gray-800 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Intake Distribution & Verification Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FEFO Expiration & Shelf-Life Watchlist */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-gray-900">Expiration Schedule &amp; Shelf-Life Watchlist</h3>
                {showDescriptions && (
                  <p className="text-xs text-gray-500">Operational expiration tracking and shelf-life monitoring for incoming relief inventory</p>
                )}
              </div>
            </div>
            {fefoWatchlist.criticalCount > 0 ? (
              <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {fefoWatchlist.criticalCount} Critical
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold border border-green-200 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                All Batches Safe
              </span>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            {/* Shelf-Life Urgency Distribution Pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-center">
                <span className="block text-xs font-medium text-red-700">Critical (&le; {EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS}d)</span>
                <span className="block text-lg font-bold text-red-800">{fefoWatchlist.criticalCount}</span>
                <span className="block text-[10px] text-red-600 font-medium">{fefoWatchlist.criticalQty.toLocaleString()} units</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-center">
                <span className="block text-xs font-medium text-amber-700">Moderate ({EXPIRY_THRESHOLDS.MODERATE_MIN_DAYS}-{EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS}d)</span>
                <span className="block text-lg font-bold text-amber-800">{fefoWatchlist.moderateCount}</span>
                <span className="block text-[10px] text-amber-600 font-medium">{fefoWatchlist.moderateQty.toLocaleString()} units</span>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-100 text-center">
                <span className="block text-xs font-medium text-green-700">Safe (&gt; {EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS}d)</span>
                <span className="block text-lg font-bold text-green-800">{fefoWatchlist.safeCount}</span>
                <span className="block text-[10px] text-green-600 font-medium">{fefoWatchlist.safeQty.toLocaleString()} units</span>
              </div>
            </div>

            {/* Earliest Expiring Batches List */}
            {fefoWatchlist.earliest.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Earliest Expiring Batches (Priority Outflow)</p>
                {fefoWatchlist.earliest.map((item) => {
                  const badge = getExpiryBadgeConfig(item.tier);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition text-xs ${
                        item.tier === 'expired'
                          ? 'bg-red-50 border-red-200'
                          : item.tier === 'critical'
                          ? 'bg-red-50/60 border-red-200'
                          : item.tier === 'moderate'
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100/70'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 truncate">{item.fnfiCategory}</span>
                          <span className="font-mono text-[11px] text-gray-500">
                            {item.incidentCode ? item.incidentCode : item.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                          <span>{((item as any).remainingQuantity ?? item.quantity).toLocaleString()} {item.unitType || 'packs'}</span>
                          <span>&middot;</span>
                          <span className="font-medium text-gray-700">{item.destination}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeClass}`}
                        >
                          <span className={`w-1 h-1 rounded-full ${badge.dotClass}`} />
                          {badge.label}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          Exp: {item.expirationDate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                No expiration-tracked relief batches recorded.
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Expiration Protocol:</span>
              <span className="font-medium text-gray-700">Dispatch batches with shortest remaining shelf-life first.</span>
            </div>
          </div>
        </div>

        {/* Receiving Activity & Verification Pipeline */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCheck2 className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-gray-900">Receiving Activity &amp; Verification Pipeline</h3>
                {showDescriptions && (
                  <p className="text-xs text-gray-500">Verification lifecycle status and recent delivery receipts</p>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
              {incomingGoodsList.length} Total Batches
            </span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            {/* Pipeline Stage Counters */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-100 text-center">
                <span className="block text-xs font-medium text-green-700">Verified & Stocked</span>
                <span className="block text-lg font-bold text-green-800">{pipelineStats.verified}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-yellow-50 border border-yellow-100 text-center">
                <span className="block text-xs font-medium text-yellow-700">For Verification</span>
                <span className="block text-lg font-bold text-yellow-800">{pipelineStats.pending}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-center">
                <span className="block text-xs font-medium text-gray-600">Drafts</span>
                <span className="block text-lg font-bold text-gray-800">{pipelineStats.draft}</span>
              </div>
            </div>

            {/* Recent Deliveries List */}
            {recentIntakes.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Receipts</p>
                {recentIntakes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/70 transition text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">{item.fnfiCategory}</span>
                        <span className="font-mono text-[11px] text-gray-500">
                          {item.incidentCode ? item.incidentCode : item.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                        <span>{item.source}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-medium text-gray-700">{item.destination}</span>
                        <span>&middot;</span>
                        <span>{item.quantity.toLocaleString()} {item.unitType}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {item.dateReceived}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">
                No recent incoming receipts recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {showReplenishModal && (
        <ReplenishLguModal
          onClose={() => setShowReplenishModal(false)}
          onSubmit={handleReplenishSubmit}
          warehousesList={warehousesList}
          kitTypesList={kitTypesList}
          lgusList={lgusList}
          provincesList={provincesList}
          getAvailableWarehouseStock={getAvailableStock}
        />
      )}

      {showAddModal && (
        <AddIncomingGoodsModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddGoods}
          onSwitchToReplenish={() => {
            setShowAddModal(false);
            setShowReplenishModal(true);
          }}
          mode="add"
          supplySourcesList={supplySourcesList}
          warehousesList={warehousesList}
          kitTypesList={kitTypesList}
          lgusList={lgusList}
          provincesList={provincesList}
        />
      )}

      {editingIncoming && (
        <AddIncomingGoodsModal
          onClose={() => setEditingIncoming(null)}
          onSubmit={handleEditGoods}
          mode="edit"
          supplySourcesList={supplySourcesList}
          warehousesList={warehousesList}
          kitTypesList={kitTypesList}
          lgusList={lgusList}
          provincesList={provincesList}
          initialData={{
            manifestNumber: editingIncoming.manifestNumber || editingIncoming.id,
            dateReceived: editingIncoming.dateReceived,
            fnfiCategory: editingIncoming.fnfiCategory,
            quantity: editingIncoming.quantity,
            unitType: editingIncoming.unitType,
            expirationDate: editingIncoming.expirationDate,
            source: editingIncoming.source,
            destinationType: editingIncoming.destinationType,
            destination: editingIncoming.destination
          }}
        />
      )}

      {actionModal?.type === 'message' && (
        <SuccessModal
          isOpen={true}
          onClose={closeActionModal}
          message={actionModal.message}
          title="Successful!"
          buttonText="Done"
        />
      )}

      {actionModal && actionModal.type !== 'message' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {actionModal.type === 'verify' && 'Stock & Verify Physical Receipt'}
                  {actionModal.type === 'cancel' && 'Cancel Incoming Stock Intake'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                </h2>
                {actionModal.item && <p className="text-sm text-gray-500 mt-1">{actionModal.item.id} | {actionModal.item.fnfiCategory}</p>}
              </div>
              <button type="button" onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionModal.type === 'verify' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    {actionModal.item?.destinationType === 'LGU'
                      ? `Confirm physical receipt of this delivery? Upon verification, ${actionModal.item.quantity.toLocaleString()} ${actionModal.item.unitType} of ${actionModal.item.fnfiCategory} will be immediately stocked into ${actionModal.item.destination} LGU inventory.`
                      : `Confirm physical receipt of this delivery? Upon verification, ${actionModal.item?.quantity.toLocaleString()} ${actionModal.item?.unitType} of ${actionModal.item?.fnfiCategory} will be immediately stocked into warehouse inventory.`}
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                    <p className="font-semibold">Single-step confirmation</p>
                    <p className="mt-0.5 text-blue-700">This intake will be permanently verified and recorded into inventory ledger.</p>
                  </div>
                </div>
              )}

              {actionModal.type === 'cancel' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-rose-900">Confirm Stock Intake Cancellation</p>
                      <p className="text-xs text-rose-700 mt-1">
                        Are you sure you want to cancel incoming delivery <span className="font-semibold">{actionModal.item?.id}</span> ({actionModal.item?.quantity.toLocaleString()} {actionModal.item?.unitType} of {actionModal.item?.fnfiCategory}) for {actionModal.item?.destination}?
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    This incoming record will be marked as Cancelled and will not be stocked into inventory. Note: Once verified and stocked, inventory records cannot be cancelled.
                  </p>
                </div>
              )}

              {actionModal.type === 'correction' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Correction Details</label>
                  <textarea
                    value={actionModal.note || ''}
                    onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-28"
                    placeholder="Describe the quantity, item, or receiving issue."
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeActionModal}
                className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 text-sm cursor-pointer"
              >
                {actionModal.type === 'cancel' ? 'Keep Delivery' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`flex-1 px-5 py-2.5 font-semibold rounded-lg text-sm text-white shadow-xs cursor-pointer ${
                  actionModal.type === 'cancel'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {actionModal.type === 'cancel' ? 'Confirm Cancellation' : actionModal.type === 'verify' ? 'Stock and Verify' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
