import { useMemo, useState } from 'react';
import { Package, TrendingDown, AlertTriangle, TrendingUp, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { LguRecord } from '../../services/backendApi';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
  incomingGoodsList: { fnfiCategory: string; expirationDate: string; quantity: number; status: string }[];
  outgoingReleasesList: { fnfiCategory: string; amountApproved: number; amountRequested: number; deliveryStatus: string; lguName?: string; municipality?: string }[];
  lguPriorityReports: { lguName: string; municipality?: string; foodPacks: number; hygieneKits: number; familyKits: number }[];
  lgusList?: LguRecord[];
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

export function InventoryMonitoring({ inventoryState }: InventoryMonitoringProps) {
  const { incomingGoodsList, inventory, lguPriorityReports, outgoingReleasesList, lgusList = [] } = inventoryState;
  const [selectedWarehouse, setSelectedWarehouse] = useState('All Specific Warehouses');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouseType, setSelectedWarehouseType] = useState('All');

  // Dynamic categories gathered from inventory, incoming, and outgoing releases without fallbacks
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => {
      if (i.category?.trim()) set.add(i.category.trim());
    });
    incomingGoodsList.forEach((i) => {
      if (i.fnfiCategory?.trim()) set.add(i.fnfiCategory.trim());
    });
    outgoingReleasesList.forEach((o) => {
      if (o.fnfiCategory?.trim()) set.add(o.fnfiCategory.trim());
    });
    lgusList.forEach((lgu) => {
      Object.keys(lgu.currentStock ?? {}).forEach((category) => {
        if (category.trim()) set.add(category.trim());
      });
    });
    return Array.from(set).sort();
  }, [inventory, incomingGoodsList, outgoingReleasesList, lgusList]);

  // Dynamically compute live LGU warehouse stock from accepted deliveries and LGU reports (no static mock zeros)
  const lguWarehouseData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();

    const cleanLguName = (name: string) => (
      name.split('(')[0].replace(/municipal.*|city.*|office.*|government.*|evacuation.*|hall.*|warehouse.*/i, '').trim() || name.trim()
    );

    const ensureLgu = (name: string, baseStock?: Record<string, number>) => {
      const trimmed = name.trim();
      if (!map.has(trimmed)) {
        const init: Record<string, number> = {};
        dynamicCategories.forEach((cat) => {
          init[cat] = 0;
        });
        Object.entries(baseStock ?? {}).forEach(([category, value]) => {
          init[category] = Number(value) || 0;
        });
        map.set(trimmed, init);
      }
      return map.get(trimmed)!;
    };

    // 0. Start with every LGU from the Supabase master directory, even with zero stock.
    lgusList.forEach((lgu) => {
      ensureLgu(cleanLguName(lgu.municipality || lgu.lguName), {
        'Food Pack': lgu.foodPacks || 0,
        'Hygiene Kit': lgu.hygieneKits || 0,
        'Sleeping Kit': lgu.sleepingKits || 0,
        'Kitchen Kit': lgu.kitchenKits || 0,
        'Family Kit': lgu.familyKits || 0,
        'Laminated Sack': lgu.laminatedSacks || 0,
        RTEF: lgu.rtef || 0,
        ...(lgu.currentStock ?? {})
      });
    });

    // 1. Accumulate accepted/delivered goods to each LGU from outgoing requests
    outgoingReleasesList.forEach((release) => {
      if (!['Delivered', 'Accepted'].includes(release.deliveryStatus)) return;
      const raw = release.municipality || release.lguName || 'General LGU';
      const lgu = cleanLguName(raw);
      const record = ensureLgu(lgu);
      const qty = release.amountApproved || release.amountRequested || 0;
      const cat = release.fnfiCategory;
      if (cat) {
        record[cat] = (record[cat] || 0) + qty;
      }
    });

    // 1b. Deduct outbound dispatches immediately from source LGU upon dispatch
    outgoingReleasesList.forEach((release) => {
      if (release.sourceType !== 'LGU' || release.deliveryStatus === 'Cancelled') return;
      const rawSource = release.warehouseSource;
      if (!rawSource) return;
      const sourceLgu = cleanLguName(rawSource);
      const record = ensureLgu(sourceLgu);
      const qty = release.amountApproved || release.amountRequested || 0;
      const cat = release.fnfiCategory;
      if (cat && qty > 0) {
        record[cat] = Math.max(0, (record[cat] || 0) - qty);
      }
    });

    // 2. Merge LGU reported inventory counts
    lguPriorityReports.forEach((report) => {
      const raw = report.municipality || report.lguName || 'Reported LGU';
      const lgu = cleanLguName(raw);
      const record = ensureLgu(lgu);
      if ('Food Pack' in record || dynamicCategories.includes('Food Pack')) record['Food Pack'] = Math.max(record['Food Pack'] || 0, report.foodPacks || 0);
      if ('Hygiene Kit' in record || dynamicCategories.includes('Hygiene Kit')) record['Hygiene Kit'] = Math.max(record['Hygiene Kit'] || 0, report.hygieneKits || 0);
      if ('Family Kit' in record || dynamicCategories.includes('Family Kit')) record['Family Kit'] = Math.max(record['Family Kit'] || 0, report.familyKits || 0);
    });

    return Array.from(map.entries()).map(([warehouse, stock]) => ({
      warehouse,
      ...stock
    }));
  }, [outgoingReleasesList, lguPriorityReports, lgusList, dynamicCategories]);


  const releaseStatuses = ['Approved', 'Packed', 'Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'];
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const displayData: InventoryItem[] = dynamicCategories.map(category => {
    const item = inventory.find(i => i.category?.toLowerCase() === category.toLowerCase()) || {
      category,
      warehouseA: 0,
      warehouseB: 0
    };
    const released = outgoingReleasesList
      .filter(release => (release.fnfiCategory || '').toLowerCase() === category.toLowerCase() && releaseStatuses.includes(release.deliveryStatus))
      .reduce((sum, release) => sum + (release.amountApproved || release.amountRequested || 0), 0);
    const expiringItems = incomingGoodsList
      .filter(incoming => (incoming.fnfiCategory || '').toLowerCase() === category.toLowerCase() && (incoming.status === 'Verified' || incoming.status === 'Minted'))
      .filter(incoming => {
        if (!incoming.expirationDate) return false;
        const expirationDate = new Date(incoming.expirationDate);
        return expirationDate <= thirtyDaysFromNow && expirationDate >= today;
      })
      .reduce((sum, incoming) => sum + (incoming.quantity || 0), 0);

    return {
      category,
      warehouseA: item.warehouseA || 0,
      warehouseB: item.warehouseB || 0,
      totalStock: (item.warehouseA || 0) + (item.warehouseB || 0),
      released,
      available: (item.warehouseA || 0) + (item.warehouseB || 0),
      expiringItems
    };
  });

  // Calculate LGU totals per category
  const lguTotals = dynamicCategories.reduce((acc, category) => {
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
    grandTotal: item.totalStock + (lguTotals[item.category] || 0),
    selectedWarehouseStock: (() => {
      if (selectedWarehouse === 'All' || selectedWarehouse === 'All Specific Warehouses') return null;
      if (selectedWarehouse === 'Oton Main Warehouse') return item.warehouseA;
      if (selectedWarehouse === 'Pototan Main Warehouse') return item.warehouseB;
      const lguRecord = lguWarehouseData.find((lgu) => lgu.warehouse === selectedWarehouse);
      const value = lguRecord ? (lguRecord as Record<string, number | string>)[item.category] : 0;
      return typeof value === 'number' ? value : 0;
    })()
  }));

  const filteredData = combinedData.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    if (!matchesCategory) return false;

    if (selectedWarehouse === 'All' || selectedWarehouse === 'All Specific Warehouses') return true;
    if (selectedWarehouse === 'Oton Main Warehouse') return item.warehouseA > 0 || selectedCategory !== 'All';
    if (selectedWarehouse === 'Pototan Main Warehouse') return item.warehouseB > 0 || selectedCategory !== 'All';

    const lguRecord = lguWarehouseData.find((lgu) => lgu.warehouse === selectedWarehouse);
    const value = lguRecord ? (lguRecord as Record<string, number | string>)[item.category] : 0;
    return Number(value) > 0 || selectedCategory !== 'All';
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const warehouseATotal = displayData.reduce((sum, item) => sum + item.warehouseA, 0);
  const warehouseBTotal = displayData.reduce((sum, item) => sum + item.warehouseB, 0);
  const totalMainWarehouse = warehouseATotal + warehouseBTotal;
  const totalLGUWarehouse = Object.values(lguTotals).reduce((sum, val) => sum + val, 0);
  const selectedSpecificTotal = combinedData.reduce((sum, item) => (
    sum + (typeof item.selectedWarehouseStock === 'number' ? item.selectedWarehouseStock : 0)
  ), 0);
  const totalAvailable = (selectedWarehouse !== 'All' && selectedWarehouse !== 'All Specific Warehouses') ? selectedSpecificTotal :
                         selectedWarehouseType === 'Main' ? totalMainWarehouse :
                         selectedWarehouseType === 'LGU' ? totalLGUWarehouse :
                         totalMainWarehouse + totalLGUWarehouse;
  const totalReleased = displayData.reduce((sum, item) => sum + item.released, 0);
  const totalExpiring = displayData.reduce((sum, item) => sum + item.expiringItems, 0);

  const chartData = dynamicCategories.map(category => {
    const inventoryItem = displayData.find(item => item.category?.toLowerCase() === category.toLowerCase());
    const lguTotal = lguWarehouseData.reduce((sum, lgu) => {
      const value = (lgu as Record<string, number | string>)[category];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    return {
      name: category,
      'Oton Main Warehouse': inventoryItem?.warehouseA || 0,
      'Pototan Main Warehouse': inventoryItem?.warehouseB || 0,
      'All LGUs': lguTotal
    };
  });

  // Low stock items (available < 500)
  const lowStockItems = displayData.filter(item => item.available < 500);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Live database inventory from minted incoming batches, approved outgoing releases, and LGU stock receipts</p>
        </div>
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
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Categories</option>
            {dynamicCategories.map(cat => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedWarehouseType}
            onChange={(e) => {
              setSelectedWarehouseType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option value="All">All Warehouses</option>
            <option value="Main">Main Warehouses Only</option>
            <option value="LGU">LGU Warehouses Only</option>
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Specific Warehouses</option>
            <option>Oton Main Warehouse</option>
            <option>Pototan Main Warehouse</option>
            <option disabled>-- LGU Warehouses --</option>
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
              <Bar dataKey="All LGUs" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Inventory Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Detailed Inventory</h3>
        </div>
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
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
              {paginatedData.map((item) => {
                const displayTotal = selectedWarehouseType === 'Main' ? item.totalStock :
                                    selectedWarehouseType === 'LGU' ? item.lguTotal :
                                    item.grandTotal;
                const displayAvailable = typeof item.selectedWarehouseStock === 'number'
                  ? item.selectedWarehouseStock
                  : selectedWarehouseType === 'LGU'
                  ? item.lguTotal
                  : item.available;
                const stockPercentage = displayTotal > 0 ? Math.round((displayAvailable / displayTotal) * 100) : 0;
                const isLowStock = displayAvailable < 500;

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
                        {displayAvailable.toLocaleString()}
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

        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No inventory records found</p>
          </div>
        ) : (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing{' '}
              <span className="font-bold text-gray-900">
                {filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(currentPage * pageSize, filteredData.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredData.length}</span> categories
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
    </div>
  );
}
