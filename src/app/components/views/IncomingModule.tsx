import { useMemo, useState } from 'react';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight, Edit, FileCheck2, Package, Plus, RotateCcw, Search, ShieldCheck, TruckIcon, X, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { AddIncomingGoodsModal, type IncomingGoodsForm } from '../modals/AddIncomingGoodsModal';
import { SuccessModal } from '../modals/SuccessModal';
import type { DiscrepancyReport, IncomingGoods, IncomingStatus, UserRole, WarehouseName } from '../../hooks/useInventoryState';
import type { WarehouseRecord, SupplySourceRecord, KitTypeRecord, LguRecord, ProvinceRecord } from '../../services/backendApi';

interface InventoryState {
  incomingGoodsList: IncomingGoods[];
  discrepancyReports: DiscrepancyReport[];
  warehousesList?: WarehouseRecord[];
  supplySourcesList?: SupplySourceRecord[];
  kitTypesList?: KitTypeRecord[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  addIncomingGoods: (data: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => void;
  updateIncomingGoods: (id: string, patch: Partial<IncomingGoods>) => void;
  submitIncomingForVerification: (id: string) => void;
  verifyIncomingReceipt: (id: string) => void;
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
  Minted: 'bg-green-100 text-green-700',
  'Correction Requested': 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700'
};

const statusLabels: Record<IncomingStatus, string> = {
  Draft: 'Draft',
  'Pending Verification': 'For Verification',
  Verified: 'Verified & Stocked',
  Minted: 'Verified & Stocked',
  'Correction Requested': 'Correction Filed',
  Rejected: 'Rejected'
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

type IncomingAction = 'submit' | 'verify' | 'correction' | 'message';

interface IncomingActionModalState {
  type: IncomingAction;
  item?: IncomingGoods;
  quantity?: number;
  note?: string;
  message?: string;
}

export function IncomingModule({ inventoryState, currentRole }: IncomingModuleProps) {
  const {
    incomingGoodsList,
    addIncomingGoods,
    updateIncomingGoods,
    submitIncomingForVerification,
    verifyIncomingReceipt,
    requestIncomingCorrection,
    warehousesList = [],
    supplySourcesList = [],
    kitTypesList = [],
    lgusList = [],
    provincesList = []
  } = inventoryState;

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncoming, setEditingIncoming] = useState<IncomingGoods | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
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

  const handleEditGoods = (updatedGoods: IncomingGoodsForm) => {
    if (!editingIncoming) return;
    const itemTarget = editingIncoming;
    updateIncomingGoods(itemTarget.id, {
      dateReceived: updatedGoods.dateReceived,
      fnfiCategory: updatedGoods.fnfiCategory,
      quantity: updatedGoods.quantity,
      unitType: updatedGoods.unitType,
      expirationDate: updatedGoods.expirationDate,
      source: updatedGoods.source,
      destinationType: updatedGoods.destinationType,
      destination: updatedGoods.destination,
      incidentCode: updatedGoods.incidentCode
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

    if (actionModal.type === 'submit') {
      submitIncomingForVerification(item.id);
      showResult(`Incoming record ${item.id} has been submitted for ${item.destinationType === 'LGU' ? item.destination + ' LGU' : 'warehouse'} checker review.`);
      return;
    }

    if (actionModal.type === 'verify') {
      verifyIncomingReceipt(item.id);
      showResult(`Physical receipt for ${item.id} (${item.quantity.toLocaleString()} ${item.unitType} of ${item.fnfiCategory}) confirmed and added to ${item.destinationType === 'LGU' ? item.destination + ' LGU' : 'warehouse'} stock.`);
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

    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredGoods.length / pageSize));
  const paginatedGoods = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGoods.slice(start, start + pageSize);
  }, [filteredGoods, currentPage, pageSize]);

  const postedCount = incomingGoodsList.filter(item => item.status === 'Verified' || item.status === 'Minted').length;
  const pendingCount = incomingGoodsList.filter(item => item.status === 'Pending Verification').length;
  const warehouseTotalQty = incomingGoodsList
    .filter(item => item.destinationType === 'Warehouse' && (item.status === 'Verified' || item.status === 'Minted'))
    .reduce((sum, item) => sum + item.quantity, 0);

  // FEFO shelf-life tracking for incoming batches sorted by earliest expiration
  const fefoWatchlist = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemsWithDays = incomingGoodsList
      .filter(item => Boolean(item.expirationDate))
      .map(item => {
        const expDate = new Date(item.expirationDate);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...item,
          daysRemaining: diffDays
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const criticalCount = itemsWithDays.filter(i => i.daysRemaining <= 30).length;
    const moderateCount = itemsWithDays.filter(i => i.daysRemaining > 30 && i.daysRemaining <= 90).length;
    const safeCount = itemsWithDays.filter(i => i.daysRemaining > 90).length;

    return {
      all: itemsWithDays,
      earliest: itemsWithDays.slice(0, 5),
      criticalCount,
      moderateCount,
      safeCount
    };
  }, [incomingGoodsList]);

  // Most recent 5 incoming deliveries for the activity stream
  const recentIntakes = useMemo(() => {
    return [...incomingGoodsList]
      .sort((a, b) => new Date(b.dateReceived || 0).getTime() - new Date(a.dateReceived || 0).getTime())
      .slice(0, 5);
  }, [incomingGoodsList]);

  // Verification lifecycle pipeline counts
  const pipelineStats = useMemo(() => {
    const draft = incomingGoodsList.filter(i => i.status === 'Draft').length;
    const pending = incomingGoodsList.filter(i => i.status === 'Pending Verification').length;
    const verified = incomingGoodsList.filter(i => i.status === 'Verified' || i.status === 'Minted').length;
    const correction = incomingGoodsList.filter(i => i.status === 'Correction Requested').length;
    return { draft, pending, verified, correction };
  }, [incomingGoodsList]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Incoming Goods Receiving</h1>
            <p className="text-sm text-blue-100 mt-1">
              Record deliveries, inspect physical shipments, and add verified supplies to warehouse inventory.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Incoming Delivery
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RIS code, manifest ID, batch record, category, source..."
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
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">RIS Code</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Manifest</th>
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
                  {/* RIS Code - Column before Manifest */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block shadow-2xs">
                      {item.incidentCode || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <p className="font-bold text-sm text-gray-900 font-mono">{item.id}</p>
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
                    {item.status === 'Verified' || item.status === 'Minted' ? (
                      <div className="space-y-1">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          Stocked in {item.destination}
                        </span>
                        <p className="text-xs text-gray-500">Verified: {item.dateReceived}</p>
                      </div>
                    ) : item.status === 'Pending Verification' ? (
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                        Awaiting Physical Check
                      </span>
                    ) : (
                      <p className="text-sm text-gray-400">Draft Record</p>
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
                      {item.status === 'Draft' && (
                        <button onClick={() => openActionModal('submit', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200">
                          <FileCheck2 className="w-3 h-3" /> Submit
                        </button>
                      )}
                      {item.status === 'Pending Verification' && (
                        <button onClick={() => openActionModal('verify', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                          <CheckCircle className="w-3 h-3" /> Verify & Stock
                        </button>
                      )}
                      {['Verified', 'Minted', 'Correction Requested'].includes(item.status) && (
                        <button onClick={() => openActionModal('correction', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">
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
                <h3 className="text-base font-bold text-gray-900">FEFO Expiration & Shelf-Life Watchlist</h3>
                <p className="text-xs text-gray-500">First-Expired, First-Out operational tracking for incoming relief inventory</p>
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
                <span className="block text-xs font-medium text-red-700">Critical (&le; 30d)</span>
                <span className="block text-lg font-bold text-red-800">{fefoWatchlist.criticalCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-center">
                <span className="block text-xs font-medium text-amber-700">Moderate (31-90d)</span>
                <span className="block text-lg font-bold text-amber-800">{fefoWatchlist.moderateCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-100 text-center">
                <span className="block text-xs font-medium text-green-700">Safe (&gt; 90d)</span>
                <span className="block text-lg font-bold text-green-800">{fefoWatchlist.safeCount}</span>
              </div>
            </div>

            {/* Earliest Expiring Batches List */}
            {fefoWatchlist.earliest.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Earliest Expiring Batches (Priority Outflow)</p>
                {fefoWatchlist.earliest.map((item) => {
                  const isExpired = item.daysRemaining <= 0;
                  const isCritical = item.daysRemaining > 0 && item.daysRemaining <= 30;
                  const isModerate = item.daysRemaining > 30 && item.daysRemaining <= 90;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition text-xs ${
                        isExpired
                          ? 'bg-red-50 border-red-200'
                          : isCritical
                          ? 'bg-red-50/60 border-red-200'
                          : isModerate
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
                          <span>{item.quantity.toLocaleString()} {item.unitType}</span>
                          <span>&middot;</span>
                          <span className="font-medium text-gray-700">{item.destination}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isExpired
                              ? 'bg-red-100 text-red-800'
                              : isCritical
                              ? 'bg-red-100 text-red-800'
                              : isModerate
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {isExpired
                            ? 'Expired'
                            : `${item.daysRemaining} days left`}
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
              <span>FEFO Protocol:</span>
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
                <h3 className="text-base font-bold text-gray-900">Receiving Activity & Verification Pipeline</h3>
                <p className="text-xs text-gray-500">Verification lifecycle status and recent delivery receipts</p>
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

      {showAddModal && (
        <AddIncomingGoodsModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddGoods}
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
            dateReceived: editingIncoming.dateReceived,
            fnfiCategory: editingIncoming.fnfiCategory,
            quantity: editingIncoming.quantity,
            unitType: editingIncoming.unitType,
            expirationDate: editingIncoming.expirationDate,
            source: editingIncoming.source,
            destinationType: editingIncoming.destinationType,
            destination: editingIncoming.destination,
            incidentCode: editingIncoming.incidentCode
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
                  {actionModal.type === 'submit' && 'Submit for Checking'}
                  {actionModal.type === 'verify' && 'Confirm Physical Receipt & Stock'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                </h2>
                {actionModal.item && <p className="text-sm text-gray-500 mt-1">{actionModal.item.id} | {actionModal.item.fnfiCategory}</p>}
              </div>
              <button type="button" onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionModal.type === 'submit' && (
                <p className="text-sm text-gray-700">
                  {actionModal.item?.destinationType === 'LGU'
                    ? `Send this direct incoming delivery for ${actionModal.item.destination} for review?`
                    : 'Send this incoming delivery to the warehouse checker for review?'}
                </p>
              )}

              {actionModal.type === 'verify' && (
                <p className="text-sm text-gray-700">
                  {actionModal.item?.destinationType === 'LGU'
                    ? `Confirm physical receipt of this delivery? Upon verification, this quantity will be immediately stocked into ${actionModal.item.destination} LGU inventory.`
                    : 'Confirm physical receipt of this delivery? Upon verification, this quantity will be immediately stocked into warehouse inventory.'}
                </p>
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
                className="flex-1 px-5 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="flex-1 px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
