import { useEffect, useState, useMemo } from 'react';
import { X, Calendar, MapPin, TruckIcon, AlertCircle, Package } from 'lucide-react';
import type { OutgoingStatus } from '../../hooks/useInventoryState';
import type { LguRecord } from '../../services/backendApi';
import { PANAY_LGUS } from '../../data/panayLguDirectory';
import { LocationPickerMap } from '../design/LocationPickerMap';
import { sanitizeNumbersOnly, sanitizeTextOnly } from '../../lib/inputValidation';

export interface ReleaseForm {
  dateAllocated: string;
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
  incidentCode: string;
  destinationAddress?: string;
  receiverGps?: string;
  directSource?: 'LDRC' | 'VDRC';
}

interface AddReleaseModalProps {
  onClose: () => void;
  onSubmit: (data: ReleaseForm) => void;
  availableStock: { category: string; warehouseA: number; warehouseB: number }[];
  initialData?: ReleaseForm;
  mode?: 'add' | 'edit';
  lgusList?: LguRecord[];
}

const FNFI_CATEGORIES = [
  'Hygiene Kit',
  'Food Pack',
  'Sleeping Kit',
  'Kitchen Kit',
  'Family Kit',
  'Laminated Sack',
  'RTEF'
];

const WAREHOUSE_OPTIONS = [
  'Oton Main Warehouse',
  'Pototan Main Warehouse'
];

const DELIVERY_MODES = ['Truck'];

const DELIVERY_STATUSES: OutgoingStatus[] = [
  'Draft',
  'Allocating',
  'Approved',
  'Packed',
  'Released',
  'In Transit',
  'Delivered',
  'Accepted',
  'Distributed',
  'Correction Requested',
  'Cancelled'
];

const defaultFormData: ReleaseForm = {
    dateAllocated: new Date().toISOString().split('T')[0],
    lguName: '',
    province: '',
    municipality: '',
    fnfiCategory: '',
    amountRequested: 0,
    amountApproved: 0,
    sourceType: 'Warehouse',
    warehouseSource: 'Oton Main Warehouse',
    deliveryMode: 'Truck',
    deliveryStatus: 'Allocating',
    incidentCode: '',
    destinationAddress: '',
    receiverGps: '10.6415, 122.2352',
    directSource: undefined
};

export function AddReleaseModal({ onClose, onSubmit, availableStock, initialData, mode = 'add', lgusList }: AddReleaseModalProps) {
  const [formData, setFormData] = useState<ReleaseForm>(initialData ?? defaultFormData);
  const [directSource, setDirectSource] = useState<'LDRC' | 'VDRC'>('VDRC');

  // Dynamically compute provinces and municipalities from lgusList (master Supabase table) or PANAY_LGUS directory
  const availableLgus = useMemo(() => {
    if (lgusList && lgusList.length > 0) {
      return lgusList;
    }
    return PANAY_LGUS.map(l => ({
      id: `STATIC-${l.municipality.toUpperCase().replace(/\s+/g, '-')}`,
      municipality: l.municipality,
      province: l.province,
      lguName: l.defaultFacility,
      latitude: l.lat,
      longitude: l.lng,
      isActive: true
    })) as LguRecord[];
  }, [lgusList]);

  const provinces = useMemo(() => {
    const set = new Set<string>();
    availableLgus.forEach(l => {
      if (l.province) set.add(l.province);
    });
    return Array.from(set).sort();
  }, [availableLgus]);

  const municipalitiesByProvince = useMemo(() => {
    const map: Record<string, string[]> = {};
    availableLgus.forEach(l => {
      if (!map[l.province]) map[l.province] = [];
      if (!map[l.province].includes(l.municipality)) {
        map[l.province].push(l.municipality);
      }
    });
    Object.keys(map).forEach(p => map[p].sort());
    return map;
  }, [availableLgus]);

  useEffect(() => {
    if (formData.deliveryMode === 'Direct Delivery') {
      setDirectSource('VDRC');
      setFormData(prev => ({ ...prev, warehouseSource: 'VDRC', directSource: 'VDRC' }));
    }
  }, [formData.deliveryMode]);

  const [selectedProvince, setSelectedProvince] = useState(provinces[0] || 'Iloilo');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseForm, string>>>({});

  const [pinLat, setPinLat] = useState<number>(() => {
    if (initialData?.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0])) return parts[0];
    }
    return 10.6415;
  });

  const [pinLng, setPinLng] = useState<number>(() => {
    if (initialData?.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[1])) return parts[1];
    }
    return 122.2352;
  });

  useEffect(() => {
    if (!initialData) return;
    setFormData(initialData);
    setSelectedProvince(initialData.province || provinces[0] || 'Iloilo');
    setSelectedMunicipality(initialData.municipality || '');
    if (initialData.receiverGps) {
      const parts = initialData.receiverGps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setPinLat(parts[0]);
        setPinLng(parts[1]);
      }
    }
  }, [initialData, provinces]);

  const handleSelectPredefinedLgu = (lguId: string) => {
    const found = availableLgus.find(l => l.id === lguId);
    if (!found) return;

    setFormData(prev => ({
      ...prev,
      lguId: found.id,
      lguName: found.lguName || `${found.municipality} Municipal Office`,
      municipality: found.municipality,
      province: found.province,
      receiverGps: `${found.latitude.toFixed(5)}, ${found.longitude.toFixed(5)}`,
      destinationAddress: `${found.lguName || found.municipality}, ${found.municipality}, ${found.province}`
    }));
    setSelectedProvince(found.province);
    setSelectedMunicipality(found.municipality);
    setPinLat(found.latitude);
    setPinLng(found.longitude);
  };

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
      lguName: details?.building ? `${details.building} (${resolvedMuni})` : (matchedLgu?.lguName || prev.lguName)
    }));
    if (resolvedProv) setSelectedProvince(resolvedProv);
    if (resolvedMuni) setSelectedMunicipality(resolvedMuni);
  };

  const sourceLguRecord = useMemo(() => {
    if (formData.sourceType !== 'LGU' || !selectedMunicipality) return null;
    return availableLgus.find(
      (l) => l.municipality.toLowerCase() === selectedMunicipality.toLowerCase() &&
             (!selectedProvince || l.province.toLowerCase() === selectedProvince.toLowerCase())
    );
  }, [availableLgus, formData.sourceType, selectedMunicipality, selectedProvince]);

  // Get available stock for selected category and source (Warehouse or LGU)
  const getAvailableStock = () => {
    if (!formData.fnfiCategory) return 0;
    if (formData.deliveryMode === 'Direct Delivery') return Infinity;

    if (formData.sourceType === 'Warehouse') {
      const stockItem = availableStock.find(item => item.category === formData.fnfiCategory);
      if (!stockItem) return 0;

      // Main warehouses have stock in the inventory system
      if (formData.warehouseSource === 'Oton Main Warehouse') {
        return stockItem.warehouseA;
      } else if (formData.warehouseSource === 'Pototan Main Warehouse') {
        return stockItem.warehouseB;
      }
      return 0;
    }

    if (formData.sourceType === 'LGU') {
      if (!sourceLguRecord) return 0;
      const stock = sourceLguRecord.currentStock;
      if (stock && formData.fnfiCategory in stock) {
        return stock[formData.fnfiCategory] || 0;
      }
      if (formData.fnfiCategory === 'Food Pack') return sourceLguRecord.foodPacks ?? 0;
      if (formData.fnfiCategory === 'Hygiene Kit') return sourceLguRecord.hygieneKits ?? 0;
      if (formData.fnfiCategory === 'Family Kit') return sourceLguRecord.familyKits ?? 0;
      if (formData.fnfiCategory === 'Sleeping Kit') return sourceLguRecord.sleepingKits ?? 0;
      if (formData.fnfiCategory === 'Kitchen Kit') return sourceLguRecord.kitchenKits ?? 0;
      if (formData.fnfiCategory === 'Laminated Sack') return sourceLguRecord.laminatedSacks ?? 0;
      if (formData.fnfiCategory === 'RTEF') return sourceLguRecord.rtef ?? 0;
      return 0;
    }

    return 0;
  };

  const availableQty = getAvailableStock();

  const handleChange = (field: keyof ReleaseForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Auto-generate LGU name from municipality
    if (field === 'municipality' && typeof value === 'string') {
      setFormData(prev => ({
        ...prev,
        municipality: value,
        lguName: `${value} Municipal Office`
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ReleaseForm, string>> = {};

    if (!formData.dateAllocated) {
      newErrors.dateAllocated = 'Date allocated is required';
    }

    if (!formData.lguName.trim()) {
      newErrors.lguName = 'LGU destination is required';
    }

    if (!formData.province) {
      newErrors.province = 'Province is required';
    }

    // Municipality is now optional - no validation needed

    if (!formData.fnfiCategory) {
      newErrors.fnfiCategory = 'FNFI category is required';
    }

    if (formData.deliveryMode !== 'Direct Delivery') {
      if (formData.sourceType === 'Warehouse' && !formData.warehouseSource) {
        newErrors.warehouseSource = 'Warehouse source is required';
      }

      if (formData.sourceType === 'LGU' && !selectedMunicipality) {
        newErrors.warehouseSource = 'LGU source is required';
      }
    }

    if (!formData.amountRequested || formData.amountRequested <= 0) {
      newErrors.amountRequested = 'Amount requested must be greater than 0';
    } else {
      // Validate stock when not Direct Delivery
      if (formData.deliveryMode !== 'Direct Delivery') {
        if (formData.sourceType === 'Warehouse' && formData.amountRequested > availableQty) {
          newErrors.amountRequested = 'Insufficient stock in the warehouse.';
        } else if (formData.sourceType === 'LGU' && formData.amountRequested > availableQty) {
          newErrors.amountRequested = `Insufficient stock in source LGU (${availableQty} available).`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const initialStatus: OutgoingStatus = formData.deliveryMode === 'Direct Delivery' ? 'Approved' : 'Allocating';
      const submissionData = mode === 'add' ? { ...formData, deliveryStatus: initialStatus } : formData;
      onSubmit(submissionData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mode === 'edit' ? 'Edit Release Draft' : 'New Release'}</h2>
              <p className="text-sm text-gray-600">{mode === 'edit' ? 'Update release request details' : 'Release FNFI items to LGU'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date Allocated & Delivery Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Date Allocated <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={formData.dateAllocated}
                  onChange={(e) => handleChange('dateAllocated', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Delivery Status
              </label>
              {mode === 'add' ? (
                <div>
                  <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      Allocating
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      System Initialized
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Locked upon creation. Status updates automatically via workflow (Approval ➔ Driver Pickup ➔ LGU Acceptance).
                  </p>
                </div>
              ) : (
                <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>{formData.deliveryStatus}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                    Current Status
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Destination LGU Delivery Pin & Address Breakdown */}
          <div>
            <LocationPickerMap
              latitude={pinLat}
              longitude={pinLng}
              destinationAddress={formData.destinationAddress}
              province={formData.province || selectedProvince}
              municipality={formData.municipality || selectedMunicipality}
              lguDestination={formData.lguName}
              onLguDestinationChange={(name) => handleChange('lguName', name)}
              onLocationChange={handleLocationChange}
            />
            {errors.lguName && (
              <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.lguName}
              </p>
            )}
          </div>

          {/* FNFI Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              FNFI Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.fnfiCategory}
              onChange={(e) => handleChange('fnfiCategory', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.fnfiCategory ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select category...</option>
              {FNFI_CATEGORIES.map(cat => (
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

          {/* Direct Delivery Source — shown only for Direct Delivery mode */}
          {formData.deliveryMode === 'Direct Delivery' && (
            <div className="rounded-lg border border-[#2500ba]/20 bg-[#2500ba]/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#2500ba] uppercase tracking-wider">Direct National Dispatch</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#2500ba] text-white">Direct to LGU</span>
              </div>
              <p className="text-xs text-gray-600">
                Goods dispatched directly from a national disaster resource center &mdash; regional warehouse stock is not deducted.
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  National Resource Center <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectSource('VDRC');
                      setFormData(prev => ({ ...prev, directSource: 'VDRC', warehouseSource: 'VDRC' }));
                    }}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                      directSource === 'VDRC'
                        ? 'bg-[#2500ba] text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    VDRC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectSource('LDRC');
                      setFormData(prev => ({ ...prev, directSource: 'LDRC', warehouseSource: 'LDRC' }));
                    }}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                      directSource === 'LDRC'
                        ? 'bg-[#2500ba] text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    LDRC
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Source Type - Hidden when Direct Delivery */}
          {formData.deliveryMode !== 'Direct Delivery' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Source Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, sourceType: 'Warehouse', warehouseSource: 'Oton Main Warehouse' }));
                  }}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    formData.sourceType === 'Warehouse'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Warehouse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, sourceType: 'LGU' }));
                    setSelectedMunicipality('');
                  }}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    formData.sourceType === 'LGU'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  LGU
                </button>
              </div>
            </div>
          )}

          {/* Source Selection - Hidden when Direct Delivery */}
          {formData.deliveryMode !== 'Direct Delivery' && (
            formData.sourceType === 'Warehouse' ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Select Warehouse <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, warehouseSource: 'Oton Main Warehouse' }))}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                      formData.warehouseSource === 'Oton Main Warehouse'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    Oton Main Warehouse
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, warehouseSource: 'Pototan Main Warehouse' }))}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                      formData.warehouseSource === 'Pototan Main Warehouse'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    Pototan Main Warehouse
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Province <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);
                      setSelectedMunicipality('');
                      setFormData(prev => ({ ...prev, warehouseSource: '' }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {provinces.map(prov => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Municipality/LGU <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedMunicipality}
                    onChange={(e) => {
                      setSelectedMunicipality(e.target.value);
                      setFormData(prev => ({ ...prev, warehouseSource: e.target.value }));
                    }}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.warehouseSource && formData.sourceType === 'LGU' ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select municipality...</option>
                    {(municipalitiesByProvince[selectedProvince] || []).map(mun => (
                      <option key={mun} value={mun}>{mun}</option>
                    ))}
                  </select>
                  {errors.warehouseSource && formData.sourceType === 'LGU' && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.warehouseSource}
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Source LGU Live Stock Breakdown - Shown when Source Type is LGU */}
          {formData.deliveryMode !== 'Direct Delivery' && formData.sourceType === 'LGU' && selectedMunicipality && sourceLguRecord && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-bold text-purple-900">
                    Source LGU Live Stock ({sourceLguRecord.municipality}, {sourceLguRecord.province})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                  LGU On-Hand Balances
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white rounded-lg p-2 border border-purple-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 font-semibold">Food Packs</p>
                  <p className="text-sm font-bold text-purple-950 font-mono">{(sourceLguRecord.foodPacks ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-purple-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 font-semibold">Hygiene Kits</p>
                  <p className="text-sm font-bold text-purple-950 font-mono">{(sourceLguRecord.hygieneKits ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-purple-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 font-semibold">Family Kits</p>
                  <p className="text-sm font-bold text-purple-950 font-mono">{(sourceLguRecord.familyKits ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-purple-100 shadow-xs">
                  <p className="text-[10px] text-gray-500 font-semibold">Sleeping Kits</p>
                  <p className="text-sm font-bold text-purple-950 font-mono">{(sourceLguRecord.sleepingKits ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Available Stock Display - Shown for Warehouse and LGU sources */}
          {formData.deliveryMode !== 'Direct Delivery' && formData.fnfiCategory && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Available Stock</p>
                    <p className="text-xs text-gray-600">
                      {formData.fnfiCategory} in {formData.sourceType === 'Warehouse' ? formData.warehouseSource : `${selectedMunicipality || 'Source LGU'} (${selectedProvince})`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${availableQty > 100 ? 'text-green-600' : availableQty > 0 ? 'text-orange-600' : 'text-red-500'}`}>
                    {availableQty > 0 ? availableQty.toLocaleString() : '0'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {availableQty > 0 ? 'kits available' : 'no stock'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount Requested & Delivery Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
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
                placeholder="Enter amount (kits)"
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.amountRequested ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amountRequested && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.amountRequested}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Transportation Method
              </label>
              <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TruckIcon className="w-4 h-4 text-[#2500ba]" />
                  <span>DSWD Relief Truck Driver</span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2500ba]">
                  Truck Only
                </span>
              </div>
            </div>
          </div>

          {/* Incident Code */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Incident Code (Optional)
            </label>
            <textarea
              value={formData.incidentCode}
              onChange={(e) => handleChange('incidentCode', e.target.value)}
              placeholder="Add incident code or additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              {mode === 'edit' ? 'Save Changes' : 'Create Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
