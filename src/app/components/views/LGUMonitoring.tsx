import { useMemo, useState, useEffect } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle, Clock, Edit, ChevronLeft, ChevronRight, LayoutGrid, List, ShieldAlert, Package, Lock } from 'lucide-react';
import type { LGUPriorityReport, UserRole, OutgoingRelease, IncomingGoods } from '../../hooks/useInventoryState';
import { EditLGUModal } from '../modals/EditLGUModal';
import { EmergencyStockCorrectionModal } from '../modals/EmergencyStockCorrectionModal';
import { backendApi, type LguRecord, type LguInput, type ProvinceRecord, type KitTypeRecord } from '../../services/backendApi';
import { DEFAULT_KIT_NAMES, REGIONAL_PROVINCES } from '../../lib/lguMatching';
import { computeSynchronizedLgus, getLguStockForCategory, type SynchronizedLgu } from '../../lib/lguSync';
import { evaluatePriorityIndicator } from '../../lib/priorityLogic';

export type LGUDelivery = SynchronizedLgu;

interface RecentActivity {
  id: string;
  lguName: string;
  municipality: string;
  fnfiCategory: string;
  quantity: number;
  date: string;
  status: string;
}

interface LGUMonitoringProps {
  inventoryState?: {
    inventory?: { category: string; warehouseA: number; warehouseB: number }[];
    incomingGoodsList?: IncomingGoods[];
    outgoingReleasesList?: OutgoingRelease[];
    lguPriorityReports: LGUPriorityReport[];
    lgusList?: LguRecord[];
    provincesList?: ProvinceRecord[];
    kitTypesList?: KitTypeRecord[];
    adminActionsEnabled?: boolean;
    setAdminActionsEnabled?: (enabled: boolean) => void;
    addLgu?: (input: LguInput) => Promise<{ ok: boolean; message: string }>;
    editLgu?: (id: string, updates: Partial<LguInput>) => Promise<{ ok: boolean; message: string }>;
    emergencyCorrectLguStock?: (
      lguId: string,
      stockUpdates: Record<string, number>,
      reason: string,
      actorName?: string
    ) => Promise<{ ok: boolean; message: string }>;
    refreshLgus?: () => Promise<void>;
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
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyLguId, setEmergencyLguId] = useState<string | undefined>(undefined);

  // Administrative Actions State (synced from inventoryState or localStorage)
  const [internalAdminActions, setInternalAdminActions] = useState<boolean>(() => {
    if (typeof inventoryState?.adminActionsEnabled === 'boolean') {
      return inventoryState.adminActionsEnabled;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dswd_admin_actions_enabled') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof inventoryState?.adminActionsEnabled === 'boolean') {
      setInternalAdminActions(inventoryState.adminActionsEnabled);
    }
  }, [inventoryState?.adminActionsEnabled]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dswd_admin_actions_enabled') {
        setInternalAdminActions(e.newValue === 'true');
      }
    };
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setInternalAdminActions(customEvent.detail.enabled);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('dswd_admin_actions_changed', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('dswd_admin_actions_changed', handleCustom);
    };
  }, []);

  const adminActionsEnabled = typeof inventoryState?.adminActionsEnabled === 'boolean'
    ? inventoryState.adminActionsEnabled
    : internalAdminActions;

  // Dynamically compute live LGU list exclusively using unified synchronization helper
  const baseLguList = useMemo<LGUDelivery[]>(() => {
    return computeSynchronizedLgus({
      masterLgus: inventoryState?.lgusList,
      outgoingReleases: inventoryState?.outgoingReleasesList,
      incomingGoods: inventoryState?.incomingGoodsList,
      lguPriorityReports: inventoryState?.lguPriorityReports
    });
  }, [inventoryState?.outgoingReleasesList, inventoryState?.incomingGoodsList, inventoryState?.lguPriorityReports, inventoryState?.lgusList]);

  // Province list with counts
  const provinceOptions = useMemo(() => {
    if (inventoryState?.provincesList && inventoryState.provincesList.length > 0) {
      return inventoryState.provincesList
        .map(p => p?.name?.trim())
        .filter((name): name is string => Boolean(name))
        .sort();
    }
    const set = new Set<string>();
    baseLguList.forEach(l => {
      if (l?.province) set.add(l.province.trim());
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : [...REGIONAL_PROVINCES];
  }, [inventoryState?.provincesList, baseLguList]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (inventoryState?.kitTypesList ?? []).forEach(k => { if (k?.name) set.add(k.name.trim()); });
    (inventoryState?.outgoingReleasesList ?? []).forEach(r => { if (r?.fnfiCategory) set.add(r.fnfiCategory.trim()); });
    (inventoryState?.incomingGoodsList ?? []).forEach(g => { if (g?.fnfiCategory) set.add(g.fnfiCategory.trim()); });
    if (set.size === 0) {
      DEFAULT_KIT_NAMES.forEach(c => set.add(c));
    }
    return Array.from(set).sort();
  }, [inventoryState?.kitTypesList, inventoryState?.outgoingReleasesList, inventoryState?.incomingGoodsList]);


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
        maxStock: updatedLGU.maxStock !== undefined ? Number(updatedLGU.maxStock) || 3000 : 3000,
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
    return releases.filter(Boolean).slice(0, 8).map((release, idx) => ({
      id: release.drNumber || `OUT-${idx + 1}`,
      lguName: release.lguName || `${release.municipality || 'LGU'} Office`,
      municipality: release.municipality || 'Panay',
      fnfiCategory: release.fnfiCategory || 'Relief Goods',
      quantity: Number(release.amountApproved) || Number(release.amountRequested) || 0,
      date: release.dateAllocated || 'Recent',
      status: release.deliveryStatus || 'Pending'
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
                             (lgu?.currentStock && (Number(lgu.currentStock[selectedCategory]) || 0) > 0);

      return matchesSearch && matchesProvince && matchesCategory;
    });
  }, [baseLguList, searchTerm, selectedProvinceTab, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredLGUs.length / pageSize));
  const paginatedLGUs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLGUs.slice(start, start + pageSize);
  }, [filteredLGUs, currentPage, pageSize]);

  const totalLGUs = baseLguList.length;
  const totalItemsReleased = baseLguList.reduce((sum, lgu) => sum + (Number(lgu?.totalItemsReleased) || 0), 0);
  const totalDeliveries = baseLguList.reduce((sum, lgu) => sum + (Number(lgu?.deliveryCount) || 0), 0);
  const totalCompleted = baseLguList.reduce((sum, lgu) => sum + (Number(lgu?.completedDeliveries) || 0), 0);
  const overallCompletionRate = totalDeliveries > 0 ? Math.round((totalCompleted / totalDeliveries) * 100) : 0;

  const dynamicPriorities = useMemo(() => {
    return baseLguList
      .map((lgu) => {
        const foodStock = getLguStockForCategory(lgu, 'Food Pack');
        const pending = Number(lgu?.pendingDeliveries) || 0;
        const completed = Number(lgu?.completedDeliveries) || 0;
        const deliveries = Number(lgu?.deliveryCount) || (completed + pending);
        
        const maxStock = Number(lgu?.maxStock) > 0 ? Number(lgu.maxStock) : 3000;
        
        const evalRes = evaluatePriorityIndicator({
          foodPacks: foodStock,
          completedDeliveries: completed,
          pendingDeliveries: pending,
          totalDeliveries: deliveries,
          affectedFamilies: Number(lgu?.affectedFamilies) || 0,
          targetQuota: maxStock
        });

        return {
          id: `DYNAMIC-${lgu?.municipality || lgu?.id || Math.random()}`,
          municipality: lgu?.municipality || 'LGU',
          province: lgu?.province || '',
          lguName: lgu?.lguName || `${lgu?.municipality || 'LGU'} Municipal Office`,
          reportedAt: lgu?.lastDeliveryDate || 'Recent',
          foodPacks: foodStock,
          hygieneKits: getLguStockForCategory(lgu, 'Hygiene Kit'),
          familyKits: getLguStockForCategory(lgu, 'Family Kit'),
          affectedFamilies: Number(lgu?.affectedFamilies) || 0,
          damageIndex: evalRes.urgencyScore,
          maxStock,
          urgencyScore: evalRes.urgencyScore,
          priorityColor: evalRes.priorityColor,
          priorityLevel: evalRes.priorityLevel,
          stockRate: evalRes.stockRate,
          effectiveRate: evalRes.effectiveRate,
          systemResponse: evalRes.systemResponse,
          recommendation: evalRes.systemResponse
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 5);
  }, [baseLguList]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-gray-900">LGU Monitoring</h1>
            {adminActionsEnabled && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                Admin Actions Enabled
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">Track FNFI distribution and live stock levels across Panay LGUs</p>
        </div>
        {adminActionsEnabled && (
          <button
            type="button"
            onClick={() => {
              setEmergencyLguId(undefined);
              setShowEmergencyModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            title="Authorized Stock Overrides & Discrepancy Audits"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>Emergency Stock Correction</span>
          </button>
        )}
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
                Immediate Restocking: {dynamicPriorities.filter((report) => report.priorityColor === 'Red' || report.priorityColor === 'Orange').length}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {dynamicPriorities.map((report) => (
              <div
                key={report.id}
                className={`rounded-lg border p-3 flex flex-col justify-between ${
                  report.priorityColor === 'Red' ? 'bg-red-50/70 border-red-200' :
                  report.priorityColor === 'Orange' ? 'bg-orange-50/70 border-orange-200' :
                  report.priorityColor === 'Yellow' ? 'bg-yellow-50/70 border-yellow-200' :
                  'bg-emerald-50/70 border-emerald-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-gray-900 truncate" title={report.municipality}>
                      {report.municipality}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      report.priorityColor === 'Red' ? 'bg-red-100 text-red-700 border-red-200' :
                      report.priorityColor === 'Orange' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                      report.priorityColor === 'Yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}>
                      {report.priorityLevel || report.priorityColor}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-xl font-bold text-gray-900">{report.effectiveRate ?? report.urgencyScore}%</p>
                    <span className="text-[10px] font-semibold text-gray-500">Stock Rate</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5">Food packs: {report.foodPacks}</p>
                </div>
                <p className="text-[11px] text-gray-700 mt-2 font-medium truncate" title={report.systemResponse || report.recommendation}>
                  {report.systemResponse || report.recommendation}
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
                    <span className="inline-block text-[10px] font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 mb-0.5 truncate max-w-full" title={lgu.id}>
                      {lgu.id}
                    </span>
                    <h3 className="font-bold text-base text-gray-900 truncate" title={lgu.municipality}>{lgu.municipality}</h3>
                    <p className="text-xs text-gray-600 mt-0.5">{lgu.province} &bull; {lgu.lguName}</p>
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

                {/* On-Hand Relief Inventory (Prominent & Automated) */}
                <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-purple-700" />
                      <span className="text-xs font-bold text-purple-950">On-Hand Relief Stock</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      {Object.values(lgu.currentStock || {}).reduce((sum, val) => sum + (Number(val) || 0), 0).toLocaleString()} / {(lgu.maxStock ?? 3000).toLocaleString()} Max
                    </span>
                  </div>

                  {/* Category Breakdown Chips */}
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(lgu.currentStock || {})
                      .filter(([_, qty]) => Number(qty) > 0)
                      .map(([category, qty]) => (
                        <div key={category} className="bg-white rounded-lg px-2.5 py-1.5 border border-purple-100 shadow-2xs">
                          <p className="text-[10px] text-gray-500 font-medium truncate" title={category}>{category}</p>
                          <p className="text-xs font-bold text-purple-900 mt-0.5">{(Number(qty) || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    {Object.values(lgu.currentStock || {}).every(v => (Number(v) || 0) <= 0) && (
                      <div className="col-span-2 text-center py-2 text-[11px] text-purple-600 font-medium italic">
                        No relief stock recorded on-hand
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-purple-700 pt-1 border-t border-purple-200/60">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-purple-500" />
                      Automated via deliveries
                    </span>
                    {adminActionsEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmergencyLguId(lgu.id);
                          setShowEmergencyModal(true);
                        }}
                        className="text-purple-700 hover:text-purple-900 font-bold hover:underline cursor-pointer"
                      >
                        Emergency Recount
                      </button>
                    )}
                  </div>
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Current Stock</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedLGUs.map((lgu) => (
                  <tr key={lgu.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="block text-[10px] font-mono text-purple-700 font-semibold leading-tight">{lgu.id}</span>
                        <span className="font-bold text-sm text-gray-900">{lgu.municipality}</span>
                      </div>
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
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-purple-700">
                            {Object.values(lgu.currentStock || {}).reduce((sum, val) => sum + (Number(val) || 0), 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">/ {(lgu.maxStock ?? 3000).toLocaleString()} max</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {Object.entries(lgu.currentStock || {})
                            .filter(([_, qty]) => Number(qty) > 0)
                            .map(([cat, qty]) => (
                              <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 font-medium">
                                {cat}: {(Number(qty) || 0).toLocaleString()}
                              </span>
                            ))}
                          {Object.values(lgu.currentStock || {}).every(v => (Number(v) || 0) <= 0) && (
                            <span className="text-[10px] text-gray-400 italic">0 in stock</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(lgu)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600 transition cursor-pointer"
                          title="Edit LGU Info"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {adminActionsEnabled && (
                          <button
                            onClick={() => {
                              setEmergencyLguId(lgu.id);
                              setShowEmergencyModal(true);
                            }}
                            className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition cursor-pointer"
                            title="Emergency Stock Correction"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
          availableCategories={categoryOptions}
          adminActionsEnabled={adminActionsEnabled}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLGU(null);
          }}
          onSubmit={handleEditLGU}
          onOpenEmergencyCorrection={adminActionsEnabled ? (lguId) => {
            setEmergencyLguId(lguId);
            setShowEmergencyModal(true);
          } : undefined}
        />
      )}

      {/* Emergency Stock Correction Modal */}
      {showEmergencyModal && (
        <EmergencyStockCorrectionModal
          isOpen={showEmergencyModal}
          onClose={() => {
            setShowEmergencyModal(false);
            setEmergencyLguId(undefined);
          }}
          lgusList={baseLguList}
          kitTypesList={inventoryState?.kitTypesList}
          initialLguId={emergencyLguId}
          onCorrectStock={async (lguId, newStock, reason) => {
            if (inventoryState?.emergencyCorrectLguStock) {
              return inventoryState.emergencyCorrectLguStock(lguId, newStock, reason);
            }
            return backendApi.emergencyCorrectLguStock(lguId, newStock, reason);
          }}
        />
      )}
    </div>
  );
}

export default LGUMonitoring;

