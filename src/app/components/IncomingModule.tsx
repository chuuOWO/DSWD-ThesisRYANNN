import { useMemo, useState } from 'react';
import { Calendar, CheckCircle, Edit, FileCheck2, Package, Plus, RotateCcw, Search, ShieldCheck, TruckIcon, X } from 'lucide-react';
import { AddIncomingGoodsModal } from './AddIncomingGoodsModal';
import type { IncomingGoods, IncomingStatus, WarehouseName } from '../hooks/useInventoryState';

interface InventoryState {
  incomingGoodsList: IncomingGoods[];
  addIncomingGoods: (data: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => void;
  updateIncomingGoods: (id: string, patch: Partial<IncomingGoods>) => void;
  submitIncomingForVerification: (id: string) => void;
  verifyIncomingReceipt: (id: string) => void;
  mintBatchToken: (id: string) => Promise<{ ok: boolean; message: string }>;
  requestIncomingCorrection: (id: string, note: string) => void;
}

interface IncomingModuleProps {
  inventoryState: InventoryState;
}

const FNFI_CATEGORIES = [
  'Hygiene Kit',
  'Food Pack',
  'Sleeping Kit',
  'Kitchen Kit',
  'Family Kit',
  'Laminated Sack',
  'RTEF'
];

const statusStyles: Record<IncomingStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  'Pending Verification': 'bg-yellow-100 text-yellow-800',
  Verified: 'bg-blue-100 text-blue-700',
  Minted: 'bg-green-100 text-green-700',
  'Correction Requested': 'bg-orange-100 text-orange-700',
  Rejected: 'bg-red-100 text-red-700'
};

const statusLabels: Record<IncomingStatus, string> = {
  Draft: 'Draft',
  'Pending Verification': 'For Checking',
  Verified: 'Checked',
  Minted: 'Posted',
  'Correction Requested': 'Correction Filed',
  Rejected: 'Rejected'
};

const canEdit = (status: IncomingStatus) => ['Draft', 'Pending Verification', 'Verified'].includes(status);

const friendlyResult = (message: string) =>
  message
    .replace(/minted/gi, 'posted')
    .replace(/token/gi, 'batch record')
    .replace(/manifest hash/gi, 'delivery reference');

const friendlyAuditDetails = (details = '') =>
  details
    .replace(/No blockchain minting yet\./gi, 'Not yet posted to the official stock record.')
    .replace(/Pre-tokenization record/gi, 'Draft receiving record')
    .replace(/blockchain/gi, 'official')
    .replace(/minted/gi, 'posted')
    .replace(/token/gi, 'batch record')
    .replace(/manifest hash/gi, 'delivery reference');

type IncomingAction = 'edit' | 'submit' | 'verify' | 'post' | 'correction' | 'message';

interface IncomingActionModalState {
  type: IncomingAction;
  item?: IncomingGoods;
  quantity?: number;
  note?: string;
  message?: string;
}

export function IncomingModule({ inventoryState }: IncomingModuleProps) {
  const {
    incomingGoodsList,
    addIncomingGoods,
    updateIncomingGoods,
    submitIncomingForVerification,
    verifyIncomingReceipt,
    mintBatchToken,
    requestIncomingCorrection
  } = inventoryState;

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [actionModal, setActionModal] = useState<IncomingActionModalState | null>(null);

  const handleAddGoods = (newGoods: Omit<IncomingGoods, 'id' | 'status' | 'manifestHash' | 'auditTrail'>) => {
    addIncomingGoods(newGoods);
    setShowAddModal(false);
  };

  const openActionModal = (type: IncomingAction, item: IncomingGoods) => {
    if (type === 'edit' && !canEdit(item.status)) {
      setActionModal({
        type: 'message',
        message: 'This verified batch record can no longer be edited directly. Please file a correction record.'
      });
      return;
    }

    setActionModal({
      type,
      item,
      quantity: item.quantity,
      note: item.correctionNote || item.incidentCode || ''
    });
  };

  const closeActionModal = () => setActionModal(null);

  const showResult = (message: string) => setActionModal({ type: 'message', message });

  const handleConfirmAction = async () => {
    if (!actionModal?.item) return;
    const item = actionModal.item;

    if (actionModal.type === 'edit') {
      const nextQuantity = Number(actionModal.quantity);
      if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;
      updateIncomingGoods(item.id, {
        quantity: nextQuantity,
        incidentCode: actionModal.note || item.incidentCode
      });
      closeActionModal();
      return;
    }

    if (actionModal.type === 'submit') {
      submitIncomingForVerification(item.id);
      closeActionModal();
      return;
    }

    if (actionModal.type === 'verify') {
      verifyIncomingReceipt(item.id);
      closeActionModal();
      return;
    }

    if (actionModal.type === 'post') {
      const result = await mintBatchToken(item.id);
      showResult(friendlyResult(result.message));
      return;
    }

    if (actionModal.type === 'correction') {
      if (actionModal.note) requestIncomingCorrection(item.id, actionModal.note);
      closeActionModal();
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
    const matchesSearch =
      item.fnfiCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manifestHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.batchTokenId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === 'All' || item.destination === selectedWarehouse;
    const matchesCategory = selectedCategory === 'All' || item.fnfiCategory === selectedCategory;

    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  const postedCount = incomingGoodsList.filter(item => item.status === 'Minted').length;
  const pendingCount = incomingGoodsList.filter(item => item.status === 'Pending Verification' || item.status === 'Verified').length;
  const warehouseTotalQty = incomingGoodsList
    .filter(item => item.destinationType === 'Warehouse' && item.status === 'Minted')
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Incoming Goods Receiving</h1>
            <p className="text-sm text-blue-100 mt-1">
              Record deliveries, check physical receipt, and post verified batches to warehouse stock.
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
              <p className="text-sm font-semibold text-gray-600">Posted Batches</p>
              <p className="text-2xl font-bold text-green-600">{postedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <FileCheck2 className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">For Review or Posting</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Posted Warehouse Stock</p>
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
              placeholder="Search ID, batch record, category, source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="All">All Destinations</option>
            <option value="Oton Main Warehouse">Oton Main Warehouse</option>
            <option value="Pototan Main Warehouse">Pototan Main Warehouse</option>
            <option value="Leon">Leon</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="All">All Categories</option>
            {FNFI_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Manifest</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Goods</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Destination</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Posting Record</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Latest Update</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGoods.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-blue-600">{item.id}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" /> {item.dateReceived}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Record ref: {item.manifestHash}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{item.fnfiCategory}</p>
                    <p className="text-sm text-gray-700">{item.quantity.toLocaleString()} {item.unitType}</p>
                    <p className="text-xs text-gray-500">Exp: {item.expirationDate}</p>
                    <p className="text-xs text-gray-500">Source: {item.source}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.destinationType === 'Warehouse' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {item.destination}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">{item.incidentCode || 'No remarks'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyles[item.status]}`}>
                      {statusLabels[item.status]}
                    </span>
                    {item.verifiedBy && <p className="text-xs text-gray-500 mt-2">Verified by {item.verifiedBy}</p>}
                  </td>
                  <td className="px-4 py-4">
                    {item.batchTokenId ? (
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-green-700">{item.batchTokenId}</p>
                        <p className="text-xs text-gray-600 break-all">Receipt ref: {item.blockchainTxHash}</p>
                        <p className="text-xs text-gray-500">Posted: {item.mintedAt}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Not posted yet</p>
                    )}
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <p className="text-xs font-bold text-gray-700">{item.auditTrail[0]?.action}</p>
                    <p className="text-xs text-gray-500 mt-1">{friendlyAuditDetails(item.auditTrail[0]?.details)}</p>
                    {item.correctionNote && <p className="text-xs text-orange-700 mt-1">Correction: {item.correctionNote}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canEdit(item.status) && (
                        <button onClick={() => openActionModal('edit', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
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
                          <CheckCircle className="w-3 h-3" /> Verify
                        </button>
                      )}
                      {item.status === 'Verified' && (
                        <button onClick={() => openActionModal('post', item)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <ShieldCheck className="w-3 h-3" /> Post
                        </button>
                      )}
                      {['Minted', 'Correction Requested'].includes(item.status) && (
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

        {filteredGoods.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No incoming goods found</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddIncomingGoodsModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddGoods}
        />
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {actionModal.type === 'edit' && 'Edit Incoming Record'}
                  {actionModal.type === 'submit' && 'Submit for Checking'}
                  {actionModal.type === 'verify' && 'Confirm Physical Receipt'}
                  {actionModal.type === 'post' && 'Post Verified Batch'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                  {actionModal.type === 'message' && 'Action Notice'}
                </h2>
                {actionModal.item && <p className="text-sm text-gray-500 mt-1">{actionModal.item.id} | {actionModal.item.fnfiCategory}</p>}
              </div>
              <button onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionModal.type === 'message' ? (
                <p className="text-sm text-gray-700">{actionModal.message}</p>
              ) : (
                <>
                  {actionModal.type === 'edit' && (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={actionModal.quantity || 0}
                          onChange={(e) => setActionModal({ ...actionModal, quantity: Number(e.target.value) })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Remarks</label>
                        <textarea
                          value={actionModal.note || ''}
                          onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                        />
                      </div>
                    </>
                  )}

                  {actionModal.type === 'submit' && (
                    <p className="text-sm text-gray-700">Send this incoming delivery to the warehouse checker for review?</p>
                  )}

                  {actionModal.type === 'verify' && (
                    <p className="text-sm text-gray-700">Confirm that the quantity and item category match the received goods?</p>
                  )}

                  {actionModal.type === 'post' && (
                    <p className="text-sm text-gray-700">Post this verified batch to the official warehouse stock record?</p>
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
                </>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={closeActionModal}
                className="flex-1 px-5 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
              >
                {actionModal.type === 'message' ? 'Close' : 'Cancel'}
              </button>
              {actionModal.type !== 'message' && (
                <button
                  onClick={handleConfirmAction}
                  className="flex-1 px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
