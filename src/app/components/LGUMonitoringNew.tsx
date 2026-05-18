import { useState } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle, Clock, Plus, Edit } from 'lucide-react';
import { AddLGUModal } from './AddLGUModal';
import { EditLGUModal, LGUDelivery } from './EditLGUModal';
import type { LGUPriorityReport } from '../hooks/useInventoryState';

interface RecentActivity {
  id: string;
  lguName: string;
  municipality: string;
  fnfiCategory: string;
  quantity: number;
  date: string;
  status: string;
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

interface LGUMonitoringNewProps {
  inventoryState?: {
    lguPriorityReports: LGUPriorityReport[];
  };
}

export function LGUMonitoringNew({ inventoryState }: LGUMonitoringNewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseType, setSelectedWarehouseType] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLGU, setSelectedLGU] = useState<LGUDelivery | null>(null);
  const [lguDataList, setLguDataList] = useState<LGUDelivery[]>([
    {
      id: 'MAIN-001',
      lguName: 'Oton Main Warehouse',
      municipality: 'Oton',
      province: 'Iloilo',
      totalItemsReleased: 5000,
      deliveryCount: 15,
      completedDeliveries: 12,
      pendingDeliveries: 3,
      lastDeliveryDate: '2026-05-13',
      currentStock: {
        'Hygiene Kit': 800,
        'Food Pack': 1500,
        'Sleeping Kit': 400,
        'Kitchen Kit': 300,
        'Family Kit': 600,
        'Laminated Sack': 2000,
        'RTEF': 250
      }
    },
    {
      id: 'MAIN-002',
      lguName: 'Pototan Main Warehouse',
      municipality: 'Pototan',
      province: 'Iloilo',
      totalItemsReleased: 4200,
      deliveryCount: 12,
      completedDeliveries: 10,
      pendingDeliveries: 2,
      lastDeliveryDate: '2026-05-13',
      currentStock: {
        'Hygiene Kit': 500,
        'Food Pack': 1200,
        'Sleeping Kit': 300,
        'Kitchen Kit': 200,
        'Family Kit': 400,
        'Laminated Sack': 1500,
        'RTEF': 150
      }
    },
    {
      id: 'LGU-001',
      lguName: 'Leon Municipal Office',
      municipality: 'Leon',
      province: 'Iloilo',
      totalItemsReleased: 1500,
      deliveryCount: 5,
      completedDeliveries: 4,
      pendingDeliveries: 1,
      lastDeliveryDate: '2026-05-12',
      currentStock: {
        'Hygiene Kit': 250,
        'Food Pack': 350,
        'Sleeping Kit': 100,
        'Kitchen Kit': 75,
        'Family Kit': 150,
        'Laminated Sack': 200,
        'RTEF': 50
      }
    },
    {
      id: 'LGU-002',
      lguName: 'Miag-ao Municipal Office',
      municipality: 'Miag-ao',
      province: 'Iloilo',
      totalItemsReleased: 1200,
      deliveryCount: 4,
      completedDeliveries: 3,
      pendingDeliveries: 1,
      lastDeliveryDate: '2026-05-11',
      currentStock: {
        'Hygiene Kit': 180,
        'Food Pack': 220,
        'Sleeping Kit': 80,
        'Kitchen Kit': 60,
        'Family Kit': 120,
        'Laminated Sack': 150,
        'RTEF': 40
      }
    },
    {
      id: 'LGU-003',
      lguName: 'Banate Municipal Office',
      municipality: 'Banate',
      province: 'Iloilo',
      totalItemsReleased: 800,
      deliveryCount: 3,
      completedDeliveries: 2,
      pendingDeliveries: 1,
      lastDeliveryDate: '2026-05-10',
      currentStock: {
        'Hygiene Kit': 120,
        'Food Pack': 180,
        'Sleeping Kit': 50,
        'Kitchen Kit': 40,
        'Family Kit': 90,
        'Laminated Sack': 100,
        'RTEF': 25
      }
    },
    {
      id: 'LGU-004',
      lguName: 'Guinhol Municipal Office',
      municipality: 'Guinhol',
      province: 'Iloilo',
      totalItemsReleased: 600,
      deliveryCount: 2,
      completedDeliveries: 1,
      pendingDeliveries: 1,
      lastDeliveryDate: '2026-05-09',
      currentStock: {
        'Hygiene Kit': 90,
        'Food Pack': 130,
        'Sleeping Kit': 40,
        'Kitchen Kit': 30,
        'Family Kit': 70,
        'Laminated Sack': 80,
        'RTEF': 20
      }
    },
    {
      id: 'LGU-005',
      lguName: 'Iloilo City Government',
      municipality: 'Iloilo City',
      province: 'Iloilo',
      totalItemsReleased: 3500,
      deliveryCount: 8,
      completedDeliveries: 8,
      pendingDeliveries: 0,
      lastDeliveryDate: '2026-05-12',
      currentStock: {
        'Hygiene Kit': 500,
        'Food Pack': 700,
        'Sleeping Kit': 250,
        'Kitchen Kit': 180,
        'Family Kit': 350,
        'Laminated Sack': 400,
        'RTEF': 120
      }
    }
  ]);

  const handleAddLGU = (newLGU: Omit<LGUDelivery, 'id'>) => {
    const newId = `LGU-${String(lguDataList.length + 1).padStart(3, '0')}`;
    const lguWithId: LGUDelivery = {
      ...newLGU,
      id: newId
    };
    setLguDataList([...lguDataList, lguWithId]);
    setShowAddModal(false);
  };

  const handleEditLGU = (updatedLGU: LGUDelivery) => {
    setLguDataList(lguDataList.map(lgu =>
      lgu.id === updatedLGU.id ? updatedLGU : lgu
    ));
    setShowEditModal(false);
    setSelectedLGU(null);
  };

  const openEditModal = (lgu: LGUDelivery) => {
    setSelectedLGU(lgu);
    setShowEditModal(true);
  };

  // Recent activity log
  const recentActivity: RecentActivity[] = [
    {
      id: 'OUT-2026-001',
      lguName: 'Leon Municipal Office',
      municipality: 'Leon',
      fnfiCategory: 'Food Pack',
      quantity: 500,
      date: '2026-05-12',
      status: 'Delivered'
    },
    {
      id: 'OUT-2026-002',
      lguName: 'Miag-ao Municipal Office',
      municipality: 'Miag-ao',
      fnfiCategory: 'Hygiene Kit',
      quantity: 300,
      date: '2026-05-12',
      status: 'In Transit'
    },
    {
      id: 'OUT-2026-003',
      lguName: 'Banate Municipal Office',
      municipality: 'Banate',
      fnfiCategory: 'Sleeping Kit',
      quantity: 200,
      date: '2026-05-11',
      status: 'Released'
    },
    {
      id: 'OUT-2026-004',
      lguName: 'Iloilo City Government',
      municipality: 'Iloilo City',
      fnfiCategory: 'Family Kit',
      quantity: 1000,
      date: '2026-05-10',
      status: 'Delivered'
    }
  ];

  const filteredLGUs = lguDataList.filter(lgu => {
    const matchesSearch = lgu.lguName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          lgu.municipality.toLowerCase().includes(searchTerm.toLowerCase());

    const isMainWarehouse = lgu.lguName.includes('Main Warehouse');
    const matchesType = selectedWarehouseType === 'All' ||
                       (selectedWarehouseType === 'Main' && isMainWarehouse) ||
                       (selectedWarehouseType === 'LGU' && !isMainWarehouse);

    const matchesCategory = selectedCategory === 'All' ||
                           (lgu.currentStock && (lgu.currentStock[selectedCategory as keyof typeof lgu.currentStock] || 0) > 0);

    return matchesSearch && matchesType && matchesCategory;
  });

  const priorityReports = inventoryState?.lguPriorityReports || [];
  const totalLGUs = lguDataList.length;
  const totalItemsReleased = lguDataList.reduce((sum, lgu) => sum + lgu.totalItemsReleased, 0);
  const totalDeliveries = lguDataList.reduce((sum, lgu) => sum + lgu.deliveryCount, 0);
  const totalCompleted = lguDataList.reduce((sum, lgu) => sum + lgu.completedDeliveries, 0);
  const overallCompletionRate = Math.round((totalCompleted / totalDeliveries) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LGU Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Track FNFI distribution to Local Government Units</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add New LGU
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalLGUs}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total LGUs Served</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalItemsReleased.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Items Released</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalCompleted}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Completed Deliveries</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{overallCompletionRate}%</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Completion Rate</p>
        </div>
      </div>



      {priorityReports.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Stock-Based Prioritization Logic</h3>
              <p className="text-sm text-gray-600">Red/Yellow/Green indicators are computed from LGU stock, affected families, and damage severity.</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold text-gray-600 border-b border-dashed border-gray-400"
                title="Urgency score = stock score + demand score + damage score"
              >
                Score formula
              </span>
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">Immediate restocking: {priorityReports.filter(report => report.priorityColor === 'Red').length}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {priorityReports.slice(0, 3).map(report => (
              <div key={report.id} className={`rounded-lg border p-4 ${
                report.priorityColor === 'Red' ? 'bg-red-50 border-red-200' :
                report.priorityColor === 'Yellow' ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-gray-900">{report.municipality}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    report.priorityColor === 'Red' ? 'bg-red-100 text-red-700' :
                    report.priorityColor === 'Yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-700'
                  }`}>{report.priorityColor}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{report.urgencyScore}</p>
                <p className="text-xs text-gray-600 mt-1">Food packs: {report.foodPacks} • Affected families: {report.affectedFamilies}</p>
                <p className="text-xs text-gray-700 mt-2">{report.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by LGU name or municipality..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

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
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            <option value="All">All Categories</option>
            {FNFI_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LGU Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLGUs.map((lgu, index) => {
          const completionRate = lgu.deliveryCount > 0
            ? Math.round((lgu.completedDeliveries / lgu.deliveryCount) * 100)
            : 0;

          return (
            <div key={lgu.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gray-900">{lgu.lguName}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{lgu.municipality}, {lgu.province}</p>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(lgu)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title="Edit LGU"
                >
                  <Edit className="w-4 h-4 text-gray-600" />
                </button>
              </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">Total Items Released</span>
                <span className="text-lg font-bold text-blue-600">{lgu.totalItemsReleased.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">Total Deliveries</span>
                <span className="text-sm font-bold text-gray-900">{lgu.deliveryCount}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">Completed</span>
                <span className="text-sm font-bold text-green-600">{lgu.completedDeliveries}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">Pending</span>
                <span className="text-sm font-bold text-orange-600">{lgu.pendingDeliveries}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">Current Stock</span>
                <span className="text-sm font-bold text-purple-600">
                  {lgu.currentStock ? Object.values(lgu.currentStock).reduce((sum, val) => sum + val, 0).toLocaleString() : 0} units
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-700">Completion Rate</span>
                  <span className={`text-sm font-bold ${
                    completionRate === 100 ? 'text-green-600' :
                    completionRate >= 70 ? 'text-blue-600' :
                    'text-orange-600'
                  }`}>
                    {completionRate}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      completionRate === 100 ? 'bg-green-500' :
                      completionRate >= 70 ? 'bg-blue-500' :
                      'bg-orange-500'
                    }`}
                    style={{ width: `${completionRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs text-gray-500">Last delivery: {lgu.lastDeliveryDate || 'N/A'}</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Recent Activity Log */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Recent Outgoing Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activity.status === 'Delivered' ? 'bg-green-100' :
                    activity.status === 'In Transit' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    {activity.status === 'Delivered' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {activity.status === 'In Transit' && <TrendingUp className="w-5 h-5 text-yellow-600" />}
                    {activity.status === 'Released' && <Clock className="w-5 h-5 text-blue-600" />}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{activity.lguName}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">{activity.municipality}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{activity.date}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                      {activity.fnfiCategory}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{activity.quantity.toLocaleString()} units</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      activity.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                      activity.status === 'In Transit' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">LGU Summary Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">LGU Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Municipality</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Items Released</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Deliveries</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Completed</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Last Delivery</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLGUs.map((lgu, index) => {
                const completionRate = lgu.deliveryCount > 0
                  ? Math.round((lgu.completedDeliveries / lgu.deliveryCount) * 100)
                  : 0;

                return (
                  <tr key={lgu.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-gray-900">{lgu.lguName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">{lgu.municipality}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-blue-600">{lgu.totalItemsReleased.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-gray-900">{lgu.deliveryCount}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-green-600">{lgu.completedDeliveries}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-orange-600">{lgu.pendingDeliveries}</span>
                  </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-gray-700">{lgu.lastDeliveryDate || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              completionRate === 100 ? 'bg-green-500' :
                              completionRate >= 70 ? 'bg-blue-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-12 text-right">
                          {completionRate}%
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

      {/* Add LGU Modal */}
      {showAddModal && (
        <AddLGUModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddLGU}
        />
      )}

      {/* Edit LGU Modal */}
      {showEditModal && selectedLGU && (
        <EditLGUModal
          lgu={selectedLGU}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLGU(null);
          }}
          onSubmit={handleEditLGU}
        />
      )}
    </div>
  );
}
