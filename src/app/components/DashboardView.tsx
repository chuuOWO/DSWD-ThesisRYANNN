import { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ClipboardCheck, FileSignature, MapPin, Package, TrendingUp, TruckIcon } from 'lucide-react';
import type { IncomingGoods, InventoryItem, LGUPriorityReport, OutgoingRelease } from '../hooks/useInventoryState';

interface DashboardState {
  inventory: InventoryItem[];
  incomingGoodsList: IncomingGoods[];
  outgoingReleasesList: OutgoingRelease[];
  lguPriorityReports: LGUPriorityReport[];
}

interface DashboardViewProps {
  inventoryState: DashboardState;
  onNavigate: (view: string) => void;
}

const priorityClasses = {
  Red: 'bg-red-100 text-red-700 border-red-200',
  Yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Green: 'bg-green-100 text-green-700 border-green-200'
};

export function DashboardView({ inventoryState, onNavigate }: DashboardViewProps) {
  const { inventory, incomingGoodsList, outgoingReleasesList, lguPriorityReports } = inventoryState;
  const [showWarehouseOverview, setShowWarehouseOverview] = useState(false);

  const totalInventory = inventory.reduce((sum, item) => sum + item.warehouseA + item.warehouseB, 0);
  const postedBatchCount = incomingGoodsList.filter(item => item.status === 'Minted').length;
  const releaseRecordCount = outgoingReleasesList.filter(item => item.handoverContractId).length;
  const gpsAcceptedCount = outgoingReleasesList.filter(item => item.receiverGps).length;
  const urgentLGUs = lguPriorityReports.filter(report => report.priorityColor === 'Red');
  const activeReleases = outgoingReleasesList.filter(item => ['Released', 'In Transit', 'Correction Requested'].includes(item.deliveryStatus));
  const incomingForReview = incomingGoodsList.filter(item => item.status === 'Pending Verification' || item.status === 'Verified').length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl p-6 text-white shadow-md">
        <h1 className="text-2xl font-bold">DSWD Relief Goods Logistics Dashboard</h1>
        <p className="text-sm text-blue-100 mt-1">
          Operational view of warehouse stock, incoming deliveries, outgoing releases, GPS-confirmed receipts, and LGU priority needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setShowWarehouseOverview((current) => !current)}
          aria-expanded={showWarehouseOverview}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md text-left hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <Package className="w-8 h-8 mb-3" />
            <ChevronDown className={`w-6 h-6 transition-transform ${showWarehouseOverview ? 'rotate-180' : ''}`} />
          </div>
          <p className="text-3xl font-bold">{totalInventory.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Current Warehouse Inventory</p>
          <p className="text-xs text-blue-100 mt-2">{showWarehouseOverview ? 'Hide FNFI breakdown' : 'Show FNFI breakdown'}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('incoming')}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-md text-left hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 transition-all"
        >
          <ClipboardCheck className="w-8 h-8 mb-3" />
          <p className="text-3xl font-bold">{postedBatchCount}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Verified Incoming Batches</p>
          <p className="text-xs text-green-100 mt-2">Open incoming records</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('outgoing')}
          className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-6 text-white shadow-md text-left hover:from-cyan-600 hover:to-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-200 transition-all"
        >
          <FileSignature className="w-8 h-8 mb-3" />
          <p className="text-3xl font-bold">{releaseRecordCount}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Signed Release Records</p>
          <p className="text-xs text-cyan-100 mt-2">Open outgoing releases</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('lgu-monitoring')}
          className="bg-gradient-to-br from-red-500 to-orange-500 rounded-lg p-6 text-white shadow-md text-left hover:from-red-600 hover:to-orange-600 focus:outline-none focus:ring-4 focus:ring-red-200 transition-all"
        >
          <AlertTriangle className="w-8 h-8 mb-3" />
          <p className="text-3xl font-bold">{urgentLGUs.length}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Red Priority LGUs</p>
          <p className="text-xs text-red-100 mt-2">Open LGU monitor</p>
        </button>
      </div>

      {showWarehouseOverview && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Warehouse FNFI Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {inventory.map((item) => (
              <div key={item.category} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-lg font-bold text-gray-900">{(item.warehouseA + item.warehouseB).toLocaleString()}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">{item.category}</p>
                <p className="text-[11px] text-gray-500 mt-2">Oton {item.warehouseA.toLocaleString()} | Pototan {item.warehouseB.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Priority and Movement Overview</h3>
              <p className="text-sm text-gray-600">Quick operational summary for deciding where to release goods next.</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Incoming for Review', `${incomingForReview} deliveries need checking or final posting.`],
              ['Ready or Moving Out', `${activeReleases.length} releases are released, in transit, or need correction.`],
              ['Confirmed Receipts', `${gpsAcceptedCount} deliveries have LGU receipt and location confirmation.`],
              ['Urgent LGUs', `${urgentLGUs.length} municipalities are marked Red based on need and current food pack supply.`]
            ].map(([title, description]) => (
              <div key={title} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="font-bold text-sm text-gray-900">{title}</p>
                <p className="text-xs text-gray-600 mt-1">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Release Follow-up Queue</h3>
          <p className="text-sm text-gray-600 mb-4">Outgoing records that still need monitoring or staff action.</p>

          <div className="space-y-3">
            {activeReleases.length > 0 ? (
              activeReleases.slice(0, 4).map((release) => (
                <button
                  key={release.drNumber}
                  type="button"
                  onClick={() => onNavigate('outgoing')}
                  className="w-full text-left p-3 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 hover:border-orange-200 focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{release.drNumber} | {release.municipality}</p>
                      <p className="text-xs text-gray-600 mt-1">{release.fnfiCategory} | {release.amountApproved || release.amountRequested} units</p>
                    </div>
                    <span className="shrink-0 px-2 py-1 bg-white text-orange-700 border border-orange-200 rounded-full text-[11px] font-bold">
                      {release.deliveryStatus}
                    </span>
                  </div>
                  <p className="text-xs text-orange-700 font-semibold mt-2">Open outgoing release</p>
                </button>
              ))
            ) : (
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm font-bold text-green-900">No releases need follow-up</p>
                <p className="text-xs text-green-700 mt-1">All current releases are either accepted, distributed, or waiting for a new action.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">LGU Priority List</h3>
          <div className="space-y-3">
            {lguPriorityReports.map(report => (
              <div key={report.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="font-bold text-sm text-gray-900">{report.municipality}</p>
                  <p className="text-xs text-gray-600">Affected families: {report.affectedFamilies.toLocaleString()} | Food packs: {report.foodPacks}</p>
                  <p className="text-xs text-gray-500 mt-1">{report.recommendation}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold ${priorityClasses[report.priorityColor]}`}>{report.priorityColor}</span>
                  <p className="text-lg font-bold text-gray-900 mt-1">{report.urgencyScore}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Release Activity</h3>
          <div className="space-y-3">
            {outgoingReleasesList.slice(0, 5).map(release => (
              <div key={release.drNumber} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {release.receiverGps ? <MapPin className="w-5 h-5 text-green-600" /> : <TruckIcon className="w-5 h-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{release.drNumber}: {release.fnfiCategory}</p>
                  <p className="text-xs text-gray-600">{release.amountApproved || release.amountRequested} units | {release.municipality} | {release.deliveryStatus}</p>
                  <p className="text-xs text-gray-500 truncate">Release record: {release.handoverContractId || 'not signed yet'} | Receipt reference: {release.blockchainTxHash || '-'}</p>
                </div>
                {release.receiverGps && <CheckCircle className="w-5 h-5 text-green-600" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Geospatial Snapshot</h3>
            <p className="text-sm text-gray-600">Pinned handovers with GPS-confirmed receipt locations.</p>
          </div>
          <MapPin className="w-6 h-6 text-blue-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="relative bg-slate-50 rounded-xl p-6 border border-slate-200 h-56 overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 300 200">
                <path d="M 40 120 Q 90 60 150 90 T 270 120" stroke="#94a3b8" strokeWidth="2" fill="none" />
                <path d="M 20 150 L 70 150 L 70 190 L 20 190 Z" fill="#cbd5e1" opacity="0.6" />
                <path d="M 110 70 L 150 70 L 150 110 L 110 110 Z" fill="#cbd5e1" opacity="0.6" />
                <path d="M 200 110 L 240 110 L 240 150 L 200 150 Z" fill="#cbd5e1" opacity="0.6" />
                <text x="30" y="180" fontSize="8" fill="#64748b">Iloilo City</text>
                <text x="115" y="105" fontSize="8" fill="#64748b">Leon</text>
                <text x="205" y="140" fontSize="8" fill="#64748b">Miag-ao</text>
              </svg>
              <div className="absolute top-6 right-6 flex flex-col gap-2">
                {outgoingReleasesList.filter(release => release.receiverGps).slice(0, 3).map(release => (
                  <div key={release.drNumber} className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-semibold text-gray-700">{release.municipality}</span>
                  </div>
                ))}
                {outgoingReleasesList.filter(release => release.receiverGps).length === 0 && (
                  <div className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-gray-500">
                    No GPS-confirmed receipts yet
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-800">GPS-Confirmed Handover</p>
              <p className="text-2xl font-bold text-emerald-700 mt-2">{gpsAcceptedCount}</p>
              <p className="text-xs text-emerald-700 mt-1">Receipts with coordinates captured.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-700">Active Movements</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{activeReleases.length}</p>
              <p className="text-xs text-slate-600 mt-1">Releases still in motion or pending checks.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
