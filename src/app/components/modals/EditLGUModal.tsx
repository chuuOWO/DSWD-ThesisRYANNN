import { useState, useEffect, useMemo } from 'react';
import { X, MapPin, AlertCircle, Edit, Lock, Package, ShieldAlert } from 'lucide-react';
import { sanitizeTextOnly, sanitizeNumbersOnly, sanitizePhone } from '../../lib/inputValidation';
import { REGIONAL_PROVINCES } from '../../lib/lguMatching';
import type { LGUDelivery } from '../views/LGUMonitoring';

interface EditLGUModalProps {
  lgu: LGUDelivery;
  onClose: () => void;
  onSubmit: (data: LGUDelivery) => void | Promise<void>;
  availableCategories?: string[];
  onOpenEmergencyCorrection?: (lguId: string) => void;
}

const PROVINCES = REGIONAL_PROVINCES;

export function EditLGUModal({
  lgu,
  onClose,
  onSubmit,
  availableCategories = [],
  onOpenEmergencyCorrection
}: EditLGUModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LGUDelivery>({
    ...lgu,
    latitude: lgu.latitude,
    longitude: lgu.longitude,
    currentStock: lgu.currentStock || {}
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LGUDelivery, string>>>({});

  const categoriesToRender = useMemo(() => {
    const set = new Set<string>(availableCategories);
    if (formData.currentStock) {
      Object.keys(formData.currentStock).forEach(k => set.add(k));
    }
    return Array.from(set).sort();
  }, [availableCategories, formData.currentStock]);

  const handleChange = (field: keyof LGUDelivery, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof LGUDelivery, string>> = {};

    if (!formData.lguName.trim()) {
      newErrors.lguName = 'LGU name is required';
    }

    if (!formData.municipality.trim()) {
      newErrors.municipality = 'Municipality is required';
    }

    if (!formData.province) {
      newErrors.province = 'Province is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await onSubmit(formData);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to update LGU in database.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Edit className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Update LGU Data</h2>
              <p className="text-sm text-gray-600">Edit delivery and contact information</p>
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
                {PROVINCES.map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Municipality <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.municipality}
                onChange={(e) => handleChange('municipality', sanitizeTextOnly(e.target.value))}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.municipality ? 'border-red-500' : 'border-gray-300'
                }`}
              />
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
              onChange={(e) => handleChange('lguName', sanitizeTextOnly(e.target.value))}
              className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.lguName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson || ''}
                onChange={(e) => handleChange('contactPerson', sanitizeTextOnly(e.target.value))}
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
                inputMode="tel"
                value={formData.contactNumber || ''}
                onChange={(e) => handleChange('contactNumber', sanitizePhone(e.target.value))}
                placeholder="e.g., 09XX-XXX-XXXX"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Delivery Statistics */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="font-bold text-orange-900 text-sm mb-3">Update Delivery Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-orange-700 mb-2">
                  Total Items Released
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.totalItemsReleased || ''}
                  onChange={(e) => {
                    const c = sanitizeNumbersOnly(e.target.value);
                    handleChange('totalItemsReleased', c ? parseInt(c, 10) : 0);
                  }}
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-green-700 mb-2">
                  Completed Deliveries
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.completedDeliveries || ''}
                  onChange={(e) => {
                    const c = sanitizeNumbersOnly(e.target.value);
                    handleChange('completedDeliveries', c ? parseInt(c, 10) : 0);
                  }}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-orange-700 mb-2">
                  Pending Deliveries
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.pendingDeliveries || ''}
                  onChange={(e) => {
                    const c = sanitizeNumbersOnly(e.target.value);
                    handleChange('pendingDeliveries', c ? parseInt(c, 10) : 0);
                  }}
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-orange-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-orange-900">Total Deliveries</span>
                <span className="text-lg font-bold text-orange-600">{formData.deliveryCount}</span>
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

          {/* Current Stock (Read-Only / Automated) */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                <Lock className="w-4 h-4 text-purple-700" />
                <span>On-Hand Inventory (Locked & Automated)</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {Object.values(formData.currentStock || {}).reduce((sum, val) => sum + (Number(val) || 0), 0).toLocaleString()} Total Items
              </span>
            </div>

            <p className="text-xs text-purple-700 leading-relaxed">
              LGU inventory balances are automatically updated when releases are accepted and direct incoming goods are stocked. Manual editing is restricted here to ensure chain-of-custody integrity.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {categoriesToRender.map(category => {
                const qty = formData.currentStock?.[category] || 0;
                return (
                  <div key={category} className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-xs">
                    <p className="text-[11px] font-semibold text-gray-500 truncate" title={category}>{category}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{qty.toLocaleString()}</p>
                  </div>
                );
              })}
            </div>

            {onOpenEmergencyCorrection && (
              <div className="pt-2 border-t border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-purple-800">Need an authorized recount or emergency adjustment?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEmergencyCorrection(formData.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Emergency Stock Correction</span>
                </button>
              </div>
            )}
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Latitude (GPS)
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude !== undefined && formData.latitude !== null ? formData.latitude : ''}
                onChange={(e) => handleChange('latitude', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="e.g. 10.7202"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Longitude (GPS)
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude !== undefined && formData.longitude !== null ? formData.longitude : ''}
                onChange={(e) => handleChange('longitude', e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="e.g. 122.5621"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={formData.remarks || ''}
              onChange={(e) => handleChange('remarks', e.target.value)}
              placeholder="Add any additional notes about this LGU..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update LGU Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
