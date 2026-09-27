import { useEffect, useState } from 'react';
import { X, Calendar, Package, AlertCircle } from 'lucide-react';

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

const SOURCE_OPTIONS = [
  'VDRC',
  'LDRC',
  'Oton Main Warehouse',
  'Pototan Main Warehouse',
  'Others'
];

const defaultFormData: IncomingGoodsForm = {
    dateReceived: new Date().toISOString().split('T')[0],
    fnfiCategory: '',
    quantity: 0,
    unitType: 'kits',
    expirationDate: '',
    source: 'VDRC',
    destinationType: 'Warehouse',
    destination: 'Oton Main Warehouse',
    incidentCode: ''
};

export function AddIncomingGoodsModal({ onClose, onSubmit, initialData, mode = 'add' }: AddIncomingGoodsModalProps) {
  const [formData, setFormData] = useState<IncomingGoodsForm>(
    initialData ? { ...initialData, unitType: initialData.unitType || 'kits' } : defaultFormData
  );
  const [errors, setErrors] = useState<Partial<Record<keyof IncomingGoodsForm, string>>>({});

  useEffect(() => {
    if (!initialData) return;
    setFormData({ ...initialData, unitType: initialData.unitType || 'kits' });
  }, [initialData]);

  const handleChange = (field: keyof IncomingGoodsForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof IncomingGoodsForm, string>> = {};

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

    if (!formData.source.trim()) {
      newErrors.source = 'Source/Donor is required';
    }

    if (!formData.destination.trim()) {
      newErrors.destination = 'Destination is required';
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
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{mode === 'edit' ? 'Edit Incoming Delivery' : 'Add Incoming Goods'}</h2>
              <p className="text-sm text-gray-600">{mode === 'edit' ? 'Update incoming FNFI delivery details' : 'Add new FNFI items to warehouse inventory'}</p>
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

          {/* Quantity & Unit Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity || ''}
                onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                placeholder="Enter quantity"
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
                <span>kits</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-xs">
                  Fixed
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

          {/* Source/Donor */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Source <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.source ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {SOURCE_OPTIONS.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
            {errors.source && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.source}
              </p>
            )}
          </div>

          {/* Destination Warehouse */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Destination Warehouse <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('destination', 'Oton Main Warehouse')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                  formData.destination === 'Oton Main Warehouse'
                    ? 'bg-[#2500ba] text-white shadow-md'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                Oton Main Warehouse
              </button>
              <button
                type="button"
                onClick={() => handleChange('destination', 'Pototan Main Warehouse')}
                className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                  formData.destination === 'Pototan Main Warehouse'
                    ? 'bg-[#2500ba] text-white shadow-md'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                Pototan Main Warehouse
              </button>
            </div>
          </div>

          {/* Incident Code */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Incident Code (Optional)
            </label>
            <input
              type="text"
              value={formData.incidentCode}
              onChange={(e) => handleChange('incidentCode', e.target.value)}
              placeholder="e.g., Emergency stock, Good condition"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {mode === 'edit' ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
