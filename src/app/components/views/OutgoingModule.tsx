import { useState, useMemo } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, Edit, Loader2, MapPin, PackageCheck, Plus, QrCode, RotateCcw, Search, ShieldCheck, TruckIcon, X } from 'lucide-react';
import { AddReleaseModal, type ReleaseForm } from '../modals/AddReleaseModal';
import { parseIncidentInfo } from '../../lib/incidentHelper';
import { QrCodeGeneratorModal } from '../modals/QrCodeGeneratorModal';
import { SuccessModal } from '../modals/SuccessModal';
import { blockchain } from '../../services/blockchain';
import { sanitizeNumbersOnly } from '../../lib/inputValidation';
import type { DiscrepancyReport, InventoryItem, OutgoingRelease, OutgoingStatus, UserRole } from '../../hooks/useInventoryState';
import type { LguRecord, ProvinceRecord, WarehouseRecord, SupplySourceRecord, KitTypeRecord } from '../../services/backendApi';

interface InventoryState {
  inventory: InventoryItem[];
  outgoingReleasesList: OutgoingRelease[];
  discrepancyReports: DiscrepancyReport[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  warehousesList?: WarehouseRecord[];
  supplySourcesList?: SupplySourceRecord[];
  kitTypesList?: KitTypeRecord[];
  addOutgoingRelease: (data: Omit<OutgoingRelease, 'drNumber' | 'allocatedBatches' | 'auditTrail'>) => void;
  updateOutgoingRelease: (drNumber: string, patch: Partial<OutgoingRelease>) => void;
  approveAllocation: (drNumber: string, amountApproved: number) => Promise<{ ok: boolean; message: string }>;
  senderSignAndRelease: (drNumber: string, actorRole?: UserRole) => Promise<{ ok: boolean; message: string }>;
  markInTransit: (drNumber: string) => void;
  receiverAcceptWithGps: (drNumber: string, actorRole?: UserRole) => Promise<{ ok: boolean; message: string }>;
  requestOutgoingCorrection: (drNumber: string, note: string) => void;
}

interface OutgoingModuleProps {
  inventoryState: InventoryState;
  currentRole: UserRole;
}

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

type ReleaseAction = 'senderSign' | 'inTransit' | 'receiverAccept' | 'correction' | 'message';

interface ReleaseActionModalState {
  type: ReleaseAction;
  release?: OutgoingRelease;
  requestedAmount?: number;
  note?: string;
  message?: string;
}

export function OutgoingModule({ inventoryState, currentRole }: OutgoingModuleProps) {
  const {
    inventory,
    outgoingReleasesList,
    discrepancyReports,
    lgusList,
    addOutgoingRelease,
    updateOutgoingRelease,
    approveAllocation,
    senderSignAndRelease,
    markInTransit,
    receiverAcceptWithGps,
    requestOutgoingCorrection,
    provincesList = [],
    warehousesList = [],
    supplySourcesList = [],
    kitTypesList = []
  } = inventoryState;

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState<OutgoingRelease | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<OutgoingRelease | null>(null);
  const [approvalAmount, setApprovalAmount] = useState(0);
  const [isApproving, setIsApproving] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionModal, setActionModal] = useState<ReleaseActionModalState | null>(null);
  const [qrModalRelease, setQrModalRelease] = useState<OutgoingRelease | null>(null);
  const autoCloseDelayMs = 1800;

  const warehouseOptions = useMemo(() => {
    if (warehousesList.length > 0) return warehousesList.map(w => w.name);
    return ['Oton Main Warehouse', 'Pototan Main Warehouse'];
  }, [warehousesList]);

  const handleAddRelease = (newRelease: ReleaseForm) => {
    addOutgoingRelease({
      ...newRelease,
      deliveryStatus: newRelease.deliveryStatus,
      receiverGps: newRelease.receiverGps || undefined,
      destinationAddress: newRelease.destinationAddress || undefined,
      lguId: newRelease.lguId || undefined,
      handoverContractId: undefined,
      senderSignature: undefined,
      receiverSignature: undefined,
      senderGps: undefined,
      blockchainTxHash: undefined,
      correctionNote: undefined
    });
    setShowReleaseModal(false);
    showResult(`Release allocation for ${newRelease.municipality || 'LGU'} (${(newRelease.amountRequested ?? 0).toLocaleString()} ${newRelease.fnfiCategory}) created successfully.`);
  };

  const handleEditRelease = (updatedRelease: ReleaseForm) => {
    if (!editingRelease) return;
    updateOutgoingRelease(editingRelease.drNumber, {
      dateAllocated: updatedRelease.dateAllocated,
      lguName: updatedRelease.lguName,
      province: updatedRelease.province,
      municipality: updatedRelease.municipality,
      fnfiCategory: updatedRelease.fnfiCategory,
      amountRequested: updatedRelease.amountRequested,
      amountApproved: updatedRelease.amountApproved,
      warehouseSource: updatedRelease.warehouseSource,
      deliveryMode: updatedRelease.deliveryMode,
      deliveryStatus: updatedRelease.deliveryStatus,
      incidentCode: updatedRelease.incidentCode,
      receiverGps: updatedRelease.receiverGps,
      destinationAddress: updatedRelease.destinationAddress
    });
    setEditingRelease(null);
    showResult(`Release request ${editingRelease.drNumber} updated successfully.`);
  };

  const openApprovalModal = (release: OutgoingRelease) => {
    setSelectedRelease(release);
    setApprovalAmount(release.amountApproved || release.amountRequested);
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedRelease) return;
    setIsApproving(true);
    try {
      const result = await approveAllocation(selectedRelease.drNumber, approvalAmount);
      if (result.ok) {
        setShowApprovalModal(false);
        setSelectedRelease(null);
        setApprovalAmount(0);
      }
      setActionModal({ type: 'message', message: result.message });
    } catch (err) {
      setActionModal({ type: 'message', message: err instanceof Error ? err.message : 'Approval and minting failed.' });
    } finally {
      setIsApproving(false);
    }
  };

  const openReleaseAction = (type: ReleaseAction, release: OutgoingRelease) => {
    setActionModal({
      type,
      release,
      requestedAmount: release.amountRequested,
      note: release.correctionNote || release.incidentCode || ''
    });
  };

  const closeActionModal = () => setActionModal(null);

  const showResult = (message: string, autoClose = false) => {
    setActionModal({ type: 'message', message });
    if (autoClose) {
      setTimeout(() => {
        setActionModal(null);
      }, autoCloseDelayMs);
    }
  };

  const handleConfirmReleaseAction = async () => {
    if (!actionModal?.release || isSubmittingAction) return;
    const release = actionModal.release;
    setIsSubmittingAction(true);

    try {
      if (actionModal.type === 'senderSign') {
        const result = await senderSignAndRelease(release.drNumber, currentRole);
        showResult(result.message.replace('handover contract opened', 'release record signed'), result.ok);
        return;
      }

      if (actionModal.type === 'inTransit') {
        markInTransit(release.drNumber);
        closeActionModal();
        return;
      }

      if (actionModal.type === 'receiverAccept') {
        const result = await receiverAcceptWithGps(release.drNumber, currentRole);
        showResult(result.message, result.ok);
        return;
      }

      if (actionModal.type === 'correction') {
        if (actionModal.note) requestOutgoingCorrection(release.drNumber, actionModal.note);
        closeActionModal();
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredReleases = (outgoingReleasesList || []).filter(release => {
    if (!release) return false;
    const batches = Array.isArray(release.allocatedBatches) ? release.allocatedBatches : [];
    const matchesSearch =
      (release.lguName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.municipality || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.fnfiCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.drNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.incidentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.handoverContractId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      batches.map(batch => batch?.batchTokenId || '').join(' ').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === 'All' || release.warehouseSource === selectedWarehouse;
    const matchesStatus = selectedStatus === 'All' || release.deliveryStatus === selectedStatus;

    return matchesSearch && matchesWarehouse && matchesStatus;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredReleases.length / pageSize));
  const paginatedReleases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReleases.slice(start, start + pageSize);
  }, [filteredReleases, currentPage, pageSize]);

  const allocatingCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus === 'Allocating').length;
  const approvedCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus === 'Approved').length;
  const activeReleaseCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus && ['Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus)).length;
  const acceptedCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus && (r.deliveryStatus === 'Accepted' || r.deliveryStatus === 'Distributed')).length;
  const outgoingDiscrepancies = (discrepancyReports || []).filter(report => report.reportType === 'Outgoing');

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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowReleaseModal(true)}
              className="flex items-center justify-center gap-2 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              New Release Draft
            </button>
          </div>
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Warehouses</option>
            {warehouseOptions.map(wh => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Statuses</option>
            {Object.keys(statusStyles).map(status => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full min-w-[1300px]">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Release</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Destination</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Goods</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Release Record</th>
                <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedReleases.map((release) => (
                <tr key={release.drNumber} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-green-700">{release.drNumber}</p>
                    <p className="text-xs text-gray-500">Allocated: {release.dateAllocated || '-'}</p>
                    <p className="text-xs text-gray-500">Mode: {release.deliveryMode || '-'}</p>
                    <p className="text-xs text-gray-500">Source: {release.warehouseSource || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{release.lguName || 'LGU'}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {release.municipality || '-'}, {release.province || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-gray-900">{release.fnfiCategory || 'Relief Goods'}</p>
                    <p className="text-sm text-gray-700">Requested: {(release.amountRequested ?? 0).toLocaleString()} kits</p>
                    <p className="text-sm text-green-700 font-semibold">Approved: {release.amountApproved ? `${(release.amountApproved).toLocaleString()} kits` : '-'}</p>
                    {(() => {
                      const incidentInfo = parseIncidentInfo(release.incidentCode);
                      const displayCode = incidentInfo.incidentCode || release.incidentCode;
                      if (!displayCode || displayCode.toLowerCase() === 'none') return null;
                      return (
                        <div className="mt-2 space-y-1 pt-1.5 border-t border-gray-100">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-bold">
                            <span className="text-[10px] uppercase font-bold text-blue-600">Incident:</span>
                            <span>{displayCode}</span>
                          </div>
                          {incidentInfo.reportReason && (
                            <p className="text-xs text-gray-700 font-medium">
                              <span className="text-gray-500 font-normal">Reason:</span> {incidentInfo.reportReason}
                            </p>
                          )}
                          {incidentInfo.incidentDate && (
                            <p className="text-[11px] text-gray-500">
                              <span>Disaster Date:</span> {incidentInfo.incidentDate}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyles[release.deliveryStatus] || 'bg-gray-100 text-gray-700'}`}>
                      {release.deliveryStatus}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <p>Sender GPS: {release.senderGps || '-'}</p>
                      <p>Receiver GPS: {release.receiverGps || '-'}</p>
                    </div>
                    {release.receiverGps && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-bold">
                        <MapPin className="w-3 h-3" /> GPS verified
                      </div>
                    )}
                    {release.correctionNote && <p className="text-xs text-red-700 mt-2">Correction: {release.correctionNote}</p>}
                  </td>
                  <td className="px-4 py-4 max-w-xs">
                    {(Array.isArray(release.allocatedBatches) && release.allocatedBatches.length > 0) ? (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {release.allocatedBatches.map(batch => (
                          <span key={batch?.batchTokenId || Math.random()} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">
                            {batch?.batchTokenId || 'Batch'} ({batch?.quantity ?? 0})
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-400 mb-2">No batch record assigned</p>}
                    <p className="text-xs text-gray-600">Release agreement: {release.handoverContractId ? 'On file' : 'Not set'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {!['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                        <button
                          onClick={() => setQrModalRelease(release)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition shadow-xs cursor-pointer"
                          title="View & Print Delivery Receipt QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" /> QR Code
                        </button>
                      )}
                      {editableStatuses.includes(release.deliveryStatus) && (
                        <button
                          onClick={() => {
                            if (!editableStatuses.includes(release.deliveryStatus)) {
                              setActionModal({
                                type: 'message',
                                message: 'This release already has signed movement activity. Please file a correction record.'
                              });
                              return;
                            }
                            setEditingRelease(release);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                        <button onClick={() => openApprovalModal(release)} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {['Approved', 'Packed'].includes(release.deliveryStatus) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                          <QrCode className="w-3.5 h-3.5 text-amber-600" /> Awaiting Receiver Scan
                        </span>
                      )}
                      {['In Transit', 'Delivered'].includes(release.deliveryStatus) && (
                        <button
                          onClick={() => openReleaseAction('receiverAccept', release)}
                          disabled={currentRole !== 'LGUReceiver'}
                          title={currentRole !== 'LGUReceiver' ? 'RBAC: connect the LGUReceiver MetaMask wallet to confirm receipt.' : 'Confirm receipt with the LGUReceiver MetaMask wallet.'}
                          className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg ${currentRole === 'LGUReceiver' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                        >
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

        {filteredReleases.length === 0 ? (
          <div className="text-center py-12">
            <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No outgoing releases found</p>
          </div>
        ) : (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing{' '}
              <span className="font-bold text-gray-900">
                {filteredReleases.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(currentPage * pageSize, filteredReleases.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredReleases.length}</span> releases
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

      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Available Warehouse Stock Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(inventory || []).map(item => (
            <div key={item.category} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-bold text-sm text-gray-900">{item.category}</p>
              <p className="text-xs text-gray-600 mt-1">Oton: {(item.warehouseA ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-600">Pototan: {(item.warehouseB ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Outgoing Discrepancy Reports</h3>
            <p className="text-sm text-gray-600">LGU-reported issues on release quantities or deliveries.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
            {outgoingDiscrepancies.length} total
          </span>
        </div>
        <div className="p-6">
          {outgoingDiscrepancies.length > 0 ? (
            <div className="space-y-3">
              {outgoingDiscrepancies.slice(0, 5).map(report => (
                <div key={report.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">{report.drNumber || 'Unknown DR'}</p>
                    <p className="text-xs text-gray-600 mt-1">{report.note}</p>
                    <p className="text-[11px] text-gray-500 mt-2">Reported {report.reportedAt}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                    Outgoing
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm font-bold text-green-900">No discrepancy reports yet</p>
              <p className="text-xs text-green-700 mt-1">Outgoing mismatches will appear here once filed.</p>
            </div>
          )}
        </div>
      </div>

      {showReleaseModal && (
        <AddReleaseModal
          onClose={() => setShowReleaseModal(false)}
          onSubmit={handleAddRelease}
          availableStock={inventory}
          lgusList={lgusList}
          provincesList={provincesList}
          warehousesList={warehousesList}
          supplySourcesList={supplySourcesList}
          kitTypesList={kitTypesList}
          mode="add"
        />
      )}

      {editingRelease && (
        <AddReleaseModal
          onClose={() => setEditingRelease(null)}
          onSubmit={handleEditRelease}
          availableStock={inventory}
          lgusList={lgusList}
          provincesList={provincesList}
          warehousesList={warehousesList}
          supplySourcesList={supplySourcesList}
          kitTypesList={kitTypesList}
          mode="edit"
          initialData={{
            dateAllocated: editingRelease.dateAllocated,
            lguId: editingRelease.lguId,
            lguName: editingRelease.lguName,
            province: editingRelease.province,
            municipality: editingRelease.municipality,
            fnfiCategory: editingRelease.fnfiCategory,
            amountRequested: editingRelease.amountRequested,
            amountApproved: editingRelease.amountApproved,
            sourceType: (warehousesList.some(w => (w?.name || '').toLowerCase() === (editingRelease.warehouseSource || '').toLowerCase()) || ['Oton Main Warehouse', 'Pototan Main Warehouse'].includes(editingRelease.warehouseSource || '')) ? 'Warehouse' : 'LGU',
            warehouseSource: editingRelease.warehouseSource,
            deliveryMode: editingRelease.deliveryMode,
            deliveryStatus: editingRelease.deliveryStatus,
            incidentCode: editingRelease.incidentCode,
            incidentDate: editingRelease.incidentDate || '',
            reportReason: editingRelease.reportReason || '',
            receiverGps: editingRelease.receiverGps,
            destinationAddress: editingRelease.destinationAddress
          }}
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
                  <span className="text-lg font-bold text-gray-900">{(selectedRelease.amountRequested ?? 0).toLocaleString()} kits</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount to Approve <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={approvalAmount || ''}
                  onChange={(e) => {
                    const c = sanitizeNumbersOnly(e.target.value);
                    const n = c ? parseInt(c, 10) : 0;
                    setApprovalAmount(selectedRelease ? Math.min(n, selectedRelease.amountRequested) : n);
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                />
                <p className="text-xs text-gray-600 mt-1">Approval mints the on-chain batch token and records the Admin MetaMask signature.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRelease(null);
                  setApprovalAmount(0);
                }}
                disabled={isApproving}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="flex-1 px-6 py-3 bg-[#2500ba] text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isApproving ? 'Authorizing & Minting...' : 'Approve & Mint Release'}
              </button>
            </div>
          </div>
        </div>
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
                  {actionModal.type === 'senderSign' && 'Sign Warehouse Release'}
                  {actionModal.type === 'inTransit' && 'Mark as In Transit'}
                  {actionModal.type === 'receiverAccept' && 'Confirm LGU Receipt'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                </h2>
                {actionModal.release && <p className="text-sm text-gray-500 mt-1">{actionModal.release.drNumber} | {actionModal.release.lguName}</p>}
              </div>
              <button type="button" onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                onClick={handleConfirmReleaseAction}
                disabled={isSubmittingAction}
                className="flex-1 px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModalRelease && (
        <QrCodeGeneratorModal
          releases={outgoingReleasesList}
          initialRelease={qrModalRelease}
          onClose={() => setQrModalRelease(null)}
        />
      )}
    </div>
  );
}
