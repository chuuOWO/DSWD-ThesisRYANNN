import { useMemo, useState, useEffect } from 'react';
import { Search, MapPin, TrendingUp, CheckCircle, Clock, Edit, ChevronLeft, ChevronRight, LayoutGrid, List, ShieldAlert, Package, Lock, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import type { LGUPriorityReport, UserRole, OutgoingRelease, IncomingGoods } from '../../hooks/useInventoryState';
import { EditLGUModal } from '../modals/EditLGUModal';
import { EmergencyStockCorrectionModal } from '../modals/EmergencyStockCorrectionModal';
import { LGUDetailModal } from '../modals/LGUDetailModal';
import { backendApi, type LguRecord, type LguInput, type ProvinceRecord, type KitTypeRecord } from '../../services/backendApi';
import { DEFAULT_KIT_NAMES, REGIONAL_PROVINCES } from '../../lib/lguMatching';
import { computeSynchronizedLgus, getLguStockForCategory, normalizeCategoryName, type SynchronizedLgu } from '../../lib/lguSync';
import { evaluatePriorityIndicator } from '../../lib/priorityLogic';
import {
  type CommodityTypeFilter,
  matchesCommodityFilter,
  isFoodItem,
  getLguCapacities,
  getLguCommodityStock
} from '../../lib/commodityClassification';
import { supabase } from '../../lib/supabase';
import { getDaysRemaining } from '../../lib/expiryConstants';

export type LGUDelivery = SynchronizedLgu;

export type LguSortField =
  | 'name'
  | 'province'
  | 'status'
  | 'current_stock'
  | 'capacity'
  | 'percentage'
  | 'variance'
  | 'expiring90'
  | 'expiring120';

export type SortDirection = 'asc' | 'desc';

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
  const [commodityTypeFilter, setCommodityTypeFilter] = useState<CommodityTypeFilter>('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dswd_lgu_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    }
    return 'cards';
  });

  const handleSetViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dswd_lgu_view_mode', mode);
    }
  };

  useEffect(() => {
    const handleViewSwitch = (e: any) => {
      if (e.detail?.mode === 'table' || e.detail?.mode === 'cards') {
        setViewMode(e.detail.mode);
      }
    };
    window.addEventListener('dswd_switch_lgu_view_mode', handleViewSwitch);
    return () => window.removeEventListener('dswd_switch_lgu_view_mode', handleViewSwitch);
  }, []);

  const [sortBy, setSortBy] = useState<LguSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSortToggle = (field: LguSortField) => {
    if (sortBy === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection(field === 'name' || field === 'province' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: LguSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60 inline shrink-0 ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-600 inline shrink-0 ml-1" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-600 inline shrink-0 ml-1" />
    );
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = viewMode === 'table' ? 18 : 12;

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLGU, setSelectedLGU] = useState<LGUDelivery | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyLguId, setEmergencyLguId] = useState<string | undefined>(undefined);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLguForDetails, setSelectedLguForDetails] = useState<LGUDelivery | null>(null);

  const openDetailModal = (lgu: LGUDelivery) => {
    setSelectedLguForDetails(lgu);
    setShowDetailModal(true);
  };

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

  const [capacityVersion, setCapacityVersion] = useState(0);
  const [dbBatches, setDbBatches] = useState<any[]>([]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchBatches = async () => {
      try {
        const { data } = await supabase.from('inventory_batches').select('*, kit_types(name, category)');
        if (isSubscribed && data) {
          setDbBatches(data.map((b: any) => ({
            ...b,
            kit_name: b.kit_types?.name || b.kit_name || b.kit_type_id
          })));
        }
      } catch (err) {
        console.warn('Failed to load inventory_batches in LGUMonitoring:', err);
      }
    };
    fetchBatches();

    const channel = supabase
      .channel('lgu-monitoring-batches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_batches' }, () => {
        fetchBatches();
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => setCapacityVersion(v => v + 1);
    window.addEventListener('dswd_capacities_updated', handleUpdate);
    return () => window.removeEventListener('dswd_capacities_updated', handleUpdate);
  }, []);

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
    (inventoryState?.kitTypesList ?? []).forEach(k => {
      const canonical = normalizeCategoryName(k?.name);
      if (canonical) set.add(canonical);
      else if (k?.name) set.add(k.name.trim());
    });
    (inventoryState?.outgoingReleasesList ?? []).forEach(r => {
      const canonical = normalizeCategoryName(r?.fnfiCategory);
      if (canonical) set.add(canonical);
      else if (r?.fnfiCategory) set.add(r.fnfiCategory.trim());
    });
    (inventoryState?.incomingGoodsList ?? []).forEach(g => {
      const canonical = normalizeCategoryName(g?.fnfiCategory);
      if (canonical) set.add(canonical);
      else if (g?.fnfiCategory) set.add(g.fnfiCategory.trim());
    });
    DEFAULT_KIT_NAMES.forEach(c => {
      const canonical = normalizeCategoryName(c);
      if (canonical) set.add(canonical);
      else set.add(c);
    });
    const list = Array.from(set).sort();
    if (commodityTypeFilter === 'All') return list;
    return list.filter(cat => matchesCommodityFilter(cat, commodityTypeFilter));
  }, [inventoryState?.kitTypesList, inventoryState?.outgoingReleasesList, inventoryState?.incomingGoodsList, commodityTypeFilter]);

  useEffect(() => {
    if (selectedCategory !== 'All' && commodityTypeFilter !== 'All') {
      if (!matchesCommodityFilter(selectedCategory, commodityTypeFilter)) {
        setSelectedCategory('All');
      }
    }
  }, [commodityTypeFilter, selectedCategory]);


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
  const [showArchived, setShowArchived] = useState(false);

  const filteredLGUs = useMemo(() => {
    return baseLguList.filter(lgu => {
      if (!showArchived && lgu?.isActive === false) return false;
      const q = (searchTerm || '').toLowerCase().trim();
      const matchesSearch = !q ||
                            (lgu?.lguName || '').toLowerCase().includes(q) ||
                            (lgu?.municipality || '').toLowerCase().includes(q) ||
                            (lgu?.province || '').toLowerCase().includes(q);

      const matchesProvince = selectedProvinceTab === 'All' ||
                             (lgu?.province || '').toLowerCase() === (selectedProvinceTab || '').toLowerCase();

      return matchesSearch && matchesProvince;
    });
  }, [baseLguList, searchTerm, selectedProvinceTab, showArchived]);

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

  // Master calculation of expiring batches by LGU (Rolling Relative Time Windows: <= 90 Days and 91-120 Days)
  const lguExpiryBreakdown = useMemo(() => {
    const map = new Map<string, { expiring90: number; expiring120: number }>();

    const getEntry = (lguId: string) => {
      if (!map.has(lguId)) {
        map.set(lguId, { expiring90: 0, expiring120: 0 });
      }
      return map.get(lguId)!;
    };

    const findLguId = (lguId?: string | null, muni?: string | null, prov?: string | null) => {
      if (lguId) {
        const match = baseLguList.find(l => l.id && String(l.id).toLowerCase() === String(lguId).toLowerCase());
        if (match) return match.id;
      }
      if (muni) {
        const muniLower = muni.trim().toLowerCase();
        const provLower = (prov || '').trim().toLowerCase();
        const match = baseLguList.find(l => {
          const lMuni = (l.municipality || '').trim().toLowerCase();
          const lProv = (l.province || '').trim().toLowerCase();
          if (provLower && lProv && provLower !== lProv) return false;
          return lMuni === muniLower || (muniLower.length > 2 && (l.lguName || '').trim().toLowerCase().includes(muniLower));
        });
        if (match) return match.id;
      }
      return null;
    };

    const targetCategoryMatch = (cat?: string | null) => {
      if (selectedCategory !== 'All') {
        const c1 = normalizeCategoryName(cat);
        const c2 = normalizeCategoryName(selectedCategory);
        return c1.toLowerCase() === c2.toLowerCase();
      }
      return matchesCommodityFilter(cat, commodityTypeFilter);
    };

    const seenTokens = new Set<string>();

    // 1. Live database inventory_batches assigned to this LGU
    dbBatches.forEach((b: any) => {
      if (!b) return;
      const exp = b.expiration_date || b.expirationDate;
      if (!exp) return;
      const cat = b.kit_name || b.kit_type_id || b.kitTypeId;
      if (!targetCategoryMatch(cat)) return;

      const token = b.batch_token_id || b.batchTokenId;
      if (token && seenTokens.has(token)) return;
      if (token) seenTokens.add(token);

      const targetLguId = findLguId(b.lgu_id || b.lguId, b.municipality, b.province);
      if (!targetLguId) return;

      const days = getDaysRemaining(exp);
      const qty = Number(b.remaining_quantity ?? b.remainingQuantity ?? b.initial_quantity ?? b.initialQuantity ?? 0);
      if (qty <= 0) return;

      const entry = getEntry(targetLguId);
      if (days <= 90) entry.expiring90 += qty;
      else if (days > 90 && days <= 120) entry.expiring120 += qty;
    });

    // 2. Batches delivered or allocated via outgoing releases
    const releases = inventoryState?.outgoingReleasesList || [];
    releases.forEach((r) => {
      if (!r) return;
      if (!targetCategoryMatch(r.fnfiCategory)) return;

      const targetLguId = findLguId(r.lguId, r.municipality || r.destination, r.province);
      if (!targetLguId) return;

      let allocs: any = r.allocatedBatches;
      if (typeof allocs === 'string') {
        try {
          allocs = JSON.parse(allocs);
        } catch {}
      }
      if (!Array.isArray(allocs)) allocs = [];

      if (allocs.length > 0) {
        allocs.forEach((a: any) => {
          const token = a.batchTokenId || a.batchNumber;
          if (token && seenTokens.has(token)) return;
          if (token) seenTokens.add(token);

          const exp = a.expirationDate;
          if (!exp) return;
          const days = getDaysRemaining(exp);
          const qty = Number(a.quantity || 0);
          if (qty <= 0) return;

          const entry = getEntry(targetLguId);
          if (days <= 90) entry.expiring90 += qty;
          else if (days > 90 && days <= 120) entry.expiring120 += qty;
        });
      } else {
        const token = r.drNumber || r.id;
        if (token && seenTokens.has(token)) return;
        if (token) seenTokens.add(token);

        const exp = (r as any).expirationDate;
        if (!exp) return;
        const days = getDaysRemaining(exp);
        const qty = Number(r.amountApproved || r.amountRequested || 0);
        if (qty <= 0) return;

        const entry = getEntry(targetLguId);
        if (days <= 90) entry.expiring90 += qty;
        else if (days > 90 && days <= 120) entry.expiring120 += qty;
      }
    });

    // 3. Batches delivered via verified direct incoming logistics
    const incoming = inventoryState?.incomingGoodsList || [];
    incoming.forEach((inc) => {
      if (!inc || inc.destinationType !== 'LGU') return;
      if (!targetCategoryMatch(inc.fnfiCategory)) return;

      const targetLguId = findLguId(null, inc.destination, null);
      if (!targetLguId) return;

      const token = inc.batchTokenId || inc.manifestNumber || inc.id;
      if (token && seenTokens.has(token)) return;
      if (token) seenTokens.add(token);

      const exp = inc.expirationDate;
      if (!exp) return;
      const days = getDaysRemaining(exp);
      const qty = Number(inc.quantity || 0);
      if (qty <= 0) return;

      const entry = getEntry(targetLguId);
      if (days <= 90) entry.expiring90 += qty;
      else if (days > 90 && days <= 120) entry.expiring120 += qty;
    });

    return map;
  }, [baseLguList, dbBatches, inventoryState?.outgoingReleasesList, inventoryState?.incomingGoodsList, commodityTypeFilter, selectedCategory]);

  // Master sorted list of LGUs based on active sortBy and sortDirection
  const sortedLGUs = useMemo(() => {
    const list = [...filteredLGUs];
    const statusWeight = (label: string) => {
      switch (label) {
        case 'DEPLETED': return 4;
        case 'CRITICAL': return 3;
        case 'MODERATE': return 2;
        case 'ADEQUATE': return 1;
        default: return 0;
      }
    };

    return list.sort((a, b) => {
      const capsA = getLguCapacities(a);
      const capsB = getLguCapacities(b);
      const stockA = getLguCommodityStock(a);
      const stockB = getLguCommodityStock(b);

      const effCapA = selectedCategory !== 'All'
        ? (isFoodItem(selectedCategory) ? capsA.food : capsA.nonFood)
        : capsA.forFilter(commodityTypeFilter);
      const effCapB = selectedCategory !== 'All'
        ? (isFoodItem(selectedCategory) ? capsB.food : capsB.nonFood)
        : capsB.forFilter(commodityTypeFilter);

      const effStockA = selectedCategory !== 'All'
        ? getLguStockForCategory(a, selectedCategory)
        : stockA.forFilter(commodityTypeFilter);
      const effStockB = selectedCategory !== 'All'
        ? getLguStockForCategory(b, selectedCategory)
        : stockB.forFilter(commodityTypeFilter);

      const pctA = effCapA > 0 ? (effStockA / effCapA) * 100 : 0;
      const pctB = effCapB > 0 ? (effStockB / effCapB) * 100 : 0;
      const varA = Math.max(0, effCapA - effStockA);
      const varB = Math.max(0, effCapB - effStockB);

      const expA = lguExpiryBreakdown.get(a.id) || { expiring90: 0, expiring120: 0 };
      const expB = lguExpiryBreakdown.get(b.id) || { expiring90: 0, expiring120: 0 };

      let diff = 0;
      switch (sortBy) {
        case 'name':
          diff = (a.municipality || '').localeCompare(b.municipality || '');
          break;
        case 'province':
          diff = (a.province || '').localeCompare(b.province || '') || (a.municipality || '').localeCompare(b.municipality || '');
          break;
        case 'status': {
          const wA = statusWeight(getLguStatusConfig(effStockA, effCapA).label);
          const wB = statusWeight(getLguStatusConfig(effStockB, effCapB).label);
          diff = wA - wB;
          break;
        }
        case 'current_stock':
          diff = effStockA - effStockB;
          break;
        case 'capacity':
          diff = effCapA - effCapB;
          break;
        case 'percentage':
          diff = pctA - pctB;
          break;
        case 'variance':
          diff = varA - varB;
          break;
        case 'expiring90':
          diff = expA.expiring90 - expB.expiring90;
          break;
        case 'expiring120':
          diff = expA.expiring120 - expB.expiring120;
          break;
        default:
          diff = 0;
      }

      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [filteredLGUs, sortBy, sortDirection, commodityTypeFilter, selectedCategory, lguExpiryBreakdown]);

  const totalPages = Math.max(1, Math.ceil(sortedLGUs.length / pageSize));
  const paginatedLGUs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLGUs.slice(start, start + pageSize);
  }, [sortedLGUs, currentPage, pageSize]);

  // Table summary totals (sum of all filtered records)
  const tableTotals = useMemo(() => {
    let currentStockSum = 0;
    let capacitySum = 0;
    let expiring90Sum = 0;
    let expiring120Sum = 0;

    filteredLGUs.forEach((lgu) => {
      const caps = getLguCapacities(lgu);
      const stock = getLguCommodityStock(lgu);
      const effectiveCap = selectedCategory !== 'All'
        ? (isFoodItem(selectedCategory) ? caps.food : caps.nonFood)
        : caps.forFilter(commodityTypeFilter);
      const effectiveStock = selectedCategory !== 'All'
        ? getLguStockForCategory(lgu, selectedCategory)
        : stock.forFilter(commodityTypeFilter);
      currentStockSum += effectiveStock;
      capacitySum += effectiveCap;

      const expiry = lguExpiryBreakdown.get(lgu.id) || { expiring90: 0, expiring120: 0 };
      expiring90Sum += expiry.expiring90;
      expiring120Sum += expiry.expiring120;
    });

    const varianceSum = Math.max(0, capacitySum - currentStockSum);
    const percentage = capacitySum > 0 ? (currentStockSum / capacitySum) * 100 : 0;

    return {
      currentStockSum,
      capacitySum,
      varianceSum,
      percentage,
      expiring90Sum,
      expiring120Sum
    };
  }, [filteredLGUs, commodityTypeFilter, selectedCategory, lguExpiryBreakdown]);

  const commodityHeaderLabel = useMemo(() => {
    if (selectedCategory !== 'All') {
      return selectedCategory.toUpperCase();
    }
    if (commodityTypeFilter === 'Food Items') {
      return 'FAMILY FOOD PACKS & RTEF';
    }
    if (commodityTypeFilter === 'Non-Food Items') {
      return 'NON-FOOD ITEMS (NFIs)';
    }
    return 'FAMILY FOOD PACKS & RELIEF GOODS';
  }, [commodityTypeFilter, selectedCategory]);

  const getLguStatusConfig = (effectiveStock: number, effectiveCap: number) => {
    if (effectiveStock <= 0) {
      return {
        label: 'DEPLETED',
        badgeClass: 'bg-gray-100 text-gray-700 border-gray-200'
      };
    }
    const pct = effectiveCap > 0 ? (effectiveStock / effectiveCap) * 100 : 100;
    if (pct >= 80) {
      return {
        label: 'ADEQUATE',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    }
    if (pct >= 50) {
      return {
        label: 'MODERATE',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
      };
    }
    return {
      label: 'CRITICAL',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200'
    };
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
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
            value={commodityTypeFilter}
            onChange={(e) => {
              setCommodityTypeFilter(e.target.value as CommodityTypeFilter);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
          >
            <option value="All">All Classifications</option>
            <option value="Food Items">Food Items (FFP & RTEF)</option>
            <option value="Non-Food Items">Non-Food Items (NFIs)</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
          >
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={`${sortBy}-${sortDirection}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split('-');
              setSortBy(f as LguSortField);
              setSortDirection(d as SortDirection);
              setCurrentPage(1);
            }}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white text-xs text-gray-700"
            title="Sort LGUs"
          >
            <option value="name-asc">Sort: Name (A to Z)</option>
            <option value="name-desc">Sort: Name (Z to A)</option>
            <option value="province-asc">Sort: Province (A to Z)</option>
            <option value="status-desc">Sort: Status (Critical first)</option>
            <option value="status-asc">Sort: Status (Adequate first)</option>
            <option value="currentStock-desc">Sort: Current Stock (High to Low)</option>
            <option value="currentStock-asc">Sort: Current Stock (Low to High)</option>
            <option value="percentage-asc">Sort: Percentage (Lowest first)</option>
            <option value="percentage-desc">Sort: Percentage (Highest first)</option>
            <option value="capacity-desc">Sort: Capacity (High to Low)</option>
            <option value="variance-desc">Sort: Shortage/Variance (High to Low)</option>
            <option value="expiring90-desc">Sort: Expiring ≤ 90 Days (Most first)</option>
            <option value="expiring120-desc">Sort: Expiring 91-120 Days (Most first)</option>
          </select>
        </div>

        {/* View mode & Archive toggles */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer select-none px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setCurrentPage(1);
              }}
              className="w-3.5 h-3.5 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
            />
            <span>Show Archived</span>
          </label>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => handleSetViewMode('cards')}
              className={`p-2 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content: Cards View or Table View */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLGUs.map((lgu) => (
            <div
              key={lgu.id}
              onClick={() => openDetailModal(lgu)}
              className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <MapPin className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[10px] font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 mb-0.5 truncate max-w-full" title={lgu.id}>
                        {lgu.id}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors truncate" title={lgu.municipality}>{lgu.municipality}</h3>
                        {lgu.isActive === false && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{lgu.province} &bull; {lgu.lguName}</p>
                    </div>
                  </div>
                  {adminActionsEnabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(lgu);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                      title="Edit LGU"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
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
                  {(() => {
                    const caps = getLguCapacities(lgu);
                    const stock = getLguCommodityStock(lgu);
                    const effectiveCap = caps.forFilter(commodityTypeFilter);
                    const effectiveStock = stock.forFilter(commodityTypeFilter);
                    const occupancyPct = Math.round((effectiveStock / (effectiveCap || 1)) * 100);

                    return (
                      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-purple-700" />
                            <span className="text-xs font-bold text-purple-950">On-Hand Relief Stock</span>
                          </div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            {effectiveStock.toLocaleString()} / {effectiveCap.toLocaleString()} ({occupancyPct}%)
                          </span>
                        </div>

                        {/* 2-Way Capacity Split Indicator */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/90 p-2 rounded-lg border border-purple-100">
                          <div className="space-y-0.5">
                            <div className="flex justify-between font-bold text-gray-700">
                              <span>Food Buffer</span>
                              <span className="text-amber-800">{Math.round((stock.food / (caps.food || 1)) * 100)}%</span>
                            </div>
                            <p className="text-gray-500 font-medium">{stock.food.toLocaleString()} / {caps.food.toLocaleString()}</p>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between font-bold text-gray-700">
                              <span>Non-Food</span>
                              <span className="text-indigo-800">{Math.round((stock.nonFood / (caps.nonFood || 1)) * 100)}%</span>
                            </div>
                            <p className="text-gray-500 font-medium">{stock.nonFood.toLocaleString()} / {caps.nonFood.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Category Breakdown Chips */}
                        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                          {Object.entries(lgu.currentStock || {})
                            .filter(([category, qty]) => Number(qty) > 0 && matchesCommodityFilter(category, commodityTypeFilter))
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
                              onClick={(e) => {
                                e.stopPropagation();
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
                    );
                  })()}

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

              {/* View Transactions & Ledger Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetailModal(lgu);
                }}
                className="w-full mt-3 py-2 px-3 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <span>View Transactions &amp; Stock Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Municipal LGU Inventory &amp; Aging Ledger</h3>
              <p className="text-xs text-gray-500">Live buffer stock levels, storage capacities, and rolling FEFO expiration countdowns</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 bg-gray-200/80 px-2.5 py-1 rounded-full">
                {filteredLGUs.length} Municipalities
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-200">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px] tracking-wider select-none">
                <tr>
                  <th
                    rowSpan={2}
                    onClick={() => handleSortToggle('status')}
                    className="px-4 py-3 text-center border-b border-r border-gray-200 align-middle w-28 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by status"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>STATUS</span>
                      {renderSortIcon('status')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSortToggle('name')}
                    className="px-5 py-3 text-left border-b border-r border-gray-200 align-middle min-w-[200px] cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by municipality name"
                  >
                    <div className="flex items-center justify-between">
                      <span>LGU / MUNICIPALITY</span>
                      {renderSortIcon('name')}
                    </div>
                  </th>
                  <th
                    colSpan={4}
                    className="px-4 py-2 text-center border-b border-r border-gray-200 bg-gray-100/70 text-gray-800 font-extrabold"
                  >
                    {commodityHeaderLabel}
                  </th>
                  <th
                    onClick={() => handleSortToggle('expiring90')}
                    className="px-4 py-2 text-center border-b border-r border-rose-200 bg-rose-50/70 text-rose-900 font-extrabold whitespace-nowrap min-w-[130px] cursor-pointer hover:bg-rose-100/80 transition-colors select-none"
                    title="Click to sort by expiring in ≤ 90 days"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <div>
                        <span className="block text-[9px] opacity-75 font-semibold">EXPIRING</span>
                        <span className="block text-xs font-black">≤ 90 DAYS</span>
                        <span className="block text-[9px] font-medium normal-case opacity-75">(≤ 3 Months)</span>
                      </div>
                      {renderSortIcon('expiring90')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortToggle('expiring120')}
                    className="px-4 py-2 text-center border-b border-r border-amber-200 bg-amber-50/70 text-amber-900 font-extrabold whitespace-nowrap min-w-[130px] cursor-pointer hover:bg-amber-100/80 transition-colors select-none"
                    title="Click to sort by expiring in 91–120 days"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <div>
                        <span className="block text-[9px] opacity-75 font-semibold">EXPIRING</span>
                        <span className="block text-xs font-black">91–120 DAYS</span>
                        <span className="block text-[9px] font-medium normal-case opacity-75">(4–6 Months)</span>
                      </div>
                      {renderSortIcon('expiring120')}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 text-center border-b border-gray-200 align-middle w-24"
                  >
                    ACTIONS
                  </th>
                </tr>
                <tr>
                  <th
                    onClick={() => handleSortToggle('percentage')}
                    className="px-3 py-2 text-right border-b border-gray-200 bg-gray-50/90 text-gray-600 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by capacity percentage"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>PERCENTAGE</span>
                      {renderSortIcon('percentage')}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSortToggle('currentStock')}
                    className="px-3 py-2 text-right border-b border-gray-200 bg-gray-50/90 text-gray-600 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by current stock"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>CURRENT</span>
                      {renderSortIcon('currentStock')}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSortToggle('capacity')}
                    className="px-3 py-2 text-right border-b border-gray-200 bg-gray-50/90 text-gray-600 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by capacity limit"
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>CAPACITY</span>
                      {renderSortIcon('capacity')}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSortToggle('variance')}
                    className="px-3 py-2 text-center border-b border-r border-gray-200 bg-gray-50/90 text-gray-600 font-bold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by shortage variance"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <span>VARIANCE</span>
                      {renderSortIcon('variance')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {/* TOTAL Summary Row matching overall theme */}
                <tr className="bg-slate-50 border-b-2 border-gray-200 font-bold text-gray-900 select-none">
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                      SUMMARY
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-left font-black tracking-wide text-gray-900">
                    TOTAL MONITORED ({filteredLGUs.length})
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-blue-700 pr-4">
                    {tableTotals.percentage.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-gray-900 pr-4">
                    {tableTotals.currentStockSum.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-700 pr-4">
                    {tableTotals.capacitySum.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-gray-700">
                    {tableTotals.varianceSum > 0 ? tableTotals.varianceSum.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-rose-700 pr-4 bg-rose-50/30">
                    {tableTotals.expiring90Sum > 0 ? tableTotals.expiring90Sum.toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-amber-700 pr-4 bg-amber-50/30">
                    {tableTotals.expiring120Sum > 0 ? tableTotals.expiring120Sum.toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-400">
                    -
                  </td>
                </tr>

                {/* Data Rows */}
                {paginatedLGUs.map((lgu) => {
                  const caps = getLguCapacities(lgu);
                  const stock = getLguCommodityStock(lgu);
                  const effectiveCap = selectedCategory !== 'All'
                    ? (isFoodItem(selectedCategory) ? caps.food : caps.nonFood)
                    : caps.forFilter(commodityTypeFilter);
                  const effectiveStock = selectedCategory !== 'All'
                    ? getLguStockForCategory(lgu, selectedCategory)
                    : stock.forFilter(commodityTypeFilter);
                  const occupancyPct = effectiveCap > 0 ? (effectiveStock / effectiveCap) * 100 : 0;
                  const variance = Math.max(0, effectiveCap - effectiveStock);
                  const statusCfg = getLguStatusConfig(effectiveStock, effectiveCap);
                  const expiry = lguExpiryBreakdown.get(lgu.id) || { expiring90: 0, expiring120: 0 };

                  return (
                    <tr key={lgu.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-3 text-center align-middle">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openDetailModal(lgu)}
                            className="font-semibold text-gray-900 hover:text-blue-700 hover:underline cursor-pointer text-left group"
                            title="Click to view detailed stock and FEFO expiry breakdown"
                          >
                            <p className="font-bold text-xs text-gray-900 group-hover:text-blue-600 transition-colors">
                              {lgu.lguName || `${lgu.municipality} Municipal Office`}
                            </p>
                            <p className="text-[11px] text-gray-500 font-normal">
                              {lgu.municipality}, {lgu.province}
                            </p>
                          </button>
                          {lgu.isActive === false && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold text-gray-800 pr-4 align-middle">
                        {occupancyPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-gray-900 pr-4 align-middle">
                        {effectiveStock.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-medium text-gray-600 pr-4 align-middle">
                        {effectiveCap.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-700 border-r border-gray-100 align-middle">
                        {variance > 0 ? variance.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium pr-4 align-middle bg-rose-50/20">
                        {expiry.expiring90 > 0 ? (
                          <span className="font-bold text-rose-700">
                            {expiry.expiring90.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium pr-4 align-middle bg-amber-50/20">
                        {expiry.expiring120 > 0 ? (
                          <span className="font-bold text-amber-700">
                            {expiry.expiring120.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetailModal(lgu)}
                            className="p-1.5 hover:bg-blue-50 rounded text-gray-600 hover:text-blue-600 transition cursor-pointer"
                            title="View Transactions & FEFO Expiry Ledger"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                          {adminActionsEnabled && (
                            <button
                              type="button"
                              onClick={() => openEditModal(lgu)}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600 transition cursor-pointer"
                              title="Edit LGU Info"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {adminActionsEnabled && (
                            <button
                              type="button"
                              onClick={() => {
                                setEmergencyLguId(lgu.id);
                                setShowEmergencyModal(true);
                              }}
                              className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition cursor-pointer"
                              title="Emergency Stock Correction"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* LGU Incoming & Outgoing Transactions and Inventory Ledger Modal */}
      {showDetailModal && selectedLguForDetails && (
        <LGUDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedLguForDetails(null);
          }}
          lgu={selectedLguForDetails}
          outgoingReleases={inventoryState?.outgoingReleasesList}
          incomingGoods={inventoryState?.incomingGoodsList}
          kitTypesList={inventoryState?.kitTypesList}
          initialCommodityFilter={commodityTypeFilter}
        />
      )}
    </div>
  );
}

export default LGUMonitoring;

