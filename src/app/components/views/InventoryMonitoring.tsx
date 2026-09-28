import { useEffect, useMemo, useState } from 'react';
import { Package, TrendingDown, AlertTriangle, TrendingUp, RefreshCw, ShieldCheck, ExternalLink, CheckCircle2, Clock, X, MapPin, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { backendApi, type BatchRecord, type CustodyScanLog } from '../../services/backendApi';
import { blockchain } from '../../services/blockchain';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
  incomingGoodsList: { fnfiCategory: string; expirationDate: string; quantity: number; status: string }[];
  outgoingReleasesList: { fnfiCategory: string; amountApproved: number; amountRequested: number; deliveryStatus: string; lguName?: string; municipality?: string }[];
  lguPriorityReports: { lguName: string; municipality?: string; foodPacks: number; hygieneKits: number; familyKits: number }[];
  addStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => void;
  deductStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => boolean;
  getAvailableStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse') => number;
}

interface InventoryMonitoringProps {
  inventoryState: InventoryState;
}

interface InventoryItem {
  category: string;
  warehouseA: number;
  warehouseB: number;
  totalStock: number;
  released: number;
  available: number;
  expiringItems: number;
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

export function InventoryMonitoring({ inventoryState }: InventoryMonitoringProps) {
  const { incomingGoodsList, inventory, lguPriorityReports, outgoingReleasesList } = inventoryState;
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouseType, setSelectedWarehouseType] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [auditDrawerBatch, setAuditDrawerBatch] = useState<BatchRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<CustodyScanLog[]>([]);

  useEffect(() => {
    backendApi.getBatches().then(setBatches);
    const unsub = backendApi.subscribeDashboard(() => {
      backendApi.getBatches().then(setBatches);
    });
    return () => unsub();
  }, []);

  const handleOpenAuditDrawer = async (batch: BatchRecord) => {
    setAuditDrawerBatch(batch);
    const logs = await backendApi.getCustodyScanLogs(batch.batch_id);
    setAuditLogs(logs);
  };

  // Dynamically compute live LGU warehouse stock from accepted deliveries and LGU reports (no static mock zeros)
  const lguWarehouseData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();

    const ensureLgu = (name: string) => {
      const trimmed = name.trim();
      if (!map.has(trimmed)) {
        map.set(trimmed, {
          'Hygiene Kit': 0,
          'Food Pack': 0,
          'Sleeping Kit': 0,
          'Kitchen Kit': 0,
          'Family Kit': 0,
          'Laminated Sack': 0,
          'RTEF': 0
        });
      }
      return map.get(trimmed)!;
    };

    // 1. Accumulate accepted/delivered goods to each LGU from outgoing requests
    outgoingReleasesList.forEach((release) => {
      if (!['Delivered', 'Accepted'].includes(release.deliveryStatus)) return;
      const raw = release.municipality || release.lguName || 'General LGU';
      const lgu = raw.split('(')[0].replace(/municipal.*|city.*|office.*|government.*|evacuation.*|hall.*|warehouse.*/i, '').trim() || raw;
      const record = ensureLgu(lgu);
      const qty = release.amountApproved || release.amountRequested || 0;
      const cat = release.fnfiCategory;
      if (cat && cat in record) {
        record[cat] += qty;
      }
    });

    // 2. Merge LGU reported inventory counts
    lguPriorityReports.forEach((report) => {
      const raw = report.municipality || report.lguName || 'Reported LGU';
      const lgu = raw.split('(')[0].replace(/municipal.*|city.*|office.*|government.*|evacuation.*|hall.*|warehouse.*/i, '').trim() || raw;
      const record = ensureLgu(lgu);
      record['Food Pack'] = Math.max(record['Food Pack'], report.foodPacks || 0);
      record['Hygiene Kit'] = Math.max(record['Hygiene Kit'], report.hygieneKits || 0);
      record['Family Kit'] = Math.max(record['Family Kit'], report.familyKits || 0);
    });

    return Array.from(map.entries()).map(([warehouse, stock]) => ({
      warehouse,
      ...stock
    }));
  }, [outgoingReleasesList, lguPriorityReports]);


  const releaseStatuses = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'];
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const displayData: InventoryItem[] = inventory.map(item => {
    const released = outgoingReleasesList
      .filter(release => release.fnfiCategory === item.category && releaseStatuses.includes(release.deliveryStatus))
      .reduce((sum, release) => sum + (release.amountApproved || release.amountRequested), 0);
    const expiringItems = incomingGoodsList
      .filter(incoming => incoming.fnfiCategory === item.category && (incoming.status === 'Verified' || incoming.status === 'Minted'))
      .filter(incoming => {
        const expirationDate = new Date(incoming.expirationDate);
        return expirationDate <= thirtyDaysFromNow && expirationDate >= today;
      })
      .reduce((sum, incoming) => sum + incoming.quantity, 0);

    return {
      category: item.category,
      warehouseA: item.warehouseA,
      warehouseB: item.warehouseB,
      totalStock: item.warehouseA + item.warehouseB,
      released,
      available: item.warehouseA + item.warehouseB,
      expiringItems
    };
  });

  // Calculate LGU totals per category
  const lguTotals = FNFI_CATEGORIES.reduce((acc, category) => {
    const total = lguWarehouseData.reduce((sum, lgu) => {
      const val = (lgu as Record<string, any>)[category];
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
    acc[category] = total;
    return acc;
  }, {} as Record<string, number>);

  // Combine main warehouse and LGU data
  const combinedData = displayData.map(item => ({
    ...item,
    lguTotal: lguTotals[item.category] || 0,
    grandTotal: item.totalStock + (lguTotals[item.category] || 0)
  }));

  const filteredData = combinedData.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesCategory;
  });

  const warehouseATotal = inventory.reduce((sum, item) => sum + item.warehouseA, 0);
  const warehouseBTotal = inventory.reduce((sum, item) => sum + item.warehouseB, 0);
  const totalMainWarehouse = warehouseATotal + warehouseBTotal;
  const totalLGUWarehouse = Object.values(lguTotals).reduce((sum, val) => sum + val, 0);
  const totalAvailable = selectedWarehouseType === 'Main' ? totalMainWarehouse :
                         selectedWarehouseType === 'LGU' ? totalLGUWarehouse :
                         totalMainWarehouse + totalLGUWarehouse;
  const totalReleased = displayData.reduce((sum, item) => sum + item.released, 0);
  const totalExpiring = displayData.reduce((sum, item) => sum + item.expiringItems, 0);

  const chartData = FNFI_CATEGORIES.map(category => {
    const inventoryItem = inventory.find(item => item.category === category);
    return {
      name: category,
      'Oton Main Warehouse': inventoryItem?.warehouseA || 0,
      'Pototan Main Warehouse': inventoryItem?.warehouseB || 0
    };
  });

  // Low stock items (available < 500)
  const lowStockItems = displayData.filter(item => item.available < 500);

  const handleSyncDatabase = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1600);
  };

  return (
    <div className="space-y-6">
      {/* 5-Dot Loading Modal for Admin Sync */}
      <FiveDotsLoadingModal
        isOpen={isSyncing}
        title="Synchronizing Database Inventory"
        subtitle="Refreshing minted batches, outgoing transfers, and LGU receipts..."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Live database inventory from minted incoming batches, approved outgoing releases, and LGU stock receipts</p>
        </div>

        <button
          type="button"
          onClick={handleSyncDatabase}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync with Supabase
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalAvailable.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Available</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{warehouseATotal.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Oton Main Warehouse</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{warehouseBTotal.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Pototan Main Warehouse</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TrendingDown className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalReleased.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Released</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalExpiring.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Expiring Items</p>
        </div>
      </div>

      {/* Alerts */}
      {(lowStockItems.length > 0 || totalExpiring > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-yellow-900 text-sm">Low Stock Alert</h3>
                  <p className="text-sm text-yellow-800 mt-1">{lowStockItems.length} categories have low stock (below 500 kits)</p>
                  <div className="mt-3 space-y-2">
                    {lowStockItems.map(item => (
                      <div key={item.category} className="bg-white rounded p-2 border border-yellow-200">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-900">{item.category}</span>
                          <span className="text-sm font-bold text-yellow-700">{item.available} available</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expiration Alert */}
          {totalExpiring > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-900 text-sm">Expiration Warning</h3>
                  <p className="text-sm text-red-800 mt-1">{totalExpiring} items expiring within 30 days</p>
                  <div className="mt-3 space-y-2">
                    {displayData
                      .filter(item => item.expiringItems > 0)
                      .map(item => (
                        <div key={item.category} className="bg-white rounded p-2 border border-red-200">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-gray-900">{item.category}</span>
                            <span className="text-sm font-bold text-red-700">{item.expiringItems} expiring</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Categories</option>
            {FNFI_CATEGORIES.map(cat => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedWarehouseType}
            onChange={(e) => setSelectedWarehouseType(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option value="All">All Warehouses</option>
            <option value="Main">Main Warehouses Only</option>
            <option value="LGU">LGU Warehouses Only</option>
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Specific Warehouses</option>
            <option>Oton Main Warehouse</option>
            <option>Pototan Main Warehouse</option>
            {lguWarehouseData.map(lgu => (
              <option key={lgu.warehouse}>{lgu.warehouse}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Comparison Chart */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Warehouse Comparison</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
              <Bar dataKey="Oton Main Warehouse" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pototan Main Warehouse" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Inventory Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Detailed Inventory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">FNFI Category</th>
                {(selectedWarehouseType === 'All' || selectedWarehouseType === 'Main') && (
                  <>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Oton Main Warehouse</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Pototan Main Warehouse</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Main Total</th>
                  </>
                )}
                {(selectedWarehouseType === 'All' || selectedWarehouseType === 'LGU') && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">LGU Total</th>
                )}
                {selectedWarehouseType === 'All' && (
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Grand Total</th>
                )}
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Released</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Available</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Expiring</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => {
                const displayTotal = selectedWarehouseType === 'Main' ? item.totalStock :
                                    selectedWarehouseType === 'LGU' ? item.lguTotal :
                                    item.grandTotal;
                const stockPercentage = displayTotal > 0 ? Math.round((item.available / displayTotal) * 100) : 0;
                const isLowStock = item.available < 500;

                return (
                  <tr key={item.category} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-sm text-gray-900">{item.category}</span>
                    </td>
                    {(selectedWarehouseType === 'All' || selectedWarehouseType === 'Main') && (
                      <>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-green-600">{item.warehouseA.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-purple-600">{item.warehouseB.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-gray-900">{item.totalStock.toLocaleString()}</span>
                        </td>
                      </>
                    )}
                    {(selectedWarehouseType === 'All' || selectedWarehouseType === 'LGU') && (
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-indigo-600">{item.lguTotal.toLocaleString()}</span>
                      </td>
                    )}
                    {selectedWarehouseType === 'All' && (
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-blue-900">{item.grandTotal.toLocaleString()}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-orange-600">{item.released.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${isLowStock ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.available.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.expiringItems > 0 ? (
                        <span className="text-sm font-bold text-red-600">{item.expiringItems}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {isLowStock && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">
                            LOW
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          stockPercentage >= 70 ? 'bg-green-100 text-green-700' :
                          stockPercentage >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {stockPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Tokenization & Blockchain Custody Lifecycle Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2500ba]/10 flex items-center justify-center text-[#2500ba]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Batch Tokenization & Blockchain Custody Lifecycle</h3>
              <p className="text-xs text-gray-500">Live multi-party custodial audit trail on Ethereum Sepolia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#2500ba] font-bold border border-blue-100">
              {batches.length} Tracked Batches
            </span>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No tokenized batches registered yet</p>
            <p className="text-xs text-gray-500 mt-1">Batches are tokenized on-chain upon Outgoing Release manifest approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Manifest / Token ID</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Item Category</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Quantity</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Origin Hub</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">Custody State</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((batch) => {
                  const statusColors: Record<string, string> = {
                    PACKED: 'bg-blue-100 text-blue-800 border-blue-200',
                    IN_TRANSIT: 'bg-amber-100 text-amber-800 border-amber-200',
                    DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    ACCEPTED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    CANCELLED: 'bg-red-100 text-red-800 border-red-200'
                  };

                  return (
                    <tr key={batch.batch_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm text-gray-900">{batch.manifest_number}</div>
                        <div className="text-[11px] font-mono text-gray-500">ID: #{batch.batch_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-800">{batch.item_type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-gray-900">{batch.total_quantity.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600 font-medium">{batch.origin_warehouse}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[batch.status] || 'bg-gray-100 text-gray-700'}`}>
                          {batch.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenAuditDrawer(batch)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2500ba]/10 text-[#2500ba] hover:bg-[#2500ba] hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Inspect Audit Trail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Blockchain Custody Audit Trail Drawer / Modal */}
      {auditDrawerBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white h-full w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 bg-gradient-to-r from-gray-900 via-blue-950 to-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs uppercase tracking-wider font-bold text-blue-200">Cryptographic Ledger Verification</span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  Manifest {auditDrawerBatch.manifest_number}
                </h2>
                <div className="text-xs text-gray-300 font-mono">
                  Batch ID: #{auditDrawerBatch.batch_id} &middot; {auditDrawerBatch.item_type} ({auditDrawerBatch.total_quantity.toLocaleString()} units)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditDrawerBatch(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stepper container */}
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
                
                {/* Milestone 1: Minted */}
                <div className="relative group">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-600 border-4 border-white shadow-sm flex items-center justify-center text-white text-[10px]">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Milestone 1 &middot; Minted on Blockchain
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {auditDrawerBatch.created_at ? new Date(auditDrawerBatch.created_at).toLocaleString() : 'Timestamp Recorded'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-700">
                      Originating Warehouse: <span className="font-semibold text-gray-900">{auditDrawerBatch.origin_warehouse}</span>
                    </div>
                    <div className="text-xs text-gray-700">
                      Authorization: <span className="font-semibold text-gray-900">DSWD Warehouse Admin (MetaMask Web3 Signer)</span>
                    </div>
                    {auditDrawerBatch.tx_hash_mint ? (
                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-500 truncate max-w-[240px]">
                          Tx: {auditDrawerBatch.tx_hash_mint}
                        </span>
                        <a
                          href={blockchain.getExplorerUrl(auditDrawerBatch.tx_hash_mint)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#2500ba] hover:underline font-bold"
                        >
                          View on Etherscan
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic">Genesis mint verified on local ledger registry</div>
                    )}
                  </div>
                </div>

                {/* Milestone 2: Handed Over to Driver */}
                {(() => {
                  const driverLog = auditLogs.find(l => l.scan_type === 'DRIVER_PICKUP');
                  const isReleased = Boolean(auditDrawerBatch.tx_hash_release || driverLog || ['IN_TRANSIT', 'DELIVERED', 'ACCEPTED'].includes(auditDrawerBatch.status));
                  const releaseTx = auditDrawerBatch.tx_hash_release || driverLog?.tx_hash;
                  
                  return (
                    <div className="relative group">
                      <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-white text-[10px] ${isReleased ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                        {isReleased ? <CheckCircle2 className="w-3 h-3 text-white" /> : <Clock className="w-3 h-3 text-white" />}
                      </div>
                      <div className={`border rounded-xl p-4 space-y-2 ${isReleased ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-200/60 opacity-80'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isReleased ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                            Milestone 2 &middot; Handed Over to Driver
                          </span>
                          {driverLog?.created_at && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              {new Date(driverLog.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {isReleased ? (
                          <>
                            <div className="text-xs text-gray-700">
                              Custodial Operator: <span className="font-semibold text-gray-900">Truck Driver (Zero-MetaMask Relay)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                              <span>Cryptographic Digital Signature Broadcasted & Verified</span>
                            </div>
                            {(driverLog?.device_latitude && driverLog?.device_longitude) && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-mono">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span>Pickup GPS: {driverLog.device_latitude.toFixed(5)}, {driverLog.device_longitude.toFixed(5)}</span>
                              </div>
                            )}
                            {releaseTx && (
                              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                                <span className="font-mono text-gray-500 truncate max-w-[240px]">
                                  Tx: {releaseTx}
                                </span>
                                <a
                                  href={blockchain.getExplorerUrl(releaseTx)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#2500ba] hover:underline font-bold"
                                >
                                  View on Etherscan
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 py-1">
                            Pending Operational Handover &mdash; awaiting physical box QR scan by assigned truck driver.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Milestone 3: Confirmed by LGU Receiver */}
                {(() => {
                  const lguLog = auditLogs.find(l => l.scan_type === 'LGU_RECEIPT');
                  const isDelivered = Boolean(auditDrawerBatch.tx_hash_receipt || lguLog || ['DELIVERED', 'ACCEPTED'].includes(auditDrawerBatch.status));
                  const receiptTx = auditDrawerBatch.tx_hash_receipt || lguLog?.tx_hash;

                  return (
                    <div className="relative group">
                      <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm flex items-center justify-center text-white text-[10px] ${isDelivered ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                        {isDelivered ? <CheckCircle2 className="w-3 h-3 text-white" /> : <Clock className="w-3 h-3 text-white" />}
                      </div>
                      <div className={`border rounded-xl p-4 space-y-2 ${isDelivered ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-200/60 opacity-80'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${isDelivered ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                            Milestone 3 &middot; Confirmed by LGU Receiver
                          </span>
                          {lguLog?.created_at && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              {new Date(lguLog.created_at).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {isDelivered ? (
                          <>
                            <div className="text-xs text-gray-700">
                              Custodial Operator: <span className="font-semibold text-gray-900">LGU Receiving Officer (Zero-MetaMask Relay)</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                              <span>Immutable Receipt Registered on Ledger (Non-Repudiable Handover)</span>
                            </div>
                            {(lguLog?.device_latitude && lguLog?.device_longitude) && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 font-mono">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                <span>Receipt GPS: {lguLog.device_latitude.toFixed(5)}, {lguLog.device_longitude.toFixed(5)}</span>
                              </div>
                            )}
                            {receiptTx && (
                              <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                                <span className="font-mono text-gray-500 truncate max-w-[240px]">
                                  Tx: {receiptTx}
                                </span>
                                <a
                                  href={blockchain.getExplorerUrl(receiptTx)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[#2500ba] hover:underline font-bold"
                                >
                                  View on Etherscan
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 py-1">
                            Pending Operational Handover &mdash; awaiting destination arrival and receipt confirmation by LGU officer.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* QR Verification Info Footer */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-600 space-y-1">
                <div className="font-bold text-gray-800">Physical Cargo Box QR Integrity</div>
                <div className="font-mono text-[11px] text-gray-500 break-all">
                  Signature: {auditDrawerBatch.qr_signature}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setAuditDrawerBatch(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition"
              >
                Close Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
