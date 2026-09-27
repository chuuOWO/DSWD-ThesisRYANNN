import { useState } from 'react';
import { X, MapPin, AlertCircle } from 'lucide-react';

interface LGUForm {
  lguName: string;
  municipality: string;
  province: string;
  totalItemsReleased: number;
  deliveryCount: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  lastDeliveryDate: string;
  contactPerson: string;
  contactNumber: string;
  remarks: string;
  currentStock: {
    'Hygiene Kit': number;
    'Food Pack': number;
    'Sleeping Kit': number;
    'Kitchen Kit': number;
    'Family Kit': number;
    'Laminated Sack': number;
    'RTEF': number;
  };
}

interface AddLGUModalProps {
  onClose: () => void;
  onSubmit: (data: LGUForm) => void;
}

const PROVINCES = ['Iloilo', 'Antique', 'Capiz', 'Aklan', 'Guimaras', 'Negros Occidental'];
const FNFI_CATEGORIES = ['Hygiene Kit', 'Food Pack', 'Sleeping Kit', 'Kitchen Kit', 'Family Kit', 'Laminated Sack', 'RTEF'] as const;

export function AddLGUModal({ onClose, onSubmit }: AddLGUModalProps) {
  const [formData, setFormData] = useState<LGUForm>({
    lguName: '',
    municipality: '',
    province: '',
    totalItemsReleased: 0,
    deliveryCount: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    lastDeliveryDate: '',
    contactPerson: '',
    contactNumber: '',
    remarks: '',
    currentStock: {
      'Hygiene Kit': 0,
      'Food Pack': 0,
      'Sleeping Kit': 0,
      'Kitchen Kit': 0,
      'Family Kit': 0,
      'Laminated Sack': 0,
      'RTEF': 0
    }
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LGUForm, string>>>({});

  const handleChange = (field: keyof LGUForm, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

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

    // Auto-calculate total deliveries
    if (field === 'completedDeliveries' || field === 'pendingDeliveries') {
      const completed = field === 'completedDeliveries' ? Number(value) : formData.completedDeliveries;
      const pending = field === 'pendingDeliveries' ? Number(value) : formData.pendingDeliveries;
      setFormData(prev => ({
        ...prev,
        deliveryCount: completed + pending
      }));
    }
  };

  const handleStockChange = (category: typeof FNFI_CATEGORIES[number], value: number) => {
    setFormData(prev => ({
      ...prev,
      currentStock: {
        ...prev.currentStock,
        [category]: value
      }
    }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LGUForm, string>> = {};

    if (!formData.lguName.trim()) {
      newErrors.lguName = 'LGU name is required';
    }

    if (!formData.municipality.trim()) {
      newErrors.municipality = 'Municipality is required';
    }

    if (!formData.province) {
      newErrors.province = 'Province is required';
    }

    if (formData.completedDeliveries < 0) {
      newErrors.completedDeliveries = 'Cannot be negative';
    }

    if (formData.pendingDeliveries < 0) {
      newErrors.pendingDeliveries = 'Cannot be negative';
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
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New LGU</h2>
              <p className="text-sm text-gray-600">Register a new Local Government Unit</p>
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
                Municipality <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.municipality}
                onChange={(e) => handleChange('municipality', e.target.value)}
                placeholder="e.g., Leon, Miag-ao"
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.municipality ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.municipality && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.municipality}
                </p>
              )}
            </div>
          </div>

          {/* LGU Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              LGU Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lguName}
              onChange={(e) => handleChange('lguName', e.target.value)}
              placeholder="e.g., Leon Municipal Office"
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.lguName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.lguName && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.lguName}
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => handleChange('contactPerson', e.target.value)}
                placeholder="e.g., Juan Dela Cruz"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Contact Number
              </label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => handleChange('contactNumber', e.target.value)}
                placeholder="e.g., 09XX-XXX-XXXX"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Delivery Statistics */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 text-sm mb-3">Delivery Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-blue-700 mb-2">
                  Total Items Released
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.totalItemsReleased || ''}
                  onChange={(e) => handleChange('totalItemsReleased', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-green-700 mb-2">
                  Completed Deliveries
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.completedDeliveries || ''}
                  onChange={(e) => handleChange('completedDeliveries', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.completedDeliveries ? 'border-red-500' : 'border-green-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-orange-700 mb-2">
                  Pending Deliveries
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.pendingDeliveries || ''}
                  onChange={(e) => handleChange('pendingDeliveries', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.pendingDeliveries ? 'border-red-500' : 'border-orange-300'
                  }`}
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-blue-900">Total Deliveries</span>
                <span className="text-lg font-bold text-blue-600">{formData.deliveryCount}</span>
              </div>
            </div>
          </div>

          {/* Last Delivery Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Last Delivery Date
            </label>
            <input
              type="date"
              value={formData.lastDeliveryDate}
              onChange={(e) => handleChange('lastDeliveryDate', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Current Stock */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-900 text-sm mb-3">Current Stock at LGU (Optional)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FNFI_CATEGORIES.map(category => (
                <div key={category}>
                  <label className="block text-xs font-bold text-green-700 mb-2">
                    {category}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.currentStock[category] || 0}
                    onChange={(e) => handleStockChange(category, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-green-900">Total Stock</span>
                <span className="text-lg font-bold text-green-600">
                  {Object.values(formData.currentStock).reduce((sum, val) => sum + val, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Add any additional notes about this LGU..."
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
              Add LGU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
