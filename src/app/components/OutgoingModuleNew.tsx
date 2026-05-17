import { useState } from 'react';
import { CheckCircle, Edit, FileSignature, MapPin, PackageCheck, Plus, RotateCcw, Search, ShieldCheck, TruckIcon, X } from 'lucide-react';
import { AddReleaseModal } from './AddReleaseModal';
import type { InventoryItem, OutgoingRelease, OutgoingStatus } from '../hooks/useInventoryState';

interface InventoryState {
  inventory: InventoryItem[];
  outgoingReleasesList: OutgoingRelease[];
  addOutgoingRelease: (data: Omit<OutgoingRelease, 'drNumber' | 'allocatedBatchTokenIds' | 'auditTrail'>) => void;
  updateOutgoingRelease: (drNumber: string, patch: Partial<OutgoingRelease>) => void;
  approveAllocation: (drNumber: string, amountApproved: number) => { ok: boolean; message: string };
  senderSignAndRelease: (drNumber: string) => { ok: boolean; message: string };
  markInTransit: (drNumber: string) => void;
  receiverAcceptWithGps: (drNumber: string) => void;
  requestOutgoingCorrection: (drNumber: string, note: string) => void;
}

interface OutgoingModuleProps {
  inventoryState: InventoryState;
}

type AddReleaseForm = {
  dateAllocated: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  amountRequested: number;
  amountApproved: number;
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: 'Allocating' | 'Release' | 'In Transit' | 'Distributed';
  incidentCode: string;
};

const statusStyles: Record<OutgoingStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Allocating: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-blue-100 text-blue-700',
  Packed: 'bg-indigo-100 text-indigo-700',
  Released: 'bg-purple-100 text-purple-700',
  'In Transit': 'bg-orange-100 text-orange-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Accepted: 'bg-green-100 text-green-700',
  Distributed: 'bg-green-200 text-green-800',
  'Correction Requested': 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-200 text-gray-700'
};

const editableStatuses: OutgoingStatus[] = ['Draft', 'Allocating', 'Approved', 'Packed'];

type ReleaseAction = 'edit' | 'senderSign' | 'inTransit' | 'receiverAccept' | 'correction' | 'message';

interface ReleaseActionModalState {
  type: ReleaseAction;
  release?: OutgoingRelease;
  requestedAmount?: number;
  note?: string;
  message?: string;
}

export function OutgoingModuleNew({ inventoryState }: OutgoingModuleProps) {
  const {
    inventory,
    outgoingReleasesList,
    addOutgoingRelease,
    updateOutgoingRelease,
    approveAllocation,
    senderSignAndRelease,
    markInTransit,
    receiverAcceptWithGps,
    requestOutgoingCorrection
  } = inventoryState;

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<OutgoingRelease | null>(null);
  const [approvalAmount, setApprovalAmount] = useState(0);
  const [actionModal, setActionModal] = useState<ReleaseActionModalState | null>(null);

  const handleAddRelease = (newRelease: AddReleaseForm) => {
    addOutgoingRelease({
      ...newRelease,
      deliveryStatus: newRelease.deliveryStatus === 'Release' ? 'Approved' : newRelease.deliveryStatus,
      handoverContractId: undefined,
      senderSignature: undefined,
      receiverSignature: undefined,
      senderGps: undefined,
      receiverGps: undefined,
      blockchainTxHash: undefined,
      correctionNote: undefined
    });
    setShowReleaseModal(false);
  };

  const openApprovalModal = (release: OutgoingRelease) => {
    setSelectedRelease(release);
    setApprovalAmount(release.amountApproved || release.amountRequested);
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = () => {
    if (!selectedRelease) return;
    const result = approveAllocation(selectedRelease.drNumber, approvalAmount);
    if (result.ok) {
      setShowApprovalModal(false);
      setSelectedRelease(null);
      setApprovalAmount(0);
    }
    setActionModal({ type: 'message', message: result.message.replace('token batches', 'batch records') });
  };

  const openReleaseAction = (type: ReleaseAction, release: OutgoingRelease) => {
    if (type === 'edit' && !editableStatuses.includes(release.deliveryStatus)) {
      setActionModal({
        type: 'message',
        message: 'This release already has signed movement activity. Please file a correction record.'
      });
      return;
    }

    setActionModal({
      type,
      release,
      requestedAmount: release.amountRequested,
      note: release.correctionNote || release.incidentCode || ''
    });
  };

  const closeActionModal = () => setActionModal(null);

  const showResult = (message: string) => setActionModal({ type: 'message', message });

  const handleConfirmReleaseAction = () => {
    if (!actionModal?.release) return;
    const release = actionModal.release;

    if (actionModal.type === 'edit') {
      const nextRequested = Number(actionModal.requestedAmount);
      if (!Number.isFinite(nextRequested) || nextRequested <= 0) return;
      updateOutgoingRelease(release.drNumber, {
        amountRequested: nextRequested,
        incidentCode: actionModal.note || release.incidentCode
      });
      closeActionModal();
      return;
    }

    if (actionModal.type === 'senderSign') {
      const result = senderSignAndRelease(release.drNumber);
      showResult(result.message.replace('handover contract opened', 'release record signed'));
      return;
    }

    if (actionModal.type === 'inTransit') {
      markInTransit(release.drNumber);
      closeActionModal();
      return;
    }

    if (actionModal.type === 'receiverAccept') {
      receiverAcceptWithGps(release.drNumber);
      closeActionModal();
      return;
    }

    if (actionModal.type === 'correction') {
      if (actionModal.note) requestOutgoingCorrection(release.drNumber, actionModal.note);
      closeActionModal();
    }
  };

  const filteredReleases = outgoingReleasesList.filter(release => {
    const matchesSearch =
      release.lguName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.municipality.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.fnfiCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.drNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.handoverContractId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.allocatedBatchTokenIds.join(' ').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === 'All' || release.warehouseSource === selectedWarehouse;
    const matchesStatus = selectedStatus === 'All' || release.deliveryStatus === selectedStatus;

    return matchesSearch && matchesWarehouse && matchesStatus;
  });

  const allocatingCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Allocating').length;
  const approvedCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Approved').length;
  const activeReleaseCount = outgoingReleasesList.filter(r => ['Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus)).length;
  const acceptedCount = outgoingReleasesList.filter(r => r.deliveryStatus === 'Accepted' || r.deliveryStatus === 'Distributed').length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-700 to-teal-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Outgoing Goods Release</h1>
            <p className="text-sm text-green-100 mt-1">
              Approve stock, release goods from the warehouse, and confirm LGU receipt with location details.
            </p>
          </div>
          <button
            onClick={() => setShowReleaseModal(true)}
            className="flex items-center justify-center gap-2 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Release Draft
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">For Allocation</p>
              <p className="text-2xl font-bold text-yellow-600">{allocatingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Active Releases</p>
              <p className="text-2xl font-bold text-purple-600">{activeReleaseCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Confirmed Receipts</p>
              <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search DR, LGU, batch record, release record..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Warehouses</option>
            <option value="Oton Main Warehouse">Oton Main Warehouse</option>
            <option value="Pototan Main Warehouse">Pototan Main Warehouse</option>
            <option value="Leon Municipal Office">Leon Municipal Office</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Statuses</option>
            {Object.keys(statusStyles).map(status => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Release</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Destination</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Goods</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Release Record</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Signatures & GPS</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReleases.map((release) => (
                <tr key={release.drNumber} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-green-700">{release.drNumber}</p>
                    <p className="text-xs text-gray-500">Allocated: {release.dateAllocated}</p>
                    <p className="text-xs text-gray-500">Mode: {release.deliveryMode}</p>
                    <p className="text-xs text-gray-500">Source: {release.warehouseSource}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{release.lguName}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {release.municipality}, {release.province}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{release.fnfiCategory}</p>
                    <p className="text-sm text-gray-700">Requested: {release.amountRequested.toLocaleString()}</p>
                    <p className="text-sm text-green-700 font-semibold">Approved: {release.amountApproved ? release.amountApproved.toLocaleString() : '-'}</p>
                    <p className="text-xs text-gray-500">{release.incidentCode || 'No remarks'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyles[release.deliveryStatus]}`}>
                      {release.deliveryStatus}
                    </span>
                    {release.correctionNote && <p className="text-xs text-red-700 mt-2">Correction: {release.correctionNote}</p>}
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    {release.allocatedBatchTokenIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {release.allocatedBatchTokenIds.map(token => (
                          <span key={token} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">{token}</span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 mb-2">No batch record assigned</p>}
                    <p className="text-xs text-gray-600">Release agreement: {release.handoverContractId || '-'}</p>
                    <p className="text-xs text-gray-500 break-all">Receipt ref: {release.blockchainTxHash || '-'}</p>
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    <p className="text-xs"><span className="font-bold">Sender:</span> {release.senderSignature || '-'}</p>
                    <p className="text-xs text-gray-600">GPS: {release.senderGps || '-'}</p>
                    <p className="text-xs mt-2"><span className="font-bold">Receiver:</span> {release.receiverSignature || '-'}</p>
                    <p className="text-xs text-gray-600">GPS: {release.receiverGps || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {editableStatuses.includes(release.deliveryStatus) && (
                        <button onClick={() => openReleaseAction('edit', release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                        <button onClick={() => openApprovalModal(release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {['Approved', 'Packed'].includes(release.deliveryStatus) && (
                        <button onClick={() => openReleaseAction('senderSign', release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                          <FileSignature className="w-3 h-3" /> Sign Release
                        </button>
                      )}
                      {release.deliveryStatus === 'Released' && (
                        <button onClick={() => openReleaseAction('inTransit', release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">
                          <TruckIcon className="w-3 h-3" /> In Transit
                        </button>
                      )}
                      {['Released', 'In Transit', 'Delivered'].includes(release.deliveryStatus) && (
                        <button onClick={() => openReleaseAction('receiverAccept', release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <MapPin className="w-3 h-3" /> Confirm Receipt
                        </button>
                      )}
                      {['Accepted', 'Distributed', 'Correction Requested'].includes(release.deliveryStatus) && (
                        <button onClick={() => openReleaseAction('correction', release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
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

        {filteredReleases.length === 0 && (
          <div className="text-center py-12">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No outgoing releases found</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Available Warehouse Stock Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {inventory.map(item => (
            <div key={item.category} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-bold text-sm text-gray-900">{item.category}</p>
              <p className="text-xs text-gray-600 mt-1">Oton: {item.warehouseA.toLocaleString()}</p>
              <p className="text-xs text-gray-600">Pototan: {item.warehouseB.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {showReleaseModal && (
        <AddReleaseModal
          onClose={() => setShowReleaseModal(false)}
          onSubmit={handleAddRelease}
          availableStock={inventory}
        />
      )}

      {showApprovalModal && selectedRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Approve Allocation</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-600">DR Number:</span><p className="font-bold text-blue-600">{selectedRelease.drNumber}</p></div>
                  <div><span className="text-gray-600">LGU:</span><p className="font-bold text-gray-900">{selectedRelease.lguName}</p></div>
                  <div><span className="text-gray-600">Category:</span><p className="font-bold text-gray-900">{selectedRelease.fnfiCategory}</p></div>
                  <div><span className="text-gray-600">Warehouse:</span><p className="font-bold text-gray-900">{selectedRelease.warehouseSource}</p></div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount Requested</label>
                <div className="px-4 py-3 bg-gray-100 rounded-lg">
                  <span className="text-lg font-bold text-gray-900">{selectedRelease.amountRequested.toLocaleString()} units</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount to Approve <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max={selectedRelease.amountRequested}
                  value={approvalAmount}
                  onChange={(e) => setApprovalAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                />
                <p className="text-xs text-gray-600 mt-1">Approval reserves stock and assigns batch records for release.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRelease(null);
                  setApprovalAmount(0);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {actionModal.type === 'edit' && 'Edit Release Request'}
                  {actionModal.type === 'senderSign' && 'Sign Warehouse Release'}
                  {actionModal.type === 'inTransit' && 'Mark as In Transit'}
                  {actionModal.type === 'receiverAccept' && 'Confirm LGU Receipt'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                  {actionModal.type === 'message' && 'Action Notice'}
                </h2>
                {actionModal.release && <p className="text-sm text-gray-500 mt-1">{actionModal.release.drNumber} | {actionModal.release.lguName}</p>}
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
                        <label className="block text-sm font-bold text-gray-700 mb-2">Requested Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={actionModal.requestedAmount || 0}
                          onChange={(e) => setActionModal({ ...actionModal, requestedAmount: Number(e.target.value) })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Remarks</label>
                        <textarea
                          value={actionModal.note || ''}
                          onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-24"
                        />
                      </div>
                    </>
                  )}

                  {actionModal.type === 'senderSign' && (
                    <p className="text-sm text-gray-700">Confirm that this warehouse release is ready for dispatch and record the sender signature?</p>
                  )}

                  {actionModal.type === 'inTransit' && (
                    <p className="text-sm text-gray-700">Update this release as in transit to the receiving LGU?</p>
                  )}

                  {actionModal.type === 'receiverAccept' && (
                    <p className="text-sm text-gray-700">Confirm LGU receipt and record the receiving location details?</p>
                  )}

                  {actionModal.type === 'correction' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Correction Details</label>
                      <textarea
                        value={actionModal.note || ''}
                        onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
                        placeholder="Describe the quantity, location, or delivery issue."
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
                  onClick={handleConfirmReleaseAction}
                  className="flex-1 px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
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
