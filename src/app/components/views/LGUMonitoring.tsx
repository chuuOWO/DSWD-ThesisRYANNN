import { useMemo, useState } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle, Clock, Plus, Edit } from 'lucide-react';
import type { LGUPriorityReport, UserRole, OutgoingRelease } from '../../hooks/useInventoryState';
import { PANAY_LGUS } from '../../data/panayLguDirectory';
import { AddLGUModal, type LGUForm } from '../modals/AddLGUModal';
import { EditLGUModal } from '../modals/EditLGUModal';
import type { LguRecord, LguInput } from '../../services/backendApi';

export interface LGUDelivery {
  id: string;
  lguName: string;
  municipality: string;
  province: string;
  totalItemsReleased: number;
  deliveryCount: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  lastDeliveryDate: string;
  contactPerson?: string;
  contactNumber?: string;
  remarks?: string;
  latitude?: number;
  longitude?: number;
  currentStock?: {
    'Hygiene Kit': number;
    'Food Pack': number;
    'Sleeping Kit': number;
    'Kitchen Kit': number;
    'Family Kit': number;
    'Laminated Sack': number;
    'RTEF': number;
  };
}

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

const EMPTY_STOCK: NonNullable<LGUDelivery['currentStock']> = {
  'Hygiene Kit': 0,
  'Food Pack': 0,
  'Sleeping Kit': 0,
  'Kitchen Kit': 0,
  'Family Kit': 0,
  'Laminated Sack': 0,
  'RTEF': 0
};

interface LGUMonitoringProps {
  inventoryState?: {
    inventory?: { category: string; warehouseA: number; warehouseB: number }[];
    outgoingReleasesList?: OutgoingRelease[];
    lguPriorityReports: LGUPriorityReport[];
    lgusList?: LguRecord[];
    addLgu?: (input: LguInput) => Promise<{ ok: boolean; message: string }>;
    editLgu?: (id: string, updates: Partial<LguInput>) => Promise<{ ok: boolean; message: string }>;
  };
  currentRole?: UserRole;
}

export function LGUMonitoring({ inventoryState, currentRole: _currentRole }: LGUMonitoringProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseType, setSelectedWarehouseType] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLGU, setSelectedLGU] = useState<LGUDelivery | null>(null);

  // Dynamically compute live LGU list from outgoing releases, reports, and Panay directory (Zero static mock data)
  const baseLguList = useMemo<LGUDelivery[]>(() => {
    const releases = inventoryState?.outgoingReleasesList ?? [];
    const reports = inventoryState?.lguPriorityReports ?? [];
    const mainInventory = inventoryState?.inventory ?? [];

    const warehouseAStock: NonNullable<LGUDelivery['currentStock']> = { ...EMPTY_STOCK };
    const warehouseBStock: NonNullable<LGUDelivery['currentStock']> = { ...EMPTY_STOCK };
    mainInventory.forEach((item) => {
      if (item.category in warehouseAStock) {
        (warehouseAStock as Record<string, number>)[item.category] = item.warehouseA || 0;
      }
      if (item.category in warehouseBStock) {
        (warehouseBStock as Record<string, number>)[item.category] = item.warehouseB || 0;
      }
    });

    const otonDeliveries = releases.filter((r) => (r.warehouseSource || '').toLowerCase().includes('oton'));
    const pototanDeliveries = releases.filter((r) => (r.warehouseSource || '').toLowerCase().includes('pototan'));

    // Main Warehouses
    const mainWarehouses: LGUDelivery[] = [
      {
        id: 'MAIN-OTON',
        lguName: 'Oton Main Warehouse',
        municipality: 'Oton',
        province: 'Iloilo',
        totalItemsReleased: otonDeliveries.reduce((sum, r) => sum + (r.amountApproved || r.amountRequested || 0), 0),
        deliveryCount: otonDeliveries.length,
        completedDeliveries: otonDeliveries.filter((r) => ['Delivered', 'Accepted'].includes(r.deliveryStatus)).length,
        pendingDeliveries: otonDeliveries.filter((r) => ['Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus)).length,
        lastDeliveryDate: otonDeliveries[0]?.dateAllocated || 'Active',
        currentStock: warehouseAStock
      },
      {
        id: 'MAIN-POTOTAN',
        lguName: 'Pototan Main Warehouse',
        municipality: 'Pototan',
        province: 'Iloilo',
        totalItemsReleased: pototanDeliveries.reduce((sum, r) => sum + (r.amountApproved || r.amountRequested || 0), 0),
        deliveryCount: pototanDeliveries.length,
        completedDeliveries: pototanDeliveries.filter((r) => ['Delivered', 'Accepted'].includes(r.deliveryStatus)).length,
        pendingDeliveries: pototanDeliveries.filter((r) => ['Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus)).length,
        lastDeliveryDate: pototanDeliveries[0]?.dateAllocated || 'Active',
        currentStock: warehouseBStock
      }
    ];

    // Compute Panay LGUs from master Supabase list, falling back to PANAY_LGUS directory
    const masterLgus = inventoryState?.lgusList ?? [];
    const candidateLgus: { id: string; municipality: string; province: string; lguName: string; contactPerson?: string; contactNumber?: string; remarks?: string; lat?: number; lng?: number }[] = [];

    if (masterLgus.length > 0) {
      masterLgus.forEach(l => {
        candidateLgus.push({
          id: l.id,
          municipality: l.municipality,
          province: l.province,
          lguName: l.lguName,
          contactPerson: l.contactPerson,
          contactNumber: l.contactNumber,
          remarks: l.remarks,
          lat: l.latitude,
          lng: l.longitude
        });
      });
    } else {
      PANAY_LGUS.forEach(l => {
        candidateLgus.push({
          id: `STATIC-${l.municipality.toUpperCase().replace(/\s+/g, '-')}`,
          municipality: l.municipality,
          province: l.province,
          lguName: l.defaultFacility,
          lat: l.lat,
          lng: l.lng
        });
      });
    }

    const lguEntriesMap = new Map<string, LGUDelivery>();

    candidateLgus.forEach((lgu) => {
      const muni = lgu.municipality;
      const lguReleases = releases.filter((r) => {
        const target = (r.lguName || '').toLowerCase();
        const m = (r.municipality || '').toLowerCase();
        return (r.lguId && r.lguId === lgu.id) || target.includes(muni.toLowerCase()) || m === muni.toLowerCase();
      });

      const report = reports.find((rpt) => rpt.municipality.toLowerCase() === muni.toLowerCase());

      const totalReleased = lguReleases.reduce((sum, r) => sum + (r.amountApproved || r.amountRequested || 0), 0);
      const deliveryCount = lguReleases.length;
      const completed = lguReleases.filter((r) => ['Delivered', 'Accepted'].includes(r.deliveryStatus)).length;
      const pending = lguReleases.filter((r) => ['Allocating', 'Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus)).length;
      const lastDate = lguReleases[0]?.dateAllocated || (report ? report.reportedAt?.slice(0, 10) : 'N/A');

      const matchedMaster = masterLgus.find(m => m.id === lgu.id);
      const stock: NonNullable<LGUDelivery['currentStock']> = {
        ...EMPTY_STOCK,
        ...(matchedMaster?.currentStock || {})
      };
      // Accumulate accepted relief packages
      lguReleases.forEach((r) => {
        if (['Delivered', 'Accepted'].includes(r.deliveryStatus) && r.fnfiCategory in stock) {
          (stock as Record<string, number>)[r.fnfiCategory] += (r.amountApproved || r.amountRequested || 0);
        }
      });
      // Override/augment from official LGU inventory reports
      if (report) {
        stock['Food Pack'] = Math.max(stock['Food Pack'], report.foodPacks || 0);
        stock['Hygiene Kit'] = Math.max(stock['Hygiene Kit'], report.hygieneKits || 0);
        stock['Family Kit'] = Math.max(stock['Family Kit'], report.familyKits || 0);
      }

      lguEntriesMap.set(lgu.id, {
        id: lgu.id,
        lguName: lgu.lguName || `${muni} Municipal Office`,
        municipality: muni,
        province: lgu.province,
        totalItemsReleased: totalReleased,
        deliveryCount,
        completedDeliveries: completed,
        pendingDeliveries: pending,
        lastDeliveryDate: lastDate,
        contactPerson: lgu.contactPerson,
        contactNumber: lgu.contactNumber,
        remarks: lgu.remarks,
        latitude: lgu.lat,
        longitude: lgu.lng,
        currentStock: stock
      });
    });

    return [...mainWarehouses, ...Array.from(lguEntriesMap.values())];
  }, [inventoryState?.outgoingReleasesList, inventoryState?.lguPriorityReports, inventoryState?.inventory, inventoryState?.lgusList]);

  const displayLGUList = baseLguList;

  const handleAddLGU = async (newLGU: LGUForm) => {
    if (inventoryState?.addLgu) {
      const res = await inventoryState.addLgu({
        municipality: newLGU.municipality,
        province: newLGU.province,
        lguName: newLGU.lguName,
        contactPerson: newLGU.contactPerson,
        contactNumber: newLGU.contactNumber,
        remarks: newLGU.remarks,
        latitude: newLGU.latitude,
        longitude: newLGU.longitude,
        initialStock: newLGU.currentStock
      });
      if (!res.ok) {
        throw new Error(res.message);
      }
    }
    setShowAddModal(false);
  };

  const handleEditLGU = async (updatedLGU: LGUDelivery) => {
    if (inventoryState?.editLgu) {
      const res = await inventoryState.editLgu(updatedLGU.id, {
        municipality: updatedLGU.municipality,
        province: updatedLGU.province,
        lguName: updatedLGU.lguName,
        contactPerson: updatedLGU.contactPerson,
        contactNumber: updatedLGU.contactNumber,
        remarks: updatedLGU.remarks,
        latitude: updatedLGU.latitude,
        longitude: updatedLGU.longitude,
        initialStock: updatedLGU.currentStock
      });
      if (!res.ok) {
        throw new Error(res.message);
      }
    }
    setShowEditModal(false);
    setSelectedLGU(null);
  };

  const openEditModal = (lgu: LGUDelivery) => {
    setSelectedLGU(lgu);
    setShowEditModal(true);
  };

  // Recent activity dynamically populated from live outgoing releases
  const recentActivity = useMemo<RecentActivity[]>(() => {
    const releases = inventoryState?.outgoingReleasesList ?? [];
    return releases.slice(0, 8).map((release, idx) => ({
      id: release.drNumber || `OUT-${idx + 1}`,
      lguName: release.lguName || `${release.municipality} LGU`,
      municipality: release.municipality || 'Panay',
      fnfiCategory: release.fnfiCategory,
      quantity: release.amountApproved || release.amountRequested || 0,
      date: release.dateAllocated || 'Recent',
      status: release.deliveryStatus
    }));
  }, [inventoryState?.outgoingReleasesList]);

  const priorityReports = inventoryState?.lguPriorityReports || [];

  const filteredLGUs = displayLGUList.filter(lgu => {
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

  const totalLGUs = displayLGUList.length;
  const totalItemsReleased = displayLGUList.reduce((sum, lgu) => sum + lgu.totalItemsReleased, 0);
  const totalDeliveries = displayLGUList.reduce((sum, lgu) => sum + lgu.deliveryCount, 0);
  const totalCompleted = displayLGUList.reduce((sum, lgu) => sum + lgu.completedDeliveries, 0);
  const overallCompletionRate = Math.round((totalCompleted / totalDeliveries) * 100);

  const dynamicPriorities = useMemo(() => {
    if (priorityReports.length > 0) return priorityReports;

    return displayLGUList
      .filter((lgu) => !lgu.lguName.includes('Main Warehouse'))
      .map((lgu) => {
        const foodStock = lgu.currentStock?.['Food Pack'] || 0;
        const totalStock = lgu.currentStock ? Object.values(lgu.currentStock).reduce((sum, v) => sum + v, 0) : 0;
        const pending = lgu.pendingDeliveries;
        const urgencyScore = Math.min(100, Math.max(15, Math.round(85 - (foodStock / 10) + (pending * 5))));
        const priorityColor = urgencyScore >= 70 ? 'Red' : urgencyScore >= 40 ? 'Yellow' : 'Green';
        return {
          id: `DYNAMIC-${lgu.municipality}`,
          municipality: lgu.municipality,
          province: lgu.province,
          lguName: lgu.lguName,
          reportedAt: lgu.lastDeliveryDate || 'Recent',
          foodPacks: foodStock,
          hygieneKits: lgu.currentStock?.['Hygiene Kit'] || 0,
          familyKits: lgu.currentStock?.['Family Kit'] || 0,
          affectedFamilies: Math.max(100, 350 - totalStock),
          damageIndex: urgencyScore,
          urgencyScore,
          priorityColor: priorityColor as 'Red' | 'Yellow' | 'Green',
          recommendation: priorityColor === 'Red'
            ? 'Immediate restocking and dispatch recommended.'
            : priorityColor === 'Yellow'
            ? 'Prepare allocation; monitor within 24 hours.'
            : 'Sufficient stock; continue monitoring.'
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [priorityReports, displayLGUList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LGU Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Track FNFI distribution and live stock levels across Panay LGUs</p>
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

      {/* Stock-Based Prioritization Logic */}
      {dynamicPriorities.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Stock-Based Prioritization Logic</h3>
              <p className="text-sm text-gray-600">Red/Yellow/Green indicators computed dynamically from Supabase LGU stock records, delivery status, and relief demand.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                Immediate restocking: {dynamicPriorities.filter((report) => report.priorityColor === 'Red').length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {dynamicPriorities.slice(0, 3).map((report) => (
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
                  {lgu.currentStock ? Object.values(lgu.currentStock).reduce((sum, val) => sum + val, 0).toLocaleString() : 0} kits
                </span>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Last delivery:</span>
                  <span className="font-medium text-gray-700">{lgu.lastDeliveryDate || 'N/A'}</span>
                </div>
                {(lgu.contactPerson || lgu.contactNumber) && (
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span className="truncate max-w-[140px]">Contact: {lgu.contactPerson || 'Office'}</span>
                    <span className="font-mono">{lgu.contactNumber || ''}</span>
                  </div>
                )}
                {lgu.remarks && (
                  <div className="text-[11px] text-gray-400 italic truncate" title={lgu.remarks}>
                    {lgu.remarks}
                  </div>
                )}
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
                    <span className="text-sm font-bold text-gray-900">{activity.quantity.toLocaleString()} kits</span>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLGUs.map((lgu) => (
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
                </tr>
              ))}
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
