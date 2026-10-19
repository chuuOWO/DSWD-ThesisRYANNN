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
  AlertCircle,
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Maximize2,
  Minimize2,
  Printer,
  FileText
} from 'lucide-react';
import type { OutgoingRelease, IncomingGoods } from '../../hooks/useInventoryState';
import { normalizeCategoryName, type SynchronizedLgu } from '../../lib/lguSync';
import { backendApi, type KitTypeRecord } from '../../services/backendApi';
import { supabase } from '../../lib/supabase';
import {
  EXPIRY_THRESHOLDS,
  getDaysRemaining,
  getExpiryTier,
  getExpiryBadgeConfig,
  type ExpiryTier
} from '../../lib/expiryConstants';
import {
  type CommodityTypeFilter,
  matchesCommodityFilter,
  isFoodItem,
  isNonFoodItem
} from '../../lib/commodityClassification';
import { LGUReportPdfModal } from './LGUReportPdfModal';
import { getLguCategoryStock } from './ReplenishLguModal';

export interface LGUTransaction {
  id: string;
  type: 'Incoming' | 'Outgoing';
  flowLabel?: string;
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
  expirationDate?: string | null;
  daysRemaining?: number;
  expiryTier?: ExpiryTier;
  batchTokenId?: string | null;
  allocatedBatches?: Array<{
    batchTokenId?: string;
    batchNumber?: string;
    expirationDate?: string | null;
    quantity?: number;
  }>;
}

export interface LGUExpiryLot {
  id: string;
  batchTokenId: string;
  referenceCode: string;
  category: string;
  quantity: number;
  unit: string;
  source: string;
  destination: string;
  date: string;
  expirationDate: string;
  daysRemaining: number;
  expiryTier: ExpiryTier;
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
  kitTypesList?: KitTypeRecord[];
  initialCommodityFilter?: CommodityTypeFilter;
}

export function LGUDetailModal({
  isOpen,
  onClose,
  lgu,
  outgoingReleases = [],
  incomingGoods = [],
  kitTypesList = [],
  initialCommodityFilter = 'All'
}: LGUDetailModalProps) {
  // Tab switcher: 'transactions' = Flow & Delivery ledger; 'fefo_expiry' = Batches by Expiry Date
  const [activeTab, setActiveTab] = useState<'transactions' | 'fefo_expiry'>('transactions');

  // Window size and export states
  const [isMaximized, setIsMaximized] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);

  // Filters & Search
  const [commodityTypeFilter, setCommodityTypeFilter] = useState<CommodityTypeFilter>(initialCommodityFilter || 'All');
  const [timeFilter, setTimeFilter] = useState<'all' | '10days' | '30days' | '90days'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Incoming' | 'Outgoing'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'critical' | 'moderate' | 'safe' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'expiry_asc' | 'expiry_desc' | 'qty_desc' | 'qty_asc'>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = isMaximized ? 10 : 6;

  const [dbLedgerEntries, setDbLedgerEntries] = useState<any[]>([]);
  const [dbBatches, setDbBatches] = useState<any[]>([]);
  const [dbManifests, setDbManifests] = useState<any[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Load and subscribe to live database stock ledger movements and batch data for this LGU
  useEffect(() => {
    if (!isOpen || !lgu?.id) {
      setDbLedgerEntries([]);
      setDbBatches([]);
      setDbManifests([]);
      return;
    }

    let isSubscribed = true;
    setIsLoadingLedger(true);

    const fetchAllData = async () => {
      try {
        const [ledgerRows, batchesRes, manifestsRes] = await Promise.all([
          backendApi.getStockLedgerForLgu(lgu.id).catch(() => []),
          supabase.from('inventory_batches').select('*'),
          supabase.from('incoming_manifests').select('*')
        ]);
        if (isSubscribed) {
          setDbLedgerEntries(ledgerRows || []);
          if (batchesRes.data) setDbBatches(batchesRes.data);
          if (manifestsRes.data) setDbManifests(manifestsRes.data);
        }
      } catch (err) {
        console.warn('Failed to load database ledger/batches for LGU:', err);
      } finally {
        if (isSubscribed) {
          setIsLoadingLedger(false);
        }
      }
    };

    fetchAllData();

    const channelLedger = supabase
      .channel(`lgu-ledger-${lgu.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_ledger',
          filter: `lgu_id=eq.${lgu.id}`
        },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    const channelBatches = supabase
      .channel(`lgu-batches-${lgu.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_batches'
        },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channelLedger);
      supabase.removeChannel(channelBatches);
    };
  }, [isOpen, lgu?.id]);

  // Reset pagination when opening modal or switching tabs/filters
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      if (initialCommodityFilter) {
        setCommodityTypeFilter(initialCommodityFilter);
      }
    }
  }, [isOpen, lgu?.id, activeTab, initialCommodityFilter]);

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

  // Master expiry lookup map resolving batch token IDs and manifest references to expiration dates
  const expiryMap = useMemo(() => {
    const map = new Map<string, string>();

    // 1. From database inventory_batches
    dbBatches.forEach((b: any) => {
      const exp = b.expiration_date || b.expirationDate;
      if (exp) {
        const tId = b.batch_token_id || b.batchTokenId;
        if (tId) map.set(String(tId).toLowerCase().trim(), exp);
        const mId = b.incoming_manifest_id || b.incomingManifestId;
        if (mId) map.set(String(mId).toLowerCase().trim(), exp);
      }
    });

    // 2. From incoming manifests
    dbManifests.forEach((m: any) => {
      const exp = m.expiration_date || m.expirationDate;
      if (exp) {
        if (m.id) map.set(String(m.id).toLowerCase().trim(), exp);
        if (m.manifest_number) {
          const num = String(m.manifest_number).toLowerCase().trim();
          map.set(num, exp);
          map.set(`batch-${num}`, exp);
        }
      }
    });

    // 3. From incomingGoods prop
    incomingGoods.forEach((inc) => {
      if (inc?.expirationDate) {
        if (inc.id) map.set(String(inc.id).toLowerCase().trim(), inc.expirationDate);
        if (inc.manifestNumber) {
          const num = String(inc.manifestNumber).toLowerCase().trim();
          map.set(num, inc.expirationDate);
          map.set(`batch-${num}`, inc.expirationDate);
        }
        if (inc.incidentCode) map.set(String(inc.incidentCode).toLowerCase().trim(), inc.expirationDate);
        if (inc.batchTokenId) map.set(String(inc.batchTokenId).toLowerCase().trim(), inc.expirationDate);
      }
    });

    return map;
  }, [dbBatches, dbManifests, incomingGoods]);

  // Helper to resolve an allocation or batch token to an expiration date
  const resolveExpirationDate = (alloc: { batchTokenId?: string | null; batchNumber?: string | null; expirationDate?: string | null }): string | null => {
    if (alloc.expirationDate) return alloc.expirationDate;
    if (alloc.batchTokenId) {
      const match = expiryMap.get(String(alloc.batchTokenId).toLowerCase().trim());
      if (match) return match;
    }
    if (alloc.batchNumber) {
      const bn = String(alloc.batchNumber).toLowerCase().trim();
      const match = expiryMap.get(bn) || expiryMap.get(`batch-${bn}`);
      if (match) return match;
    }
    return null;
  };

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
        // Parse allocated batches if serialized
        let rawAllocs: any = r.allocatedBatches;
        if (typeof rawAllocs === 'string') {
          try {
            rawAllocs = JSON.parse(rawAllocs);
          } catch {}
        }
        if (!Array.isArray(rawAllocs)) rawAllocs = [];

        const resolvedAllocBatches = rawAllocs.map((a: any) => {
          const exp = resolveExpirationDate(a);
          return {
            batchTokenId: a.batchTokenId || '',
            batchNumber: a.batchNumber || '',
            expirationDate: exp,
            quantity: Number(a.quantity) || 0
          };
        });

        // Determine effective earliest expiration date for the release
        let effectiveExp: string | null = null;
        let minDays = 999999;
        resolvedAllocBatches.forEach((b: any) => {
          if (b.expirationDate) {
            const days = getDaysRemaining(b.expirationDate);
            if (days < minDays) {
              minDays = days;
              effectiveExp = b.expirationDate;
            }
          }
        });

        // Fallback to drNumber lookup in map if no batch dates found
        if (!effectiveExp && r.drNumber) {
          effectiveExp = expiryMap.get(String(r.drNumber).toLowerCase().trim()) || null;
        }

        const daysRemaining = effectiveExp ? getDaysRemaining(effectiveExp) : undefined;
        const expiryTier = effectiveExp ? getExpiryTier(effectiveExp) : undefined;

        list.push({
          id: `OUT-DR-${r.id || r.drNumber || Math.random()}`,
          type: 'Outgoing',
          flowLabel: 'Outgoing Release (DR)',
          referenceCode: r.drNumber || r.id || 'N/A',
          category: normalizeCategoryName(r.fnfiCategory) || r.fnfiCategory || 'Relief Goods',
          quantity: Number(r.amountApproved) || Number(r.amountRequested) || 0,
          unit: 'kits',
          source: r.warehouseSource || 'Regional Hub',
          destination: `${lgu.municipality} LGU`,
          date: r.dateAllocated || r.dateRequested || '',
          status: r.deliveryStatus || 'Pending',
          deliveryMode: r.deliveryMode,
          plateNumber: r.plateNumber || r.truckId,
          expirationDate: effectiveExp,
          daysRemaining,
          expiryTier,
          batchTokenId: resolvedAllocBatches[0]?.batchTokenId || null,
          allocatedBatches: resolvedAllocBatches
        });
      }
    });

    // 2. Direct incoming goods entries to this LGU (Incoming to LGU)
    incomingGoods.forEach((inc) => {
      if (!inc) return;
      if (inc.destinationType === 'LGU') {
        const dest = (inc.destination || '').trim().toLowerCase();
        if (dest === muniLower || (muniLower.length > 2 && dest.includes(muniLower))) {
          const exp = inc.expirationDate || null;
          const days = exp ? getDaysRemaining(exp) : undefined;
          const tier = exp ? getExpiryTier(exp) : undefined;

          list.push({
            id: `INC-DIRECT-${inc.id}`,
            type: 'Incoming',
            flowLabel: 'Incoming Intake (RIS)',
            referenceCode: inc.incidentCode || inc.id,
            category: normalizeCategoryName(inc.fnfiCategory) || inc.fnfiCategory || 'Relief Goods',
            quantity: Number(inc.quantity) || 0,
            unit: inc.unitType || 'packs',
            source: inc.source || 'National Center',
            destination: `${lgu.municipality} LGU`,
            date: inc.dateReceived || '',
            status: inc.status === 'Verified' ? 'Delivered' : inc.status,
            deliveryMode: 'Direct Logistics',
            expirationDate: exp,
            daysRemaining: days,
            expiryTier: tier,
            batchTokenId: inc.batchTokenId || inc.manifestNumber || null
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
            id: `OUT-LGU-${r.id || r.drNumber || Math.random()}`,
            type: 'Outgoing',
            flowLabel: 'Local Distribution',
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

    // 4. Incorporate database stock ledger movements (audits, recounts, mutual aid, receipts)
    dbLedgerEntries.forEach((row) => {
      if (!row) return;

      let resolvedManifestNum = '';
      if (row.reference_manifest_id) {
        const foundM = dbManifests.find(
          (m: any) => m.id === row.reference_manifest_id || m.manifest_number === row.reference_manifest_id
        );
        resolvedManifestNum = foundM?.manifest_number || '';
        if (!resolvedManifestNum) {
          const foundInc = incomingGoods.find(
            (inc) => inc.id === row.reference_manifest_id || inc.manifestNumber === row.reference_manifest_id
          );
          resolvedManifestNum = foundInc?.manifestNumber || foundInc?.id || '';
        }
        if (!resolvedManifestNum && typeof row.reference_manifest_id === 'string' && row.reference_manifest_id.startsWith('RIS-')) {
          resolvedManifestNum = row.reference_manifest_id;
        }
      }

      let resolvedDrNum = '';
      if (row.reference_dr_id) {
        const foundDr = outgoingReleases.find(
          (r) => r.id === row.reference_dr_id || r.drNumber === row.reference_dr_id
        );
        resolvedDrNum = foundDr?.drNumber || '';
        if (!resolvedDrNum && typeof row.reference_dr_id === 'string' && row.reference_dr_id.startsWith('DR-')) {
          resolvedDrNum = row.reference_dr_id;
        }
      }

      const delta = Number(row.delta_quantity) || 0;
      const isIncoming = delta >= 0;

      let refCode = resolvedDrNum || resolvedManifestNum || '';
      if (!refCode) {
        if (row.reference_dr_id) {
          const raw = String(row.reference_dr_id).trim();
          refCode = raw.startsWith('DR-') ? raw : `DR-${raw.slice(0, 8).toUpperCase()}`;
        } else if (row.reference_manifest_id) {
          const raw = String(row.reference_manifest_id).trim();
          refCode = raw.startsWith('RIS-') ? raw : `RIS-${raw.slice(0, 8).toUpperCase()}`;
        } else {
          const rawId = String(row.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'SYS';
          refCode = isIncoming ? `RIS-${rawId}` : `DR-${rawId}`;
        }
      }

      const kitName = (row.kit_types && typeof row.kit_types === 'object' && 'name' in row.kit_types)
        ? String((row.kit_types as any).name)
        : (row.kit_type_id || 'Relief Goods');
      const canonicalKit = normalizeCategoryName(kitName);
      const rowQty = Math.abs(delta);

      // Deduplicate if already present in list (either from outgoing releases, incoming goods, or previous entries)
      const alreadyLogged = list.some((item) => {
        if (refCode && (item.referenceCode === refCode || item.id.includes(refCode))) return true;
        if (resolvedManifestNum && (item.referenceCode === resolvedManifestNum || item.id.includes(resolvedManifestNum))) return true;
        if (resolvedDrNum && (item.referenceCode === resolvedDrNum || item.id.includes(resolvedDrNum))) return true;
        if (row.reference_manifest_id && (item.referenceCode === row.reference_manifest_id || item.id.includes(row.reference_manifest_id))) return true;
        if (row.reference_dr_id && (item.referenceCode === row.reference_dr_id || item.id.includes(row.reference_dr_id))) return true;

        if (
          normalizeCategoryName(item.category) === canonicalKit &&
          item.quantity === rowQty &&
          ((isIncoming && item.type === 'Incoming') || (!isIncoming && item.type === 'Outgoing'))
        ) {
          if (row.created_at && item.date) {
            const d1 = new Date(row.created_at).toISOString().split('T')[0];
            const d2 = new Date(item.date).toISOString().split('T')[0];
            if (d1 === d2) return true;
          }
          return true;
        }
        return false;
      });
      if (alreadyLogged) return;

      const mvType = String(row.movement_type || '').toUpperCase();
      let sourceName = `${lgu.municipality} LGU`;
      let destName = 'Local Relief Distribution';

      let ledgerFlowLabel = isIncoming ? 'Incoming Intake (RIS)' : 'Local Distribution';
      if (row.reference_dr_id || refCode.startsWith('DR-')) {
        ledgerFlowLabel = 'Outgoing Release (DR)';
      } else if (mvType === 'MUTUAL_AID_OUT') {
        ledgerFlowLabel = 'Mutual Aid Out';
      }

      if (isIncoming) {
        sourceName = mvType === 'AID_RECEIVED' ? 'DSWD Regional Relief Hub' : 'Local Stock / Intake';
        destName = `${lgu.municipality} LGU`;
      } else {
        sourceName = `${lgu.municipality} LGU`;
        destName = mvType === 'MUTUAL_AID_OUT' ? 'Inter-LGU Mutual Aid Transfer' : 'Community Distribution';
      }

      const exp = row.reference_dr_id ? expiryMap.get(String(row.reference_dr_id).toLowerCase().trim()) : null;

      list.push({
        id: `DB-TX-${row.id}`,
        type: isIncoming ? 'Incoming' : 'Outgoing',
        flowLabel: ledgerFlowLabel,
        referenceCode: refCode,
        category: canonicalKit || kitName,
        quantity: rowQty,
        unit: 'kits',
        source: sourceName,
        destination: destName,
        date: row.created_at || '',
        status: 'Recorded',
        deliveryMode: mvType ? mvType.replace(/_/g, ' ') : (isIncoming ? 'Direct Intake' : 'Dispatch Release'),
        expirationDate: exp,
        daysRemaining: exp ? getDaysRemaining(exp) : undefined,
        expiryTier: exp ? getExpiryTier(exp) : undefined
      });
    });

    return list;
  }, [lgu, outgoingReleases, incomingGoods, dbLedgerEntries, dbManifests, expiryMap]);

  // Aggregate individual inventory lots / batches received and currently on-hand at this LGU
  const allLots = useMemo<LGUExpiryLot[]>(() => {
    if (!lgu) return [];

    const muniLower = (lgu.municipality || '').trim().toLowerCase();
    const lguId = lgu.id;
    const lots: LGUExpiryLot[] = [];

    // All possible commodity categories
    const categories = [
      'Family Food Pack',
      'Ready-to-Eat Food (RTEF)',
      'Hygiene Kit',
      'Sleeping Kit',
      'Kitchen Kit',
      'Family Kit',
      'Laminated Sacks'
    ];
    const stockMap = lgu.currentStock || {};
    Object.keys(stockMap).forEach(cat => {
      const canonical = normalizeCategoryName(cat) || cat.trim();
      if (canonical && !categories.includes(canonical)) {
        categories.push(canonical);
      }
    });

    // Reconcile each commodity category against real on-hand stock
    categories.forEach((cat) => {
      const canonicalCat = normalizeCategoryName(cat);
      const onHandQty = getLguCategoryStock(lgu, cat);
      if (onHandQty <= 0) return; // Zero stock on-hand, no active lots should appear

      // Collect candidate lots for this specific category and this LGU
      const candidateLots: Array<{
        batchTokenId: string;
        referenceCode: string;
        category: string;
        quantity: number;
        unit: string;
        source: string;
        destination: string;
        date: string;
        expirationDate: string;
        daysRemaining?: number;
        expiryTier?: ExpiryTier;
        status: string;
        deliveryMode?: string;
        plateNumber?: string;
      }> = [];

      // 1. Batches directly recorded in inventory_batches for this LGU
      dbBatches.forEach((b: any) => {
        if (!b) return;
        const bLguId = b.lgu_id || b.lguId;
        const bMuni = (b.lgu_name || '').trim().toLowerCase();
        const matchesLgu = (bLguId && bLguId === lguId) || (bMuni && bMuni === muniLower);
        const matchesKit = normalizeCategoryName(b.kit_name || b.kit_type_id) === canonicalCat;
        const batchRem = Number(b.remaining_quantity ?? b.initial_quantity ?? 0);
        if (matchesLgu && matchesKit && batchRem > 0) {
          const exp = b.expiration_date || b.expirationDate || '';
          const token = b.batch_token_id || b.batchTokenId || 'PREPOS-BATCH';
          candidateLots.push({
            batchTokenId: token,
            referenceCode: b.incoming_manifest_id || b.incomingManifestId || 'Prepositioned Stock',
            category: canonicalCat,
            quantity: batchRem,
            unit: 'kits',
            source: 'Local Prepositioned Buffer',
            destination: `${lgu.municipality} LGU`,
            date: b.minted_at || b.mintedAt || '',
            expirationDate: exp,
            daysRemaining: exp ? getDaysRemaining(exp) : undefined,
            expiryTier: exp ? getExpiryTier(exp) : undefined,
            status: 'In Stock',
            deliveryMode: 'Prepositioned'
          });
        }
      });

      // 2. Direct incoming intake receipts (e.g. RIS replenishments or intakes)
      incomingGoods.forEach((inc) => {
        if (!inc) return;
        if (inc.destinationType === 'LGU') {
          const dest = (inc.destination || '').trim().toLowerCase();
          const matchesLgu = dest === muniLower || inc.destinationLguId === lguId || (muniLower.length > 2 && dest.includes(muniLower));
          const matchesKit = normalizeCategoryName(inc.fnfiCategory) === canonicalCat;
          const isValidStatus = inc.status === 'Verified' || inc.status === 'Delivered';
          const incQty = Number(inc.quantity) || 0;
          if (matchesLgu && matchesKit && isValidStatus && incQty > 0) {
            const exp = inc.expirationDate || '';
            const refCode = inc.manifestNumber || inc.incidentCode || inc.id;
            const token = inc.batchTokenId || (refCode ? `BATCH-${refCode}` : 'BATCH-INTAKE');
            if (!candidateLots.some(c => c.batchTokenId === token || c.referenceCode === refCode)) {
              candidateLots.push({
                batchTokenId: token,
                referenceCode: refCode,
                category: canonicalCat,
                quantity: incQty,
                unit: inc.unitType || 'packs',
                source: inc.source || 'Regional Warehouse',
                destination: `${lgu.municipality} LGU`,
                date: inc.dateReceived || '',
                expirationDate: exp,
                daysRemaining: exp ? getDaysRemaining(exp) : undefined,
                expiryTier: exp ? getExpiryTier(exp) : undefined,
                status: 'In Stock',
                deliveryMode: 'Direct Intake'
              });
            }
          }
        }
      });

      // 3. Delivered outbound releases from warehouses to this LGU
      outgoingReleases.forEach((r) => {
        if (!r) return;
        const targetMuni = (r.municipality || '').trim().toLowerCase();
        const targetName = (r.lguName || '').trim().toLowerCase();
        const targetId = r.lguId;
        const matchesLgu = (targetId && targetId === lguId) || targetMuni === muniLower || (muniLower.length > 2 && targetName.includes(muniLower));
        const matchesKit = normalizeCategoryName(r.fnfiCategory) === canonicalCat;
        const isDelivered = r.deliveryStatus === 'Delivered' || r.deliveryStatus === 'Accepted';
        if (matchesLgu && matchesKit && isDelivered) {
          let rawAllocs: any = r.allocatedBatches;
          if (typeof rawAllocs === 'string') {
            try { rawAllocs = JSON.parse(rawAllocs); } catch {}
          }
          if (Array.isArray(rawAllocs) && rawAllocs.length > 0) {
            rawAllocs.forEach((a: any, idx: number) => {
              const exp = resolveExpirationDate(a) || '';
              const token = a.batchTokenId || (a.batchNumber ? `BATCH-${a.batchNumber}` : `${r.drNumber}-LOT-${idx + 1}`);
              if (!candidateLots.some(c => c.batchTokenId === token)) {
                candidateLots.push({
                  batchTokenId: token,
                  referenceCode: r.drNumber || r.id || 'N/A',
                  category: canonicalCat,
                  quantity: Number(a.quantity) || 0,
                  unit: 'kits',
                  source: r.warehouseSource || 'Regional Hub',
                  destination: `${lgu.municipality} LGU`,
                  date: r.dateAllocated || r.dateRequested || '',
                  expirationDate: exp,
                  daysRemaining: exp ? getDaysRemaining(exp) : undefined,
                  expiryTier: exp ? getExpiryTier(exp) : undefined,
                  status: 'In Stock',
                  deliveryMode: r.deliveryMode,
                  plateNumber: r.plateNumber || r.truckId
                });
              }
            });
          } else {
            const exp = expiryMap.get(String(r.drNumber).toLowerCase().trim()) || '';
            const token = r.drNumber ? `BATCH-${r.drNumber}` : 'BATCH-SHIPMENT';
            if (!candidateLots.some(c => c.batchTokenId === token || c.referenceCode === r.drNumber)) {
              candidateLots.push({
                batchTokenId: token,
                referenceCode: r.drNumber || r.id || 'N/A',
                category: canonicalCat,
                quantity: Number(r.amountApproved) || Number(r.amountRequested) || 0,
                unit: 'kits',
                source: r.warehouseSource || 'Regional Hub',
                destination: `${lgu.municipality} LGU`,
                date: r.dateAllocated || r.dateRequested || '',
                expirationDate: exp,
                daysRemaining: exp ? getDaysRemaining(exp) : undefined,
                expiryTier: exp ? getExpiryTier(exp) : undefined,
                status: 'In Stock',
                deliveryMode: r.deliveryMode,
                plateNumber: r.plateNumber || r.truckId
              });
            }
          }
        }
      });

      // Sort candidate lots by FEFO (earliest expiry first), or latest date
      candidateLots.sort((a, b) => {
        if (a.expirationDate && b.expirationDate) {
          return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
        }
        if (a.expirationDate) return -1;
        if (b.expirationDate) return 1;
        return (b.date || '').localeCompare(a.date || '');
      });

      // Allocate candidate lots up to the exact on-hand stock
      let needed = onHandQty;
      for (const cand of candidateLots) {
        if (needed <= 0) break;
        const lotQty = Math.min(needed, cand.quantity);
        if (lotQty > 0) {
          lots.push({
            id: `LOT-${lgu.id}-${cand.batchTokenId}-${lots.length}`,
            ...cand,
            quantity: lotQty,
            status: 'In Stock'
          });
          needed -= lotQty;
        }
      }

      // If still needed (e.g. baseline buffer from report without specific batch receipt)
      if (needed > 0) {
        const cleanMuni = (lgu.municipality || 'LGU').toUpperCase().replace(/[^A-Z0-9]/g, '-');
        const now = new Date();
        const defaultExp = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        lots.push({
          id: `LOT-PREPOS-${lgu.id}-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          batchTokenId: `LOT-${cleanMuni}-01`,
          referenceCode: 'Prepositioned Stock',
          category: canonicalCat,
          quantity: needed,
          unit: 'kits',
          source: 'Local Prepositioned Site',
          destination: `${lgu.municipality} LGU`,
          date: lgu.lastReportedAt ? new Date(lgu.lastReportedAt).toISOString().split('T')[0] : now.toISOString().split('T')[0],
          expirationDate: defaultExp,
          daysRemaining: getDaysRemaining(defaultExp),
          expiryTier: getExpiryTier(defaultExp),
          status: 'In Stock',
          deliveryMode: 'Prepositioned'
        });
      }
    });

    return lots;
  }, [lgu, outgoingReleases, incomingGoods, dbBatches, expiryMap]);

  // Pre-calculated batch classification counts (Food vs Non-Food)
  const lotClassificationCounts = useMemo(() => {
    let foodLots = 0;
    let foodUnits = 0;
    let nonFoodLots = 0;
    let nonFoodUnits = 0;

    allLots.forEach((lot) => {
      const isFood = isFoodItem(lot.category);
      const qty = lot.quantity || 0;
      if (isFood) {
        foodLots++;
        foodUnits += qty;
      } else {
        nonFoodLots++;
        nonFoodUnits += qty;
      }
    });

    return {
      allLots: allLots.length,
      allUnits: allLots.reduce((sum, l) => sum + (l.quantity || 0), 0),
      foodLots,
      foodUnits,
      nonFoodLots,
      nonFoodUnits
    };
  }, [allLots]);

  // FEFO shelf-life metrics for this LGU (dynamically filtered by commodity classification)
  const fefoMetrics = useMemo(() => {
    let criticalLots = 0;
    let moderateLots = 0;
    let safeLots = 0;
    let expiredLots = 0;
    let criticalUnits = 0;
    let moderateUnits = 0;
    let safeUnits = 0;
    let expiredUnits = 0;
    let matchingLotsCount = 0;

    allLots.forEach((lot) => {
      if (!matchesCommodityFilter(lot.category, commodityTypeFilter)) return;
      matchingLotsCount++;

      if (!lot.expirationDate) return;
      const tier = lot.expiryTier;
      const qty = lot.quantity || 0;
      if (tier === 'critical') {
        criticalLots++;
        criticalUnits += qty;
      } else if (tier === 'moderate') {
        moderateLots++;
        moderateUnits += qty;
      } else if (tier === 'safe') {
        safeLots++;
        safeUnits += qty;
      } else if (tier === 'expired') {
        expiredLots++;
        expiredUnits += qty;
      }
    });

    return {
      totalLots: matchingLotsCount,
      criticalLots,
      criticalUnits,
      moderateLots,
      moderateUnits,
      safeLots,
      safeUnits,
      expiredLots,
      expiredUnits
    };
  }, [allLots, commodityTypeFilter]);

  // Calculate On-Hand Inventory Category ledger with latest dates
  const inventoryDates = useMemo(() => {
    if (!lgu) return [];
    const stockMap = lgu.currentStock || {};

    const categories = [
      'Family Food Pack',
      'Hygiene Kit',
      'Sleeping Kit',
      'Kitchen Kit',
      'Family Kit',
      'Laminated Sacks',
      'Ready-to-Eat Food (RTEF)'
    ];

    Object.keys(stockMap).forEach((cat) => {
      const canonical = normalizeCategoryName(cat) || cat.trim();
      if (canonical && !categories.includes(canonical)) {
        categories.push(canonical);
      }
    });

    return categories.map((cat) => {
      const normalizedCat = normalizeCategoryName(cat);
      const onHand = Number(stockMap[cat]) || Number(stockMap[normalizedCat]) || 0;

      const muniLower = (lgu.municipality || '').trim().toLowerCase();
      const recentIncoming = allTransactions.find(
        (t) => (t.type === 'Incoming' || t.destination.toLowerCase().includes(muniLower)) && normalizeCategoryName(t.category) === normalizedCat && Boolean(t.date)
      );

      const recentOutgoing = allTransactions.find(
        (t) => t.source.toLowerCase().includes(muniLower) && normalizeCategoryName(t.category) === normalizedCat && Boolean(t.date)
      );

      return {
        category: cat,
        onHand,
        lastIncomingDate: recentIncoming?.date || null,
        lastOutgoingDate: recentOutgoing?.date || null
      };
    });
  }, [lgu, allTransactions]);

  // Count transactions per time filter for quick visual indicator badges
  const countsByTimeFilter = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let allCount = 0;
    let tenDaysCount = 0;
    let thirtyDaysCount = 0;
    let ninetyDaysCount = 0;

    allTransactions.forEach((tx) => {
      if (!matchesCommodityFilter(tx.category, commodityTypeFilter)) return;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return;
      if (categoryFilter !== 'all') {
        const canonicalTx = normalizeCategoryName(tx.category);
        const canonicalFilter = normalizeCategoryName(categoryFilter);
        if (canonicalTx !== canonicalFilter) return;
      }
      if (expiryFilter !== 'all') {
        if (!tx.expirationDate) return;
        if (tx.expiryTier !== expiryFilter) return;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = tx.referenceCode.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchFlow = (tx.flowLabel || '').toLowerCase().includes(q);
        const matchSource = tx.source.toLowerCase().includes(q);
        const matchDest = tx.destination.toLowerCase().includes(q);
        const matchMode = (tx.deliveryMode || '').toLowerCase().includes(q);
        const matchStatus = tx.status.toLowerCase().includes(q);
        const matchExp = (tx.expirationDate || '').toLowerCase().includes(q);
        if (!matchCode && !matchCat && !matchFlow && !matchSource && !matchDest && !matchMode && !matchStatus && !matchExp) return;
      }

      allCount++;
      if (tx.date) {
        const txDate = new Date(tx.date);
        if (!isNaN(txDate.getTime())) {
          const diffTime = today.getTime() - txDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 10) tenDaysCount++;
          if (diffDays <= 30) thirtyDaysCount++;
          if (diffDays <= 90) ninetyDaysCount++;
        }
      }
    });

    return { allCount, tenDaysCount, thirtyDaysCount, ninetyDaysCount };
  }, [allTransactions, commodityTypeFilter, typeFilter, categoryFilter, expiryFilter, searchQuery]);

  // Filtered & sorted transactions
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const result = allTransactions.filter((tx) => {
      if (!matchesCommodityFilter(tx.category, commodityTypeFilter)) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      if (categoryFilter !== 'all') {
        const canonicalTx = normalizeCategoryName(tx.category);
        const canonicalFilter = normalizeCategoryName(categoryFilter);
        if (canonicalTx !== canonicalFilter) return false;
      }

      if (expiryFilter !== 'all') {
        if (!tx.expirationDate) return false;
        if (tx.expiryTier !== expiryFilter) return false;
      }

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

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = tx.referenceCode.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchFlow = (tx.flowLabel || '').toLowerCase().includes(q);
        const matchSource = tx.source.toLowerCase().includes(q);
        const matchDest = tx.destination.toLowerCase().includes(q);
        const matchMode = (tx.deliveryMode || '').toLowerCase().includes(q);
        const matchStatus = tx.status.toLowerCase().includes(q);
        const matchExp = (tx.expirationDate || '').toLowerCase().includes(q);
        const matchBatch = (tx.batchTokenId || '').toLowerCase().includes(q);

        if (!matchCode && !matchCat && !matchFlow && !matchSource && !matchDest && !matchMode && !matchStatus && !matchExp && !matchBatch) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'expiry_asc') {
        const daysA = a.expirationDate ? (a.daysRemaining ?? 9999) : 99999;
        const daysB = b.expirationDate ? (b.daysRemaining ?? 9999) : 99999;
        return daysA - daysB;
      }
      if (sortBy === 'expiry_desc') {
        const daysA = a.expirationDate ? (a.daysRemaining ?? -9999) : -99999;
        const daysB = b.expirationDate ? (b.daysRemaining ?? -9999) : -99999;
        return daysB - daysA;
      }
      if (sortBy === 'date_asc') {
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      }
      if (sortBy === 'date_desc') {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      }
      if (sortBy === 'qty_desc') {
        return b.quantity - a.quantity;
      }
      if (sortBy === 'qty_asc') {
        return a.quantity - b.quantity;
      }
      return 0;
    });

    return result;
  }, [allTransactions, commodityTypeFilter, typeFilter, categoryFilter, expiryFilter, timeFilter, searchQuery, sortBy]);

  // Filtered & sorted lots (Stock by Expiry)
  const filteredLots = useMemo(() => {
    const result = allLots.filter((lot) => {
      if (!matchesCommodityFilter(lot.category, commodityTypeFilter)) return false;

      if (categoryFilter !== 'all') {
        const canonicalLot = normalizeCategoryName(lot.category);
        const canonicalFilter = normalizeCategoryName(categoryFilter);
        if (canonicalLot !== canonicalFilter) return false;
      }

      if (expiryFilter !== 'all') {
        if (!lot.expirationDate) return false;
        if (lot.expiryTier !== expiryFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchBatch = lot.batchTokenId.toLowerCase().includes(q);
        const matchRef = lot.referenceCode.toLowerCase().includes(q);
        const matchCat = lot.category.toLowerCase().includes(q);
        const matchSource = lot.source.toLowerCase().includes(q);
        const matchStatus = lot.status.toLowerCase().includes(q);
        const matchExp = (lot.expirationDate || '').toLowerCase().includes(q);

        if (!matchBatch && !matchRef && !matchCat && !matchSource && !matchStatus && !matchExp) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'expiry_asc') {
        const daysA = a.expirationDate ? a.daysRemaining : 99999;
        const daysB = b.expirationDate ? b.daysRemaining : 99999;
        return daysA - daysB;
      }
      if (sortBy === 'expiry_desc') {
        const daysA = a.expirationDate ? a.daysRemaining : -99999;
        const daysB = b.expirationDate ? b.daysRemaining : -99999;
        return daysB - daysA;
      }
      if (sortBy === 'date_asc') {
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      }
      if (sortBy === 'date_desc') {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      }
      if (sortBy === 'qty_desc') {
        return b.quantity - a.quantity;
      }
      if (sortBy === 'qty_asc') {
        return a.quantity - b.quantity;
      }
      return 0;
    });

    return result;
  }, [allLots, commodityTypeFilter, categoryFilter, expiryFilter, searchQuery, sortBy]);

  // Dynamic category options filtered by current commodity classification
  const availableCategoryOptions = useMemo(() => {
    const all = [
      'Family Food Pack',
      'Ready-to-Eat Food (RTEF)',
      'Hygiene Kit',
      'Sleeping Kit',
      'Kitchen Kit',
      'Family Kit',
      'Laminated Sacks'
    ];

    if (commodityTypeFilter === 'Food Items') {
      return all.filter((c) => isFoodItem(c));
    }
    if (commodityTypeFilter === 'Non-Food Items') {
      return all.filter((c) => isNonFoodItem(c));
    }
    return all;
  }, [commodityTypeFilter]);

  const handleCommodityFilterChange = (val: CommodityTypeFilter) => {
    setCommodityTypeFilter(val);
    setCurrentPage(1);
    if (categoryFilter !== 'all' && !matchesCommodityFilter(categoryFilter, val)) {
      setCategoryFilter('all');
    }
  };

  // Active view list and pagination
  const activeList = activeTab === 'transactions' ? filteredTransactions : filteredLots;
  const totalPages = Math.max(1, Math.ceil(activeList.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, currentPage, pageSize]);

  // Toggle sort by expiry on clicking column header
  const handleToggleExpirySort = () => {
    if (sortBy === 'expiry_asc') {
      setSortBy('expiry_desc');
    } else {
      setSortBy('expiry_asc');
    }
    setCurrentPage(1);
  };

  // High-level aggregate metrics
  const totalInflow = useMemo(() => {
    const muniLower = (lgu?.municipality || '').trim().toLowerCase();
    return allTransactions
      .filter((t) => t.type === 'Incoming' || (muniLower && t.destination.toLowerCase().includes(muniLower)))
      .reduce((sum, t) => sum + t.quantity, 0);
  }, [allTransactions, lgu?.municipality]);

  const totalOutflow = useMemo(() => {
    const muniLower = (lgu?.municipality || '').trim().toLowerCase();
    return allTransactions
      .filter((t) => Boolean(muniLower && t.source.toLowerCase().includes(muniLower)))
      .reduce((sum, t) => sum + t.quantity, 0);
  }, [allTransactions, lgu?.municipality]);

  const totalOnHand = useMemo(() => {
    if (!lgu?.currentStock) return 0;
    return Object.values(lgu.currentStock).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [lgu]);

  const maxStockCapacity = lgu?.maxStock && lgu.maxStock > 0 ? lgu.maxStock : 3000;
  const capacityPercent = Math.min(100, Math.round((totalOnHand / maxStockCapacity) * 100));

  if (!isOpen || !lgu) return null;

  return (
    <div className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 overflow-y-auto ${isMaximized ? 'p-0' : 'p-3 sm:p-5'}`}>
      <div className={`bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        isMaximized
          ? 'w-full h-full max-w-none max-h-none rounded-none'
          : 'rounded-2xl max-w-5xl w-full max-h-[92vh]'
      }`}>
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white flex items-start justify-between gap-4 flex-shrink-0">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">{lgu.lguName || lgu.municipality}</h2>
                <span className="text-sm text-blue-200">&bull; {lgu.municipality}, {lgu.province}</span>
                {lgu.isActive === false && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-amber-950 rounded">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100/90 mt-1">
                {lgu.contactPerson ? `Contact: ${lgu.contactPerson}` : 'Designated Municipal Warehouse'}
                {lgu.contactNumber ? ` (${lgu.contactNumber})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExportPdfOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Export official printable PDF report for this LGU"
            >
              <Printer className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Export PDF Report</span>
              <span className="sm:hidden">PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={isMaximized ? 'Restore window size' : 'Maximize to full screen'}
              aria-label={isMaximized ? 'Restore window size' : 'Maximize window'}
            >
              {isMaximized ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close window"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
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
                {allTransactions.filter((t) => t.type === 'Incoming' || t.destination.toLowerCase().includes((lgu.municipality || '').toLowerCase())).length} inbound deliveries &amp; intakes
              </p>
            </div>

            <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-blue-700 font-bold mb-1">
                <span>Total Dispatched</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-blue-950">{totalOutflow.toLocaleString()}</p>
              <p className="text-[11px] text-blue-700 mt-1">
                {allTransactions.filter((t) => Boolean(lgu.municipality && t.source.toLowerCase().includes(lgu.municipality.toLowerCase()))).length} outward distributions
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

          {/* Section 2: Incoming and Outgoing Transaction History & FEFO Expiry Breakdown */}
          <div className="space-y-4">
            {/* Section Header & Tab Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    {activeTab === 'transactions' ? 'Incoming & Outgoing Transactions' : 'Stock by Expiry (FEFO Batches)'}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium">
                    {isLoadingLedger ? 'Syncing...' : 'Realtime DB Sync'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {activeTab === 'transactions'
                    ? `Complete audit trail of relief shipments arriving at and releasing from ${lgu.municipality}`
                    : `FEFO batch-level shelf-life tracker and expiration schedule for ${lgu.municipality}`}
                </p>
              </div>

              {/* View Mode Tabs: Transactions Ledger vs Stock by Expiry */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('transactions');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'transactions'
                      ? 'bg-white text-blue-900 font-bold shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                  }`}
                  title="View complete transaction history and delivery flow"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
                  <span>Transactions ({allTransactions.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('fefo_expiry');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'fefo_expiry'
                      ? 'bg-purple-700 text-white font-bold shadow-xs'
                      : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                  title="View prepositioned stock and delivered lots by expiration date (FEFO)"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>View by Expiry ({fefoMetrics.totalLots})</span>
                  {fefoMetrics.criticalLots > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white animate-pulse">
                      {fefoMetrics.criticalLots}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Commodity Classification Quick Toggle Bar for Stock by Expiry */}
            {activeTab === 'fefo_expiry' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-900">Commodity Classification</span>
                      <span className="text-[10px] font-semibold text-gray-600 bg-white px-1.5 py-0.2 rounded border border-gray-200">
                        FEFO Stock Filter
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Filter prepositioned relief batches by Food vs Non-Food Items
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => handleCommodityFilterChange('All')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      commodityTypeFilter === 'All'
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span>All Commodities</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        commodityTypeFilter === 'All'
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {lotClassificationCounts.allLots}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCommodityFilterChange('Food Items')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      commodityTypeFilter === 'Food Items'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                    }`}
                  >
                    <span>Food Items (FFP &amp; RTEF)</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        commodityTypeFilter === 'Food Items'
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {lotClassificationCounts.foodLots}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCommodityFilterChange('Non-Food Items')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      commodityTypeFilter === 'Non-Food Items'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-800 hover:text-indigo-950 hover:bg-indigo-50'
                    }`}
                  >
                    <span>Non-Food Items (NFIs)</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        commodityTypeFilter === 'Non-Food Items'
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-900'
                      }`}
                    >
                      {lotClassificationCounts.nonFoodLots}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* FEFO Shelf-Life Metrics Sub-Banner (Always available as quick filters) */}
            {activeTab === 'fefo_expiry' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter((prev) => (prev === 'critical' ? 'all' : 'critical'));
                    setCurrentPage(1);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    expiryFilter === 'critical'
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-400'
                      : 'bg-white border-gray-200 hover:border-red-200 hover:bg-red-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-800">Critical Shelf-Life</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <p className="text-lg font-extrabold text-red-900 mt-0.5">{fefoMetrics.criticalLots} Lots</p>
                  <p className="text-[10px] text-red-700 font-medium">
                    {fefoMetrics.criticalUnits.toLocaleString()} units (&le; {EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS}d)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter((prev) => (prev === 'moderate' ? 'all' : 'moderate'));
                    setCurrentPage(1);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    expiryFilter === 'moderate'
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                      : 'bg-white border-gray-200 hover:border-amber-200 hover:bg-amber-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">Moderate Shelf-Life</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="text-lg font-extrabold text-amber-900 mt-0.5">{fefoMetrics.moderateLots} Lots</p>
                  <p className="text-[10px] text-amber-700 font-medium">
                    {fefoMetrics.moderateUnits.toLocaleString()} units ({EXPIRY_THRESHOLDS.MODERATE_MIN_DAYS}-{EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS}d)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter((prev) => (prev === 'safe' ? 'all' : 'safe'));
                    setCurrentPage(1);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    expiryFilter === 'safe'
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
                      : 'bg-white border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800">Safe Reserve</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-lg font-extrabold text-emerald-900 mt-0.5">{fefoMetrics.safeLots} Lots</p>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    {fefoMetrics.safeUnits.toLocaleString()} units (&gt; {EXPIRY_THRESHOLDS.SAFE_MIN_DAYS}d)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setExpiryFilter((prev) => (prev === 'expired' ? 'all' : 'expired'));
                    setCurrentPage(1);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    expiryFilter === 'expired'
                      ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-400'
                      : 'bg-white border-gray-200 hover:border-rose-200 hover:bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800">Expired Stock</span>
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                  </div>
                  <p className="text-lg font-extrabold text-rose-900 mt-0.5">{fefoMetrics.expiredLots} Lots</p>
                  <p className="text-[10px] text-rose-700 font-medium">
                    {fefoMetrics.expiredUnits.toLocaleString()} units expired
                  </p>
                </button>
              </div>
            )}

            {/* Time Horizon Quick Filters (when on Transactions mode) */}
            {activeTab === 'transactions' && (
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto border border-gray-200 w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    timeFilter === 'all'
                      ? 'bg-white text-blue-900 font-bold shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                  }`}
                  title="Show all transactions across all dates"
                >
                  <span>All Time</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      timeFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {countsByTimeFilter.allCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('10days');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    timeFilter === '10days'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-blue-700 hover:text-blue-900 hover:bg-blue-50'
                  }`}
                  title="Filter transactions recorded in the past 10 days"
                >
                  <span>Past 10 Days</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      timeFilter === '10days' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {countsByTimeFilter.tenDaysCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('30days');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    timeFilter === '30days'
                      ? 'bg-white text-blue-900 font-bold shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                  }`}
                  title="Filter transactions recorded in the past 30 days"
                >
                  <span>Past 30 Days</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      timeFilter === '30days' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {countsByTimeFilter.thirtyDaysCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimeFilter('90days');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    timeFilter === '90days'
                      ? 'bg-white text-blue-900 font-bold shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                  }`}
                  title="Filter transactions recorded in the past 90 days"
                >
                  <span>Past 90 Days</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      timeFilter === '90days' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {countsByTimeFilter.ninetyDaysCount}
                  </span>
                </button>
              </div>
            )}

            {/* Filter Bar: Classification, Flow/Urgency, Category, Sort by Expiry/Date, and Search */}
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Classification Filter */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Classification</label>
                <select
                  value={commodityTypeFilter}
                  onChange={(e) => handleCommodityFilterChange(e.target.value as CommodityTypeFilter)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
                >
                  <option value="All">All Commodities</option>
                  <option value="Food Items">Food Items (FFP &amp; RTEF)</option>
                  <option value="Non-Food Items">Non-Food Items (NFIs)</option>
                </select>
              </div>

              {/* Type Filter (Transactions Mode) OR Expiry Urgency Filter (Both Modes) */}
              {activeTab === 'transactions' ? (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Transaction Flow</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value as 'all' | 'Incoming' | 'Outgoing');
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
                  >
                    <option value="all">All Flow (Incoming &amp; Outgoing)</option>
                    <option value="Outgoing">Outgoing Releases (DR &amp; Dispatches)</option>
                    <option value="Incoming">Incoming Intakes (RIS)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Shelf-Life Urgency</label>
                  <select
                    value={expiryFilter}
                    onChange={(e) => {
                      setExpiryFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer bg-white"
                  >
                    <option value="all">All Shelf-Life Statuses</option>
                    <option value="critical">Critical (&le; 100 days)</option>
                    <option value="moderate">Moderate (101 - 150 days)</option>
                    <option value="safe">Safe Reserve (&gt; 150 days)</option>
                    <option value="expired">Expired Stock</option>
                  </select>
                </div>
              )}

              {/* Category Filter */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  {commodityTypeFilter === 'Food Items'
                    ? 'Food Item Type'
                    : commodityTypeFilter === 'Non-Food Items'
                    ? 'Non-Food Item Type'
                    : 'Commodity / Item Type'}
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
                >
                  <option value="all">
                    {commodityTypeFilter === 'Food Items'
                      ? 'All Food Items (FFP & RTEF)'
                      : commodityTypeFilter === 'Non-Food Items'
                      ? 'All Non-Food Items (NFIs)'
                      : 'All Items & Kits'}
                  </option>
                  {availableCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By Dropdown (includes Sort by Expiry!) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Sort Ordering</label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
                >
                  <option value="expiry_asc">Earliest Expiry First (FEFO Priority)</option>
                  <option value="expiry_desc">Latest Expiry First</option>
                  <option value="date_desc">Newest Date First</option>
                  <option value="date_asc">Oldest Date First</option>
                  <option value="qty_desc">Highest Quantity</option>
                  <option value="qty_asc">Lowest Quantity</option>
                </select>
              </div>

              {/* Search Bar */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Search Reference / Batch</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search DR, lot, category..."
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

            {/* Active Scope Notice Banner when Filtered */}
            {activeTab === 'fefo_expiry' && commodityTypeFilter !== 'All' && (
              <div
                className={`px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  commodityTypeFilter === 'Food Items'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      commodityTypeFilter === 'Food Items' ? 'bg-amber-500' : 'bg-indigo-500'
                    } animate-pulse`}
                  />
                  <span>
                    Scope Filter: <strong>{commodityTypeFilter === 'Food Items' ? 'Food Items Only (FFP & RTEF)' : 'Non-Food Items Only (NFIs)'}</strong> &mdash; Showing {filteredLots.length} lot{filteredLots.length === 1 ? '' : 's'} ({filteredLots.reduce((acc, l) => acc + (l.quantity || 0), 0).toLocaleString()} units)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCommodityFilterChange('All')}
                  className="font-bold underline text-[11px] hover:opacity-80 cursor-pointer"
                >
                  Reset to All Commodities
                </button>
              </div>
            )}

            {/* Active Table: Transactions OR Stock by Expiry */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                    {activeTab === 'transactions' ? (
                      <tr>
                        <th className="px-4 py-3">Flow</th>
                        <th className="px-4 py-3">Reference / DR</th>
                        <th className="px-4 py-3">Commodity Item</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Route (Origin &rarr; Destination)</th>
                        <th className="px-4 py-3">Date</th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition select-none"
                          onClick={handleToggleExpirySort}
                          title="Click to sort by expiration date"
                        >
                          <div className="flex items-center gap-1">
                            <span>Expiration Date / Shelf-Life</span>
                            {sortBy === 'expiry_asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                            ) : sortBy === 'expiry_desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-4 py-3">Batch Token / Lot</th>
                        <th className="px-4 py-3">Reference / DR</th>
                        <th className="px-4 py-3">Commodity Item</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3">Origin Facility</th>
                        <th className="px-4 py-3">Received Date</th>
                        <th
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition select-none"
                          onClick={handleToggleExpirySort}
                          title="Click to sort by expiration date"
                        >
                          <div className="flex items-center gap-1">
                            <span>Expiration Date / Shelf-Life</span>
                            {sortBy === 'expiry_asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-purple-700" />
                            ) : sortBy === 'expiry_desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-purple-700" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeTab === 'transactions' ? (
                      (paginatedItems as LGUTransaction[]).map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {tx.flowLabel === 'Outgoing Release (DR)' || (!tx.flowLabel && tx.referenceCode?.startsWith('DR-')) ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                Outgoing Release (DR)
                              </span>
                            ) : tx.flowLabel === 'Incoming Intake (RIS)' || tx.flowLabel === 'Intake (RIS)' || (!tx.flowLabel && (tx.type === 'Incoming' || tx.referenceCode?.startsWith('RIS-') || tx.referenceCode?.startsWith('INC-'))) ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Incoming Intake (RIS)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                                <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                {tx.flowLabel || 'Local Distribution'}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                            {tx.referenceCode}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-gray-800 block">{tx.category}</span>
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isFoodItem(tx.category)
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {isFoodItem(tx.category) ? 'Food Item' : 'Non-Food'}
                            </span>
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

                          {/* Expiration Date & FEFO Badge Column */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {tx.expirationDate ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <span className="font-mono font-bold text-gray-900 text-xs">
                                    {tx.expirationDate}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {(() => {
                                    const tier = tx.expiryTier || getExpiryTier(tx.expirationDate);
                                    const days = tx.daysRemaining ?? getDaysRemaining(tx.expirationDate);
                                    const cfg = getExpiryBadgeConfig(tier);
                                    return (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${cfg.badgeClass}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                                        <span>{cfg.label}</span>
                                        <span className="text-[9px] opacity-75">
                                          ({days > 0 ? `${days}d left` : 'Expired'})
                                        </span>
                                      </span>
                                    );
                                  })()}
                                  {tx.allocatedBatches && tx.allocatedBatches.length > 1 && (
                                    <span className="text-[9px] font-medium text-purple-700 bg-purple-50 px-1 rounded border border-purple-200" title={tx.allocatedBatches.map(b => `${b.batchTokenId || b.batchNumber}: ${b.expirationDate || 'N/A'}`).join(', ')}>
                                      {tx.allocatedBatches.length} lots
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px] italic">Standard Reserve</span>
                            )}
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
                      ))
                    ) : (
                      (paginatedItems as LGUExpiryLot[]).map((lot) => (
                        <tr key={lot.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-purple-950 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-purple-700" />
                              <span className="truncate max-w-[150px]" title={lot.batchTokenId}>{lot.batchTokenId}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono font-medium text-gray-700 whitespace-nowrap">
                            {lot.referenceCode}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-gray-900 block">{lot.category}</span>
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isFoodItem(lot.category)
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {isFoodItem(lot.category) ? 'Food Item' : 'Non-Food'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                            {lot.quantity.toLocaleString()} {lot.unit}
                          </td>

                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={lot.source}>
                            <span className="font-medium text-gray-800">{lot.source}</span>
                            {lot.deliveryMode && (
                              <span className="text-[10px] text-gray-400 block mt-0.5">
                                Via {lot.deliveryMode}{lot.plateNumber ? ` (${lot.plateNumber})` : ''}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {lot.date || 'Unspecified'}
                          </td>

                          {/* Expiration Date & FEFO Badge Column */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lot.expirationDate ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <span className="font-mono font-bold text-gray-900 text-xs">
                                    {lot.expirationDate}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {(() => {
                                    const tier = lot.expiryTier || getExpiryTier(lot.expirationDate);
                                    const days = lot.daysRemaining ?? getDaysRemaining(lot.expirationDate);
                                    const cfg = getExpiryBadgeConfig(tier);
                                    return (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${cfg.badgeClass}`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                                        <span>{cfg.label}</span>
                                        <span className="text-[9px] opacity-75">
                                          ({days > 0 ? `${days}d left` : 'Expired'})
                                        </span>
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px] italic">Standard Reserve</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                lot.status === 'Delivered' || lot.status === 'Accepted' || lot.status === 'In Stock'
                                  ? 'bg-green-100 text-green-800'
                                  : lot.status === 'In Transit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {lot.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {activeList.length === 0 && (
                <div className="p-8 text-center bg-gray-50/50">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700">
                    {activeTab === 'transactions' ? 'No transactions match your filter' : 'No inventory lots match your filter'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try switching filters (e.g., select &quot;All Items &amp; Kits&quot; or &quot;All Shelf-Life Statuses&quot;).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCommodityTypeFilter('All');
                      setTimeFilter('all');
                      setTypeFilter('all');
                      setCategoryFilter('all');
                      setExpiryFilter('all');
                      setSortBy('date_desc');
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}

              {/* Pagination */}
              {activeList.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-[11px] text-gray-500">
                    Showing <span className="font-bold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-bold">{Math.min(currentPage * pageSize, activeList.length)}</span> of{' '}
                    <span className="font-bold">{activeList.length}</span> {activeTab === 'transactions' ? 'transactions' : 'lots'}
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
            DSWD Disaster Relief Operations &bull; {lgu.municipality}, {lgu.province}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExportPdfOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Export official printable PDF report for this LGU"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Export PDF Report</span>
            </button>
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

      {/* Official LGU Disaster Relief & Inventory PDF Report Modal */}
      {isExportPdfOpen && (
        <LGUReportPdfModal
          isOpen={isExportPdfOpen}
          onClose={() => setIsExportPdfOpen(false)}
          lgu={lgu}
          allTransactions={allTransactions}
          allLots={allLots}
          inventoryDates={inventoryDates}
          fefoMetrics={fefoMetrics}
          totalOnHand={totalOnHand}
          totalInflow={totalInflow}
          totalOutflow={totalOutflow}
          capacityPercent={capacityPercent}
          maxStockCapacity={maxStockCapacity}
        />
      )}
    </div>
  );
}
