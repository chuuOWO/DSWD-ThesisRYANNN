import { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ClipboardCheck, FileSignature, MapPin, Package, TrendingUp, TruckIcon } from 'lucide-react';
import type { DiscrepancyReport, IncomingGoods, InventoryItem, LGUPriorityReport, OutgoingRelease } from '../../hooks/useInventoryState';

interface DashboardState {
  inventory: InventoryItem[];
  incomingGoodsList: IncomingGoods[];
  outgoingReleasesList: OutgoingRelease[];
  lguPriorityReports: LGUPriorityReport[];
  discrepancyReports: DiscrepancyReport[];
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
  const { inventory, incomingGoodsList, outgoingReleasesList, lguPriorityReports, discrepancyReports } = inventoryState;
  const [showWarehouseOverview, setShowWarehouseOverview] = useState(false);
  const [lguProvinceFilter, setLguProvinceFilter] = useState<'All' | 'Iloilo' | 'Aklan' | 'Capiz' | 'Antique'>('All');

  const filteredPriorityReports = lguPriorityReports.filter(report => {
    if (lguProvinceFilter === 'All') return true;
    const prov = (report.province || '').toLowerCase();
    return prov === lguProvinceFilter.toLowerCase();
  });

  const totalInventory = inventory.reduce((sum, item) => sum + item.warehouseA + item.warehouseB, 0);
  const postedBatchCount = incomingGoodsList.filter(item => item.status === 'Verified' || item.status === 'Minted').length;
  const releaseRecordCount = outgoingReleasesList.filter(item => item.handoverContractId).length;
  const gpsAcceptedCount = outgoingReleasesList.filter(item => item.receiverGps).length;
  const urgentLGUs = lguPriorityReports.filter(report => report.priorityColor === 'Red');
  const activeReleases = outgoingReleasesList.filter(item => ['Released', 'In Transit', 'Correction Requested'].includes(item.deliveryStatus));
  const incomingForReview = incomingGoodsList.filter(item => item.status === 'Pending Verification').length;

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
                      <p className="text-xs text-gray-600 mt-1">{release.fnfiCategory} | {release.amountApproved || release.amountRequested} kits</p>
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
        {/* LGU Priority List with Province Filter */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-base font-bold text-gray-900">LGU Priority List</h3>
            
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {(['All', 'Iloilo', 'Aklan', 'Capiz', 'Antique'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLguProvinceFilter(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    lguProvinceFilter === p
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
            {filteredPriorityReports.map(report => (
              <div key={report.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-gray-900">{report.municipality}</p>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {report.province}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">Affected families: {report.affectedFamilies.toLocaleString()} | Food packs: {report.foodPacks}</p>
                  <p className="text-xs text-gray-500 mt-1">{report.recommendation}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold ${priorityClasses[report.priorityColor]}`}>{report.priorityColor}</span>
                  <p className="text-lg font-bold text-gray-900 mt-1">{report.urgencyScore}</p>
                </div>
              </div>
            ))}
            {filteredPriorityReports.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-500">
                No priority reports recorded for {lguProvinceFilter}.
              </div>
            )}
          </div>
        </div>

        {/* Recent Release Activity (Scrollable Container) */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Recent Release Activity</h3>
            <span className="text-xs font-semibold text-gray-500">
              {outgoingReleasesList.length} total releases
            </span>
          </div>
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
            {outgoingReleasesList.map(release => (
              <div key={release.drNumber} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-gray-50 transition">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {release.receiverGps ? <MapPin className="w-4 h-4 text-green-600" /> : <TruckIcon className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-gray-900">{release.drNumber}: {release.fnfiCategory}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{release.amountApproved || release.amountRequested} kits &bull; {release.municipality} &bull; <span className="font-semibold text-blue-700">{release.deliveryStatus}</span></p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">Ref: {release.handoverContractId || 'not signed'} | Tx: {release.blockchainTxHash ? `${release.blockchainTxHash.slice(0, 10)}...` : 'Pending'}</p>
                </div>
                {release.receiverGps && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" />}
              </div>
            ))}
            {outgoingReleasesList.length === 0 && (
              <div className="py-8 text-center text-xs text-gray-500">
                No recent releases found.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Discrepancy Reports</h3>
            <p className="text-sm text-gray-600">LGU-reported quantity mismatches and delivery issues.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
            {discrepancyReports.length} total
          </span>
        </div>

        {discrepancyReports.length > 0 ? (
          <div className="space-y-3">
            {discrepancyReports.slice(0, 5).map(report => (
              <div key={report.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {report.reportType} {report.reportType === 'Incoming' ? (report.manifestNumber || 'Unknown Manifest') : (report.drNumber || 'Unknown DR')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{report.note}</p>
                  <p className="text-[11px] text-gray-500 mt-2">Reported {report.reportedAt}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold ${report.reportType === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {report.reportType}
                  </span>
                  {report.reportedByRole && (
                    <p className="text-[11px] text-gray-500 mt-2">Role: {report.reportedByRole}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <p className="text-sm font-bold text-green-900">No discrepancy reports yet</p>
            <p className="text-xs text-green-700 mt-1">Reported mismatches will appear here once filed.</p>
          </div>
        )}
      </div>

    </div>
  );
}
