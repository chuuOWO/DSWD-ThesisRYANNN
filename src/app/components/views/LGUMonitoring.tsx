import { useMemo, useState } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle, Clock, Plus, Edit, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import type { LGUPriorityReport, UserRole, OutgoingRelease } from '../../hooks/useInventoryState';
import { AddLGUModal, type LGUForm } from '../modals/AddLGUModal';
import { EditLGUModal } from '../modals/EditLGUModal';
import type { LguRecord, LguInput, ProvinceRecord, KitTypeRecord } from '../../services/backendApi';

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
    provincesList?: ProvinceRecord[];
    kitTypesList?: KitTypeRecord[];
    addLgu?: (input: LguInput) => Promise<{ ok: boolean; message: string }>;
    editLgu?: (id: string, updates: Partial<LguInput>) => Promise<{ ok: boolean; message: string }>;
  };
  currentRole?: UserRole;
}

export function LGUMonitoring({ inventoryState, currentRole: _currentRole }: LGUMonitoringProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvinceTab, setSelectedProvinceTab] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLGU, setSelectedLGU] = useState<LGUDelivery | null>(null);

  // Dynamically compute live LGU list exclusively from master Supabase lgus table
  const baseLguList = useMemo<LGUDelivery[]>(() => {
    const releases = inventoryState?.outgoingReleasesList ?? [];
    const reports = inventoryState?.lguPriorityReports ?? [];
    const masterLgus = inventoryState?.lgusList ?? [];

    const lguEntriesMap = new Map<string, LGUDelivery>();

    masterLgus.forEach((lgu) => {
      const muni = lgu.municipality || '';
      const muniLower = muni.toLowerCase();
      const lguReleases = releases.filter((r) => {
        const target = (r?.lguName || '').toLowerCase();
        const m = (r?.municipality || '').toLowerCase();
        return (r?.lguId && r.lguId === lgu.id) || (muniLower && target.includes(muniLower)) || (muniLower && m === muniLower);
      });

      const report = reports.find((rpt) => (rpt?.municipality || '').toLowerCase() === muniLower);

      const totalReleased = lguReleases.reduce((sum, r) => sum + (r.amountApproved || r.amountRequested || 0), 0);
      const deliveryCount = lguReleases.length;
      const completed = lguReleases.filter((r) => ['Delivered', 'Accepted'].includes(r.deliveryStatus)).length;
      const pending = lguReleases.filter((r) => ['Allocating', 'Approved', 'Packed', 'Released', 'In Transit'].includes(r.deliveryStatus)).length;
      const lastDate = lguReleases[0]?.dateAllocated || (report ? report.reportedAt?.slice(0, 10) : 'N/A');

      const stock: NonNullable<LGUDelivery['currentStock']> = {
        ...EMPTY_STOCK,
        ...(lgu.currentStock || {})
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
        latitude: lgu.latitude,
        longitude: lgu.longitude,
        currentStock: stock
      });
    });

    return Array.from(lguEntriesMap.values());
  }, [inventoryState?.outgoingReleasesList, inventoryState?.lguPriorityReports, inventoryState?.lgusList]);

  // Province list with counts
  const provinceOptions = useMemo(() => {
    if (inventoryState?.provincesList && inventoryState.provincesList.length > 0) {
      return inventoryState.provincesList.map(p => p.name).sort();
    }
    const set = new Set<string>();
    baseLguList.forEach(l => {
      if (l.province) set.add(l.province);
    });
    return Array.from(set).sort();
  }, [inventoryState?.provincesList, baseLguList]);

  const categoryOptions = useMemo(() => {
    if (inventoryState?.kitTypesList && inventoryState.kitTypesList.length > 0) {
      return inventoryState.kitTypesList.map(k => k.name);
    }
    return FNFI_CATEGORIES;
  }, [inventoryState?.kitTypesList]);

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

  const filteredLGUs = useMemo(() => {
    return baseLguList.filter(lgu => {
      const q = (searchTerm || '').toLowerCase();
      const matchesSearch = (lgu?.lguName || '').toLowerCase().includes(q) ||
                            (lgu?.municipality || '').toLowerCase().includes(q);

      const matchesProvince = selectedProvinceTab === 'All' ||
                             (lgu?.province || '').toLowerCase() === (selectedProvinceTab || '').toLowerCase();

      const matchesCategory = selectedCategory === 'All' ||
                             (lgu?.currentStock && (lgu.currentStock[selectedCategory as keyof typeof lgu.currentStock] || 0) > 0);

      return matchesSearch && matchesProvince && matchesCategory;
    });
  }, [baseLguList, searchTerm, selectedProvinceTab, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredLGUs.length / pageSize));
  const paginatedLGUs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLGUs.slice(start, start + pageSize);
  }, [filteredLGUs, currentPage, pageSize]);

  const totalLGUs = baseLguList.length;
  const totalItemsReleased = baseLguList.reduce((sum, lgu) => sum + lgu.totalItemsReleased, 0);
  const totalDeliveries = baseLguList.reduce((sum, lgu) => sum + lgu.deliveryCount, 0);
  const totalCompleted = baseLguList.reduce((sum, lgu) => sum + lgu.completedDeliveries, 0);
  const overallCompletionRate = totalDeliveries > 0 ? Math.round((totalCompleted / totalDeliveries) * 100) : 0;

  const dynamicPriorities = useMemo(() => {
    if (priorityReports.length > 0) return priorityReports.slice(0, 5);

    return baseLguList
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
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 5);
  }, [priorityReports, baseLguList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LGU Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Track FNFI distribution and live stock levels across Panay LGUs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">{totalLGUs}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total LGUs Monitored</p>
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

      {/* Stock-Based Prioritization Logic (Limited to 5, Scrollable if needed) */}
      {dynamicPriorities.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">High-Priority LGU Restocking Watch</h3>
              <p className="text-sm text-gray-600">Top 5 urgent LGUs requiring relief attention based on low stock and pending requests.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                Immediate Restocking: {dynamicPriorities.filter((report) => report.priorityColor === 'Red').length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {dynamicPriorities.map((report) => (
              <div
                key={report.id}
                className={`rounded-lg border p-3 flex flex-col justify-between ${
                  report.priorityColor === 'Red' ? 'bg-red-50/70 border-red-200' :
                  report.priorityColor === 'Yellow' ? 'bg-yellow-50/70 border-yellow-200' :
                  'bg-green-50/70 border-green-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-gray-900 truncate" title={report.municipality}>
                      {report.municipality}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      report.priorityColor === 'Red' ? 'bg-red-100 text-red-700' :
                      report.priorityColor === 'Yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {report.priorityColor}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 mt-1">{report.urgencyScore}</p>
                  <p className="text-[11px] text-gray-600 mt-1">Food packs: {report.foodPacks}</p>
                </div>
                <p className="text-[11px] text-gray-700 mt-2 font-medium truncate" title={report.recommendation}>
                  {report.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Province Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setSelectedProvinceTab('All');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            selectedProvinceTab === 'All'
              ? 'bg-[#2500ba] text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          All LGUs
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            selectedProvinceTab === 'All' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
          }`}>
            {baseLguList.length}
          </span>
        </button>

        {provinceOptions.map(prov => {
          const provLower = (prov || '').toLowerCase();
          const isSelected = (selectedProvinceTab || '').toLowerCase() === provLower;
          const count = baseLguList.filter(l => (l?.province || '').toLowerCase() === provLower).length;
          return (
            <button
              key={prov}
              type="button"
              onClick={() => {
                setSelectedProvinceTab(prov);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#2500ba] text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {prov}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, Category Filter, and View Mode Toggle */}
      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search municipality or facility..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 self-end md:self-center">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Card View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content: Cards View or Table View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLGUs.map((lgu) => (
            <div key={lgu.id} className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gray-900 truncate" title={lgu.lguName}>{lgu.lguName}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{lgu.municipality}, {lgu.province}</p>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(lgu)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                  title="Edit LGU"
                >
                  <Edit className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Total Items Released</span>
                  <span className="font-bold text-blue-600 text-sm">{lgu.totalItemsReleased.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-600">Deliveries</span>
                  <span className="font-bold text-gray-900">{lgu.deliveryCount} total</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-[11px]">
                  <div className="flex justify-between items-center bg-green-50 px-2 py-1 rounded">
                    <span className="text-green-700">Completed</span>
                    <span className="font-bold text-green-800">{lgu.completedDeliveries}</span>
                  </div>
                  <div className="flex justify-between items-center bg-orange-50 px-2 py-1 rounded">
                    <span className="text-orange-700">Pending</span>
                    <span className="font-bold text-orange-800">{lgu.pendingDeliveries}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-semibold text-gray-600">Current Stock</span>
                  <span className="font-bold text-purple-600">
                    {lgu.currentStock ? Object.values(lgu.currentStock).reduce((sum, val) => sum + val, 0).toLocaleString() : 0} kits
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-100 space-y-1 text-[11px] text-gray-500">
                  <div className="flex justify-between">
                    <span>Last delivery:</span>
                    <span className="font-medium text-gray-700">{lgu.lastDeliveryDate || 'N/A'}</span>
                  </div>
                  {(lgu.contactPerson || lgu.contactNumber) && (
                    <div className="flex justify-between">
                      <span className="truncate max-w-[140px]">Contact: {lgu.contactPerson || 'Office'}</span>
                      <span className="font-mono">{lgu.contactNumber || ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Municipality</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Province</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Facility</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Released</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Deliveries</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Stock</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLGUs.map((lgu) => (
                  <tr key={lgu.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-sm text-gray-900">{lgu.municipality}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {lgu.province}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs" title={lgu.lguName}>
                      {lgu.lguName}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-sm text-blue-600">
                      {lgu.totalItemsReleased.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center text-xs">
                      <span className="text-green-700 font-bold">{lgu.completedDeliveries}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-700">{lgu.deliveryCount}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-sm text-purple-600">
                      {lgu.currentStock ? Object.values(lgu.currentStock).reduce((sum, val) => sum + val, 0).toLocaleString() : 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => openEditModal(lgu)}
                        className="p-1 hover:bg-gray-100 rounded text-blue-600 hover:text-blue-800 transition cursor-pointer"
                        title="Edit LGU"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredLGUs.length === 0 && (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
          <p className="text-gray-500 font-medium">No municipalities match your search or filter.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredLGUs.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">
            Showing <span className="font-bold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold">{Math.min(currentPage * pageSize, filteredLGUs.length)}</span> of{' '}
            <span className="font-bold">{filteredLGUs.length}</span> municipalities
          </p>

          <div className="flex items-center gap-2 self-center">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, idx, arr) => {
                  const prevPage = arr[idx - 1];
                  const hasGap = prevPage && page - prevPage > 1;

                  return (
                    <div key={page} className="flex items-center gap-1">
                      {hasGap && <span className="text-xs text-gray-400 px-1">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                          currentPage === page
                            ? 'bg-[#2500ba] text-white shadow-xs'
                            : 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
