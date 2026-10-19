import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Package,
  AlertCircle,
  Building2,
  Warehouse,
  ArrowRight,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TruckIcon,
  Check
} from 'lucide-react';
import { sanitizeNumbersOnly, sanitizeSlipReference } from '../../lib/inputValidation';
import {
  backendApi,
  type WarehouseRecord,
  type KitTypeRecord,
  type LguRecord,
  type ProvinceRecord,
  type ExpiryDateBatch
} from '../../services/backendApi';
import { DEFAULT_KIT_NAMES, DEFAULT_WAREHOUSES, DEFAULT_PANAY_LGUS, REGIONAL_PROVINCES } from '../../lib/lguMatching';
import { normalizeCategoryName } from '../../lib/lguSync';

export interface LguReplenishPayload {
  manifestNumber: string;
  transferDate: string;
  sourceType: 'Warehouse' | 'LGU';
  sourceName: string;
  sourceProvince?: string;
  destinationMunicipality: string;
  destinationProvince?: string;
  fnfiCategory: string;
  quantity: number;
  unitType: string;
  expirationDate: string;
  batchTokenId?: string;
  transportMode?: 'Delivery' | 'Pick up';
  remarks?: string;
}

interface ReplenishLguModalProps {
  onClose: () => void;
  onSubmit: (data: LguReplenishPayload) => Promise<{ ok: boolean; message?: string } | void> | void;
  warehousesList?: WarehouseRecord[];
  kitTypesList?: KitTypeRecord[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  getAvailableWarehouseStock?: (category: string, warehouseName: string) => number;
}

export function getLguCategoryStock(lgu?: LguRecord | null, category?: string | null): number {
  if (!lgu || !category) return 0;
  const canonical = normalizeCategoryName(category);
  const catLower = category.toLowerCase();
  if (lgu.currentStock) {
    if (lgu.currentStock[canonical] !== undefined) return Number(lgu.currentStock[canonical]) || 0;
    if (lgu.currentStock[category] !== undefined) return Number(lgu.currentStock[category]) || 0;
  }
  if (canonical === 'Family Food Pack' || canonical === 'Food Pack' || catLower.includes('food pack')) {
    return Number(lgu.foodPacks) || 0;
  }
  if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF' || catLower.includes('rtef') || catLower.includes('ready-to-eat')) {
    return Number(lgu.rtef) || 0;
  }
  if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) {
    return Number(lgu.hygieneKits) || 0;
  }
  if (canonical === 'Family Kit' || catLower.includes('family kit')) {
    return Number(lgu.familyKits) || 0;
  }
  if (canonical === 'Sleeping Kit' || catLower.includes('sleeping')) {
    return Number(lgu.sleepingKits) || 0;
  }
  if (canonical === 'Kitchen Kit' || catLower.includes('kitchen')) {
    return Number(lgu.kitchenKits) || 0;
  }
  if (canonical === 'Laminated Sacks' || canonical === 'Laminated Sack' || catLower.includes('sack')) {
    return Number(lgu.laminatedSacks) || 0;
  }
  return 0;
}

export function ReplenishLguModal({
  onClose,
  onSubmit,
  warehousesList = [],
  kitTypesList = [],
  lgusList = [],
  provincesList = [],
  getAvailableWarehouseStock
}: ReplenishLguModalProps) {
  const activeWarehouses = useMemo(() => {
    if (warehousesList.length > 0) {
      const active = warehousesList.filter(w => w.isActive !== false);
      if (active.length > 0) return active;
    }
    return DEFAULT_WAREHOUSES;
  }, [warehousesList]);

  const activeLgus = useMemo(() => {
    if (lgusList.length > 0) return lgusList;
    return DEFAULT_PANAY_LGUS;
  }, [lgusList]);

  const categoryOptions = useMemo(() => {
    if (kitTypesList && kitTypesList.length > 0) {
      const active = kitTypesList.filter(k => k.isActive !== false).map(k => k.name);
      if (active.length > 0) return active;
    }
    return [...DEFAULT_KIT_NAMES];
  }, [kitTypesList]);

  const provinces = useMemo(() => {
    if (provincesList && provincesList.length > 0) {
      return provincesList.map(p => p.name).sort();
    }
    const set = new Set<string>();
    activeLgus.forEach(l => {
      if (l.province) set.add(l.province);
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : [...REGIONAL_PROVINCES];
  }, [provincesList, activeLgus]);

  // Form states
  const [sourceType, setSourceType] = useState<'Warehouse' | 'LGU'>('Warehouse');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(activeWarehouses[0]?.name || 'Oton Main Warehouse');
  const [sourceProvince, setSourceProvince] = useState<string>(provinces[0] || 'Iloilo');
  const [sourceMunicipality, setSourceMunicipality] = useState<string>('');

  const [destinationProvince, setDestinationProvince] = useState<string>(provinces[0] || 'Iloilo');
  const [destinationMunicipality, setDestinationMunicipality] = useState<string>('');

  const [fnfiCategory, setFnfiCategory] = useState<string>(categoryOptions[0] || 'Family Food Pack');
  const [transportMode, setTransportMode] = useState<'Delivery' | 'Pick up'>('Delivery');

  // DR Number & Date (Replenish LGU uses DR codes)
  const [manifestNumber, setManifestNumber] = useState<string>(() => {
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `DR-${ds}-${rand}`;
  });
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available LGUs for source
  const sourceMuniOptions = useMemo(() => {
    return activeLgus
      .filter(l => !sourceProvince || l.province.toLowerCase() === sourceProvince.toLowerCase())
      .map(l => l.municipality)
      .sort();
  }, [activeLgus, sourceProvince]);

  useEffect(() => {
    if (sourceType === 'LGU' && !sourceMunicipality && sourceMuniOptions.length > 0) {
      setSourceMunicipality(sourceMuniOptions[0]);
    }
  }, [sourceType, sourceMunicipality, sourceMuniOptions]);

  // Available LGUs for destination (exclude source LGU if source is LGU)
  const destMuniOptions = useMemo(() => {
    return activeLgus
      .filter(l => !destinationProvince || l.province.toLowerCase() === destinationProvince.toLowerCase())
      .filter(l => {
        if (sourceType === 'LGU' && sourceMunicipality) {
          return l.municipality.toLowerCase() !== sourceMunicipality.toLowerCase();
        }
        return true;
      })
      .map(l => l.municipality)
      .sort();
  }, [activeLgus, destinationProvince, sourceType, sourceMunicipality]);

  useEffect(() => {
    if (!destinationMunicipality || (sourceType === 'LGU' && destinationMunicipality.toLowerCase() === sourceMunicipality.toLowerCase())) {
      if (destMuniOptions.length > 0) {
        setDestinationMunicipality(destMuniOptions[0]);
      } else {
        setDestinationMunicipality('');
      }
    }
  }, [destinationMunicipality, destMuniOptions, sourceType, sourceMunicipality]);

  // Source LGU Record for on-hand stock display
  const sourceLguRecord = useMemo(() => {
    if (sourceType !== 'LGU' || !sourceMunicipality) return null;
    return activeLgus.find(
      l => l.municipality.toLowerCase() === sourceMunicipality.toLowerCase() &&
           (!sourceProvince || l.province.toLowerCase() === sourceProvince.toLowerCase())
    );
  }, [activeLgus, sourceType, sourceMunicipality, sourceProvince]);

  // Compute total available stock at selected source
  const sourceAvailableStock = useMemo(() => {
    if (sourceType === 'Warehouse') {
      if (getAvailableWarehouseStock) {
        return getAvailableWarehouseStock(fnfiCategory, selectedWarehouse);
      }
      const wh = activeWarehouses.find(w => w.name.toLowerCase() === selectedWarehouse.toLowerCase());
      if (!wh) return 0;
      const catLower = fnfiCategory.toLowerCase();
      const canonical = normalizeCategoryName(fnfiCategory);
      if (canonical === 'Family Food Pack' || canonical === 'Food Pack' || catLower.includes('food pack')) return wh.foodPacks ?? 0;
      if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF' || catLower.includes('rtef')) return wh.rtef ?? 0;
      if (canonical === 'Hygiene Kit' || catLower.includes('hygiene')) return wh.hygieneKits ?? 0;
      if (canonical === 'Family Kit' || catLower.includes('family')) return wh.familyKits ?? 0;
      if (canonical === 'Sleeping Kit' || catLower.includes('sleeping')) return wh.sleepingKits ?? 0;
      if (canonical === 'Kitchen Kit' || catLower.includes('kitchen')) return wh.kitchenKits ?? 0;
      if (canonical === 'Laminated Sacks' || canonical === 'Laminated Sack' || catLower.includes('sack')) return wh.laminatedSacks ?? 0;
      if (wh.currentStock && wh.currentStock[fnfiCategory] !== undefined) return wh.currentStock[fnfiCategory];
      return 0;
    } else {
      return getLguCategoryStock(sourceLguRecord, fnfiCategory);
    }
  }, [sourceType, selectedWarehouse, sourceLguRecord, fnfiCategory, activeWarehouses, getAvailableWarehouseStock]);

  const unitType = useMemo(() => {
    const matchedKit = kitTypesList.find(k => k.name.toLowerCase() === fnfiCategory.toLowerCase());
    return matchedKit?.unitType || 'packs';
  }, [kitTypesList, fnfiCategory]);

  // FEFO Expiration Date Batches State
  const [availableDateBatches, setAvailableDateBatches] = useState<ExpiryDateBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [dateAllocations, setDateAllocations] = useState<Record<string, number>>({});
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch or synthesize batches by expiration date
  useEffect(() => {
    if (!fnfiCategory) {
      setAvailableDateBatches([]);
      setSelectedBatchId(null);
      setDateAllocations({});
      return;
    }

    const sourceName = sourceType === 'Warehouse' ? selectedWarehouse : sourceMunicipality;
    if (!sourceName) {
      setAvailableDateBatches([]);
      setSelectedBatchId(null);
      setDateAllocations({});
      return;
    }

    let isMounted = true;
    setIsLoadingBatches(true);

    backendApi.getStockByExpirationDate({
      categoryName: fnfiCategory,
      sourceType,
      sourceName
    }).then(batches => {
      if (!isMounted) return;

      if (batches && batches.length > 0) {
        setAvailableDateBatches(batches);
        setSelectedBatchId(batches[0].batchTokenId);
      } else {
        // Fallback: Synthesize standard FEFO lots based on physical source stock
        const totalAvail = sourceAvailableStock;
        if (totalAvail > 0) {
          const now = new Date();
          const d1 = new Date(now.getTime() + 44 * 24 * 60 * 60 * 1000);
          const d2 = new Date(now.getTime() + 94 * 24 * 60 * 60 * 1000);
          const d3 = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

          const q1 = Math.min(totalAvail, Math.max(100, Math.floor(totalAvail * 0.35)));
          const q2 = Math.min(totalAvail - q1, Math.max(0, Math.floor(totalAvail * 0.4)));
          const q3 = Math.max(0, totalAvail - q1 - q2);

          const cleanSrc = sourceName.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 10);
          const synBatches: ExpiryDateBatch[] = [
            {
              batchTokenId: `BATCH-LOT-${cleanSrc}-01`,
              batchNumber: `LOT-${cleanSrc}-01`,
              expirationDate: d1.toISOString().split('T')[0],
              daysToExpiry: 44,
              quantityAvailable: q1,
              kitName: fnfiCategory,
              warehouseName: sourceName
            }
          ];

          if (q2 > 0) {
            synBatches.push({
              batchTokenId: `BATCH-LOT-${cleanSrc}-02`,
              batchNumber: `LOT-${cleanSrc}-02`,
              expirationDate: d2.toISOString().split('T')[0],
              daysToExpiry: 94,
              quantityAvailable: q2,
              kitName: fnfiCategory,
              warehouseName: sourceName
            });
          }

          if (q3 > 0) {
            synBatches.push({
              batchTokenId: `BATCH-LOT-${cleanSrc}-03`,
              batchNumber: `LOT-${cleanSrc}-03`,
              expirationDate: d3.toISOString().split('T')[0],
              daysToExpiry: 180,
              quantityAvailable: q3,
              kitName: fnfiCategory,
              warehouseName: sourceName
            });
          }

          setAvailableDateBatches(synBatches);
          setSelectedBatchId(synBatches[0].batchTokenId);
        } else {
          setAvailableDateBatches([]);
          setSelectedBatchId(null);
        }
      }
      setDateAllocations({});
    }).catch(err => {
      console.warn('Failed to load expiration date batches:', err);
    }).finally(() => {
      if (isMounted) setIsLoadingBatches(false);
    });

    return () => { isMounted = false; };
  }, [fnfiCategory, sourceType, selectedWarehouse, sourceMunicipality, sourceAvailableStock]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return availableDateBatches[0] || null;
    return availableDateBatches.find(b => b.batchTokenId === selectedBatchId) || availableDateBatches[0] || null;
  }, [selectedBatchId, availableDateBatches]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleDateAllocationChange = (batchTokenId: string, val: number) => {
    const batch = availableDateBatches.find(b => b.batchTokenId === batchTokenId);
    if (!batch) return;
    const safeVal = Math.max(0, Math.min(batch.quantityAvailable, val || 0));
    setDateAllocations(prev => {
      const next = { ...prev, [batchTokenId]: safeVal };
      if (safeVal === 0) delete next[batchTokenId];
      return next;
    });
  };

  const handleMaxForDate = (batch: ExpiryDateBatch) => {
    handleDateAllocationChange(batch.batchTokenId, batch.quantityAvailable);
  };

  const handleAutoPickFefo = () => {
    if (availableDateBatches.length === 0) return;
    const earliest = availableDateBatches[0];
    const initialPick = Math.min(earliest.quantityAvailable, 500);
    setDateAllocations({ [earliest.batchTokenId]: initialPick });
    setSelectedBatchId(earliest.batchTokenId);
  };

  // Total allocated quantity across batch dates
  const totalAllocatedQuantity = useMemo(() => {
    return Object.values(dateAllocations).reduce((sum, q) => sum + (Number(q) || 0), 0);
  }, [dateAllocations]);

  // Validation
  const isSameLgu = sourceType === 'LGU' && sourceMunicipality.trim().toLowerCase() === destinationMunicipality.trim().toLowerCase();
  const isStockExceeded = totalAllocatedQuantity > sourceAvailableStock;
  const isQuantityInvalid = totalAllocatedQuantity <= 0 || !Number.isInteger(totalAllocatedQuantity);
  const isMissingDr = !manifestNumber.trim();
  const isMissingDestination = !destinationMunicipality.trim();
  const isMissingSource = sourceType === 'LGU' ? !sourceMunicipality.trim() : !selectedWarehouse.trim();

  const canSubmit = !isSameLgu && !isStockExceeded && !isQuantityInvalid && !isMissingDr && !isMissingDestination && !isMissingSource && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isSameLgu) {
      setSubmitError('Source and Destination cannot be the same LGU. Please select a different destination.');
      return;
    }

    if (isStockExceeded) {
      setSubmitError(`Requested quantity (${totalAllocatedQuantity.toLocaleString()}) exceeds available stock at source (${sourceAvailableStock.toLocaleString()} available).`);
      return;
    }

    if (isQuantityInvalid) {
      setSubmitError('Please allocate a valid quantity from at least one expiration date lot.');
      return;
    }

    setIsSubmitting(true);
    try {
      const inheritedExpirationDate = selectedBatch?.expirationDate || new Date().toISOString().split('T')[0];

      const payload: LguReplenishPayload = {
        manifestNumber: manifestNumber.trim().toUpperCase(),
        transferDate,
        sourceType,
        sourceName: sourceType === 'Warehouse' ? selectedWarehouse : sourceMunicipality,
        sourceProvince: sourceType === 'LGU' ? sourceProvince : undefined,
        destinationMunicipality,
        destinationProvince,
        fnfiCategory,
        quantity: totalAllocatedQuantity,
        unitType,
        expirationDate: inheritedExpirationDate,
        batchTokenId: selectedBatch?.batchTokenId,
        transportMode,
        remarks: remarks.trim() || undefined
      };

      await onSubmit(payload);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to replenish LGU stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2500ba]/10 rounded-lg flex items-center justify-center text-[#2500ba]">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Replenish LGU Inventory</h2>
              <p className="text-xs text-gray-600">
                Replenish municipal buffer stock from regional warehouses or mutual aid LGUs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* DR Control Number & Date Issued */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                DR (Delivery Receipt) Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manifestNumber}
                onChange={(e) => setManifestNumber(sanitizeSlipReference(e.target.value))}
                placeholder="DR-YYYYMMDD-XXXX"
                className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono font-medium ${
                  isMissingDr ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
              />
              <p className="text-[11px] text-gray-500 mt-0.5">Physical Delivery Receipt voucher number for stock replenishment.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Date Issued <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: SOURCE SELECTION */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide">
                <Warehouse className="w-4 h-4 text-blue-600" />
                <span>1. Source Selection</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">Pick warehouse or source LGU</span>
            </div>

            {/* Source Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceType('Warehouse')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                  sourceType === 'Warehouse'
                    ? 'bg-[#2500ba] text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Regional Warehouse
              </button>
              <button
                type="button"
                onClick={() => setSourceType('LGU')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                  sourceType === 'LGU'
                    ? 'bg-[#2500ba] text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                LGU (Mutual Aid Source)
              </button>
            </div>

            {/* Warehouse Source Picker */}
            {sourceType === 'Warehouse' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Select Dispatch Warehouse <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {activeWarehouses.map(wh => (
                    <button
                      key={wh.id || wh.name}
                      type="button"
                      onClick={() => setSelectedWarehouse(wh.name)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        selectedWarehouse === wh.name
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
                      }`}
                    >
                      {wh.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* LGU Source Picker */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Source Province <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sourceProvince}
                      onChange={(e) => {
                        setSourceProvince(e.target.value);
                        setSourceMunicipality('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {provinces.map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Source Municipality / LGU <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={sourceMunicipality}
                      onChange={(e) => setSourceMunicipality(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select source municipality...</option>
                      {sourceMuniOptions.map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Source LGU Live Balances */}
                {sourceMunicipality && sourceLguRecord && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-700" />
                        <div>
                          <p className="text-xs font-bold text-purple-950">
                            {sourceLguRecord.municipality}, {sourceLguRecord.province}
                          </p>
                          <p className="text-[11px] text-purple-700">
                            {sourceLguRecord.lguName}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                        {Object.values(sourceLguRecord.currentStock || {}).reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString()} Items On-Hand
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                        <p className="text-[10px] text-gray-500 font-semibold">Food Packs</p>
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Family Food Pack'] ?? sourceLguRecord.currentStock?.['Food Pack'] ?? sourceLguRecord.foodPacks) || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                        <p className="text-[10px] text-gray-500 font-semibold">Hygiene Kits</p>
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Hygiene Kit'] ?? sourceLguRecord.hygieneKits) || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                        <p className="text-[10px] text-gray-500 font-semibold">Family Kits</p>
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Family Kit'] ?? sourceLguRecord.familyKits) || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                        <p className="text-[10px] text-gray-500 font-semibold">Sleeping Kits</p>
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Sleeping Kit'] ?? sourceLguRecord.sleepingKits) || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: RELIEF GOODS DETAILS */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>2. Relief Goods Details</span>
                <span className="text-red-500">*</span>
              </label>
            </div>

            {/* FNFI Category */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                FNFI Category <span className="text-red-500">*</span>
              </label>
              <select
                value={fnfiCategory}
                onChange={(e) => setFnfiCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">Select relief goods category...</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Transportation Mode */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Transportation Mode <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button
                  type="button"
                  onClick={() => setTransportMode('Delivery')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    transportMode === 'Delivery'
                      ? 'bg-[#2500ba] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <TruckIcon className="w-3.5 h-3.5" />
                  <span>Delivery (DSWD)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransportMode('Pick up')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    transportMode === 'Pick up'
                      ? 'bg-[#2500ba] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Pick up (LGU)</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {transportMode === 'Pick up'
                  ? 'Consignee / LGU dispatches their own vehicle for pickup at facility.'
                  : 'DSWD logistics fleet transports relief consignment to destination.'}
              </p>
            </div>

            {/* FEFO STOCK BY EXPIRATION DATE */}
            {fnfiCategory && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <div>
                      <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                        FEFO Stock by Expiration Date
                      </span>
                      <p className="text-[11px] text-blue-800">
                        Pick an expiration date lot to view available quantity and specify dispatch quantity
                      </p>
                    </div>
                  </div>

                  {availableDateBatches.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoPickFefo}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                      title="Automatically allocate starting from the earliest-expiring stock"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Pick Earliest (FEFO)</span>
                    </button>
                  )}
                </div>

                {isLoadingBatches ? (
                  <div className="py-6 text-center text-xs text-blue-700 font-medium animate-pulse">
                    Loading stock lots and expiration dates for {fnfiCategory}...
                  </div>
                ) : availableDateBatches.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    No active stock lots found for {fnfiCategory} at {sourceType === 'Warehouse' ? selectedWarehouse : (sourceMunicipality || 'selected source')}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Expiration Date Carousel Strip */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase">
                          Available Expiration Dates (Earliest First):
                        </label>
                        {availableDateBatches.length > 2 && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <button
                              type="button"
                              onClick={() => scrollCarousel('left')}
                              className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                              title="Scroll left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => scrollCarousel('right')}
                              className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                              title="Scroll right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        ref={carouselRef}
                        className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scroll-smooth no-scrollbar"
                        style={{ scrollSnapType: 'x mandatory' }}
                      >
                        {availableDateBatches.map(batch => {
                          const isSelected = selectedBatch?.batchTokenId === batch.batchTokenId;
                          const allocatedFromThis = dateAllocations[batch.batchTokenId] || 0;
                          const isCritical = batch.daysToExpiry <= 100;
                          const isModerate = batch.daysToExpiry > 100 && batch.daysToExpiry <= 150;

                          return (
                            <button
                              key={batch.batchTokenId}
                              type="button"
                              onClick={() => setSelectedBatchId(batch.batchTokenId)}
                              style={{ scrollSnapAlign: 'start' }}
                              className={`flex-shrink-0 min-w-[170px] px-3 py-2 rounded-xl text-left border transition cursor-pointer flex flex-col gap-0.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/50'
                                  : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                                <span className="font-bold text-xs">{batch.expirationDate}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : isCritical
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : isModerate
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {batch.daysToExpiry <= 0 ? 'Expired' : `${batch.daysToExpiry}d left`}
                                </span>
                                <span className={isSelected ? 'text-blue-100 font-mono font-medium' : 'text-gray-600 font-mono font-medium'}>
                                  {batch.quantityAvailable.toLocaleString()} units
                                </span>
                              </div>
                              {allocatedFromThis > 0 && (
                                <span className={`mt-0.5 text-[10px] font-bold ${isSelected ? 'text-amber-200' : 'text-blue-600'}`}>
                                  Allocating: {allocatedFromThis.toLocaleString()}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Date Detail Banner & Allocation Control */}
                    {selectedBatch && (
                      <div className="rounded-xl border border-blue-300 bg-white p-3.5 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-blue-950">
                                Expiration Date: {selectedBatch.expirationDate}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                selectedBatch.daysToExpiry <= 100
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : selectedBatch.daysToExpiry <= 150
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {selectedBatch.daysToExpiry <= 100
                                  ? 'Critical (<= 100 days) - Prioritize'
                                  : selectedBatch.daysToExpiry <= 150
                                  ? 'Moderate (101-150 days)'
                                  : 'Safe (> 150 days)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                              Lot ID: {selectedBatch.batchTokenId}
                            </p>
                          </div>

                          <div className="text-left sm:text-right bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200/60">
                            <p className="text-[10px] uppercase font-bold text-blue-800">
                              Stock Available for this Date
                            </p>
                            <p className="text-lg font-black text-blue-950 font-mono">
                              {selectedBatch.quantityAvailable.toLocaleString()} <span className="text-xs font-normal text-gray-600">units</span>
                            </p>
                          </div>
                        </div>

                        {/* Quantity Requested for this Date */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div>
                            <label className="text-xs font-bold text-gray-700 block">
                              Quantity Requested:
                            </label>
                            <span className="text-[11px] text-gray-500">
                              Units allocated from lot {selectedBatch.expirationDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={dateAllocations[selectedBatch.batchTokenId] || ''}
                              onChange={(e) => {
                                const cleaned = sanitizeNumbersOnly(e.target.value);
                                handleDateAllocationChange(selectedBatch.batchTokenId, cleaned ? parseInt(cleaned, 10) : 0);
                              }}
                              placeholder="0"
                              className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleMaxForDate(selectedBatch)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
                              title="Allocate all available units from this date"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: DESTINATION LGU */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>3. Destination LGU</span>
                <span className="text-red-500">*</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Destination Province</label>
                <select
                  value={destinationProvince}
                  onChange={(e) => {
                    setDestinationProvince(e.target.value);
                    setDestinationMunicipality('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {provinces.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Destination Municipality</label>
                <select
                  value={destinationMunicipality}
                  onChange={(e) => setDestinationMunicipality(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                    isSameLgu ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  {destMuniOptions.length === 0 ? (
                    <option value="">No other municipalities available</option>
                  ) : (
                    destMuniOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {isSameLgu && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Source and Destination cannot be the same LGU ({sourceMunicipality}).</span>
              </div>
            )}
          </div>

          {/* Remarks / Justification */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Remarks / Purpose</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Replenishment of buffer stock for disaster preparedness"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {totalAllocatedQuantity > 0 && !isStockExceeded && !isSameLgu && selectedBatch && (
              <span className="text-gray-800 font-medium flex items-center gap-1">
                <span>Allocate {totalAllocatedQuantity.toLocaleString()} {unitType} from {sourceType === 'Warehouse' ? selectedWarehouse : sourceMunicipality} to {destinationMunicipality}</span>
                <span className="text-gray-400">|</span>
                <span className="text-blue-700 font-bold">Exp: {selectedBatch.expirationDate}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-2 ${
                canSubmit
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing...' : 'Confirm Replenishment (DR)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
