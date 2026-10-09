import { useMemo, useState } from 'react';
import {
  Package,
  TrendingDown,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Building2,
  Boxes,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { LguRecord } from '../../services/backendApi';
import type { IncomingGoods, OutgoingRelease, LGUPriorityReport } from '../../hooks/useInventoryState';
import { normalizeCategoryName } from '../../lib/lguSync';
import type { UserProfile } from '../../services/authApi';
import { InventoryReportPdfModal } from '../modals/InventoryReportPdfModal';

interface InventoryState {
  inventory: { category: string; warehouseA: number; warehouseB: number }[];
  incomingGoodsList: IncomingGoods[];
  outgoingReleasesList: OutgoingRelease[];
  lguPriorityReports: LGUPriorityReport[];
  lgusList?: LguRecord[];
  addStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => void;
  deductStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse', quantity: number) => boolean;
  getAvailableStock: (category: string, warehouse: 'Oton Main Warehouse' | 'Pototan Main Warehouse') => number;
}

interface InventoryMonitoringProps {
  inventoryState: InventoryState;
  adminProfile?: UserProfile | null;
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

export function InventoryMonitoring({ inventoryState, adminProfile }: InventoryMonitoringProps) {
  const { incomingGoodsList, inventory, lguPriorityReports, outgoingReleasesList, lgusList = [] } = inventoryState;

  // Primary facility scope filter: defaults to Main Warehouses (Oton & Pototan)
  const [facilityScope, setFacilityScope] = useState<'main' | 'oton' | 'pototan' | 'all' | 'lgu'>('main');
  const [selectedLguFilter, setSelectedLguFilter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockHealthFilter, setStockHealthFilter] = useState<'all' | 'low' | 'expiring' | 'optimal'>('all');

  // Collapse toggles for notices and comparison chart - notices minimized by default
  const [isLowStockCollapsed, setIsLowStockCollapsed] = useState(true);
  const [isExpirationCollapsed, setIsExpirationCollapsed] = useState(true);
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Dynamic categories gathered from inventory, incoming, and outgoing releases without fallbacks
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => {
      const canonical = normalizeCategoryName(i.category);
      if (canonical) set.add(canonical);
      else if (i.category?.trim()) set.add(i.category.trim());
    });
    incomingGoodsList.forEach((i) => {
      const canonical = normalizeCategoryName(i.fnfiCategory);
      if (canonical) set.add(canonical);
      else if (i.fnfiCategory?.trim()) set.add(i.fnfiCategory.trim());
    });
    outgoingReleasesList.forEach((o) => {
      const canonical = normalizeCategoryName(o.fnfiCategory);
      if (canonical) set.add(canonical);
      else if (o.fnfiCategory?.trim()) set.add(o.fnfiCategory.trim());
    });
    lgusList.forEach((lgu) => {
      Object.keys(lgu.currentStock ?? {}).forEach((category) => {
        const canonical = normalizeCategoryName(category);
        if (canonical) set.add(canonical);
        else if (category.trim()) set.add(category.trim());
      });
    });
    return Array.from(set).sort();
  }, [inventory, incomingGoodsList, outgoingReleasesList, lgusList]);

  // Dynamically compute live LGU warehouse stock from accepted deliveries and LGU reports
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
          const canonical = normalizeCategoryName(category) || category.trim();
          const val = Number(value) || 0;
          init[canonical] = (init[canonical] || 0) + val;
          init[category] = val;
        });
        map.set(trimmed, init);
      }
      return map.get(trimmed)!;
    };

    // 0. Start with every LGU from the Supabase master directory
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
      const cat = normalizeCategoryName(release.fnfiCategory) || release.fnfiCategory;
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
      const cat = normalizeCategoryName(release.fnfiCategory) || release.fnfiCategory;
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

  const displayData: InventoryItem[] = useMemo(() => {
    return dynamicCategories.map((category) => {
      const canonicalCategory = normalizeCategoryName(category);
      const matchingItems = inventory.filter((i) =>
        normalizeCategoryName(i.category) === canonicalCategory || i.category?.toLowerCase() === category.toLowerCase()
      );
      const warehouseA = matchingItems.reduce((sum, i) => sum + (i.warehouseA || 0), 0);
      const warehouseB = matchingItems.reduce((sum, i) => sum + (i.warehouseB || 0), 0);

      const released = outgoingReleasesList
        .filter((release) => {
          const relCanonical = normalizeCategoryName(release.fnfiCategory);
          return (
            (relCanonical === canonicalCategory || (release.fnfiCategory || '').toLowerCase() === category.toLowerCase()) &&
            releaseStatuses.includes(release.deliveryStatus)
          );
        })
        .reduce((sum, release) => sum + (release.amountApproved || release.amountRequested || 0), 0);

      const expiringItems = incomingGoodsList
        .filter((incoming) => {
          const incCanonical = normalizeCategoryName(incoming.fnfiCategory);
          return (
            (incCanonical === canonicalCategory || (incoming.fnfiCategory || '').toLowerCase() === category.toLowerCase()) &&
            (incoming.status === 'Verified' || incoming.status === 'Minted')
          );
        })
        .filter((incoming) => {
          if (!incoming.expirationDate) return false;
          const expirationDate = new Date(incoming.expirationDate);
          return expirationDate <= thirtyDaysFromNow && expirationDate >= today;
        })
        .reduce((sum, incoming) => sum + (incoming.quantity || 0), 0);

      return {
        category,
        warehouseA,
        warehouseB,
        totalStock: warehouseA + warehouseB,
        released,
        available: warehouseA + warehouseB,
        expiringItems
      };
    });
  }, [dynamicCategories, inventory, outgoingReleasesList, incomingGoodsList]);

  // Calculate LGU totals per category
  const lguTotals = useMemo(() => {
    return dynamicCategories.reduce((acc, category) => {
      const total = lguWarehouseData.reduce((sum, lgu) => {
        const val = (lgu as Record<string, any>)[category];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
      acc[category] = total;
      return acc;
    }, {} as Record<string, number>);
  }, [dynamicCategories, lguWarehouseData]);

  // Combine main warehouse and LGU data
  const combinedData = useMemo(() => {
    return displayData.map((item) => ({
      ...item,
      lguTotal: lguTotals[item.category] || 0,
      grandTotal: item.totalStock + (lguTotals[item.category] || 0),
      selectedLguStock: (() => {
        if (selectedLguFilter === 'All') return lguTotals[item.category] || 0;
        const lguRecord = lguWarehouseData.find((lgu) => lgu.warehouse === selectedLguFilter);
        const val = lguRecord ? (lguRecord as Record<string, number | string>)[item.category] : 0;
        return typeof val === 'number' ? val : 0;
      })()
    }));
  }, [displayData, lguTotals, selectedLguFilter, lguWarehouseData]);

  // Filtered dataset matching search, category, stock health, and facility scope
  const filteredData = useMemo(() => {
    return combinedData.filter((item) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!item.category.toLowerCase().includes(q)) return false;
      }

      // 2. Category Dropdown
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // 3. Stock Buffer Health
      const activeBuffer =
        facilityScope === 'oton'
          ? item.warehouseA
          : facilityScope === 'pototan'
          ? item.warehouseB
          : facilityScope === 'lgu'
          ? item.selectedLguStock
          : facilityScope === 'all'
          ? item.grandTotal
          : item.totalStock;

      if (stockHealthFilter === 'low' && activeBuffer >= 500) return false;
      if (stockHealthFilter === 'expiring' && item.expiringItems <= 0) return false;
      if (stockHealthFilter === 'optimal' && activeBuffer < 500) return false;

      // 4. Facility Scope Specificity
      if (facilityScope === 'oton' && item.warehouseA <= 0 && !searchQuery.trim() && selectedCategory === 'All') {
        return false;
      }
      if (facilityScope === 'pototan' && item.warehouseB <= 0 && !searchQuery.trim() && selectedCategory === 'All') {
        return false;
      }
      if (facilityScope === 'lgu' && item.selectedLguStock <= 0 && !searchQuery.trim() && selectedCategory === 'All') {
        return false;
      }

      return true;
    });
  }, [combinedData, searchQuery, selectedCategory, stockHealthFilter, facilityScope]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Totals for top KPI banners
  const warehouseATotal = displayData.reduce((sum, item) => sum + item.warehouseA, 0);
  const warehouseBTotal = displayData.reduce((sum, item) => sum + item.warehouseB, 0);
  const totalMainWarehouse = warehouseATotal + warehouseBTotal;
  const totalLGUWarehouse = Object.values(lguTotals).reduce((sum, val) => sum + val, 0);
  const totalReleased = displayData.reduce((sum, item) => sum + item.released, 0);
  const totalExpiring = displayData.reduce((sum, item) => sum + item.expiringItems, 0);

  // Chart data comparing warehouses (includes LGUs only if scope is 'all' or 'lgu')
  const chartData = useMemo(() => {
    return dynamicCategories.map((category) => {
      const inventoryItem = displayData.find((item) => item.category?.toLowerCase() === category.toLowerCase());
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
  }, [dynamicCategories, displayData, lguWarehouseData]);

  // Critical items for alert notices
  const lowStockItems = displayData.filter((item) => item.available < 500);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regional Warehouses Inventory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Centrally monitoring Oton and Pototan main hubs, stock balance, and prepositioned relief supplies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExportPdfOpen(true)}
            className="px-4 py-2 bg-[#2500ba] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            title="Export selected filter and inventory view as printable PDF report"
          >
            <FileText className="w-4 h-4" />
            <span>Export as PDF</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards: Oton, Pototan, and Prepositioned Stock */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">Total Hub Buffer</span>
            <Package className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold">{totalMainWarehouse.toLocaleString()}</p>
          <p className="text-[11px] opacity-90 mt-1">Oton + Pototan Hubs</p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">Oton Main Hub</span>
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold">{warehouseATotal.toLocaleString()}</p>
          <p className="text-[11px] opacity-90 mt-1">Western Panay Hub</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">Pototan Main Hub</span>
            <Building2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold">{warehouseBTotal.toLocaleString()}</p>
          <p className="text-[11px] opacity-90 mt-1">Central Panay Hub</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 text-white shadow-sm">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">Prepositioned in LGUs</span>
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold">{totalLGUWarehouse.toLocaleString()}</p>
          <p className="text-[11px] opacity-90 mt-1">Local Municipal Reserves</p>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-4 text-white shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between opacity-80 mb-1">
            <span className="text-xs font-semibold">Total Dispatched</span>
            <TrendingDown className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold">{totalReleased.toLocaleString()}</p>
          <p className="text-[11px] opacity-90 mt-1">Released to Relief</p>
        </div>
      </div>

      {/* Critical Stock Notices & Expirations (Collapsible) */}
      {(lowStockItems.length > 0 || totalExpiring > 0) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Critical Hub Notices &amp; Buffer Warnings
            </span>
            <button
              type="button"
              onClick={() => {
                const areAllCollapsed =
                  (lowStockItems.length === 0 || isLowStockCollapsed) &&
                  (totalExpiring === 0 || isExpirationCollapsed);
                const nextState = !areAllCollapsed;
                setIsLowStockCollapsed(nextState);
                setIsExpirationCollapsed(nextState);
              }}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            >
              {(lowStockItems.length === 0 || isLowStockCollapsed) &&
              (totalExpiring === 0 || isExpirationCollapsed)
                ? 'Expand All Notices'
                : 'Minimize All Notices'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 transition-all">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsLowStockCollapsed((prev) => !prev)}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-yellow-900 text-sm">Low Stock Alert</h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-200 text-yellow-800">
                          {lowStockItems.length}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-800 mt-0.5">
                        {lowStockItems.length}{' '}
                        {lowStockItems.length === 1 ? 'category has' : 'categories have'} low hub buffer (below 500 kits)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLowStockCollapsed((prev) => !prev);
                    }}
                    className="p-1 rounded-md text-yellow-800 hover:bg-yellow-200/60 transition-colors cursor-pointer"
                    title={isLowStockCollapsed ? 'Expand Low Stock Alert' : 'Minimize Low Stock Alert'}
                  >
                    {isLowStockCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>
                </div>

                {!isLowStockCollapsed && (
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                    {lowStockItems.map((item) => (
                      <div key={item.category} className="bg-white rounded p-2 border border-yellow-200 shadow-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-900">{item.category}</span>
                          <span className="text-sm font-bold text-yellow-700">{item.available} available</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expiration Alert */}
            {totalExpiring > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 transition-all">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsExpirationCollapsed((prev) => !prev)}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-red-900 text-sm">Expiration Warning</h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-200 text-red-800">
                          {totalExpiring}
                        </span>
                      </div>
                      <p className="text-xs text-red-800 mt-0.5">
                        {totalExpiring} items expiring in warehouse within 30 days
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpirationCollapsed((prev) => !prev);
                    }}
                    className="p-1 rounded-md text-red-800 hover:bg-red-200/60 transition-colors cursor-pointer"
                    title={isExpirationCollapsed ? 'Expand Expiration Warning' : 'Minimize Expiration Warning'}
                  >
                    {isExpirationCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                  </button>
                </div>

                {!isExpirationCollapsed && (
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                    {displayData
                      .filter((item) => item.expiringItems > 0)
                      .map((item) => (
                        <div key={item.category} className="bg-white rounded p-2 border border-red-200 shadow-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm text-gray-900">{item.category}</span>
                            <span className="text-sm font-bold text-red-700">{item.expiringItems} expiring</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Facility Scope, Search & Buffer Filters */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs space-y-4">
        {/* Scope Tabs: Main Hubs Focus vs Include LGUs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Facility Filter Scope
            </span>
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFacilityScope('main');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  facilityScope === 'main'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                Main Hubs (Oton &amp; Pototan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacilityScope('oton');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  facilityScope === 'oton'
                    ? 'bg-green-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                Oton Hub Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacilityScope('pototan');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  facilityScope === 'pototan'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                Pototan Hub Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacilityScope('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  facilityScope === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                Include LGUs (All Regional Facilities)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFacilityScope('lgu');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  facilityScope === 'lgu'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                LGU Stock Only
              </button>
            </div>
          </div>

          {/* Sub-selector for specific LGU when LGU scope is selected */}
          {(facilityScope === 'lgu' || facilityScope === 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Filter Specific LGU:</span>
              <select
                value={selectedLguFilter}
                onChange={(e) => {
                  setSelectedLguFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Municipalities ({lguWarehouseData.length})</option>
                {lguWarehouseData.map((lgu) => (
                  <option key={lgu.warehouse} value={lgu.warehouse}>
                    {lgu.warehouse}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search, Commodity Category, and Stock Buffer Health Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search commodity (e.g. food pack, hygiene)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Categories ({dynamicCategories.length})</option>
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={stockHealthFilter}
              onChange={(e) => {
                setStockHealthFilter(e.target.value as 'all' | 'low' | 'expiring' | 'optimal');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Buffer Levels</option>
              <option value="low">Low Stock Buffer (&lt; 500 units)</option>
              <option value="expiring">Expiring Soon (&le; 30 Days)</option>
              <option value="optimal">Adequate Buffer (&ge; 500 units)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Warehouse Stock Comparison Chart (Collapsible) */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {facilityScope === 'all' || facilityScope === 'lgu'
                ? 'Regional Hub & LGU Stock Distribution'
                : 'Oton vs. Pototan Main Warehouse Stock Balance'}
            </h3>
            <p className="text-xs text-gray-500">
              {facilityScope === 'all' || facilityScope === 'lgu'
                ? 'Commodity volumes across Oton Hub, Pototan Hub, and prepositioned municipal stocks'
                : 'Comparison of prepositioned relief inventory between Panay regional main warehouses'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsChartCollapsed((prev) => !prev)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
          >
            {isChartCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            <span>{isChartCollapsed ? 'Expand Chart' : 'Minimize Chart'}</span>
          </button>
        </div>

        {!isChartCollapsed && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Bar dataKey="Oton Main Warehouse" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pototan Main Warehouse" fill="#9333ea" radius={[4, 4, 0, 0]} />
                {(facilityScope === 'all' || facilityScope === 'lgu') && (
                  <Bar dataKey="All LGUs" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {facilityScope === 'main'
                ? 'Main Regional Warehouses Inventory'
                : facilityScope === 'oton'
                ? 'Oton Main Warehouse Inventory'
                : facilityScope === 'pototan'
                ? 'Pototan Main Warehouse Inventory'
                : facilityScope === 'lgu'
                ? `LGU Prepositioned Stock (${selectedLguFilter})`
                : 'Consolidated Inventory (Main Hubs + LGUs)'}
            </h3>
            <p className="text-xs text-gray-500">
              Stock availability, hub balance, and prepositioning buffers
            </p>
          </div>
          <span className="text-xs font-bold text-gray-700 bg-gray-200/80 px-2.5 py-1 rounded-full">
            {filteredData.length} Commodities
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Commodity Category</th>

                {/* Show Oton and Pototan for all scopes except LGU-only */}
                {facilityScope !== 'lgu' && (
                  <>
                    <th className="px-5 py-3.5 text-right text-green-700">Oton Hub</th>
                    <th className="px-5 py-3.5 text-right text-purple-700">Pototan Hub</th>
                  </>
                )}

                {/* Show Hub Balance bar on default main warehouses view */}
                {facilityScope === 'main' && (
                  <>
                    <th className="px-5 py-3.5 text-right text-gray-900">Total Hub Stock</th>
                    <th className="px-5 py-3.5 text-center">Hub Balance</th>
                  </>
                )}

                {/* Show LGU columns when 'all' or 'lgu' scope is active */}
                {(facilityScope === 'all' || facilityScope === 'lgu') && (
                  <th className="px-5 py-3.5 text-right text-indigo-700">
                    {selectedLguFilter !== 'All' ? selectedLguFilter : 'LGU Prepositioned'}
                  </th>
                )}

                {facilityScope === 'all' && (
                  <th className="px-5 py-3.5 text-right text-gray-900">Grand Total</th>
                )}

                <th className="px-5 py-3.5 text-right text-orange-600">Dispatched</th>
                <th className="px-5 py-3.5 text-right text-blue-700">Available</th>
                <th className="px-5 py-3.5 text-center text-red-600">Expiring (&le;30d)</th>
                <th className="px-5 py-3.5 text-center">Buffer Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((item) => {
                const otonStock = item.warehouseA;
                const pototanStock = item.warehouseB;
                const hubStock = item.totalStock;
                const otonPct = hubStock > 0 ? Math.round((otonStock / hubStock) * 100) : 50;
                const pototanPct = 100 - otonPct;

                const displayAvailable =
                  facilityScope === 'oton'
                    ? item.warehouseA
                    : facilityScope === 'pototan'
                    ? item.warehouseB
                    : facilityScope === 'lgu'
                    ? item.selectedLguStock
                    : facilityScope === 'all'
                    ? item.grandTotal
                    : item.totalStock;

                const isLowStock = displayAvailable < 500;
                const isOptimal = displayAvailable >= 1000;

                return (
                  <tr key={item.category} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-gray-900">{item.category}</span>
                      </div>
                    </td>

                    {facilityScope !== 'lgu' && (
                      <>
                        <td className="px-5 py-3.5 text-right font-bold text-green-700 whitespace-nowrap">
                          {item.warehouseA.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-purple-700 whitespace-nowrap">
                          {item.warehouseB.toLocaleString()}
                        </td>
                      </>
                    )}

                    {facilityScope === 'main' && (
                      <>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                          {item.totalStock.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <div className="w-24 mx-auto space-y-1">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden flex">
                              <div
                                className="bg-green-600 h-1.5"
                                style={{ width: `${otonPct}%` }}
                                title={`Oton: ${otonPct}%`}
                              />
                              <div
                                className="bg-purple-600 h-1.5"
                                style={{ width: `${pototanPct}%` }}
                                title={`Pototan: ${pototanPct}%`}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-bold">
                              <span className="text-green-700">{otonPct}%</span>
                              <span className="text-purple-700">{pototanPct}%</span>
                            </div>
                          </div>
                        </td>
                      </>
                    )}

                    {(facilityScope === 'all' || facilityScope === 'lgu') && (
                      <td className="px-5 py-3.5 text-right font-bold text-indigo-700 whitespace-nowrap">
                        {item.selectedLguStock.toLocaleString()}
                      </td>
                    )}

                    {facilityScope === 'all' && (
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                        {item.grandTotal.toLocaleString()}
                      </td>
                    )}

                    <td className="px-5 py-3.5 text-right font-bold text-orange-600 whitespace-nowrap">
                      {item.released.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-right font-bold text-blue-700 whitespace-nowrap">
                      {displayAvailable.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {item.expiringItems > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                          {item.expiringItems} expiring
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                          Safe (&gt;30d)
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : isOptimal
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isLowStock
                          ? 'Low Buffer'
                          : isOptimal
                          ? 'Optimal Buffer'
                          : 'Adequate Stock'}
                      </span>
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
            <p className="text-gray-500 font-medium">No inventory commodities match your filters.</p>
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
              of <span className="font-bold text-gray-900">{filteredData.length}</span> commodities
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

      {/* Official Inventory PDF Export Modal */}
      <InventoryReportPdfModal
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        facilityScope={facilityScope}
        selectedLguFilter={selectedLguFilter}
        selectedCategory={selectedCategory}
        searchQuery={searchQuery}
        stockHealthFilter={stockHealthFilter}
        filteredData={filteredData}
        allData={combinedData}
        lowStockItems={lowStockItems}
        totalExpiring={totalExpiring}
        warehouseATotal={warehouseATotal}
        warehouseBTotal={warehouseBTotal}
        totalMainWarehouse={totalMainWarehouse}
        totalLGUWarehouse={totalLGUWarehouse}
        totalReleased={totalReleased}
        adminProfile={adminProfile}
      />
    </div>
  );
}
export default InventoryMonitoring;
