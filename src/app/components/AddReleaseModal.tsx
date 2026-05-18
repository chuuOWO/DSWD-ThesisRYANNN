import { useState } from 'react';
import { X, Calendar, MapPin, TruckIcon, AlertCircle, Package } from 'lucide-react';

type DeliveryStatus = 'Allocating' | 'Release' | 'In Transit' | 'Distributed';

interface ReleaseForm {
  dateAllocated: string;
  lguName: string;
  province: string;
  municipality: string;
  fnfiCategory: string;
  amountRequested: number;
  amountApproved: number;
  sourceType: 'Warehouse' | 'LGU';
  warehouseSource: string;
  deliveryMode: string;
  deliveryStatus: DeliveryStatus;
  incidentCode: string;
}

interface AddReleaseModalProps {
  onClose: () => void;
  onSubmit: (data: ReleaseForm) => void;
  availableStock: { category: string; warehouseA: number; warehouseB: number }[];
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

const PROVINCES = ['Iloilo', 'Antique', 'Capiz', 'Aklan', 'Guimaras', 'Negros Occidental'];

const MUNICIPALITIES: { [key: string]: string[] } = {
  'Iloilo': ['Leon', 'Miag-ao', 'Banate', 'Guinhol', 'Iloilo City', 'Oton', 'Tigbauan', 'Pavia'],
  'Antique': ['San Jose', 'Sibalom', 'Culasi', 'Bugasong'],
  'Capiz': ['Roxas City', 'Pilar', 'Pontevedra', 'Panay'],
  'Aklan': ['Kalibo', 'Ibajay', 'Makato', 'Altavas'],
  'Guimaras': ['Jordan', 'Nueva Valencia', 'Buenavista'],
  'Negros Occidental': ['Bacolod City', 'Silay', 'Talisay', 'Victorias']
};

const WAREHOUSE_OPTIONS = [
  'Oton Main Warehouse',
  'Pototan Main Warehouse'
];

const DELIVERY_MODES = ['Truck', 'Van', 'Pick-up', 'Boat', 'Helicopter', 'Air Cargo'];

export function AddReleaseModal({ onClose, onSubmit, availableStock }: AddReleaseModalProps) {
  const [formData, setFormData] = useState<ReleaseForm>({
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
    incidentCode: ''
  });

  const [selectedProvince, setSelectedProvince] = useState('Iloilo');
  const [selectedMunicipality, setSelectedMunicipality] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ReleaseForm, string>>>({});

  // Get available stock for selected category and warehouse
  const getAvailableStock = () => {
    if (!formData.fnfiCategory) return 0;
    if (formData.sourceType !== 'Warehouse') return 0;

    const stockItem = availableStock.find(item => item.category === formData.fnfiCategory);
    if (!stockItem) return 0;

    // Main warehouses have stock in the inventory system
    if (formData.warehouseSource === 'Oton Main Warehouse') {
      return stockItem.warehouseA;
    } else if (formData.warehouseSource === 'Pototan Main Warehouse') {
      return stockItem.warehouseB;
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
      newErrors.lguName = 'LGU name is required';
    }

    if (!formData.province) {
      newErrors.province = 'Province is required';
    }

    // Municipality is now optional - no validation needed

    if (!formData.fnfiCategory) {
      newErrors.fnfiCategory = 'FNFI category is required';
    }

    if (formData.sourceType === 'Warehouse' && !formData.warehouseSource) {
      newErrors.warehouseSource = 'Warehouse source is required';
    }

    if (formData.sourceType === 'LGU' && !selectedMunicipality) {
      newErrors.warehouseSource = 'LGU source is required';
    }

    if (!formData.amountRequested || formData.amountRequested <= 0) {
      newErrors.amountRequested = 'Amount requested must be greater than 0';
    } else {
      // Only validate stock for main warehouses
      if (formData.sourceType === 'Warehouse' && formData.amountRequested > availableQty) {
        newErrors.amountRequested = 'Insufficient stock in the warehouse.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Release</h2>
              <p className="text-sm text-gray-600">Release FNFI items to LGU</p>
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
                Delivery Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.deliveryStatus}
                onChange={(e) => handleChange('deliveryStatus', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Allocating">Allocating</option>
                <option value="Release">Release</option>
                <option value="In Transit">In Transit</option>
                <option value="Distributed">Distributed</option>
              </select>
            </div>
          </div>

          {/* Province & Municipality */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Province <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.province ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select province...</option>
                {PROVINCES.map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
              {errors.province && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.province}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Municipality
              </label>
              <input
                type="text"
                value={formData.municipality}
                onChange={(e) => handleChange('municipality', e.target.value)}
                placeholder="e.g., Leon, Miag-ao (Optional)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* LGU Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              LGU Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.lguName}
                onChange={(e) => handleChange('lguName', e.target.value)}
                placeholder="e.g., Leon Municipal Office"
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.lguName ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.lguName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
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

          {/* Source Type */}
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

          {/* Source Selection */}
          {formData.sourceType === 'Warehouse' ? (
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
                  {PROVINCES.map(prov => (
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
                  {MUNICIPALITIES[selectedProvince]?.map(mun => (
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
          )}

          {/* Available Stock Display */}
          {formData.fnfiCategory && formData.sourceType === 'Warehouse' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Available Stock</p>
                    <p className="text-xs text-gray-600">{formData.fnfiCategory} in {formData.warehouseSource}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${availableQty > 100 ? 'text-green-600' : availableQty > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {availableQty > 0 ? availableQty.toLocaleString() : '-'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {availableQty > 0 ? 'units available' : 'N/A'}
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
                type="number"
                min={availableQty > 0 ? 1 : 0}
                max={availableQty > 0 ? availableQty : undefined}
                value={formData.amountRequested || ''}
                onChange={(e) => handleChange('amountRequested', parseInt(e.target.value) || 0)}
                placeholder="Enter amount"
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

            {formData.deliveryMode !== 'Pick-up' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Delivery Mode <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.deliveryMode}
                  onChange={(e) => handleChange('deliveryMode', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DELIVERY_MODES.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Delivery Mode (when Pick-up is selected) */}
          {formData.deliveryMode === 'Pick-up' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Delivery Mode <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.deliveryMode}
                onChange={(e) => handleChange('deliveryMode', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DELIVERY_MODES.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          )}

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
              Create Release
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
