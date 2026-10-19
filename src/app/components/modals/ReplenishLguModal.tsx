import { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Package, AlertCircle, Building2, Warehouse, ArrowRight, ShieldCheck, Truck, Check } from 'lucide-react';
import { sanitizeNumbersOnly, sanitizeSlipReference } from '../../lib/inputValidation';
import type { WarehouseRecord, KitTypeRecord, LguRecord, ProvinceRecord } from '../../services/backendApi';
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
  transportMode?: 'Delivery' | 'Pick up';
  driverEscort?: string;
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
  const [quantity, setQuantity] = useState<number>(0);
  const [manifestNumber, setManifestNumber] = useState<string>(() => {
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TRF-RIS-${ds}-${rand}`;
  });
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [transportMode, setTransportMode] = useState<'Delivery' | 'Pick up'>('Delivery');
  const [driverEscort, setDriverEscort] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Available LGUs by province for source
  const sourceMuniOptions = useMemo(() => {
    return activeLgus
      .filter(l => !sourceProvince || l.province.toLowerCase() === sourceProvince.toLowerCase())
      .map(l => l.municipality)
      .sort();
  }, [activeLgus, sourceProvince]);

  // Set initial source municipality if empty
  useEffect(() => {
    if (sourceType === 'LGU' && !sourceMunicipality && sourceMuniOptions.length > 0) {
      setSourceMunicipality(sourceMuniOptions[0]);
    }
  }, [sourceType, sourceMunicipality, sourceMuniOptions]);

  // Available LGUs by province for destination (Exclude source LGU if source is LGU)
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

  // Set initial destination municipality if empty or matches source
  useEffect(() => {
    if (!destinationMunicipality || (sourceType === 'LGU' && destinationMunicipality.toLowerCase() === sourceMunicipality.toLowerCase())) {
      if (destMuniOptions.length > 0) {
        setDestinationMunicipality(destMuniOptions[0]);
      } else {
        setDestinationMunicipality('');
      }
    }
  }, [destinationMunicipality, destMuniOptions, sourceType, sourceMunicipality]);

  // Compute available stock at selected source
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
      const lgu = activeLgus.find(l => l.municipality.toLowerCase() === sourceMunicipality.toLowerCase());
      return getLguCategoryStock(lgu, fnfiCategory);
    }
  }, [sourceType, selectedWarehouse, sourceMunicipality, fnfiCategory, activeWarehouses, activeLgus, getAvailableWarehouseStock]);

  // Unit type derived from selected kit
  const unitType = useMemo(() => {
    const matchedKit = kitTypesList.find(k => k.name.toLowerCase() === fnfiCategory.toLowerCase());
    return matchedKit?.unitType || 'packs';
  }, [kitTypesList, fnfiCategory]);

  // Validation
  const isSameLgu = sourceType === 'LGU' && sourceMunicipality.trim().toLowerCase() === destinationMunicipality.trim().toLowerCase();
  const isStockExceeded = quantity > sourceAvailableStock;
  const isQuantityInvalid = quantity <= 0 || !Number.isInteger(quantity);
  const isMissingRis = !manifestNumber.trim();
  const isMissingDestination = !destinationMunicipality.trim();
  const isMissingSource = sourceType === 'LGU' ? !sourceMunicipality.trim() : !selectedWarehouse.trim();

  const canSubmit = !isSameLgu && !isStockExceeded && !isQuantityInvalid && !isMissingRis && !isMissingDestination && !isMissingSource && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isSameLgu) {
      setSubmitError('Source and Destination cannot be the same LGU. Please select a different destination.');
      return;
    }

    if (isStockExceeded) {
      setSubmitError(`Requested quantity (${quantity.toLocaleString()}) exceeds available stock at source (${sourceAvailableStock.toLocaleString()} available).`);
      return;
    }

    if (isQuantityInvalid) {
      setSubmitError('Please enter a valid transfer quantity greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: LguReplenishPayload = {
        manifestNumber: manifestNumber.trim().toUpperCase(),
        transferDate,
        sourceType,
        sourceName: sourceType === 'Warehouse' ? selectedWarehouse : sourceMunicipality,
        sourceProvince: sourceType === 'LGU' ? sourceProvince : undefined,
        destinationMunicipality,
        destinationProvince,
        fnfiCategory,
        quantity,
        unitType,
        expirationDate,
        transportMode,
        driverEscort: driverEscort.trim() || undefined,
        remarks: remarks.trim() || undefined
      };

      await onSubmit(payload);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to execute LGU replenishment transfer.');
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
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Replenish LGU Inventory</h2>
              <p className="text-xs text-gray-600">
                Transfer relief goods from regional warehouses or mutual aid LGUs to replenish municipal buffer stock
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

          {/* Transfer Reference & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Transfer RIS Control Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manifestNumber}
                onChange={(e) => setManifestNumber(sanitizeSlipReference(e.target.value))}
                placeholder="TRF-RIS-YYYYMMDD-XXXX"
                className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-medium ${
                  isMissingRis ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
              />
              <p className="text-[11px] text-gray-500 mt-0.5">Physical Requisition and Issue Slip transfer voucher.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Transfer Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Source Selection Section */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <Warehouse className="w-4 h-4 text-emerald-700" />
                1. Select Source Facility <span className="text-red-500">*</span>
              </label>
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setSourceType('Warehouse')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    sourceType === 'Warehouse' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Main Warehouse
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('LGU')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    sourceType === 'LGU' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  LGU Site
                </button>
              </div>
            </div>

            {sourceType === 'Warehouse' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Source Main Warehouse</label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {activeWarehouses.map(w => (
                    <option key={w.id || w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Source Province</label>
                  <select
                    value={sourceProvince}
                    onChange={(e) => {
                      setSourceProvince(e.target.value);
                      setSourceMunicipality('');
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Source Municipality</label>
                  <select
                    value={sourceMunicipality}
                    onChange={(e) => setSourceMunicipality(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {sourceMuniOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Commodity & Live Source Stock Badge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Relief Commodity <span className="text-red-500">*</span>
              </label>
              <select
                value={fnfiCategory}
                onChange={(e) => setFnfiCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Available at Source</span>
                <span className={`text-base font-extrabold ${sourceAvailableStock > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {sourceAvailableStock.toLocaleString()} {unitType}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                sourceAvailableStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
              }`}>
                {sourceAvailableStock > 0 ? 'Stock Available' : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Destination LGU Section */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-700" />
              2. Select Destination LGU <span className="text-red-500">*</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Province</label>
                <select
                  value={destinationProvince}
                  onChange={(e) => setDestinationProvince(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {provinces.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Municipality</label>
                <select
                  value={destinationMunicipality}
                  onChange={(e) => setDestinationMunicipality(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium ${
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
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Source and Destination cannot be the same LGU ({sourceMunicipality}).</span>
              </div>
            )}
          </div>

          {/* Transfer Quantity & Expiration Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Transfer Quantity ({unitType}) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity || ''}
                onChange={(e) => {
                  const cleaned = sanitizeNumbersOnly(e.target.value);
                  setQuantity(cleaned ? parseInt(cleaned, 10) : 0);
                }}
                placeholder={`Max: ${sourceAvailableStock.toLocaleString()}`}
                className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold ${
                  isStockExceeded ? 'border-red-500 bg-red-50/50 text-red-900' : 'border-gray-300'
                }`}
              />
              {isStockExceeded ? (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Exceeds available stock ({sourceAvailableStock.toLocaleString()} available).
                </p>
              ) : (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(500, sourceAvailableStock))}
                    disabled={sourceAvailableStock < 500}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(1000, sourceAvailableStock))}
                    disabled={sourceAvailableStock < 1000}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40"
                  >
                    +1,000
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(sourceAvailableStock)}
                    disabled={sourceAvailableStock <= 0}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 disabled:opacity-40"
                  >
                    All Available
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Batch Expiration Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Transport Mode & Escort */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Transport Mode</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as 'Delivery' | 'Pick up')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Delivery">DSWD Logistics Convoy (Delivery)</option>
                <option value="Pick up">LGU Service Vehicle (Pick up)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Assigned Driver / Escort</label>
              <input
                type="text"
                value={driverEscort}
                onChange={(e) => setDriverEscort(e.target.value)}
                placeholder="Driver or Convoy Escort Name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Transfer Remarks / Notes</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Immediate replenishment for typhoon evacuation center readiness"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {quantity > 0 && !isStockExceeded && !isSameLgu && (
              <span className="text-gray-700 font-medium flex items-center gap-1">
                <span>Deduct {quantity.toLocaleString()} from {sourceType === 'Warehouse' ? selectedWarehouse : sourceMunicipality}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                <span>Add to {destinationMunicipality}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-2 ${
                canSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Transferring...' : 'Execute Stock Transfer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

