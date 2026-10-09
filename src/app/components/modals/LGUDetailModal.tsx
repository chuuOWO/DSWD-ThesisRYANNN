import { useState, useMemo, useEffect } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Truck,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import type { OutgoingRelease, IncomingGoods } from '../../hooks/useInventoryState';
import { normalizeCategoryName, type SynchronizedLgu } from '../../lib/lguSync';

export interface LGUTransaction {
  id: string;
  type: 'Incoming' | 'Outgoing';
  referenceCode: string;
  category: string;
  quantity: number;
  unit: string;
  source: string;
  destination: string;
  date: string;
  status: string;
  deliveryMode?: string;
  plateNumber?: string;
}

interface LGUDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lgu: SynchronizedLgu | null;
  outgoingReleases?: OutgoingRelease[];
  incomingGoods?: IncomingGoods[];
}

export function LGUDetailModal({
  isOpen,
  onClose,
  lgu,
  outgoingReleases = [],
  incomingGoods = []
}: LGUDetailModalProps) {
  const [timeFilter, setTimeFilter] = useState<'all' | '10days' | '30days' | '90days'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Incoming' | 'Outgoing'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Reset pagination and filters when opening modal with a new LGU
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [isOpen, lgu?.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate all incoming & outgoing transactions for this specific LGU
  const allTransactions = useMemo<LGUTransaction[]>(() => {
    if (!lgu) return [];

    const muniLower = (lgu.municipality || '').trim().toLowerCase();
    const lguId = lgu.id;
    const list: LGUTransaction[] = [];

    // 1. Inbound shipments dispatched from Regional Hubs/Warehouses to this LGU (Incoming to LGU)
    outgoingReleases.forEach((r) => {
      if (!r) return;
      const targetMuni = (r.municipality || '').trim().toLowerCase();
      const targetName = (r.lguName || '').trim().toLowerCase();
      const targetId = r.lguId;

      const isMatch =
        (targetId && targetId === lguId) ||
        targetMuni === muniLower ||
        (muniLower.length > 2 && targetName.includes(muniLower));

      if (isMatch) {
        list.push({
          id: `IN-${r.id || r.drNumber || Math.random()}`,
          type: 'Incoming',
          referenceCode: r.drNumber || r.id || 'N/A',
          category: normalizeCategoryName(r.fnfiCategory) || r.fnfiCategory || 'Relief Goods',
          quantity: Number(r.amountApproved) || Number(r.amountRequested) || 0,
          unit: 'kits',
          source: r.warehouseSource || 'Regional Hub',
          destination: `${lgu.municipality} LGU`,
          date: r.dateAllocated || r.dateRequested || '',
          status: r.deliveryStatus || 'Pending',
          deliveryMode: r.deliveryMode,
          plateNumber: r.plateNumber || r.truckId
        });
      }
    });

    // 2. Direct incoming goods entries to this LGU (Incoming to LGU)
    incomingGoods.forEach((inc) => {
      if (!inc) return;
      if (inc.destinationType === 'LGU') {
        const dest = (inc.destination || '').trim().toLowerCase();
        if (dest === muniLower || (muniLower.length > 2 && dest.includes(muniLower))) {
          list.push({
            id: `INC-DIRECT-${inc.id}`,
            type: 'Incoming',
            referenceCode: inc.incidentCode || inc.id,
            category: normalizeCategoryName(inc.fnfiCategory) || inc.fnfiCategory || 'Relief Goods',
            quantity: Number(inc.quantity) || 0,
            unit: inc.unitType || 'packs',
            source: inc.source || 'National Center',
            destination: `${lgu.municipality} LGU`,
            date: inc.dateReceived || '',
            status: inc.status === 'Verified' ? 'Delivered' : inc.status,
            deliveryMode: 'Direct Logistics'
          });
        }
      }
    });

    // 3. Outbound releases dispatched from this LGU (Outgoing from LGU)
    outgoingReleases.forEach((r) => {
      if (!r) return;
      if (r.sourceType === 'LGU' && r.deliveryStatus !== 'Cancelled') {
        const source = (r.warehouseSource || '').trim().toLowerCase();
        if (source === muniLower || (muniLower.length > 2 && source.includes(muniLower))) {
          list.push({
            id: `OUT-${r.id || r.drNumber || Math.random()}`,
            type: 'Outgoing',
            referenceCode: r.drNumber || r.id || 'N/A',
            category: normalizeCategoryName(r.fnfiCategory) || r.fnfiCategory || 'Relief Goods',
            quantity: Number(r.amountApproved) || Number(r.amountRequested) || 0,
            unit: 'kits',
            source: `${lgu.municipality} LGU`,
            destination: r.destination || r.municipality || 'Local Evacuation Center',
            date: r.dateAllocated || r.dateRequested || '',
            status: r.deliveryStatus || 'Released',
            deliveryMode: r.deliveryMode,
            plateNumber: r.plateNumber || r.truckId
          });
        }
      }
    });

    // Sort transactions by date descending (newest first)
    list.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }, [lgu, outgoingReleases, incomingGoods]);

  // Calculate On-Hand Inventory Category ledger with latest dates
  const inventoryDates = useMemo(() => {
    if (!lgu) return [];
    const stockMap = lgu.currentStock || {};

    // Standard priority relief categories
    const categories = [
      'Food Pack',
      'Hygiene Kit',
      'Family Kit',
      'Sleeping Kit',
      'Kitchen Kit',
      'Laminated Sack',
      'RTEF'
    ];

    // Add any custom categories present in currentStock
    Object.keys(stockMap).forEach((cat) => {
      const canonical = normalizeCategoryName(cat) || cat.trim();
      if (canonical && !categories.includes(canonical)) {
        categories.push(canonical);
      }
    });

    return categories.map((cat) => {
      const normalizedCat = normalizeCategoryName(cat);
      const onHand = Number(stockMap[cat]) || Number(stockMap[normalizedCat]) || 0;

      // Find the most recent incoming date for this category
      const recentIncoming = allTransactions.find(
        (t) => t.type === 'Incoming' && normalizeCategoryName(t.category) === normalizedCat && Boolean(t.date)
      );

      // Find the most recent outgoing date for this category
      const recentOutgoing = allTransactions.find(
        (t) => t.type === 'Outgoing' && normalizeCategoryName(t.category) === normalizedCat && Boolean(t.date)
      );

      return {
        category: cat,
        onHand,
        lastIncomingDate: recentIncoming?.date || null,
        lastOutgoingDate: recentOutgoing?.date || null
      };
    });
  }, [lgu, allTransactions]);

  // Filter transactions based on UI selections
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return allTransactions.filter((tx) => {
      // 1. Transaction Type Filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'all') {
        const canonicalTx = normalizeCategoryName(tx.category);
        const canonicalFilter = normalizeCategoryName(categoryFilter);
        if (canonicalTx !== canonicalFilter) return false;
      }

      // 3. Time Filter
      if (timeFilter !== 'all') {
        if (!tx.date) return false;
        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) return false;

        const diffTime = today.getTime() - txDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (timeFilter === '10days' && diffDays > 10) return false;
        if (timeFilter === '30days' && diffDays > 30) return false;
        if (timeFilter === '90days' && diffDays > 90) return false;
      }

      // 4. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = tx.referenceCode.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchSource = tx.source.toLowerCase().includes(q);
        const matchDest = tx.destination.toLowerCase().includes(q);
        const matchMode = (tx.deliveryMode || '').toLowerCase().includes(q);
        const matchStatus = tx.status.toLowerCase().includes(q);

        if (!matchCode && !matchCat && !matchSource && !matchDest && !matchMode && !matchStatus) {
          return false;
        }
      }

      return true;
    });
  }, [allTransactions, typeFilter, categoryFilter, timeFilter, searchQuery]);

  // Paginate transactions
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // High-level aggregate metrics
  const totalInflow = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'Incoming')
      .reduce((sum, t) => sum + t.quantity, 0);
  }, [allTransactions]);

  const totalOutflow = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'Outgoing')
      .reduce((sum, t) => sum + t.quantity, 0);
  }, [allTransactions]);

  const totalOnHand = useMemo(() => {
    if (!lgu?.currentStock) return 0;
    return Object.values(lgu.currentStock).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [lgu]);

  const maxStockCapacity = lgu?.maxStock && lgu.maxStock > 0 ? lgu.maxStock : 3000;
  const capacityPercent = Math.min(100, Math.round((totalOnHand / maxStockCapacity) * 100));

  if (!isOpen || !lgu) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-blue-100 border border-white/30">
                  {lgu.id}
                </span>
                <h2 className="text-xl font-bold tracking-tight">{lgu.municipality}</h2>
                <span className="text-sm text-blue-200">&bull; {lgu.province}</span>
                {lgu.isActive === false && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-amber-950 rounded">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100/90 mt-1">
                {lgu.lguName}
                {lgu.contactPerson ? ` &bull; Contact: ${lgu.contactPerson}` : ''}
                {lgu.contactNumber ? ` (${lgu.contactNumber})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close ledger"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-purple-700 font-bold mb-1">
                <span>On-Hand Stock</span>
                <Package className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-purple-950">{totalOnHand.toLocaleString()}</p>
              <div className="mt-2 w-full bg-purple-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-700 h-1.5 rounded-full"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-purple-700 mt-1">{capacityPercent}% of {maxStockCapacity.toLocaleString()} max capacity</p>
            </div>

            <div className="bg-green-50/80 border border-green-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-green-700 font-bold mb-1">
                <span>Total Received</span>
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-green-950">{totalInflow.toLocaleString()}</p>
              <p className="text-[11px] text-green-700 mt-1">
                {allTransactions.filter((t) => t.type === 'Incoming').length} delivery receipts
              </p>
            </div>

            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-blue-700 font-bold mb-1">
                <span>Total Dispatched</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-blue-950">{totalOutflow.toLocaleString()}</p>
              <p className="text-[11px] text-blue-700 mt-1">
                {allTransactions.filter((t) => t.type === 'Outgoing').length} outward releases
              </p>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-amber-700 font-bold mb-1">
                <span>Last Replenishment</span>
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-base font-bold text-amber-950 truncate" title={lgu.lastDeliveryDate || 'None'}>
                {lgu.lastDeliveryDate || 'No recorded date'}
              </p>
              <p className="text-[11px] text-amber-700 mt-1">
                {allTransactions.length} total logged activities
              </p>
            </div>
          </div>

          {/* Section 1: On-Hand Inventory with Activity Dates */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-700" />
                <h3 className="text-sm font-bold text-gray-900">On-Hand Relief Inventory &amp; Activity Dates</h3>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Live automated stock records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {inventoryDates.map((item) => (
                <div
                  key={item.category}
                  className="bg-white border border-gray-200 rounded-lg p-3 shadow-2xs hover:border-purple-200 transition"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-gray-800 truncate" title={item.category}>
                      {item.category}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.onHand > 0
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.onHand.toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1 text-[10px] text-gray-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-green-700">
                        <ArrowDownLeft className="w-3 h-3" />
                        Last Received:
                      </span>
                      <span className="font-mono text-gray-700 font-medium">
                        {item.lastIncomingDate || 'None'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-blue-700">
                        <ArrowUpRight className="w-3 h-3" />
                        Last Dispatched:
                      </span>
                      <span className="font-mono text-gray-700 font-medium">
                        {item.lastOutgoingDate || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Incoming and Outgoing Transaction History with Filters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Incoming &amp; Outgoing Transactions</h3>
                <p className="text-xs text-gray-500">
                  Complete audit trail of relief shipments arriving at and releasing from {lgu.municipality}
                </p>
              </div>

              {/* Time Horizon Quick Filters (includes past 10 days!) */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    timeFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('10days');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                    timeFilter === '10days'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-blue-700 hover:text-blue-900 bg-blue-50'
                  }`}
                >
                  Past 10 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('30days');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    timeFilter === '30days'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Past 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('90days');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    timeFilter === '90days'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Past 90 Days
                </button>
              </div>
            </div>

            {/* Filter Bar: Direction, Commodity Category, and Search */}
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Type Filter */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Transaction Flow</label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as 'all' | 'Incoming' | 'Outgoing');
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Flow (Incoming &amp; Outgoing)</option>
                  <option value="Incoming">Incoming Only (Inflow)</option>
                  <option value="Outgoing">Outgoing Only (Outflow)</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Commodity / Item Type</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Items &amp; Kits</option>
                  <option value="Food Pack">Only Food Packs (FFP)</option>
                  <option value="Hygiene Kit">Hygiene Kits</option>
                  <option value="Family Kit">Family Kits</option>
                  <option value="Sleeping Kit">Sleeping Kits</option>
                  <option value="Kitchen Kit">Kitchen Kits</option>
                  <option value="Laminated Sack">Laminated Sacks</option>
                  <option value="RTEF">RTEF</option>
                </select>
              </div>

              {/* Search Bar */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Search Reference / Route</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search DR, category, origin..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Flow</th>
                      <th className="px-4 py-3">Reference / DR</th>
                      <th className="px-4 py-3">Commodity Item</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3">Route (Origin &rarr; Destination)</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.type === 'Incoming' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                              <ArrowDownLeft className="w-3 h-3 text-green-600" />
                              Incoming
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              <ArrowUpRight className="w-3 h-3 text-blue-600" />
                              Outgoing
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {tx.referenceCode}
                        </td>

                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                          {tx.category}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                          {tx.quantity.toLocaleString()} {tx.unit}
                        </td>

                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={`${tx.source} -> ${tx.destination}`}>
                          <span className="font-medium text-gray-800">{tx.source}</span>
                          <span className="mx-1 text-gray-400">&rarr;</span>
                          <span className="font-medium text-gray-800">{tx.destination}</span>
                          {tx.deliveryMode && (
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Via {tx.deliveryMode}{tx.plateNumber ? ` (${tx.plateNumber})` : ''}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {tx.date || 'Unspecified'}
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === 'Delivered' || tx.status === 'Accepted' || tx.status === 'Verified'
                                ? 'bg-green-100 text-green-800'
                                : tx.status === 'In Transit'
                                ? 'bg-blue-100 text-blue-800'
                                : tx.status === 'Distributed'
                                ? 'bg-purple-100 text-purple-800'
                                : tx.status === 'Approved' || tx.status === 'Packed'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length === 0 && (
                <div className="p-8 text-center bg-gray-50/50">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700">No transactions match your filter</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try switching filters (e.g., select &quot;All Time&quot; or &quot;All Items &amp; Kits&quot;).
                  </p>
                </div>
              )}

              {/* Transactions Pagination */}
              {filteredTransactions.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-[11px] text-gray-500">
                    Showing <span className="font-bold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-bold">{Math.min(currentPage * pageSize, filteredTransactions.length)}</span> of{' '}
                    <span className="font-bold">{filteredTransactions.length}</span> transactions
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold px-2 text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">
            DSWD Disaster Relief Supply Chain Ledger &bull; {lgu.municipality}, {lgu.province}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

