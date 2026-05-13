import { useState } from 'react';
import { Plus, Search, Calendar, Package, AlertTriangle, TruckIcon, X } from 'lucide-react';
import { AddIncomingGoodsModal } from './AddIncomingGoodsModal';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
  addStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => void;
  deductStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => boolean;
  getAvailableStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse') => number;
}

interface IncomingModuleProps {
  inventoryState: InventoryState;
}

interface IncomingGoods {
  id: string;
  dateReceived: string;
  fnfiCategory: string;
  quantity: number;
  unitType: string;
  expirationDate: string;
  source: string;
  destinationType: 'Warehouse' | 'LGU';
  destination: string;
  incidentCode: string;
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

export function IncomingModule({ inventoryState }: IncomingModuleProps) {
  const { addStock } = inventoryState;
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [incomingGoodsList, setIncomingGoodsList] = useState<IncomingGoods[]>([
    {
      id: 'INC-2026-001',
      dateReceived: '2026-05-10',
      fnfiCategory: 'Food/Non-Food',
      quantity: 1000,
      unitType: 'pcs',
      expirationDate: '2026-11-10',
      source: 'VDRC',
      destinationType: 'Warehouse',
      destination: 'Oton Main Warehouse',
      incidentCode: 'Good condition'
    },
    {
      id: 'INC-2026-002',
      dateReceived: '2026-05-11',
      fnfiCategory: 'Hygiene Kit',
      quantity: 500,
      unitType: 'pcs',
      expirationDate: '2027-05-11',
      source: 'Luzon Disaster Resource Center',
      destinationType: 'LGU',
      destination: 'Leon',
      incidentCode: ''
    },
    {
      id: 'INC-2026-003',
      dateReceived: '2026-05-12',
      fnfiCategory: 'Sleeping Kit',
      quantity: 300,
      unitType: 'sets',
      expirationDate: '2028-05-12',
      source: 'Others',
      destinationType: 'Warehouse',
      destination: 'Oton Main Warehouse',
      incidentCode: 'Emergency stock'
    },
    {
      id: 'INC-2026-004',
      dateReceived: '2026-05-09',
      fnfiCategory: 'Kitchen Kit',
      quantity: 200,
      unitType: 'sets',
      expirationDate: '2029-05-09',
      source: 'Others',
      destinationType: 'Warehouse',
      destination: 'Pototan Main Warehouse',
      incidentCode: ''
    }
  ]);

  const handleAddGoods = (newGoods: Omit<IncomingGoods, 'id'>) => {
    const newId = `INC-2026-${String(incomingGoodsList.length + 1).padStart(3, '0')}`;
    const goodsWithId: IncomingGoods = {
      ...newGoods,
      id: newId
    };
    setIncomingGoodsList([goodsWithId, ...incomingGoodsList]);

    // Add stock to inventory only if destination is a warehouse
    if (newGoods.destinationType === 'Warehouse' && (newGoods.destination === 'Oton Main Warehouse' || newGoods.destination === 'Pototan Main Warehouse')) {
      addStock(newGoods.fnfiCategory, newGoods.destination as 'Oton Main Warehouse' | 'Pototan Main Warehouse', newGoods.quantity);
    }

    setShowAddModal(false);
  };

  // Calculate near expiration items (within 30 days)
  const getNearExpirationItems = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    return incomingGoodsList.filter(item => {
      const expirationDate = new Date(item.expirationDate);
      return expirationDate <= thirtyDaysFromNow && expirationDate >= today;
    });
  };

  const filteredGoods = incomingGoodsList.filter(item => {
    const matchesSearch =
      item.fnfiCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.destination.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWarehouse = selectedWarehouse === 'All' || item.destination === selectedWarehouse;
    const matchesCategory = selectedCategory === 'All' || item.fnfiCategory === selectedCategory;

    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  const warehouseATotalQty = incomingGoodsList
    .filter(item => item.destination === 'Oton Main Warehouse')
    .reduce((sum, item) => sum + item.quantity, 0);

  const warehouseBTotalQty = incomingGoodsList
    .filter(item => item.destination === 'Pototan Main Warehouse')
    .reduce((sum, item) => sum + item.quantity, 0);

  const nearExpirationItems = getNearExpirationItems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incoming Module</h1>
          <p className="text-sm text-gray-600 mt-1">Warehouse Receiving & Inventory Addition</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add Incoming Goods
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Total Received</p>
              <p className="text-2xl font-bold text-gray-900">{incomingGoodsList.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Oton Main Warehouse</p>
              <p className="text-2xl font-bold text-green-600">{warehouseATotalQty.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Pototan Main Warehouse</p>
              <p className="text-2xl font-bold text-purple-600">{warehouseBTotalQty.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Near Expiration</p>
              <p className="text-2xl font-bold text-orange-600">{nearExpirationItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Near Expiration Alert */}
      {nearExpirationItems.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 text-sm">Near Expiration Alert</h3>
              <p className="text-sm text-orange-800 mt-1">
                {nearExpirationItems.length} item(s) will expire within 30 days
              </p>
              <div className="mt-2 space-y-1">
                {nearExpirationItems.map(item => (
                  <div key={item.id} className="text-xs text-orange-700 font-medium">
                    • {item.fnfiCategory} ({item.quantity} {item.unitType}) - Expires: {item.expirationDate}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by category, source, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option>All Warehouses</option>
            <option>Oton Main Warehouse</option>
            <option>Pototan Main Warehouse</option>
          </select>

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
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Date Received</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Quantity</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Unit</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Expiration</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Source</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Destination</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Incident Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGoods.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-blue-600">{item.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">{item.dateReceived}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      {item.fnfiCategory}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-900">{item.quantity.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">{item.unitType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-gray-900">{item.expirationDate}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">{item.source}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.destinationType === 'Warehouse'
                        ? item.destination === 'Oton Main Warehouse'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {item.destination}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{item.incidentCode || '-'}</span>
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

      {/* Add Incoming Goods Modal */}
      {showAddModal && (
        <AddIncomingGoodsModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddGoods}
        />
      )}
    </div>
  );
}
