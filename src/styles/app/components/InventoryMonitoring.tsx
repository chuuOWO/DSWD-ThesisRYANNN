import { useState } from 'react';
import { Package, TrendingDown, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
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
  const { inventory } = inventoryState;
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWarehouseType, setSelectedWarehouseType] = useState('All');

  // LGU Warehouse mock data
  const lguWarehouseData = [
    {
      warehouse: 'Leon Municipal Office',
      'Hygiene Kit': 250,
      'Food Pack': 350,
      'Sleeping Kit': 100,
      'Kitchen Kit': 75,
      'Family Kit': 150,
      'Laminated Sack': 200,
      'RTEF': 50
    },
    {
      warehouse: 'Miag-ao Municipal Office',
      'Hygiene Kit': 180,
      'Food Pack': 220,
      'Sleeping Kit': 80,
      'Kitchen Kit': 60,
      'Family Kit': 120,
      'Laminated Sack': 150,
      'RTEF': 40
    },
    {
      warehouse: 'Banate Municipal Office',
      'Hygiene Kit': 120,
      'Food Pack': 180,
      'Sleeping Kit': 50,
      'Kitchen Kit': 40,
      'Family Kit': 90,
      'Laminated Sack': 100,
      'RTEF': 25
    },
    {
      warehouse: 'Guinhol Municipal Office',
      'Hygiene Kit': 90,
      'Food Pack': 130,
      'Sleeping Kit': 40,
      'Kitchen Kit': 30,
      'Family Kit': 70,
      'Laminated Sack': 80,
      'RTEF': 20
    },
    {
      warehouse: 'Iloilo City Government',
      'Hygiene Kit': 500,
      'Food Pack': 700,
      'Sleeping Kit': 250,
      'Kitchen Kit': 180,
      'Family Kit': 350,
      'Laminated Sack': 400,
      'RTEF': 120
    }
  ];

  // Transform inventory data to include released and available
  const inventoryData: InventoryItem[] = inventory.map(item => ({
    category: item.category,
    warehouseA: item.warehouseA,
    warehouseB: item.warehouseB,
    totalStock: item.warehouseA + item.warehouseB,
    released: 0, // Will be calculated from outgoing releases
    available: item.warehouseA + item.warehouseB,
    expiringItems: 0 // Will be calculated from incoming goods with near expiration
  }));

  // Mock data for demo - replace with actual data later
  const mockInventoryData: InventoryItem[] = [
    {
      category: 'Food Pack',
      warehouseA: 1500,
      warehouseB: 1200,
      totalStock: 2700,
      released: 800,
      available: 1900,
      expiringItems: 150
    },
    {
      category: 'Hygiene Kit',
      warehouseA: 800,
      warehouseB: 500,
      totalStock: 1300,
      released: 300,
      available: 1000,
      expiringItems: 50
    },
    {
      category: 'Sleeping Kit',
      warehouseA: 400,
      warehouseB: 300,
      totalStock: 700,
      released: 200,
      available: 500,
      expiringItems: 0
    },
    {
      category: 'Kitchen Kit',
      warehouseA: 300,
      warehouseB: 200,
      totalStock: 500,
      released: 150,
      available: 350,
      expiringItems: 0
    },
    {
      category: 'Family Kit',
      warehouseA: 600,
      warehouseB: 400,
      totalStock: 1000,
      released: 300,
      available: 700,
      expiringItems: 30
    },
    {
      category: 'Laminated Sack',
      warehouseA: 2000,
      warehouseB: 1500,
      totalStock: 3500,
      released: 500,
      available: 3000,
      expiringItems: 0
    },
    {
      category: 'RTEF',
      warehouseA: 250,
      warehouseB: 150,
      totalStock: 400,
      released: 100,
      available: 300,
      expiringItems: 20
    }
  ];

  // Use mock data for now (TODO: replace with real calculated data)
  const displayData = mockInventoryData;

  // Calculate LGU totals per category
  const lguTotals = FNFI_CATEGORIES.reduce((acc, category) => {
    const total = lguWarehouseData.reduce((sum, lgu) => sum + (lgu[category as keyof typeof lgu] as number || 0), 0);
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
  const lowStockItems = inventory.filter(item => (item.warehouseA + item.warehouseB) < 500);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Monitoring</h1>
        <p className="text-sm text-gray-600 mt-1">Warehouse Stock Management & Tracking</p>
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
                  <p className="text-sm text-yellow-800 mt-1">{lowStockItems.length} categories have low stock (below 500 units)</p>
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
                    {inventoryData
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
                const stockPercentage = Math.round((item.available / displayTotal) * 100);
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
    </div>
  );
}
