import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  FileSignature,
  MapPin,
  Package,
  TrendingUp,
  TrendingDown,
  TruckIcon,
  Search,
  Calendar,
  Filter,
  BarChart3,
  Clock,
  ShieldAlert,
  ArrowUpDown,
  Building2,
  RefreshCw,
  Layers,
  FileText,
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type {
  DiscrepancyReport,
  IncomingGoods,
  InventoryItem,
  LGUPriorityReport,
  OutgoingRelease,
  OutgoingStatus
} from '../../hooks/useInventoryState';
import type { LguRecord, WarehouseRecord, KitTypeRecord } from '../../services/backendApi';
import type { SynchronizedLgu } from '../../lib/lguSync';
import { getLguStockForCategory } from '../../lib/lguSync';
import { parseIncidentInfo, DISASTER_REPORT_REASONS } from '../../lib/incidentHelper';
import { DEFAULT_KIT_NAMES } from '../../lib/lguMatching';

interface DashboardState {
  inventory: InventoryItem[];
  incomingGoodsList: IncomingGoods[];
  outgoingReleasesList: OutgoingRelease[];
  lguPriorityReports: LGUPriorityReport[];
  lgusList?: LguRecord[];
  synchronizedLgusList?: SynchronizedLgu[];
  warehousesList?: WarehouseRecord[];
  kitTypesList?: KitTypeRecord[];
  discrepancyReports: DiscrepancyReport[];
}

interface DashboardViewProps {
  inventoryState: DashboardState;
  onNavigate: (view: string) => void;
}

const priorityClasses = {
  Red: 'bg-red-100 text-red-700 border-red-200',
  Yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Green: 'bg-green-100 text-green-700 border-green-200'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DashboardView({ inventoryState, onNavigate }: DashboardViewProps) {
  const {
    inventory = [],
    incomingGoodsList = [],
    outgoingReleasesList = [],
    lguPriorityReports = [],
    lgusList = [],
    synchronizedLgusList = [],
    discrepancyReports = []
  } = inventoryState;

  const [showWarehouseOverview, setShowWarehouseOverview] = useState(false);

  // Analytics Filters State
  const [timeFilter, setTimeFilter] = useState<'all' | 'monthly' | 'quarterly'>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDisasterFilter, setSelectedDisasterFilter] = useState<string>('All');
  const [selectedLguFilter, setSelectedLguFilter] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // Chart 1 mode: Disaster vs Monthly timeline
  const [chartViewMode, setChartViewMode] = useState<'disaster' | 'timeline'>('disaster');

  // Bottom History Log State
  const [historyTab, setHistoryTab] = useState<'all' | 'requests' | 'allocated' | 'released'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('All');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 8;

  // Use synchronized LGUs if provided, otherwise fallback to master lgusList
  const effectiveLgus: (LguRecord | SynchronizedLgu)[] = useMemo(() => {
    if (synchronizedLgusList && synchronizedLgusList.length > 0) return synchronizedLgusList;
    return lgusList;
  }, [synchronizedLgusList, lgusList]);

  // Harmonized Priority Reports matching LGU Monitor
  const effectiveLguPriorities = useMemo(() => {
    const reportMap = new Map<string, LGUPriorityReport>();
    lguPriorityReports.forEach((report) => {
      const key = (report.municipality || report.lguName).trim().toLowerCase();
      if (key) reportMap.set(key, report);
    });

    const fromMaster = effectiveLgus.map((lgu) => {
      const key = lgu.municipality.trim().toLowerCase();
      const report = reportMap.get(key);
      const foodPacks = report?.foodPacks ?? lgu.foodPacks ?? getLguStockForCategory(lgu, 'Food Pack');
      const affectedFamilies = report?.affectedFamilies ?? lgu.affectedFamilies ?? 0;
      const damageIndex = report?.damageIndex ?? lgu.damageIndex ?? 0;
      const baseUrgency = report?.urgencyScore ?? lgu.urgencyScore ?? 0;
      const computedUrgency = baseUrgency || Math.min(100, Math.max(10, Math.round((foodPacks < 150 ? 45 : foodPacks < 300 ? 25 : 8) + Math.min(35, affectedFamilies / 30) + damageIndex * 0.2)));
      const priorityColor = report?.priorityColor ?? lgu.priorityColor ?? (computedUrgency >= 75 ? 'Red' : computedUrgency >= 50 ? 'Yellow' : 'Green');

      return {
        id: report?.id ?? lgu.id,
        municipality: lgu.municipality,
        province: lgu.province,
        lguName: lgu.lguName,
        reportedAt: report?.reportedAt ?? lgu.lastReportedAt ?? lgu.updatedAt ?? lgu.createdAt ?? '',
        foodPacks,
        hygieneKits: report?.hygieneKits ?? lgu.hygieneKits ?? getLguStockForCategory(lgu, 'Hygiene Kit'),
        familyKits: report?.familyKits ?? lgu.familyKits ?? getLguStockForCategory(lgu, 'Family Kit'),
        affectedFamilies,
        damageIndex,
        urgencyScore: computedUrgency,
        priorityColor: priorityColor === 'Red' || priorityColor === 'Yellow' || priorityColor === 'Green' ? priorityColor : 'Green',
        recommendation: report?.recommendation ?? lgu.recommendation ?? ''
      } satisfies LGUPriorityReport;
    });

    if (fromMaster.length > 0) {
      return fromMaster.sort((a, b) => b.urgencyScore - a.urgencyScore);
    }

    return [...lguPriorityReports].sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [lguPriorityReports, effectiveLgus]);

  // Helper to extract disaster reason from a release
  const getReleaseDisaster = (r: OutgoingRelease): string => {
    if (r.reportReason && r.reportReason.trim()) return r.reportReason.trim();
    const parsed = parseIncidentInfo(r.incidentCode);
    if (parsed.reportReason && parsed.reportReason.trim()) return parsed.reportReason.trim();
    return 'General Relief Augmentation';
  };

  // Distinct Disasters for Filter
  const availableDisasters = useMemo(() => {
    const set = new Set<string>();
    DISASTER_REPORT_REASONS.forEach(r => set.add(r));
    outgoingReleasesList.forEach(r => {
      const d = getReleaseDisaster(r);
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [outgoingReleasesList]);

  // Distinct LGUs for Filter
  const availableLgus = useMemo(() => {
    const set = new Set<string>();
    effectiveLgus.forEach(l => {
      if (l.municipality) set.add(l.municipality);
    });
    outgoingReleasesList.forEach(r => {
      if (r.municipality) set.add(r.municipality);
    });
    return Array.from(set).sort();
  }, [effectiveLgus, outgoingReleasesList]);

  // Distinct Categories for Filter
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_KIT_NAMES.forEach(c => set.add(c));
    inventory.forEach(i => set.add(i.category));
    outgoingReleasesList.forEach(r => {
      if (r.fnfiCategory) set.add(r.fnfiCategory);
    });
    return Array.from(set).sort();
  }, [inventory, outgoingReleasesList]);

  // Filtered Releases based on all selected analytics filters
  const filteredReleases = useMemo(() => {
    return outgoingReleasesList.filter((r) => {
      // 1. Time filter
      const dateStr = r.dateAllocated || r.incidentDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const month = d.getMonth(); // 0 to 11

          if (timeFilter === 'quarterly' && selectedQuarter !== 'all') {
            const quarterMap: Record<string, number[]> = {
              Q1: [0, 1, 2],
              Q2: [3, 4, 5],
              Q3: [6, 7, 8],
              Q4: [9, 10, 11]
            };
            if (!quarterMap[selectedQuarter]?.includes(month)) return false;
          }

          if (timeFilter === 'monthly' && selectedMonth !== 'all') {
            if (month !== parseInt(selectedMonth, 10)) return false;
          }
        }
      }

      // 2. Disaster filter
      if (selectedDisasterFilter !== 'All') {
        const dName = getReleaseDisaster(r);
        if (dName.toLowerCase() !== selectedDisasterFilter.toLowerCase()) return false;
      }

      // 3. LGU filter
      if (selectedLguFilter !== 'All') {
        if (!r.municipality || r.municipality.toLowerCase() !== selectedLguFilter.toLowerCase()) return false;
      }

      // 4. Category filter
      if (selectedCategoryFilter !== 'All') {
        if (!r.fnfiCategory || r.fnfiCategory.toLowerCase() !== selectedCategoryFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [outgoingReleasesList, timeFilter, selectedQuarter, selectedMonth, selectedDisasterFilter, selectedLguFilter, selectedCategoryFilter]);

  // Total Metric KPI Computations
  const totalWarehouseInventory = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.totalStock ?? (item.warehouseA + item.warehouseB)), 0);
  }, [inventory]);

  const totalLguOnHand = useMemo(() => {
    return effectiveLgus.reduce((sum, lgu) => {
      const stockObj = lgu.currentStock || {};
      const stockSum = Object.values(stockObj).reduce((s, v) => s + (Number(v) || 0), 0);
      return sum + stockSum;
    }, 0);
  }, [effectiveLgus]);

  const totalGoodsAllocated = useMemo(() => {
    return filteredReleases.reduce((sum, r) => sum + (Number(r.amountApproved || r.amountRequested) || 0), 0);
  }, [filteredReleases]);

  const totalGoodsRequested = useMemo(() => {
    return filteredReleases.reduce((sum, r) => sum + (Number(r.amountRequested) || 0), 0);
  }, [filteredReleases]);

  const postedBatchCount = incomingGoodsList.filter(item => item.status === 'Verified' || item.status === 'Minted').length;
  const releaseRecordCount = outgoingReleasesList.filter(item => item.handoverContractId).length;
  const gpsAcceptedCount = outgoingReleasesList.filter(item => item.receiverGps).length;
  const urgentLGUs = effectiveLguPriorities.filter(report => report.priorityColor === 'Red');
  const activeReleases = outgoingReleasesList.filter(item => ['Released', 'In Transit', 'Correction Requested'].includes(item.deliveryStatus));
  const incomingForReview = incomingGoodsList.filter(item => item.status === 'Pending Verification').length;

  // CHART 1: Total Goods Allocated by Disaster Reason
  const disasterAllocationData = useMemo(() => {
    const map: Record<string, { disaster: string; allocated: number; requested: number; count: number }> = {};
    filteredReleases.forEach((r) => {
      const disaster = getReleaseDisaster(r);
      if (!map[disaster]) {
        map[disaster] = { disaster, allocated: 0, requested: 0, count: 0 };
      }
      map[disaster].allocated += Number(r.amountApproved || r.amountRequested) || 0;
      map[disaster].requested += Number(r.amountRequested) || 0;
      map[disaster].count += 1;
    });

    const result = Object.values(map).sort((a, b) => b.allocated - a.allocated);
    return result.slice(0, 7);
  }, [filteredReleases]);

  // CHART 1 ALT: Monthly Allocation Timeline
  const timelineAllocationData = useMemo(() => {
    const map: Record<string, { month: string; monthIndex: number; allocated: number; requested: number }> = {};
    MONTH_NAMES.forEach((m, idx) => {
      map[m] = { month: m.slice(0, 3), monthIndex: idx, allocated: 0, requested: 0 };
    });

    filteredReleases.forEach((r) => {
      const dStr = r.dateAllocated || r.incidentDate;
      if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const mName = MONTH_NAMES[d.getMonth()];
          if (map[mName]) {
            map[mName].allocated += Number(r.amountApproved || r.amountRequested) || 0;
            map[mName].requested += Number(r.amountRequested) || 0;
          }
        }
      }
    });

    return Object.values(map);
  }, [filteredReleases]);

  // CHART 2: Most Frequent LGUs Allocated
  const topLgusAllocatedData = useMemo(() => {
    const map: Record<string, { municipality: string; province: string; allocated: number; requested: number; shipments: number; urgencyScore: number }> = {};
    filteredReleases.forEach((r) => {
      const muni = r.municipality || 'Unknown';
      if (!map[muni]) {
        const matchedLgu = effectiveLgus.find(l => l.municipality.toLowerCase() === muni.toLowerCase());
        map[muni] = {
          municipality: muni,
          province: r.province || matchedLgu?.province || 'Iloilo',
          allocated: 0,
          requested: 0,
          shipments: 0,
          urgencyScore: matchedLgu?.urgencyScore || 0
        };
      }
      map[muni].allocated += Number(r.amountApproved || r.amountRequested) || 0;
      map[muni].requested += Number(r.amountRequested) || 0;
      map[muni].shipments += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.allocated - a.allocated)
      .slice(0, 8);
  }, [filteredReleases, effectiveLgus]);

  // CHART 3: Stock vs Demand & Shortage Analysis
  const stockVsDemandData = useMemo(() => {
    const categories = ['Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit', 'Kitchen Kit', 'Laminated Sack', 'RTEF'];

    return categories.map((cat) => {
      // 1. Warehouse stock
      const whItem = inventory.find(i => i.category.toLowerCase().includes(cat.toLowerCase()));
      const warehouseStock = whItem ? (whItem.totalStock ?? (whItem.warehouseA + whItem.warehouseB)) : 0;

      // 2. LGU on-hand
      const lguOnHand = effectiveLgus.reduce((sum, lgu) => {
        return sum + (getLguStockForCategory(lgu, cat) || 0);
      }, 0);

      // 3. Demand (requested)
      const demand = filteredReleases
        .filter(r => r.fnfiCategory && r.fnfiCategory.toLowerCase().includes(cat.toLowerCase()))
        .reduce((sum, r) => sum + (Number(r.amountRequested) || 0), 0);

      // 4. Allocated (approved)
      const allocated = filteredReleases
        .filter(r => r.fnfiCategory && r.fnfiCategory.toLowerCase().includes(cat.toLowerCase()))
        .reduce((sum, r) => sum + (Number(r.amountApproved || r.amountRequested) || 0), 0);

      const netGap = warehouseStock - demand;
      const isShortage = netGap < 0;

      return {
        category: cat,
        warehouseStock,
        lguOnHand,
        demand,
        allocated,
        netGap,
        status: isShortage ? 'Deficit' : 'Surplus'
      };
    });
  }, [inventory, effectiveLgus, filteredReleases]);

  // CHART 4: Incoming Expirations on LGUs and Warehouses
  const { expirationBuckets, expiringBatches } = useMemo(() => {
    const today = new Date();
    const buckets = [
      { name: '< 30d (Critical)', count: 0, items: 0, color: '#ef4444' },
      { name: '30-90d (Warning)', count: 0, items: 0, color: '#f59e0b' },
      { name: '91-180d (Moderate)', count: 0, items: 0, color: '#3b82f6' },
      { name: '> 180d (Fresh)', count: 0, items: 0, color: '#10b981' }
    ];

    const batches: Array<{
      id: string;
      category: string;
      quantity: number;
      expirationDate: string;
      daysRemaining: number;
      destination: string;
      source: string;
      urgency: 'critical' | 'warning' | 'moderate' | 'fresh';
    }> = [];

    incomingGoodsList.forEach((item) => {
      if (!item.expirationDate) return;
      const exp = new Date(item.expirationDate);
      if (isNaN(exp.getTime())) return;
      const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let urgency: 'critical' | 'warning' | 'moderate' | 'fresh' = 'fresh';
      if (days <= 30) {
        buckets[0].items += item.quantity;
        buckets[0].count += 1;
        urgency = 'critical';
      } else if (days <= 90) {
        buckets[1].items += item.quantity;
        buckets[1].count += 1;
        urgency = 'warning';
      } else if (days <= 180) {
        buckets[2].items += item.quantity;
        buckets[2].count += 1;
        urgency = 'moderate';
      } else {
        buckets[3].items += item.quantity;
        buckets[3].count += 1;
        urgency = 'fresh';
      }

      batches.push({
        id: item.id,
        category: item.fnfiCategory,
        quantity: item.quantity,
        expirationDate: item.expirationDate,
        daysRemaining: days,
        destination: item.destination,
        source: item.source,
        urgency
      });
    });

    batches.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      expirationBuckets: buckets,
      expiringBatches: batches.slice(0, 5)
    };
  }, [incomingGoodsList]);

  // BOTTOM HISTORY LOG DATA: Requests, Allocated, and Releases
  const filteredHistory = useMemo(() => {
    return outgoingReleasesList.filter((r) => {
      // 1. Tab filter
      if (historyTab === 'requests') {
        if (!r.amountRequested || r.amountRequested <= 0) return false;
      } else if (historyTab === 'allocated') {
        if (!['Allocating', 'Approved', 'Packed'].includes(r.deliveryStatus)) return false;
      } else if (historyTab === 'released') {
        if (!['Released', 'In Transit', 'Delivered', 'Accepted', 'Distributed'].includes(r.deliveryStatus)) return false;
      }

      // 2. Status filter
      if (historyStatusFilter !== 'All') {
        if (r.deliveryStatus !== historyStatusFilter) return false;
      }

      // 3. Search query
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const matched =
          r.drNumber?.toLowerCase().includes(query) ||
          r.incidentCode?.toLowerCase().includes(query) ||
          r.municipality?.toLowerCase().includes(query) ||
          r.lguName?.toLowerCase().includes(query) ||
          r.fnfiCategory?.toLowerCase().includes(query) ||
          r.warehouseSource?.toLowerCase().includes(query);
        if (!matched) return false;
      }

      return true;
    });
  }, [outgoingReleasesList, historyTab, historyStatusFilter, historySearch]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / historyPageSize) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, historyPage, historyPageSize]);

  const resetFilters = () => {
    setTimeFilter('all');
    setSelectedQuarter('all');
    setSelectedMonth('all');
    setSelectedDisasterFilter('All');
    setSelectedLguFilter('All');
    setSelectedCategoryFilter('All');
  };

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white shadow-lg border border-blue-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300 bg-blue-900/60 px-2.5 py-0.5 rounded border border-blue-700/50">
                DSWD Field Office VI Logistics
              </span>
              <span className="text-xs text-blue-200">
                Integrated Operational Intelligence
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Relief Goods Logistics & Analytics Dashboard</h1>
            <p className="text-xs md:text-sm text-blue-100/90 mt-1 max-w-2xl">
              Real-time synchronization across Panay Island LGUs, Oton & Pototan main warehouses, disaster allocations, stock shortages, and GPS-verified deliveries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('outgoing')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <TruckIcon className="w-3.5 h-3.5" />
              <span>New Release</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lgu-monitoring')}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>LGU Monitor</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Warehouse Stock */}
        <button
          type="button"
          onClick={() => setShowWarehouseOverview(curr => !curr)}
          className="bg-white rounded-xl p-5 border border-blue-200/80 shadow-xs text-left hover:border-blue-400 hover:shadow-md transition cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWarehouseOverview ? 'rotate-180' : ''}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3 font-mono">{totalWarehouseInventory.toLocaleString()}</p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">Warehouse Inventory</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
            <span>Oton & Pototan Hubs</span>
            <span className="text-blue-600 font-semibold group-hover:underline">
              {showWarehouseOverview ? 'Hide breakdown' : 'Show FNFI breakdown'}
            </span>
          </div>
        </button>

        {/* Card 2: LGU On-Hand Inventory */}
        <button
          type="button"
          onClick={() => onNavigate('lgu-monitoring')}
          className="bg-white rounded-xl p-5 border border-purple-200/80 shadow-xs text-left hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              {effectiveLgus.length} LGUs
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3 font-mono">{totalLguOnHand.toLocaleString()}</p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">Total LGU Stock On-Hand</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
            <span>Staged Relief Kits</span>
            <span className="text-purple-600 font-semibold group-hover:underline">View LGUs</span>
          </div>
        </button>

        {/* Card 3: Goods Allocated & Released */}
        <button
          type="button"
          onClick={() => onNavigate('outgoing')}
          className="bg-white rounded-xl p-5 border border-emerald-200/80 shadow-xs text-left hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TruckIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {releaseRecordCount} Signed
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3 font-mono">{totalGoodsAllocated.toLocaleString()}</p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">Approved Goods Allocated</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
            <span>{gpsAcceptedCount} GPS Confirmed</span>
            <span className="text-emerald-600 font-semibold group-hover:underline">View Outgoing</span>
          </div>
        </button>

        {/* Card 4: Red Priority LGUs */}
        <button
          type="button"
          onClick={() => onNavigate('lgu-monitoring')}
          className="bg-white rounded-xl p-5 border border-rose-200/80 shadow-xs text-left hover:border-rose-400 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Urgent Need
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3 font-mono">{urgentLGUs.length}</p>
          <p className="text-xs font-bold text-gray-700 mt-0.5">Red Priority Municipalities</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
            <span>Critical Stock Deficit</span>
            <span className="text-rose-600 font-semibold group-hover:underline">Prioritize Relief</span>
          </div>
        </button>
      </div>

      {/* Warehouse FNFI Expandable Overview */}
      {showWarehouseOverview && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Regional Warehouse Inventory Breakdown</h3>
              <p className="text-xs text-gray-500">Live FNFI stock across Oton and Pototan staging centers</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory-monitoring')}
              className="text-xs text-[#2500ba] font-bold hover:underline flex items-center gap-1"
            >
              <span>Manage Warehouses</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {inventory.map((item) => {
              const totalStock = item.totalStock ?? (item.warehouseA + item.warehouseB);
              const otonQty = item.warehouseBreakdown?.['Oton Main Warehouse'] ?? item.warehouseA ?? 0;
              const pototanQty = item.warehouseBreakdown?.['Pototan Main Warehouse'] ?? item.warehouseB ?? 0;

              return (
                <div key={item.category} className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 text-center">
                  <p className="text-base font-bold text-gray-900 font-mono">{totalStock.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate" title={item.category}>{item.category}</p>
                  <div className="text-[10px] text-gray-500 mt-2 pt-1 border-t border-gray-200 flex flex-col gap-0.5">
                    <span>Oton: {otonQty.toLocaleString()}</span>
                    <span>Pototan: {pototanQty.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Analytics Control & Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#2500ba]" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Analytics & Operational Filters
            </h2>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              {filteredReleases.length} release records matched
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Time Mode Filter (Monthly / Quarterly / All) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Time Horizon</label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTimeFilter('all')}
                className={`py-1.5 rounded-lg transition ${timeFilter === 'all' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter('monthly')}
                className={`py-1.5 rounded-lg transition ${timeFilter === 'monthly' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter('quarterly')}
                className={`py-1.5 rounded-lg transition ${timeFilter === 'quarterly' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Quarterly
              </button>
            </div>
          </div>

          {/* 2. Sub-period Selector (Quarter or Month) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {timeFilter === 'quarterly' ? 'Select Quarter' : timeFilter === 'monthly' ? 'Select Month' : 'Time Interval'}
            </label>
            {timeFilter === 'quarterly' ? (
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
              >
                <option value="all">All Quarters (Q1 - Q4)</option>
                <option value="Q1">Q1 (Jan - Mar)</option>
                <option value="Q2">Q2 (Apr - Jun)</option>
                <option value="Q3">Q3 (Jul - Sep)</option>
                <option value="Q4">Q4 (Oct - Dec)</option>
              </select>
            ) : timeFilter === 'monthly' ? (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
              >
                <option value="all">All Months</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx.toString()}>{m}</option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-xs font-medium text-gray-500">
                Full Operational Timeline
              </div>
            )}
          </div>

          {/* 3. Disaster / Calamity Reason Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Disaster / Calamity Reason</label>
            <select
              value={selectedDisasterFilter}
              onChange={(e) => setSelectedDisasterFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
            >
              <option value="All">All Disaster Reasons</option>
              {availableDisasters.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 4. Destination LGU Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Destination Municipality / LGU</label>
            <select
              value={selectedLguFilter}
              onChange={(e) => setSelectedLguFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
            >
              <option value="All">All LGUs ({availableLgus.length})</option>
              {availableLgus.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 5. FNFI Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">FNFI Relief Commodity</label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
            >
              <option value="All">All Commodities</option>
              {availableCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Analytics Graphs & Charts Section (2x2 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Total Goods Allocated by Disaster Reason or Monthly Timeline */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#2500ba]" />
                <span>Goods Allocated by Disaster & Demand</span>
              </h3>
              <p className="text-xs text-gray-500">
                {chartViewMode === 'disaster' ? 'Approved relief goods vs requested needs per calamity' : 'Allocation volume over time across Panay'}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartViewMode('disaster')}
                className={`px-2.5 py-1 rounded-md transition ${chartViewMode === 'disaster' ? 'bg-white text-[#2500ba] font-bold shadow-xs' : 'text-gray-600'}`}
              >
                By Disaster
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('timeline')}
                className={`px-2.5 py-1 rounded-md transition ${chartViewMode === 'timeline' ? 'bg-white text-[#2500ba] font-bold shadow-xs' : 'text-gray-600'}`}
              >
                Timeline
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {chartViewMode === 'disaster' ? (
              disasterAllocationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disasterAllocationData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="disaster"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      formatter={(val: any) => [Number(val || 0).toLocaleString() + ' kits', '']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="requested" name="Requested Demand" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="allocated" name="Approved Allocated" fill="#2500ba" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No allocation data matching the selected filters.
                </div>
              )
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineAllocationData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(val: any) => [Number(val || 0).toLocaleString() + ' kits', '']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="requested" name="Requested Demand" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="allocated" name="Approved Allocated" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-3 border-t border-gray-100">
            <span>Total Filtered Demand: <strong className="text-gray-800 font-mono">{totalGoodsRequested.toLocaleString()}</strong> kits</span>
            <span>Allocated: <strong className="text-[#2500ba] font-mono">{totalGoodsAllocated.toLocaleString()}</strong> kits</span>
          </div>
        </div>

        {/* CHART 2: Most Frequent LGUs Allocated */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-700" />
                <span>Most Frequent LGUs Allocated</span>
              </h3>
              <p className="text-xs text-gray-500">Top recipient municipalities by total relief volume and shipments</p>
            </div>
            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              Recipient Ranking
            </span>
          </div>

          <div className="h-72 w-full">
            {topLgusAllocatedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topLgusAllocatedData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <YAxis dataKey="municipality" type="category" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === 'allocated' ? Number(val || 0).toLocaleString() + ' kits' : `${val} shipments`,
                      name === 'allocated' ? 'Total Units Allocated' : 'Shipment Dispatches'
                    ]}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                  <Bar dataKey="allocated" name="Total Units Allocated" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No LGU allocation distribution recorded yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500 pt-3 border-t border-gray-100 gap-2">
            <span>Ranked across all active dispatches</span>
            <span className="text-purple-700 font-semibold cursor-pointer hover:underline" onClick={() => onNavigate('lgu-monitoring')}>
              Open LGU Priority Monitor &rarr;
            </span>
          </div>
        </div>

        {/* CHART 3: Stock vs Demand & Shortage Analysis */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Stock vs Demand / Shortage Analysis</span>
              </h3>
              <p className="text-xs text-gray-500">Warehouse stock vs staged LGU on-hand vs requested demand</p>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Supply Balance
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockVsDemandData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(val: any) => [Number(val || 0).toLocaleString() + ' kits', '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="warehouseStock" name="Warehouse Stock" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lguOnHand" name="LGU On-Hand" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="demand" name="Requested Demand" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Shortage Badges */}
          <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2 text-[11px]">
            {stockVsDemandData.map((item) => {
              const isDeficit = item.netGap < 0;
              return (
                <span
                  key={item.category}
                  className={`px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 ${
                    isDeficit ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <span>{item.category}:</span>
                  <span className="font-mono">{isDeficit ? `${item.netGap.toLocaleString()} Deficit` : `+${item.netGap.toLocaleString()} Surplus`}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* CHART 4: Incoming Expirations on LGUs / Warehouses */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span>Incoming Expirations & Shelf-Life Risk</span>
              </h3>
              <p className="text-xs text-gray-500">Relief stock aging and nearest-to-expire batch monitoring</p>
            </div>
            <span className="text-[10px] font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              Expiry Watch
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shelf-Life Urgency Bar Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expirationBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} angle={-15} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(val: any) => [Number(val || 0).toLocaleString() + ' items', 'Volume']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="items" name="Volume (Items)" radius={[6, 6, 0, 0]}>
                    {expirationBuckets.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Nearest to Expiry Queue */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Critical Batches</p>
              {expiringBatches.length > 0 ? (
                expiringBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      batch.urgency === 'critical'
                        ? 'bg-red-50/70 border-red-200 text-red-950'
                        : batch.urgency === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">{batch.category}</p>
                      <p className="text-[10px] text-gray-600 truncate">{batch.destination}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold">{batch.quantity.toLocaleString()} kits</p>
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        batch.daysRemaining <= 30 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {batch.daysRemaining > 0 ? `${batch.daysRemaining}d left` : 'Expired'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 p-4 text-center bg-gray-50 rounded-lg">
                  No expiring goods recorded in this window.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-3 border-t border-gray-100">
            <span>Critical (&lt;30d): <strong className="text-red-600 font-mono">{expirationBuckets[0].items.toLocaleString()}</strong></span>
            <span>Warning (30-90d): <strong className="text-amber-600 font-mono">{expirationBuckets[1].items.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* 5. Priority and Movement Overview + Follow-up Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Priority and Movement Overview</h3>
              <p className="text-xs text-gray-500">Operational summary for directing subsequent dispatches.</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#2500ba]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Incoming for Review', `${incomingForReview} deliveries need warehouse inspection or final posting.`],
              ['Ready or Moving Out', `${activeReleases.length} releases are released, in transit, or need correction.`],
              ['Confirmed Receipts', `${gpsAcceptedCount} deliveries have LGU receipt and GPS location confirmation.`],
              ['Urgent LGUs', `${urgentLGUs.length} municipalities are marked Red based on current supply deficit.`]
            ].map(([title, description]) => (
              <div key={title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="font-bold text-sm text-gray-900">{title}</p>
                <p className="text-xs text-gray-600 mt-1">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Release Follow-up Queue</h3>
          <p className="text-xs text-gray-500 mb-4">Outgoing records that require staff action or transit tracking.</p>

          <div className="space-y-3">
            {activeReleases.length > 0 ? (
              activeReleases.slice(0, 4).map((release) => (
                <button
                  key={release.drNumber}
                  type="button"
                  onClick={() => onNavigate('outgoing')}
                  className="w-full text-left p-3 bg-orange-50/70 rounded-xl border border-orange-200/60 hover:bg-orange-100/80 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 font-mono">{release.drNumber} &bull; {release.municipality}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{release.fnfiCategory} &bull; {release.amountApproved || release.amountRequested} kits</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 bg-white text-orange-700 border border-orange-200 rounded-full text-[10px] font-bold">
                      {release.deliveryStatus}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-xs text-green-800">
                All current releases are delivered or accepted without pending follow-up.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. LGU Priority List & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">LGU Vulnerability & Need Ranking</h3>
              <p className="text-xs text-gray-500">Live priority score based on stock deficit and affected population</p>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {effectiveLguPriorities.length} LGUs
            </span>
          </div>

          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-2">
            {effectiveLguPriorities.slice(0, 10).map(report => (
              <div key={report.id} className="flex items-center justify-between gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs text-gray-900 truncate">{report.municipality}, {report.province}</p>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    Families: {report.affectedFamilies.toLocaleString()} &bull; Food packs: {report.foodPacks}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{report.recommendation}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${priorityClasses[report.priorityColor]}`}>
                    {report.priorityColor}
                  </span>
                  <p className="text-sm font-bold text-gray-900 mt-1 font-mono">{report.urgencyScore} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Outgoing Release Activity</h3>
              <p className="text-xs text-gray-500">Latest relief dispatches from regional inventory</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('outgoing')}
              className="text-xs text-[#2500ba] font-bold hover:underline"
            >
              View All Releases
            </button>
          </div>

          <div className="space-y-3">
            {outgoingReleasesList.slice(0, 5).map(release => (
              <div key={release.drNumber} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-700">
                  {release.receiverGps ? <MapPin className="w-4 h-4 text-emerald-600" /> : <TruckIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-gray-900">{release.drNumber} &bull; {release.fnfiCategory}</p>
                  <p className="text-[11px] text-gray-600">
                    {release.amountApproved || release.amountRequested} kits to {release.municipality} ({release.province})
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    Status: <strong className="text-blue-700">{release.deliveryStatus}</strong> {release.receiverGps ? `&bull; GPS: ${release.receiverGps}` : ''}
                  </p>
                </div>
                {release.receiverGps && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. BOTTOM HISTORY FEED: Requests, Allocated, and Releases */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2500ba]" />
              <h3 className="text-base font-bold text-gray-900">Relief Operations History Log</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive audit trail of relief requests, allocations, and field dispatches
            </p>
          </div>

          {/* History Mode Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setHistoryTab('all'); setHistoryPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${historyTab === 'all' ? 'bg-white text-gray-900 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              All Activity ({outgoingReleasesList.length})
            </button>
            <button
              type="button"
              onClick={() => { setHistoryTab('requests'); setHistoryPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${historyTab === 'requests' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Requests
            </button>
            <button
              type="button"
              onClick={() => { setHistoryTab('allocated'); setHistoryPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${historyTab === 'allocated' ? 'bg-white text-purple-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Allocated
            </button>
            <button
              type="button"
              onClick={() => { setHistoryTab('released'); setHistoryPage(1); }}
              className={`px-3 py-1.5 rounded-lg transition ${historyTab === 'released' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Released & Delivered
            </button>
          </div>
        </div>

        {/* History Search & Sub-filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              placeholder="Search history by DR Number, Incident Code, Municipality, or Commodity..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={historyStatusFilter}
              onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#2500ba] w-full sm:w-auto"
            >
              <option value="All">All Statuses</option>
              <option value="Allocating">Allocating</option>
              <option value="Approved">Approved</option>
              <option value="Packed">Packed</option>
              <option value="Released">Released</option>
              <option value="In Transit">In Transit</option>
              <option value="Delivered">Delivered</option>
              <option value="Accepted">Accepted</option>
              <option value="Distributed">Distributed</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Reference / DR #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Disaster / Calamity</th>
                <th className="px-4 py-3">Destination LGU</th>
                <th className="px-4 py-3">Commodity</th>
                <th className="px-4 py-3 text-right">Requested</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedHistory.map((item) => {
                const disaster = getReleaseDisaster(item);
                const isDelivered = ['Delivered', 'Accepted', 'Distributed'].includes(item.deliveryStatus);
                const isApproved = ['Approved', 'Packed', 'Released', 'In Transit'].includes(item.deliveryStatus);

                return (
                  <tr key={item.drNumber} className="hover:bg-gray-50/70 transition">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      <div>
                        <span>{item.drNumber}</span>
                        {item.incidentCode && (
                          <span className="block text-[10px] text-gray-400 font-normal truncate max-w-[140px]" title={item.incidentCode}>
                            {item.incidentCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {item.dateAllocated || item.incidentDate || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold text-[10px]">
                        {disaster}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-bold text-gray-900">{item.municipality}</span>
                        <span className="text-[10px] text-gray-500 block">{item.province}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {item.fnfiCategory}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {(item.amountRequested || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                      {(item.amountApproved || item.amountRequested || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isApproved
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      }`}>
                        {item.deliveryStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.receiverGps ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title={item.receiverGps}>
                          <CheckCircle className="w-3 h-3" />
                          <span>GPS Tagged</span>
                        </span>
                      ) : item.handoverContractId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <FileSignature className="w-3 h-3" />
                          <span>On-Chain</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedHistory.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-400">
                    No release history records found matching the active criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* History Pagination */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
          <span>
            Showing {filteredHistory.length > 0 ? (historyPage - 1) * historyPageSize + 1 : 0} to {Math.min(historyPage * historyPageSize, filteredHistory.length)} of {filteredHistory.length} records
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-gray-700">
              Page {historyPage} of {totalHistoryPages}
            </span>
            <button
              type="button"
              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
              disabled={historyPage >= totalHistoryPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 8. Discrepancy Reports Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Delivery Discrepancy Reports</h3>
            <p className="text-xs text-gray-500">LGU-reported quantity mismatches, damaged packs, and delivery audit notes</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold font-mono">
            {discrepancyReports.length} reports
          </span>
        </div>

        {discrepancyReports.length > 0 ? (
          <div className="space-y-3">
            {discrepancyReports.slice(0, 5).map(report => (
              <div key={report.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 font-mono">
                    {report.reportType} &bull; {report.reportType === 'Incoming' ? (report.manifestNumber || 'Unknown Manifest') : (report.drNumber || 'Unknown DR')}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{report.note}</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">Reported {report.reportedAt}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    report.reportType === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {report.reportType}
                  </span>
                  {report.reportedByRole && (
                    <p className="text-[10px] text-gray-500 mt-1.5">By: {report.reportedByRole}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-800">
            No active discrepancies reported. All shipments verified in alignment with physical manifests.
          </div>
        )}
      </div>
    </div>
  );
}
