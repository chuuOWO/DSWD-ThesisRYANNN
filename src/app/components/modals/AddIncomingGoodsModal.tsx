import { useEffect, useState, useMemo } from 'react';
import { X, Calendar, Package, AlertCircle, Building2 } from 'lucide-react';
import { sanitizeNumbersOnly, sanitizeSlipReference } from '../../lib/inputValidation';
import type { SupplySourceRecord, WarehouseRecord, KitTypeRecord, LguRecord, ProvinceRecord } from '../../services/backendApi';
import { DEFAULT_KIT_NAMES, DEFAULT_WAREHOUSES, DEFAULT_SUPPLY_SOURCES, DEFAULT_PANAY_LGUS, REGIONAL_PROVINCES } from '../../lib/lguMatching';

export interface IncomingGoodsForm {
  dateReceived: string;
  fnfiCategory: string;
  quantity: number;
  unitType: string;
  expirationDate: string;
  source: string;
  destinationType: 'Warehouse' | 'LGU';
  destination: string;
  incidentCode: string;
}

interface AddIncomingGoodsModalProps {
  onClose: () => void;
  onSubmit: (data: IncomingGoodsForm) => void;
  initialData?: IncomingGoodsForm;
  mode?: 'add' | 'edit';
  supplySourcesList?: SupplySourceRecord[];
  warehousesList?: WarehouseRecord[];
  kitTypesList?: KitTypeRecord[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
}

export function AddIncomingGoodsModal({
  onClose,
  onSubmit,
  initialData,
  mode = 'add',
  supplySourcesList,
  warehousesList,
  kitTypesList,
  lgusList = [],
  provincesList = []
}: AddIncomingGoodsModalProps) {
  const sourceOptions = useMemo(() => {
    let base: string[] = [];
    if (supplySourcesList && supplySourcesList.length > 0) {
      const active = supplySourcesList.filter(s => s.isActive !== false).map(s => s.shortCode || s.name);
      if (active.length > 0) base = active;
    }
    if (base.length === 0) {
      base = DEFAULT_SUPPLY_SOURCES.map(s => s.shortCode || s.name);
    }
    const cleanList = base.filter(s => !s.toLowerCase().startsWith('other'));
    return [...cleanList, 'Others, specify'];
  }, [supplySourcesList]);

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

  const [selectedProvince, setSelectedProvince] = useState<string>(() => {
    if (initialData && initialData.destinationType === 'LGU') {
      const matched = availableLgus.find(l => l.municipality.toLowerCase() === initialData.destination.toLowerCase());
      if (matched) return matched.province;
    }
    return provinces[0] || 'Iloilo';
  });

  const [selectedMunicipality, setSelectedMunicipality] = useState<string>(() => {
    if (initialData && initialData.destinationType === 'LGU') {
      return initialData.destination;
    }
    return '';
  });

  const [selectedSourceType, setSelectedSourceType] = useState<string>(() => {
    if (initialData?.source) {
      const match = sourceOptions.find(s => s.toLowerCase() === initialData.source.toLowerCase() && s !== 'Others, specify');
      if (match) return match;
      return 'Others, specify';
    }
    return sourceOptions[0] || 'VDRC';
  });

  const [customSourceText, setCustomSourceText] = useState<string>(() => {
    if (initialData?.source) {
      const match = sourceOptions.find(s => s.toLowerCase() === initialData.source.toLowerCase() && s !== 'Others, specify');
      if (!match) return initialData.source;
    }
    return '';
  });

  const defaultFormData: IncomingGoodsForm = {
    dateReceived: new Date().toISOString().split('T')[0],
    fnfiCategory: categoryOptions[0] || 'Food Pack',
    quantity: 0,
    unitType: 'packs',
    expirationDate: '',
    source: sourceOptions[0] || 'VDRC',
    destinationType: 'Warehouse',
    destination: warehouseOptions[0] || 'Oton Main Warehouse',
    incidentCode: ''
  };

  const [formData, setFormData] = useState<IncomingGoodsForm>(
    initialData ? { ...initialData, unitType: initialData.unitType || 'packs' } : defaultFormData
  );
  const [errors, setErrors] = useState<Partial<Record<keyof IncomingGoodsForm, string>>>({});

  useEffect(() => {
    if (!initialData) return;
    setFormData({ ...initialData, unitType: initialData.unitType || 'packs' });
    if (initialData.source) {
      const match = sourceOptions.find(s => s.toLowerCase() === initialData.source.toLowerCase() && s !== 'Others, specify');
      if (match) {
        setSelectedSourceType(match);
        setCustomSourceText('');
      } else {
        setSelectedSourceType('Others, specify');
        setCustomSourceText(initialData.source);
      }
    }
    if (initialData.destinationType === 'LGU') {
      const matched = availableLgus.find(l => l.municipality.toLowerCase() === initialData.destination.toLowerCase());
      if (matched) {
        setSelectedProvince(matched.province);
      }
      setSelectedMunicipality(initialData.destination);
    }
  }, [initialData, availableLgus, sourceOptions]);

  const handleChange = (field: keyof IncomingGoodsForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof IncomingGoodsForm, string>> = {};

    if (!formData.incidentCode || !formData.incidentCode.trim()) {
      newErrors.incidentCode = 'RIS (Request Slip) reference is required';
    }

    if (!formData.dateReceived) {
      newErrors.dateReceived = 'Date received is required';
    }

    if (!formData.fnfiCategory) {
      newErrors.fnfiCategory = 'FNFI category is required';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.expirationDate) {
      newErrors.expirationDate = 'Expiration date is required';
    } else {
      const expDate = new Date(formData.expirationDate);
      const recDate = new Date(formData.dateReceived);
      if (expDate <= recDate) {
        newErrors.expirationDate = 'Expiration date must be after received date';
      }
    }

    const finalSource = selectedSourceType === 'Others, specify'
      ? customSourceText.trim()
      : formData.source.trim();

    if (!finalSource) {
      newErrors.source = selectedSourceType === 'Others, specify'
        ? 'Please specify the other source or donor name'
        : 'Source/Donor is required';
    }

    if (formData.destinationType === 'Warehouse') {
      if (!formData.destination.trim()) {
        newErrors.destination = 'Destination warehouse is required';
      }
    } else if (formData.destinationType === 'LGU') {
      if (!selectedMunicipality.trim()) {
        newErrors.destination = 'Destination LGU is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      const finalSource = selectedSourceType === 'Others, specify'
        ? customSourceText.trim()
        : formData.source.trim();

      const submissionData = {
        ...formData,
        source: finalSource,
        destination: formData.destinationType === 'LGU' ? selectedMunicipality : formData.destination,
        incidentCode: formData.incidentCode?.trim() || ''
      };
      onSubmit(submissionData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mode === 'edit' ? 'Edit Incoming Delivery' : 'Add Incoming Goods'}</h2>
              <p className="text-sm text-gray-600">{mode === 'edit' ? 'Update incoming FNFI delivery details' : 'Add new FNFI items to warehouse or LGU inventory'}</p>
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
          {/* RIS (Request Slip) Reference - Required at Top */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              RIS (Request Slip) Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.incidentCode}
              onChange={(e) => handleChange('incidentCode', sanitizeSlipReference(e.target.value))}
              placeholder="e.g., RIS-2026-001, DSWD-RIS-042"
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                errors.incidentCode ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.incidentCode ? (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.incidentCode}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Official Request and Issue Slip reference for this incoming delivery.
              </p>
            )}
          </div>

          {/* Date Received */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Date Received <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.dateReceived}
                onChange={(e) => handleChange('dateReceived', e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.dateReceived ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.dateReceived && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.dateReceived}
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
              onChange={(e) => {
                const catName = e.target.value;
                const matchedKit = kitTypesList?.find(k => k.name === catName);
                const unit = matchedKit?.unitType || 'packs';
                setFormData(prev => ({
                  ...prev,
                  fnfiCategory: catName,
                  unitType: unit
                }));
                if (errors.fnfiCategory) {
                  setErrors(prev => ({ ...prev, fnfiCategory: '' }));
                }
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.fnfiCategory ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select category...</option>
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

          {/* Quantity & Unit Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.quantity || ''}
                onChange={(e) => {
                  const cleaned = sanitizeNumbersOnly(e.target.value);
                  handleChange('quantity', cleaned ? parseInt(cleaned, 10) : 0);
                }}
                placeholder={`Enter quantity (${formData.unitType || 'units'})`}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.quantity && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.quantity}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Unit Type
              </label>
              <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-gray-800 font-semibold text-sm flex items-center justify-between">
                <span>{formData.unitType || 'packs'}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-xs">
                  Kit Unit
                </span>
              </div>
            </div>
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Expiration Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => handleChange('expirationDate', e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.expirationDate ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.expirationDate && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.expirationDate}
              </p>
            )}
          </div>

          {/* Source Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Source / Donor <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSourceType}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSourceType(val);
                if (val === 'Others, specify') {
                  setFormData(prev => ({ ...prev, source: customSourceText }));
                } else {
                  setFormData(prev => ({ ...prev, source: val }));
                  setCustomSourceText('');
                }
                if (errors.source) {
                  setErrors(prev => ({ ...prev, source: '' }));
                }
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                errors.source && selectedSourceType !== 'Others, specify' ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {sourceOptions.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>

            {/* Custom Source Input when 'Others, specify' is selected */}
            {selectedSourceType === 'Others, specify' && (
              <div className="mt-2.5">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Specify Source / Donor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customSourceText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomSourceText(val);
                    setFormData(prev => ({ ...prev, source: val }));
                    if (errors.source) {
                      setErrors(prev => ({ ...prev, source: '' }));
                    }
                  }}
                  placeholder="e.g., Red Cross, World Food Programme, Local Business Donor"
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    errors.source ? 'border-red-500' : 'border-gray-300'
                  }`}
                  autoFocus
                />
              </div>
            )}

            {errors.source && (
              <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.source}
              </p>
            )}
          </div>

          {/* Destination Selection (Then destination is picked) */}
          <div className="space-y-4">
            {/* Destination Type Toggle */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Destination Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      destinationType: 'Warehouse',
                      destination: warehouseOptions[0] || 'Oton Main Warehouse'
                    }));
                  }}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                    formData.destinationType === 'Warehouse'
                      ? 'bg-[#2500ba] text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Warehouse
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      destinationType: 'LGU',
                      destination: selectedMunicipality || ''
                    }));
                  }}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                    formData.destinationType === 'LGU'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  LGU
                </button>
              </div>
            </div>

            {/* Destination Warehouse vs LGU */}
            {formData.destinationType === 'Warehouse' ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Destination Warehouse <span className="text-red-500">*</span>
                </label>
                {warehouseOptions.length <= 4 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {warehouseOptions.map(wh => (
                      <button
                        key={wh}
                        type="button"
                        onClick={() => handleChange('destination', wh)}
                        className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                          formData.destination === wh
                            ? 'bg-[#2500ba] text-white shadow-md'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        }`}
                      >
                        {wh}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={formData.destination}
                    onChange={(e) => handleChange('destination', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {warehouseOptions.map(wh => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
                  </select>
                )}
                {errors.destination && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.destination}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Province <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => {
                        const newProv = e.target.value;
                        setSelectedProvince(newProv);
                        setSelectedMunicipality('');
                        setFormData(prev => ({ ...prev, destination: '' }));
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
                      Municipality / LGU <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedMunicipality}
                      onChange={(e) => {
                        const muni = e.target.value;
                        setSelectedMunicipality(muni);
                        setFormData(prev => ({ ...prev, destination: muni }));
                        if (errors.destination) {
                          setErrors(prev => ({ ...prev, destination: '' }));
                        }
                      }}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.destination ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select municipality...</option>
                      {(municipalitiesByProvince[selectedProvince] || []).map(mun => (
                        <option key={mun} value={mun}>{mun}</option>
                      ))}
                    </select>
                    {errors.destination && (
                      <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.destination}
                      </p>
                    )}
                  </div>
                </div>

                {selectedMunicipality && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3 flex items-start gap-2.5 text-xs text-purple-900">
                    <Building2 className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-purple-900">LGU Direct Delivery</p>
                      <p className="text-purple-700 mt-0.5">
                        This delivery will be recorded for {selectedMunicipality}, {selectedProvince}. Submit and confirm physical verification to stock into LGU inventory.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              {mode === 'edit' ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
