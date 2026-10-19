import { useMemo, useState } from 'react';
import {
  Boxes,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  AlertCircle,
  Building2,
  CheckCircle2
} from 'lucide-react';
import type { InventoryBatchRecord, KitTypeRecord, LguRecord, WarehouseRecord } from '../../services/backendApi';
import { normalizeCategoryName } from '../../lib/lguSync';
import {
  type CommodityTypeFilter,
  matchesCommodityFilter
} from '../../lib/commodityClassification';
import {
  EXPIRY_THRESHOLDS,
  getDaysRemaining,
  getExpiryTier,
  getExpiryBadgeConfig,
  type ExpiryTier
} from '../../lib/expiryConstants';
import { useGuideMode } from '../../contexts/GuideContext';

interface FefoLotsLedgerTableProps {
  allBatches: InventoryBatchRecord[];
  dynamicCategories: string[];
  kitTypesList?: KitTypeRecord[];
  warehousesList?: WarehouseRecord[];
  lgusList?: LguRecord[];
  isBatchesLoading?: boolean;
  onRefreshBatches?: () => void;
  initialUrgencyFilter?: 'all' | 'critical' | 'moderate' | 'safe' | 'expired';
}

export function FefoLotsLedgerTable({
  allBatches,
  dynamicCategories,
  kitTypesList = [],
  warehousesList = [],
  lgusList = [],
  isBatchesLoading = false,
  onRefreshBatches,
  initialUrgencyFilter = 'all'
}: FefoLotsLedgerTableProps) {
  const { showDescriptions } = useGuideMode();
  const [fefoSearchQuery, setFefoSearchQuery] = useState('');
  const [fefoUrgencyFilter, setFefoUrgencyFilter] = useState<'all' | 'critical' | 'moderate' | 'safe' | 'expired'>(
    initialUrgencyFilter
  );
  const [fefoCommodityFilter, setFefoCommodityFilter] = useState<CommodityTypeFilter>('All');
  const [fefoCategoryFilter, setFefoCategoryFilter] = useState('All');
  const [fefoFacilityFilter, setFefoFacilityFilter] = useState('All');
  const [fefoSortOrder, setFefoSortOrder] = useState<'earliest' | 'latest' | 'quantity'>('earliest');
  const [fefoPage, setFefoPage] = useState(1);
  const fefoPageSize = 10;

  const isUuidString = (str?: string | null) =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()));

  const resolveBatchCategory = (batch: InventoryBatchRecord): string => {
    if (batch.kitName) {
      const norm = normalizeCategoryName(batch.kitName);
      if (norm && !isUuidString(norm)) return norm;
    }
    if (batch.kitTypeId) {
      const found = kitTypesList.find(
        (k) => k.id === batch.kitTypeId || k.name.toLowerCase() === batch.kitTypeId?.toLowerCase()
      );
      if (found) return normalizeCategoryName(found.name) || found.name;
      const norm = normalizeCategoryName(batch.kitTypeId);
      if (norm && !isUuidString(norm)) return norm;
    }
    return 'Family Food Pack';
  };

  const resolveBatchFacility = (batch: InventoryBatchRecord): string => {
    if (batch.warehouseId) {
      const foundWh = warehousesList.find(
        (w) => w.id === batch.warehouseId || w.name.toLowerCase() === batch.warehouseId?.toLowerCase()
      );
      if (foundWh) return foundWh.name;

      const lower = batch.warehouseId.toLowerCase();
      if (lower.includes('oton')) return 'Oton Main Warehouse';
      if (lower.includes('pototan')) return 'Pototan Main Warehouse';
      return batch.warehouseId;
    }
    if (batch.lguId) {
      const found = lgusList.find((l) => l.id === batch.lguId);
      if (found) return `${found.municipality || found.lguName} LGU`;
      return batch.lguId;
    }
    return 'Regional Hub';
  };

  // Filtered & sorted FEFO batches
  const filteredBatches = useMemo(() => {
    let result = allBatches.map((batch) => {
      const category = resolveBatchCategory(batch);
      const facility = resolveBatchFacility(batch);
      const daysRemaining = getDaysRemaining(batch.expirationDate);
      const tier = getExpiryTier(batch.expirationDate);
      return {
        ...batch,
        category,
        facility,
        daysRemaining,
        tier
      };
    });

    if (fefoSearchQuery.trim()) {
      const q = fefoSearchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.batchTokenId.toLowerCase().includes(q) ||
          (b.incomingManifestId && b.incomingManifestId.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q) ||
          b.facility.toLowerCase().includes(q)
      );
    }

    if (fefoUrgencyFilter !== 'all') {
      result = result.filter((b) => b.tier === fefoUrgencyFilter);
    }

    if (fefoCommodityFilter !== 'All') {
      result = result.filter((b) => matchesCommodityFilter(b.category, fefoCommodityFilter));
    }

    if (fefoCategoryFilter !== 'All') {
      result = result.filter((b) => b.category === fefoCategoryFilter);
    }

    if (fefoFacilityFilter !== 'All') {
      result = result.filter((b) => b.facility.toLowerCase().includes(fefoFacilityFilter.toLowerCase()));
    }

    result.sort((a, b) => {
      if (fefoSortOrder === 'earliest') {
        return a.daysRemaining - b.daysRemaining;
      }
      if (fefoSortOrder === 'latest') {
        return b.daysRemaining - a.daysRemaining;
      }
      if (fefoSortOrder === 'quantity') {
        return b.remainingQuantity - a.remainingQuantity;
      }
      return 0;
    });

    return result;
  }, [allBatches, fefoSearchQuery, fefoUrgencyFilter, fefoCommodityFilter, fefoCategoryFilter, fefoFacilityFilter, fefoSortOrder, kitTypesList, lgusList, warehousesList]);

  // FEFO Metrics Summary across all active batches
  const fefoMetrics = useMemo(() => {
    let criticalLots = 0;
    let moderateLots = 0;
    let safeLots = 0;
    let expiredLots = 0;
    let criticalUnits = 0;
    let moderateUnits = 0;
    let safeUnits = 0;
    let expiredUnits = 0;

    allBatches.forEach((b) => {
      const tier = getExpiryTier(b.expirationDate);
      const rem = Math.max(0, Number(b.remainingQuantity || 0));
      if (tier === 'critical') {
        criticalLots += 1;
        criticalUnits += rem;
      } else if (tier === 'moderate') {
        moderateLots += 1;
        moderateUnits += rem;
      } else if (tier === 'safe') {
        safeLots += 1;
        safeUnits += rem;
      } else if (tier === 'expired') {
        expiredLots += 1;
        expiredUnits += rem;
      }
    });

    return {
      totalBatches: allBatches.length,
      criticalLots,
      criticalUnits,
      moderateLots,
      moderateUnits,
      safeLots,
      safeUnits,
      expiredLots,
      expiredUnits
    };
  }, [allBatches]);

  const fefoTotalPages = Math.max(1, Math.ceil(filteredBatches.length / fefoPageSize));
  const paginatedBatches = useMemo(() => {
    const start = (fefoPage - 1) * fefoPageSize;
    return filteredBatches.slice(start, start + fefoPageSize);
  }, [filteredBatches, fefoPage, fefoPageSize]);

  return (
    <div className="space-y-4">
      {/* FEFO Shelf-Life Metrics Sub-Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setFefoUrgencyFilter('critical');
            setFefoPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            fefoUrgencyFilter === 'critical'
              ? 'bg-red-50 border-red-300 ring-2 ring-red-400'
              : 'bg-white border-gray-200 hover:border-red-200 hover:bg-red-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800">Critical Shelf-Life</span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          </div>
          <p className="text-xl font-extrabold text-red-900 mt-1">{fefoMetrics.criticalLots} Lots</p>
          <p className="text-[11px] text-red-700 font-medium">
            {fefoMetrics.criticalUnits.toLocaleString()} units (&le; {EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS} days)
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFefoUrgencyFilter('moderate');
            setFefoPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            fefoUrgencyFilter === 'moderate'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-gray-200 hover:border-amber-200 hover:bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Moderate Shelf-Life</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-900 mt-1">{fefoMetrics.moderateLots} Lots</p>
          <p className="text-[11px] text-amber-700 font-medium">
            {fefoMetrics.moderateUnits.toLocaleString()} units ({EXPIRY_THRESHOLDS.MODERATE_MIN_DAYS} - {EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS} days)
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFefoUrgencyFilter('safe');
            setFefoPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            fefoUrgencyFilter === 'safe'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
              : 'bg-white border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Safe Reserve</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl font-extrabold text-emerald-900 mt-1">{fefoMetrics.safeLots} Lots</p>
          <p className="text-[11px] text-emerald-700 font-medium">
            {fefoMetrics.safeUnits.toLocaleString()} units (&gt; {EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS} days)
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setFefoUrgencyFilter('all');
            setFefoPage(1);
          }}
          className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
            fefoUrgencyFilter === 'all'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
              : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800">All Intake Lots</span>
            <Boxes className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-extrabold text-blue-900 mt-1">{fefoMetrics.totalBatches} Lots</p>
          <p className="text-[11px] text-blue-700 font-medium">
            {(fefoMetrics.criticalUnits + fefoMetrics.moderateUnits + fefoMetrics.safeUnits).toLocaleString()} total units tracked
          </p>
        </button>
      </div>

      {/* FEFO Ledger Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Batch ID, Manifest, Facility..."
              value={fefoSearchQuery}
              onChange={(e) => {
                setFefoSearchQuery(e.target.value);
                setFefoPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Classification Filter (Food vs Non-Food) */}
          <div>
            <select
              value={fefoCommodityFilter}
              onChange={(e) => {
                setFefoCommodityFilter(e.target.value as CommodityTypeFilter);
                setFefoPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Classifications</option>
              <option value="Food Items">Food Items (FFP & RTEF)</option>
              <option value="Non-Food Items">Non-Food Items (NFIs)</option>
            </select>
          </div>

          {/* Urgency Filter */}
          <div>
            <select
              value={fefoUrgencyFilter}
              onChange={(e) => {
                setFefoUrgencyFilter(e.target.value as any);
                setFefoPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Urgency Tiers</option>
              <option value="critical">Critical (&le; {EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS} days)</option>
              <option value="moderate">Moderate ({EXPIRY_THRESHOLDS.MODERATE_MIN_DAYS} - {EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS} days)</option>
              <option value="safe">Safe (&gt; {EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS} days)</option>
              <option value="expired">Expired Lots</option>
            </select>
          </div>

          {/* Commodity Category */}
          <div>
            <select
              value={fefoCategoryFilter}
              onChange={(e) => {
                setFefoCategoryFilter(e.target.value);
                setFefoPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Categories ({dynamicCategories.length})</option>
              {dynamicCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <select
              value={fefoSortOrder}
              onChange={(e) => {
                setFefoSortOrder(e.target.value as any);
                setFefoPage(1);
              }}
              className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="earliest">Earliest Expiring (FEFO Priority)</option>
              <option value="latest">Latest Expiring First</option>
              <option value="quantity">Highest Quantity First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dedicated FEFO Expiring Lots Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Batch Expiration Schedule Ledger
            </h3>
            {showDescriptions && (
              <p className="text-xs text-gray-500">
                Consumable intake batches sorted by expiration date for prioritized dispatch and stock monitoring
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefreshBatches && (
              <button
                type="button"
                onClick={onRefreshBatches}
                disabled={isBatchesLoading}
                className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isBatchesLoading ? 'animate-spin text-blue-600' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
            <span className="text-xs font-bold text-gray-700 bg-gray-200/80 px-2.5 py-1 rounded-full">
              {filteredBatches.length} Batches
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Batch / Token ID</th>
                <th className="px-5 py-3.5">Commodity Category</th>
                <th className="px-5 py-3.5">Storage Facility</th>
                <th className="px-5 py-3.5 text-center">Expiration Date</th>
                <th className="px-5 py-3.5 text-center">Shelf-Life Urgency</th>
                <th className="px-5 py-3.5 text-right">Initial Intake</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-blue-900">Remaining Available</th>
                <th className="px-5 py-3.5 text-center">Lot Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedBatches.map((batch) => {
                const badge = getExpiryBadgeConfig(batch.tier);
                const initQty = batch.initialQuantity || batch.remainingQuantity || 1;
                const remQty = Math.max(0, batch.remainingQuantity ?? 0);
                const percentRem = Math.min(100, Math.round((remQty / initQty) * 100));

                return (
                  <tr key={batch.batchTokenId} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900">
                          {batch.batchTokenId}
                        </span>
                        {batch.incomingManifestId && (
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({batch.incomingManifestId})
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-gray-900">{batch.category}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-gray-700 font-medium">{batch.facility}</span>
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-gray-900 font-mono text-xs">
                          {batch.expirationDate || 'N/A'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {batch.daysRemaining <= 0
                            ? 'Expired'
                            : `${batch.daysRemaining} days left`}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right font-medium text-gray-500 whitespace-nowrap">
                      {batch.initialQuantity.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-right font-bold text-blue-700 text-sm whitespace-nowrap">
                      {remQty.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="w-20 mx-auto space-y-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              remQty === 0
                                ? 'bg-gray-400'
                                : batch.tier === 'critical'
                                ? 'bg-red-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${percentRem}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">
                          {percentRem}% left
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No inventory lots match the selected FEFO filter.</p>
          </div>
        ) : (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing{' '}
              <span className="font-bold text-gray-900">
                {filteredBatches.length > 0 ? (fefoPage - 1) * fefoPageSize + 1 : 0}
              </span>{' '}
              to{' '}
              <span className="font-bold text-gray-900">
                {Math.min(fefoPage * fefoPageSize, filteredBatches.length)}
              </span>{' '}
              of <span className="font-bold text-gray-900">{filteredBatches.length}</span> batches
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFefoPage((p) => Math.max(1, p - 1))}
                disabled={fefoPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="font-bold text-gray-800 px-2">
                Page {fefoPage} of {fefoTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setFefoPage((p) => Math.min(fefoTotalPages, p + 1))}
                disabled={fefoPage >= fefoTotalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

