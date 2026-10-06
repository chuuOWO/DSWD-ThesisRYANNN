import { useEffect, useState, useMemo } from 'react';
import { X, Calendar, MapPin, TruckIcon, AlertCircle, Package, ShieldAlert, Building2 } from 'lucide-react';
import type { OutgoingStatus } from '../../hooks/useInventoryState';
import type { LguRecord, ProvinceRecord, WarehouseRecord, SupplySourceRecord, KitTypeRecord } from '../../services/backendApi';
import { LocationPickerMap } from '../design/LocationPickerMap';
import { sanitizeNumbersOnly, sanitizeAlphanumeric } from '../../lib/inputValidation';
import { DEFAULT_PANAY_LGUS, DEFAULT_KIT_NAMES, DEFAULT_WAREHOUSES, REGIONAL_PROVINCES } from '../../lib/lguMatching';
import { getLguStockForCategory } from '../../lib/lguSync';
import { parseIncidentInfo, formatIncidentCode, DISASTER_REPORT_REASONS } from '../../lib/incidentHelper';

export interface ReleaseForm {
  incidentCode: string;
  incidentDate: string;
  dateAllocated: string;
  reportReason: string;
  lguId?: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  amountRequested: number;
  amountApproved: number;
  sourceType: 'Warehouse' | 'LGU';
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: OutgoingStatus;
  destinationAddress?: string;
  receiverGps?: string;
}

interface AddReleaseModalProps {
  onClose: () => void;
  onSubmit: (data: ReleaseForm) => void;
  availableStock?: { category: string; warehouseA?: number; warehouseB?: number; totalStock?: number; warehouseBreakdown?: Record<string, number> }[];
  initialData?: ReleaseForm;
  mode?: 'add' | 'edit';
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  warehousesList?: WarehouseRecord[];
  supplySourcesList?: SupplySourceRecord[];
  kitTypesList?: KitTypeRecord[];
}

const defaultFormData: ReleaseForm = {
  incidentCode: '',
  incidentDate: new Date().toISOString().split('T')[0],
  dateAllocated: new Date().toISOString().split('T')[0],
  reportReason: 'Flood / Inundation',
  lguName: '',
  province: 'Iloilo',
  municipality: '',
  fnfiCategory: 'Food Pack',
  amountRequested: 0,
  amountApproved: 0,
  sourceType: 'Warehouse',
  warehouseSource: 'Oton Main Warehouse',
  deliveryMode: 'Truck',
  deliveryStatus: 'Allocating',
  destinationAddress: '',
  receiverGps: ''
};

const cleanBuildingName = (val?: string): string => {
  if (!val) return '';
  let cleaned = val;
  while (/\s*\([^)]*\)\s*\([^)]*\)/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\([^)]*\)\s*(\([^)]*\))$/, '$1');
  }
  return cleaned;
};

export function AddReleaseModal({
  onClose,
  onSubmit,
  availableStock = [],
  initialData,
  mode = 'add',
  lgusList = [],
  provincesList = [],
  warehousesList = [],
  supplySourcesList = [],
  kitTypesList = []
}: AddReleaseModalProps) {
  // Master LGUs from Supabase with authoritative regional fallback
  const availableLgus = useMemo(() => {
    if (lgusList && lgusList.length > 0) return lgusList;
    return DEFAULT_PANAY_LGUS;
  }, [lgusList]);

  const provinces = useMemo(() => {
    if (provincesList && provincesList.length > 0) {
      return provincesList.map(p => p.name).sort();
    }
    const set = new Set<string>();
    availableLgus.forEach(l => {
      if (l.province) set.add(l.province);
    });
    const list = Array.from(set).sort();
    return list.length > 0 ? list : [...REGIONAL_PROVINCES];
  }, [provincesList, availableLgus]);

  const municipalitiesByProvince = useMemo(() => {
    const map: Record<string, string[]> = {};
    availableLgus.forEach(l => {
      if (!l.province) return;
      if (!map[l.province]) map[l.province] = [];
      if (!map[l.province].includes(l.municipality)) {
        map[l.province].push(l.municipality);
      }
    });
    Object.keys(map).forEach(p => map[p].sort());
    return map;
  }, [availableLgus]);

  const categoryOptions = useMemo(() => {
    if (kitTypesList && kitTypesList.length > 0) {
      const active = kitTypesList.filter(k => k.isActive !== false).map(k => k.name);
      if (active.length > 0) return active;
    }
    return [...DEFAULT_KIT_NAMES];
  }, [kitTypesList]);

  const warehouseOptions = useMemo(() => {
    if (warehousesList && warehousesList.length > 0) {
      const active = warehousesList.filter(w => w.isActive !== false).map(w => w.name);
      if (active.length > 0) return active;
    }
    return DEFAULT_WAREHOUSES.map(w => w.name);
  }, [warehousesList]);

  // Parse initial data for incident details
  const parsedInitial = useMemo(() => {
    return parseIncidentInfo(initialData?.incidentCode);
  }, [initialData?.incidentCode]);

  const [formData, setFormData] = useState<ReleaseForm>(() => {
    if (!initialData) return defaultFormData;
    const parsed = parseIncidentInfo(initialData.incidentCode);
    const existingReason = initialData.reportReason || parsed.reportReason || 'Flood / Inundation';
    const isStandardReason = DISASTER_REPORT_REASONS.some(r => r === existingReason);

    return {
      ...initialData,
      incidentCode: parsed.incidentCode || initialData.incidentCode || '',
      incidentDate: initialData.incidentDate || parsed.incidentDate || initialData.dateAllocated || new Date().toISOString().split('T')[0],
      reportReason: isStandardReason ? existingReason : 'Others (Specify)',
      lguName: cleanBuildingName(initialData.lguName)
    };
  });

  const [customReason, setCustomReason] = useState<string>(() => {
    if (!initialData) return '';
    const parsed = parseIncidentInfo(initialData.incidentCode);
    const existingReason = initialData.reportReason || parsed.reportReason;
    if (existingReason && !DISASTER_REPORT_REASONS.some(r => r === existingReason)) {
      return existingReason;
    }
    return '';
  });

  // Source selection state (independent from destination)
  const [sourceProvince, setSourceProvince] = useState<string>(() => {
    if (initialData?.sourceType === 'LGU' && initialData.warehouseSource) {
      const matched = availableLgus.find(l => l.municipality.toLowerCase() === initialData.warehouseSource.toLowerCase());
      if (matched) return matched.province;
    }
    return provinces[0] || 'Iloilo';
  });

  const [sourceMunicipality, setSourceMunicipality] = useState<string>(() => {
    if (initialData?.sourceType === 'LGU' && initialData.warehouseSource) {
      return initialData.warehouseSource;
    }
    return '';
  });

  // Destination selection state
  const [selectedProvince, setSelectedProvince] = useState(provinces[0] || 'Iloilo');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseForm | 'customReason', string>>>({});

  const [pinLat, setPinLat] = useState<number>(() => {
    if (initialData?.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0])) return parts[0];
    }
    return 10.7202;
  });

  const [pinLng, setPinLng] = useState<number>(() => {
    if (initialData?.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[1])) return parts[1];
    }
    return 122.5621;
  });

  useEffect(() => {
    if (!initialData) return;
    const parsed = parseIncidentInfo(initialData.incidentCode);
    const existingReason = initialData.reportReason || parsed.reportReason || 'Flood / Inundation';
    const isStandardReason = DISASTER_REPORT_REASONS.some(r => r === existingReason);

    setFormData({
      ...initialData,
      incidentCode: parsed.incidentCode || initialData.incidentCode || '',
      incidentDate: initialData.incidentDate || parsed.incidentDate || initialData.dateAllocated || new Date().toISOString().split('T')[0],
      reportReason: isStandardReason ? existingReason : 'Others (Specify)',
      lguName: cleanBuildingName(initialData.lguName)
    });

    if (existingReason && !isStandardReason) {
      setCustomReason(existingReason);
    }

    if (initialData.sourceType === 'LGU' && initialData.warehouseSource) {
      const matched = availableLgus.find(l => l.municipality.toLowerCase() === initialData.warehouseSource.toLowerCase());
      if (matched) setSourceProvince(matched.province);
      setSourceMunicipality(initialData.warehouseSource);
    }

    setSelectedProvince(initialData.province || provinces[0] || 'Iloilo');
    setSelectedMunicipality(initialData.municipality || '');

    if (initialData.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setPinLat(parts[0]);
        setPinLng(parts[1]);
      }
    }
  }, [initialData, provinces, availableLgus]);

  const handleLocationChange = (lat: number, lng: number, address?: string, details?: any) => {
    setPinLat(lat);
    setPinLng(lng);
    const resolvedProv = details?.province || formData.province || selectedProvince || 'Iloilo';
    const resolvedMuni = details?.municipality || formData.municipality || selectedMunicipality || '';

    const matchedLgu = availableLgus.find(l =>
      l.municipality.toLowerCase() === resolvedMuni.toLowerCase() &&
      l.province.toLowerCase() === resolvedProv.toLowerCase()
    );

    setFormData(prev => ({
      ...prev,
      lguId: matchedLgu ? matchedLgu.id : prev.lguId,
      receiverGps: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      destinationAddress: address ?? prev.destinationAddress,
      province: resolvedProv,
      municipality: resolvedMuni,
      lguName: details?.building !== undefined && details.building ? details.building : prev.lguName
    }));
    if (resolvedProv) setSelectedProvince(resolvedProv);
    if (resolvedMuni) setSelectedMunicipality(resolvedMuni);

    if (errors.municipality || errors.province || errors.destinationAddress) {
      setErrors(prev => ({ ...prev, municipality: '', province: '', destinationAddress: '' }));
    }
  };

  const sourceLguRecord = useMemo(() => {
    if (formData.sourceType !== 'LGU' || !sourceMunicipality) return null;
    return availableLgus.find(
      (l) => l.municipality.toLowerCase() === sourceMunicipality.toLowerCase() &&
             (!sourceProvince || l.province.toLowerCase() === sourceProvince.toLowerCase())
    );
  }, [availableLgus, formData.sourceType, sourceMunicipality, sourceProvince]);

  // Calculate available stock based on selected source (Warehouse or LGU)
  const getAvailableStock = () => {
    if (!formData.fnfiCategory) return 0;

    if (formData.sourceType === 'Warehouse') {
      const targetWh = warehousesList?.find(w => w.name.toLowerCase() === formData.warehouseSource.toLowerCase());
      if (targetWh) {
        const catLower = formData.fnfiCategory.toLowerCase();
        if (catLower.includes('food pack')) return targetWh.foodPacks;
        if (catLower.includes('hygiene')) return targetWh.hygieneKits;
        if (catLower.includes('sleeping')) return targetWh.sleepingKits;
        if (catLower.includes('kitchen')) return targetWh.kitchenKits;
        if (catLower.includes('family kit')) return targetWh.familyKits;
        if (catLower.includes('sack')) return targetWh.laminatedSacks;
        if (catLower.includes('rtef') || catLower.includes('ready-to-eat')) return targetWh.rtef;
        if (targetWh.currentStock && targetWh.currentStock[formData.fnfiCategory] !== undefined) {
          return targetWh.currentStock[formData.fnfiCategory];
        }
      }

      const stockItem = availableStock.find(item => item.category.toLowerCase() === formData.fnfiCategory.toLowerCase());
      if (!stockItem) return 0;

      if (stockItem.warehouseBreakdown && stockItem.warehouseBreakdown[formData.warehouseSource] !== undefined) {
        return stockItem.warehouseBreakdown[formData.warehouseSource];
      }

      if (formData.warehouseSource === 'Oton Main Warehouse') {
        return stockItem.warehouseA ?? 0;
      } else if (formData.warehouseSource === 'Pototan Main Warehouse') {
        return stockItem.warehouseB ?? 0;
      }
      return 0;
    }

    if (formData.sourceType === 'LGU') {
      if (!sourceLguRecord) return 0;
      return getLguStockForCategory(sourceLguRecord, formData.fnfiCategory);
    }

    return 0;
  };

  const availableQty = getAvailableStock();

  const handleChange = (field: keyof ReleaseForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ReleaseForm | 'customReason', string>> = {};

    // 1. Incident Code (Required & First)
    if (!formData.incidentCode || !formData.incidentCode.trim()) {
      newErrors.incidentCode = 'Incident code is required';
    }

    // 2. Dates
    if (!formData.incidentDate) {
      newErrors.incidentDate = 'Incident / disaster date is required';
    }

    if (!formData.dateAllocated) {
      newErrors.dateAllocated = 'Date allocated is required';
    }

    // 3. Source Selection (Source first)
    if (formData.sourceType === 'Warehouse') {
      if (!formData.warehouseSource) {
        newErrors.warehouseSource = 'Source warehouse is required';
      }
    } else if (formData.sourceType === 'LGU') {
      if (!sourceMunicipality) {
        newErrors.warehouseSource = 'Source municipality / LGU is required';
      }
    }

    // 4. Goods & Quantity
    if (!formData.fnfiCategory) {
      newErrors.fnfiCategory = 'FNFI category is required';
    }

    if (!formData.amountRequested || formData.amountRequested <= 0) {
      newErrors.amountRequested = 'Amount requested must be greater than 0';
    } else if (formData.amountRequested > availableQty) {
      const sourceLabel = formData.sourceType === 'Warehouse' ? formData.warehouseSource : (sourceMunicipality || 'Source LGU');
      newErrors.amountRequested = `Insufficient stock in ${sourceLabel} (${availableQty.toLocaleString()} available).`;
    }

    // 5. Destination Selection
    if (!formData.province) {
      newErrors.province = 'Destination province is required';
    }

    if (!formData.municipality) {
      newErrors.municipality = 'Destination municipality is required';
    }

    // For LGU-to-LGU transfers, destination must be specific
    if (formData.sourceType === 'LGU') {
      if (!formData.destinationAddress || formData.destinationAddress.trim().length < 5) {
        newErrors.destinationAddress = 'Specific drop-off site / evacuation center address is required for inter-LGU transfer';
      }
    }

    // 6. Report Reason (Required at bottom)
    if (!formData.reportReason || !formData.reportReason.trim()) {
      newErrors.reportReason = 'Report reason / disaster classification is required';
    } else if (formData.reportReason === 'Others (Specify)' && !customReason.trim()) {
      newErrors.reportReason = 'Please specify the disaster reason';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const finalReason = formData.reportReason === 'Others (Specify)'
        ? customReason.trim()
        : formData.reportReason.trim();

      const formattedIncident = formatIncidentCode(
        formData.incidentCode,
        finalReason,
        formData.incidentDate
      );

      const buildingFinal = formData.lguName.trim() || `${formData.municipality} Drop-off Center`;
      const initialStatus: OutgoingStatus = mode === 'add' ? 'Allocating' : formData.deliveryStatus;

      const submissionData: ReleaseForm = {
        ...formData,
        incidentCode: formattedIncident,
        reportReason: finalReason,
        lguName: buildingFinal,
        deliveryStatus: initialStatus
      };

      onSubmit(submissionData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mode === 'edit' ? 'Edit Release Draft' : 'New Outgoing Release'}</h2>
              <p className="text-sm text-gray-600">{mode === 'edit' ? 'Update relief allocation details' : 'Allocate and release FNFI relief goods to LGU disaster response'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Form Body with Enter key guard */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className="p-6 space-y-6 overflow-y-auto flex-1"
        >
          {/* SECTION 1: INCIDENT REFERENCE (FIRST FIELD) */}
          <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  Incident Reference & Allocation Dates
                </span>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                Required Tracking Reference
              </span>
            </div>

            {/* Incident Code - FIRST AND REQUIRED */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                Incident Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.incidentCode}
                onChange={(e) => handleChange('incidentCode', sanitizeAlphanumeric(e.target.value.toUpperCase()))}
                placeholder="e.g. INC-2026-FLOOD-01, DSWD-REL-042, TC-KRISTINE-2026"
                className={`w-full px-4 py-2.5 border rounded-lg font-mono text-sm uppercase bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.incidentCode ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.incidentCode ? (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.incidentCode}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Official disaster incident or situational reference code for this relief release.
                </p>
              )}
            </div>

            {/* 2-Column Grid: Incident / Disaster Date & Date Allocated */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Incident / Disaster Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) => handleChange('incidentDate', e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.incidentDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.incidentDate && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.incidentDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Date Allocated <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={formData.dateAllocated}
                    onChange={(e) => handleChange('dateAllocated', e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.dateAllocated ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.dateAllocated && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.dateAllocated}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: SOURCE SELECTION (SOURCE PICKED FIRST, NOT DESTINATION) */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide">
                <Package className="w-4 h-4 text-[#2500ba]" />
                <span>1. Source Selection</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-gray-500 font-medium">
                Pick warehouse or source LGU
              </span>
            </div>

            {/* Source Type Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    sourceType: 'Warehouse',
                    warehouseSource: warehouseOptions[0] || 'Oton Main Warehouse'
                  }));
                  if (errors.warehouseSource) setErrors(prev => ({ ...prev, warehouseSource: '' }));
                }}
                className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                  formData.sourceType === 'Warehouse'
                    ? 'bg-[#2500ba] text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Regional Warehouse
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    sourceType: 'LGU',
                    warehouseSource: sourceMunicipality || ''
                  }));
                }}
                className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                  formData.sourceType === 'LGU'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                LGU (Mutual Aid Source)
              </button>
            </div>

            {/* Warehouse Source Picker */}
            {formData.sourceType === 'Warehouse' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Select Dispatch Warehouse <span className="text-red-500">*</span>
                </label>
                {warehouseOptions.length <= 4 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {warehouseOptions.map(wh => (
                      <button
                        key={wh}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, warehouseSource: wh }));
                          if (errors.warehouseSource) setErrors(prev => ({ ...prev, warehouseSource: '' }));
                        }}
                        className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          formData.warehouseSource === wh
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
                        }`}
                      >
                        {wh}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={formData.warehouseSource}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, warehouseSource: e.target.value }));
                      if (errors.warehouseSource) setErrors(prev => ({ ...prev, warehouseSource: '' }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {warehouseOptions.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                  </select>
                )}
                {errors.warehouseSource && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.warehouseSource}
                  </p>
                )}
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
                        const newProv = e.target.value;
                        setSourceProvince(newProv);
                        setSourceMunicipality('');
                        setFormData(prev => ({ ...prev, warehouseSource: '' }));
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
                      onChange={(e) => {
                        const muni = e.target.value;
                        setSourceMunicipality(muni);
                        setFormData(prev => ({ ...prev, warehouseSource: muni }));
                        if (errors.warehouseSource) setErrors(prev => ({ ...prev, warehouseSource: '' }));
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.warehouseSource ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select source municipality...</option>
                      {(municipalitiesByProvince[sourceProvince] || []).map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {errors.warehouseSource && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.warehouseSource}
                  </p>
                )}

                {/* Source LGU Live Balances matching LGU Monitor */}
                {sourceMunicipality && sourceLguRecord && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-700" />
                        <div>
                          <p className="text-[10px] font-mono font-bold text-purple-700">
                            {sourceLguRecord.id}
                          </p>
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

                    {/* Category Breakdown Grid matching LGU Monitor */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-2xs">
                        <p className="text-[10px] text-gray-500 font-semibold">Food Packs</p>
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Food Pack'] ?? sourceLguRecord.foodPacks) || 0).toLocaleString()}</p>
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

                    {/* Additional Kit Categories if available */}
                    {Object.entries(sourceLguRecord.currentStock || {})
                      .filter(([k, v]) => Number(v) > 0 && !['Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit'].includes(k))
                      .length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(sourceLguRecord.currentStock || {})
                          .filter(([k, v]) => Number(v) > 0 && !['Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit'].includes(k))
                          .map(([cat, qty]) => (
                            <span key={cat} className="text-[10px] px-2 py-0.5 rounded bg-white text-purple-900 border border-purple-200 font-medium">
                              {cat}: {Number(qty).toLocaleString()}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Operational Delivery Statistics matching LGU Monitor */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200/60 text-[11px] text-purple-800">
                      <span>Total Delivered: <strong className="font-mono">{((sourceLguRecord as any).totalItemsReleased ?? 0).toLocaleString()}</strong></span>
                      <span>Completed: <strong className="font-mono text-green-700">{(sourceLguRecord as any).completedDeliveries ?? 0}</strong></span>
                      <span>Last Delivery: <strong className="font-mono">{(sourceLguRecord as any).lastDeliveryDate || 'N/A'}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: RELIEF GOODS & REQUESTED QUANTITY */}
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
                value={formData.fnfiCategory}
                onChange={(e) => handleChange('fnfiCategory', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.fnfiCategory ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select relief goods category...</option>
                {categoryOptions.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.fnfiCategory && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.fnfiCategory}
                </p>
              )}
            </div>

            {/* Real-time Available Stock Preview for Selected Source */}
            {formData.fnfiCategory && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Available Source Stock</p>
                      <p className="text-xs text-gray-600">
                        {formData.fnfiCategory} in {formData.sourceType === 'Warehouse' ? formData.warehouseSource : `${sourceMunicipality || 'Selected LGU'} (${sourceProvince})`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${availableQty > 100 ? 'text-green-600' : availableQty > 0 ? 'text-orange-600' : 'text-red-500'}`}>
                      {availableQty > 0 ? availableQty.toLocaleString() : '0'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {availableQty > 0 ? 'units available' : 'out of stock'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Requested & Transportation Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Amount Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.amountRequested || ''}
                  onChange={(e) => {
                    const cleaned = sanitizeNumbersOnly(e.target.value);
                    handleChange('amountRequested', cleaned ? parseInt(cleaned, 10) : 0);
                  }}
                  placeholder="Enter amount (units)"
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.amountRequested ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.amountRequested && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.amountRequested}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  Transportation Method
                </label>
                <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TruckIcon className="w-4 h-4 text-[#2500ba]" />
                    <span>DSWD Assigned Receiver</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2500ba]">
                    Truck Only
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: DESTINATION DELIVERY LOCATION (CHOSEN AFTER SOURCE) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide">
                <MapPin className="w-4 h-4 text-[#2500ba]" />
                <span>3. Destination Delivery Location</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-gray-500">
                {formData.sourceType === 'Warehouse' ? 'Panay LGU Drop-off' : 'Specific Inter-LGU Site'}
              </span>
            </div>

            {/* LocationPickerMap: Simplified LGU mode if warehouse source, Specific breakdown if LGU source */}
            <LocationPickerMap
              latitude={pinLat}
              longitude={pinLng}
              destinationAddress={formData.destinationAddress}
              province={formData.province || selectedProvince}
              municipality={formData.municipality || selectedMunicipality}
              lguDestination={formData.lguName}
              onLguDestinationChange={(name) => handleChange('lguName', name)}
              onLocationChange={handleLocationChange}
              lgusList={availableLgus}
              isSpecific={formData.sourceType === 'LGU'}
            />

            {(errors.municipality || errors.province || errors.destinationAddress) && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.municipality || errors.province || errors.destinationAddress}
              </p>
            )}
          </div>

          {/* SECTION 5: REPORT REASON / DISASTER TYPE (AT THE BOTTOM, REQUIRED) */}
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>4. Report Reason / Disaster Classification</span>
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                Audit Justification
              </span>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                Report Reason / Calamity Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.reportReason}
                onChange={(e) => {
                  const val = e.target.value;
                  handleChange('reportReason', val);
                  if (errors.reportReason) setErrors(prev => ({ ...prev, reportReason: '' }));
                }}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.reportReason ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {DISASTER_REPORT_REASONS.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
              {errors.reportReason && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.reportReason}
                </p>
              )}
            </div>

            {/* Custom reason input when 'Others (Specify)' is selected */}
            {formData.reportReason === 'Others (Specify)' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Specify Disaster / Justification Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    if (errors.reportReason) setErrors(prev => ({ ...prev, reportReason: '' }));
                  }}
                  placeholder="e.g. Flash Flood, Severe Monsoon Inundation, Storm Surge"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            <p className="text-xs text-amber-900/80 leading-relaxed">
              Mandatory calamity justification required by DSWD Disaster Response Management Bureau (DRMB) protocols for relief releases.
            </p>
          </div>

          {/* Delivery Status Indicator */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Initial Delivery Status:</span>
            <span className="px-2.5 py-1 rounded-full font-bold bg-yellow-100 text-yellow-800 text-[11px]">
              {mode === 'add' ? 'Allocating (System Initialized)' : formData.deliveryStatus}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              {mode === 'edit' ? 'Save Changes' : 'Create Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
