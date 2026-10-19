import { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Package,
  Truck,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  Boxes,
  ExternalLink,
  QrCode,
  ShieldCheck,
  FileText,
  Maximize2,
  Minimize2,
  Hash,
  Layers,
  User,
  Navigation
} from 'lucide-react';
import type { OutgoingRelease, OutgoingStatus, UserRole } from '../../hooks/useInventoryState';
import { parseIncidentInfo } from '../../lib/incidentHelper';

interface OutgoingTransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  release: OutgoingRelease | null;
  onOpenQr?: (release: OutgoingRelease) => void;
  onEdit?: (release: OutgoingRelease) => void;
  onApprove?: (release: OutgoingRelease) => void;
  onCancel?: (release: OutgoingRelease) => void;
  currentRole?: UserRole;
}

const statusBadgeStyles: Record<OutgoingStatus, { badge: string; dot: string; label: string }> = {
  Draft: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', label: 'Draft' },
  Allocating: { badge: 'bg-yellow-50 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500', label: 'Allocating' },
  Approved: { badge: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500', label: 'Approved' },
  Packed: { badge: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500', label: 'Packed' },
  Released: { badge: 'bg-purple-50 text-purple-800 border-purple-200', dot: 'bg-purple-500', label: 'Released' },
  'In Transit': { badge: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-500', label: 'In Transit' },
  Delivered: { badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', label: 'Delivered' },
  Accepted: { badge: 'bg-green-50 text-green-800 border-green-200', dot: 'bg-green-500', label: 'Accepted' },
  Distributed: { badge: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-500', label: 'Distributed' },
  'Correction Requested': { badge: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500', label: 'Correction Requested' },
  Cancelled: { badge: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', label: 'Cancelled' }
};

export function OutgoingTransactionDetailModal({
  isOpen,
  onClose,
  release,
  onOpenQr,
  onEdit,
  onApprove,
  onCancel,
  currentRole = 'Admin'
}: OutgoingTransactionDetailModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'goods' | 'tracking' | 'docs' | 'audit'>('all');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !release) return null;

  const incidentInfo = parseIncidentInfo(release.incidentCode);
  const displayCode = incidentInfo.incidentCode || release.incidentCode || release.drNumber;
  const calamityReason = incidentInfo.reportReason || release.reportReason || 'Standard Relief Operation';
  const disasterDate = incidentInfo.incidentDate || release.incidentDate;

  const statusConfig = statusBadgeStyles[release.deliveryStatus] || {
    badge: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: 'bg-gray-400',
    label: release.deliveryStatus
  };

  const requestedAmount = release.amountRequested ?? 0;
  const approvedAmount = release.amountApproved ?? 0;
  const fulfillmentPercent = requestedAmount > 0 ? Math.min(100, Math.round((approvedAmount / requestedAmount) * 100)) : 0;

  // Coordinate parser for map link
  const parseGpsCoords = (gpsStr?: string): { lat: number; lng: number } | null => {
    if (!gpsStr) return null;
    const parts = gpsStr.split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return null;
  };

  const receiverCoords = parseGpsCoords(release.receiverGps);
  const senderCoords = parseGpsCoords(release.senderGps);

  return (
    <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 overflow-y-auto ${isMaximized ? 'p-0' : 'p-3 sm:p-5'}`}>
      <div
        className={`bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'rounded-2xl max-w-5xl w-full max-h-[92vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
              <Boxes className="w-6 h-6 text-blue-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {displayCode}
                </span>
                <span className="text-xs text-gray-300 font-mono">
                  Inv Ref: #{release.drNumber}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusConfig.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1 truncate">
                {release.lguName || 'Destination LGU'} &bull; {release.municipality || 'Panay Region'}, {release.province || ''}
              </h2>
              <p className="text-xs text-blue-200/90 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Allocated: {release.dateAllocated || 'Pending'}</span>
                <span>&bull;</span>
                <span>Mode: {release.deliveryMode || 'Delivery'}</span>
                <span>&bull;</span>
                <span>Source: {release.warehouseSource || 'Main Hub'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenQr && !['Draft', 'Allocating'].includes(release.deliveryStatus) && (
              <button
                type="button"
                onClick={() => onOpenQr(release)}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition cursor-pointer"
                title="View & Print QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-blue-300" />
                <span>QR Code</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white transition cursor-pointer"
              title={isMaximized ? 'Restore down' : 'Maximize window'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 text-gray-200 hover:text-white transition cursor-pointer"
              title="Close details (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            All Sections
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('goods')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'goods'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Goods & Batches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'tracking'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Delivery & GPS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Documents & Blockchain
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
          >
            Audit History ({release.auditTrail?.length || 0})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Quick KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Goods Allocation</p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-bold text-gray-900">{approvedAmount.toLocaleString()}</span>
                <span className="text-xs text-gray-500 font-medium">of {requestedAmount.toLocaleString()} kits</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${fulfillmentPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1 font-medium">{fulfillmentPercent}% Approved Fulfillment</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Disaster Calamity</p>
              <p className="text-sm font-bold text-gray-900 mt-1 truncate" title={calamityReason}>
                {calamityReason}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {disasterDate ? `Date: ${disasterDate}` : 'Standard Relief Protocol'}
              </p>
              <span className="inline-block mt-1 text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                Code: {displayCode}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Transit & Escort</p>
              <p className="text-sm font-bold text-gray-900 mt-1 truncate">
                {release.assignedEscortProfileId || release.assignedDriverProfileId || 'Unassigned Escort'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Truck: {release.assignedTruckId || release.plateNumber || 'No truck selected'}
              </p>
              <span className="inline-block mt-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                Mode: {release.deliveryMode || 'Delivery'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Verification Proof</p>
              <div className="mt-1">
                {release.receiverGps ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> GPS Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending GPS Drop-off
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 truncate">
                {release.blockchainTxHash ? 'Sepolia on-chain confirmed' : 'Awaiting admin minting'}
              </p>
            </div>
          </div>

          {/* SECTION A & B: Release Info & Destination */}
          {(activeTab === 'all' || activeTab === 'goods') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* SECTION A: Release Information */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section A: Release Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Incident Code:</span>
                    <span className="font-bold text-gray-900">{displayCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Backend Inventory Ref:</span>
                    <span className="font-mono font-semibold text-gray-700">#{release.drNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Date Allocated:</span>
                    <span className="font-medium text-gray-800">{release.dateAllocated || 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Date Requested:</span>
                    <span className="font-medium text-gray-800">{release.dateRequested || release.dateAllocated || 'Not recorded'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Delivery Mode:</span>
                    <span className="font-semibold text-gray-800">{release.deliveryMode || 'Delivery'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Delivery Status:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${statusConfig.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                      {release.deliveryStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Source Warehouse:</span>
                    <span className="font-semibold text-gray-900">{release.warehouseSource || 'Main Hub'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Source Type:</span>
                    <span className="font-medium text-gray-700">{release.sourceType || 'Warehouse'}</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-500 block text-[11px]">Disaster Calamity Justification:</span>
                    <p className="font-medium text-gray-900 mt-0.5">{calamityReason}</p>
                    {disasterDate && <p className="text-[11px] text-gray-500 mt-0.5">Recorded Disaster Date: {disasterDate}</p>}
                  </div>
                </div>
              </div>

              {/* SECTION B: Destination Information */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section B: Destination Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                  <div className="col-span-2">
                    <span className="text-gray-500 block text-[11px]">Recipient LGU / Drop-off Center:</span>
                    <span className="font-bold text-sm text-gray-900">{release.lguName || 'Destination LGU'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Municipality:</span>
                    <span className="font-semibold text-gray-800">{release.municipality || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Province:</span>
                    <span className="font-semibold text-gray-800">{release.province || 'Iloilo'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 block text-[11px]">Complete Drop-off Site Address:</span>
                    <span className="font-medium text-gray-900">
                      {release.destinationAddress || `${release.municipality || 'LGU Center'}, ${release.province || 'Panay Region'}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Destination LGU ID:</span>
                    <span className="font-mono text-gray-600">{release.destinationLguId || release.lguId || 'LGU-AUTO'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Receiving Personnel:</span>
                    <span className="font-medium text-gray-700">Designated LGU Receiving Officer</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: Goods and Allocation Details */}
          {(activeTab === 'all' || activeTab === 'goods') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section C: Goods & Allocation Details</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  {release.fnfiCategory || 'Relief Goods'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase">Requested Quantity</span>
                  <p className="text-lg font-bold text-gray-900 mt-1">{requestedAmount.toLocaleString()} kits</p>
                  <p className="text-[11px] text-gray-500">Initial relief requisition</p>
                </div>

                <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200">
                  <span className="text-[11px] font-semibold text-blue-700 uppercase">Approved Quantity</span>
                  <p className="text-lg font-bold text-blue-900 mt-1">{approvedAmount.toLocaleString()} kits</p>
                  <p className="text-[11px] text-blue-600">Authorized by DSWD Admin</p>
                </div>

                <div className="p-3.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase">Fulfillment Status</span>
                  <p className="text-lg font-bold text-emerald-900 mt-1">{fulfillmentPercent}%</p>
                  <p className="text-[11px] text-emerald-700">
                    {approvedAmount >= requestedAmount ? 'Fully Allocated' : `${requestedAmount - approvedAmount} kits deficit`}
                  </p>
                </div>
              </div>

              {/* Batch Allocation Breakdown Table */}
              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>FEFO Batch Allocations on Manifest</span>
                </h4>

                {Array.isArray(release.allocatedBatches) && release.allocatedBatches.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
                        <tr>
                          <th className="px-3.5 py-2 text-left">Batch Token ID</th>
                          <th className="px-3.5 py-2 text-left">Batch Number</th>
                          <th className="px-3.5 py-2 text-left">Expiration Date</th>
                          <th className="px-3.5 py-2 text-right">Allocated Kits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {release.allocatedBatches.map((batch, idx) => (
                          <tr key={batch?.batchTokenId || idx} className="hover:bg-gray-50/60">
                            <td className="px-3.5 py-2.5 font-mono text-blue-700 font-semibold">
                              {batch?.batchTokenId || `TOKEN-${idx + 1}`}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-gray-800">
                              {batch?.batchNumber || batch?.batchTokenId || 'Standard Batch'}
                            </td>
                            <td className="px-3.5 py-2.5 text-gray-600">
                              {batch?.expirationDate ? (
                                <span className="inline-flex items-center gap-1 text-gray-700">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  {batch.expirationDate}
                                </span>
                              ) : (
                                <span className="text-gray-400">Non-expiring</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-gray-900">
                              {(batch?.quantity ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                    No specific FEFO batch tokens allocated yet. Batches will be locked upon admin authorization and on-chain minting.
                  </div>
                )}
              </div>

              {/* Correction Note if filed */}
              {release.correctionNote && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Correction Record on File:</span>
                    <p className="mt-0.5">{release.correctionNote}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION D: Delivery and Tracking Information */}
          {(activeTab === 'all' || activeTab === 'tracking') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                <Truck className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section D: Delivery & Tracking Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs mb-5">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Relief Escort Officer:</span>
                  <p className="font-bold text-gray-900 mt-1">
                    {release.assignedEscortProfileId || release.assignedDriverProfileId || 'Not assigned'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Physical convoy custodian</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Assigned Vehicle / Truck:</span>
                  <p className="font-bold text-purple-700 mt-1">
                    {release.assignedTruckId || release.plateNumber || 'No vehicle set'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Disaster response logistics fleet</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Sender Dispatch GPS:</span>
                  <p className="font-mono text-gray-800 font-semibold mt-1">
                    {release.senderGps || 'Not recorded'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Warehouse dispatch lock</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 block text-[11px]">Receiver Drop-off GPS:</span>
                  <p className="font-mono text-gray-800 font-semibold mt-1">
                    {release.receiverGps || 'Awaiting drop-off scan'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">LGU reception telemetry</p>
                </div>
              </div>

              {/* Map & GPS Verification Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">
                      {release.receiverGps ? 'Telemetry Geofence Verification Confirmed' : 'GPS Coordinates Telemetry'}
                    </h4>
                    <p className="text-[11px] text-gray-600">
                      {release.receiverGps
                        ? `Delivery verified on-site at coordinates: ${release.receiverGps}`
                        : release.senderGps
                        ? `Dispatch recorded at coordinates: ${release.senderGps}. Receiver drop-off scan pending.`
                        : 'No GPS telemetry recorded for this release yet.'}
                    </p>
                  </div>
                </div>

                {(receiverCoords || senderCoords) && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${(receiverCoords || senderCoords)!.lat}&mlon=${(receiverCoords || senderCoords)!.lng}#map=16/${(receiverCoords || senderCoords)!.lat}/${(receiverCoords || senderCoords)!.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    <span>View Map Coordinates</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* SECTION E: Release Documents, Signatures & Batch Manifests */}
          {(activeTab === 'all' || activeTab === 'docs') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section E: Release Documents & Blockchain Signatures</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-5">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase">Release Handover Agreement</span>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Contract Reference:</span>
                    <span className="font-mono font-bold text-gray-900">
                      {release.handoverContractId || `DSWD-HA-${release.drNumber}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Agreement Status:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      <CheckCircle className="w-3 h-3 text-green-600" /> On File
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase">Delivery Receipt QR Manifest</span>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Cryptographic QR Order:</span>
                    <span className="font-semibold text-gray-800">
                      {!['Draft', 'Allocating'].includes(release.deliveryStatus) ? 'Generated & Valid' : 'Pending Authorization'}
                    </span>
                  </div>
                  {onOpenQr && !['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                    <button
                      type="button"
                      onClick={() => onOpenQr(release)}
                      className="w-full mt-1.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold hover:bg-blue-100 transition cursor-pointer text-xs"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Open Delivery QR Manifest</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Digital Signatures and Blockchain Hashes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Multi-Party Cryptographic Signatures</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-gray-500 block text-[11px]">1. Admin Authorization Signature</span>
                    <p className="font-mono text-[11px] text-gray-900 font-semibold mt-1 truncate" title={release.adminSignature || release.blockchainTxHash || 'Pending'}>
                      {release.adminSignature || release.blockchainTxHash ? `${(release.adminSignature || release.blockchainTxHash)!.slice(0, 16)}...` : 'Not recorded'}
                    </p>
                    <p className="text-[10px] text-green-700 mt-1 font-medium">
                      {release.adminSignature || release.blockchainTxHash ? 'Digitally Signed & Minted' : 'Awaiting Authorization'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-gray-500 block text-[11px]">2. Escort Custody Sender Signature</span>
                    <p className="font-mono text-[11px] text-gray-900 font-semibold mt-1 truncate" title={release.senderSignature || 'Pending'}>
                      {release.senderSignature ? `${release.senderSignature.slice(0, 16)}...` : 'Not recorded'}
                    </p>
                    <p className="text-[10px] text-blue-700 mt-1 font-medium">
                      {release.senderSignature ? 'Custody Accepted' : 'Pending Escort Dispatch'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-gray-500 block text-[11px]">3. LGU Officer Receiver Signature</span>
                    <p className="font-mono text-[11px] text-gray-900 font-semibold mt-1 truncate" title={release.receiverSignature || 'Pending'}>
                      {release.receiverSignature ? `${release.receiverSignature.slice(0, 16)}...` : 'Not recorded'}
                    </p>
                    <p className="text-[10px] text-purple-700 mt-1 font-medium">
                      {release.receiverSignature ? 'Receipt Formally Verified' : 'Pending LGU Receipt'}
                    </p>
                  </div>
                </div>

                {release.blockchainTxHash && (
                  <div className="mt-3 p-3 bg-purple-50/70 border border-purple-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <span className="text-purple-900 font-bold block">Sepolia Testnet Smart Contract Transaction</span>
                      <p className="font-mono text-[11px] text-purple-700 truncate mt-0.5" title={release.blockchainTxHash}>
                        {release.blockchainTxHash}
                      </p>
                    </div>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${release.blockchainTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shrink-0 transition"
                    >
                      <span>Etherscan</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION F: Audit and Transaction History */}
          {(activeTab === 'all' || activeTab === 'audit') && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Section F: Audit & Transaction History</h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {release.auditTrail?.length || 0} recorded milestone events
                </span>
              </div>

              {Array.isArray(release.auditTrail) && release.auditTrail.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {release.auditTrail.map((event, idx) => (
                    <div key={event.id || idx} className="relative">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-100" />
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="font-bold text-gray-900">{event.action}</span>
                          <span className="text-gray-500 font-medium">{event.timestamp}</span>
                        </div>
                        <p className="text-xs text-gray-700 mt-1">{event.details}</p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800">
                            <User className="w-3 h-3 text-gray-400" />
                            {event.actor}
                          </span>
                          {event.role && (
                            <span className="px-1.5 py-0.2 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">
                              {event.role}
                            </span>
                          )}
                          {event.txHash && (
                            <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-[10px]">
                              Tx: {event.txHash.slice(0, 10)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
                  No chronological audit events recorded for this release yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-gray-500">
            <span>Viewing release record for </span>
            <strong className="text-gray-800">{displayCode}</strong>
            <span className="text-gray-400 font-mono ml-1">(#{release.drNumber})</span>
          </div>

          <div className="flex items-center gap-2">
            {onApprove && ['Draft', 'Allocating'].includes(release.deliveryStatus) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onApprove(release);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Approve Allocation
              </button>
            )}

            {onEdit && ['Draft', 'Allocating', 'Approved', 'Packed'].includes(release.deliveryStatus) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(release);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Edit Draft
              </button>
            )}

            {onCancel && currentRole === 'Admin' && ['Draft', 'Allocating'].includes(release.deliveryStatus) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCancel(release);
                }}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel Release
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

