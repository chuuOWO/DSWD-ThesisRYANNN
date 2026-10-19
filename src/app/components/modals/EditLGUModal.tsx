import { useState, useEffect, useMemo } from 'react';
import { X, MapPin, AlertCircle, Edit, Lock, Unlock, Package, ShieldAlert } from 'lucide-react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { sanitizeTextOnly, sanitizePhone } from '../../lib/inputValidation';
import { REGIONAL_PROVINCES } from '../../lib/lguMatching';
import { normalizeCategoryName, getLguStockForCategory } from '../../lib/lguSync';
import { getLguCapacities, saveLguCapacities } from '../../lib/commodityClassification';
import { MAP_TILE_CONFIG } from '../../lib/mapConfig';
import type { LGUDelivery } from '../views/LGUMonitoring';

interface EditLGUModalProps {
  lgu: LGUDelivery;
  onClose: () => void;
  onSubmit: (data: LGUDelivery) => void | Promise<void>;
  availableCategories?: string[];
  onOpenEmergencyCorrection?: (lguId: string) => void;
  adminActionsEnabled?: boolean;
}

const PROVINCES = REGIONAL_PROVINCES;

const lguPinIcon = L.divIcon({
  className: 'custom-lgu-pin',
  html: `
    <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; transform: translate(-50%, -100%);">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #ea580c;
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 14px rgba(234,88,12,0.4), 0 2px 4px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 2;
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
      <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #ea580c; margin-top: -1px; z-index: 1;"></div>
    </div>
  `,
  iconSize: [0, 0],
  iconAnchor: [0, 0]
});

function MapClickHandler({ onPinChange, disabled }: { onPinChange: (lat: number, lng: number) => void; disabled?: boolean }) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPinChange(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    }
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function EditLGUModal({
  lgu,
  onClose,
  onSubmit,
  availableCategories = [],
  onOpenEmergencyCorrection,
  adminActionsEnabled = false
}: EditLGUModalProps) {
  const initialCaps = useMemo(() => getLguCapacities(lgu), [lgu]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [foodCap, setFoodCap] = useState<number>(initialCaps.food);
  const [nonFoodCap, setNonFoodCap] = useState<number>(initialCaps.nonFood);
  const [formData, setFormData] = useState<LGUDelivery>({
    ...lgu,
    maxStock: lgu.maxStock !== undefined ? Number(lgu.maxStock) || 3000 : 3000,
    latitude: lgu.latitude,
    longitude: lgu.longitude,
    currentStock: lgu.currentStock || {}
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LGUDelivery, string>>>({});

  const categoriesToRender = useMemo(() => {
    const canonicalSet = new Set<string>();
    const standardCategories = ['Family Food Pack', 'Hygiene Kit', 'Sleeping Kit', 'Kitchen Kit', 'Family Kit', 'Laminated Sacks', 'Ready-to-Eat Food (RTEF)'];
    standardCategories.forEach(cat => canonicalSet.add(cat));

    if (Array.isArray(availableCategories)) {
      availableCategories.forEach(cat => {
        if (!cat) return;
        canonicalSet.add(normalizeCategoryName(cat));
      });
    }

    if (formData.currentStock) {
      Object.keys(formData.currentStock).forEach(k => {
        if (!k) return;
        canonicalSet.add(normalizeCategoryName(k));
      });
    }

    return Array.from(canonicalSet).sort();
  }, [availableCategories, formData.currentStock]);

  const totalOnHandItems = useMemo(() => {
    return categoriesToRender.reduce((sum, cat) => sum + getLguStockForCategory(formData, cat), 0);
  }, [categoriesToRender, formData]);

  const handleStockChange = (category: string, rawVal: string) => {
    const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0);
    const canonical = normalizeCategoryName(category);
    setFormData(prev => {
      const nextStock = { ...(prev.currentStock || {}) };
      nextStock[category] = val;
      if (canonical) {
        nextStock[canonical] = val;
      }
      const updated: LGUDelivery = {
        ...prev,
        currentStock: nextStock
      };
      if (canonical === 'Family Food Pack' || canonical === 'Food Pack') updated.foodPacks = val;
      else if (canonical === 'Hygiene Kit') updated.hygieneKits = val;
      else if (canonical === 'Sleeping Kit') updated.sleepingKits = val;
      else if (canonical === 'Kitchen Kit') updated.kitchenKits = val;
      else if (canonical === 'Family Kit') updated.familyKits = val;
      else if (canonical === 'Laminated Sacks' || canonical === 'Laminated Sack') updated.laminatedSacks = val;
      else if (canonical === 'Ready-to-Eat Food (RTEF)' || canonical === 'RTEF') updated.rtef = val;
      return updated;
    });
  };

  const handleChange = (field: keyof LGUDelivery, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
        const totalQuota = foodCap + nonFoodCap;
        saveLguCapacities(formData.id, foodCap, nonFoodCap);
        saveLguCapacities(formData.municipality, foodCap, nonFoodCap);
        await onSubmit({
          ...formData,
          maxStock: totalQuota
        });
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
              <p className="text-sm text-gray-600">Edit municipality profile and contact information</p>
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
          {/* Province & Municipality (Permanent Read-Only System Associations) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Province
                </label>
                <span className="flex items-center gap-1 text-[9.5px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5 text-gray-400" /> Locked Key
                </span>
              </div>
              <input
                type="text"
                value={formData.province}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-600 rounded-lg cursor-not-allowed text-xs font-semibold select-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Municipality
                </label>
                <span className="flex items-center gap-1 text-[9.5px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5 text-gray-400" /> Locked Key
                </span>
              </div>
              <input
                type="text"
                value={formData.municipality}
                readOnly
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-600 rounded-lg cursor-not-allowed text-xs font-semibold select-all"
              />
            </div>
          </div>

          {/* LGU ID */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              LGU ID
            </label>
            <input
              type="text"
              value={formData.id}
              readOnly
              disabled
              className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-600 rounded-lg cursor-not-allowed font-mono text-xs font-semibold select-all"
            />
          </div>

          {/* LGU Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700">
                Official LGU Name <span className="text-red-500">*</span>
              </label>
              {!adminActionsEnabled && (
                <span className="flex items-center gap-1 text-[9.5px] text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5 text-gray-400" /> Admin Mode Required
                </span>
              )}
            </div>
            <input
              type="text"
              value={formData.lguName}
              disabled={!adminActionsEnabled}
              onChange={(e) => handleChange('lguName', sanitizeTextOnly(e.target.value))}
              className={`w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !adminActionsEnabled
                  ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                  : errors.lguName
                    ? 'border-red-500 bg-white text-gray-900'
                    : 'border-gray-300 bg-white text-gray-900'
              }`}
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contactPerson || ''}
                disabled={!adminActionsEnabled}
                onChange={(e) => handleChange('contactPerson', sanitizeTextOnly(e.target.value))}
                placeholder="e.g., Juan Dela Cruz"
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !adminActionsEnabled ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Contact Number
              </label>
              <input
                type="text"
                inputMode="tel"
                value={formData.contactNumber || ''}
                disabled={!adminActionsEnabled}
                onChange={(e) => handleChange('contactNumber', sanitizePhone(e.target.value))}
                placeholder="e.g., 09XX-XXX-XXXX"
                className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !adminActionsEnabled ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>

          {/* Delivery Statistics & Last Delivery Date (Locked & Automated) */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                <Lock className="w-4 h-4 text-gray-500" />
                <span>Delivery Statistics (Automated & Locked)</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Last delivery: <span className="font-bold text-gray-700">{formData.lastDeliveryDate || 'N/A'}</span>
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Delivery metrics and last delivery timestamps are synchronized directly from verified dispatches and receipts. Manual edits are restricted to protect record integrity.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-gray-500">Items Released</p>
                <p className="text-base font-bold text-blue-600 mt-0.5">{(Number(formData.totalItemsReleased) || 0).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-gray-500">Total Deliveries</p>
                <p className="text-base font-bold text-gray-800 mt-0.5">{Number(formData.deliveryCount) || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-gray-500">Completed</p>
                <p className="text-base font-bold text-green-700 mt-0.5">{Number(formData.completedDeliveries) || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-2xs">
                <p className="text-[11px] font-semibold text-gray-500">Pending</p>
                <p className="text-base font-bold text-orange-600 mt-0.5">{Number(formData.pendingDeliveries) || 0}</p>
              </div>
            </div>
          </div>

          {/* Current Stock (Admin Mode: Editable / Read-Only otherwise) */}
          <div className={`rounded-xl p-4 space-y-3 border ${
            adminActionsEnabled
              ? 'bg-purple-50/90 border-purple-300'
              : 'bg-purple-50/70 border-purple-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                {adminActionsEnabled ? (
                  <Unlock className="w-4 h-4 text-purple-700" />
                ) : (
                  <Lock className="w-4 h-4 text-purple-700" />
                )}
                <span>
                  {adminActionsEnabled
                    ? 'On-Hand Inventory (Admin Edit Active)'
                    : 'On-Hand Inventory (Locked & Automated)'}
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {totalOnHandItems.toLocaleString()} Total Items
              </span>
            </div>

            <p className="text-xs text-purple-700 leading-relaxed">
              {adminActionsEnabled
                ? 'Administrative mode active. You may directly adjust on-hand inventory balances across all relief kit and pack categories for this LGU.'
                : 'LGU inventory balances are automatically updated when releases are accepted and direct incoming goods are stocked. Enable Administrative Actions in Settings to edit directly.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {categoriesToRender.map(category => {
                const qty = getLguStockForCategory(formData, category);
                return (
                  <div key={category} className="bg-white rounded-lg p-2.5 border border-purple-100 shadow-xs space-y-1">
                    <p className="text-[11px] font-semibold text-gray-600 truncate" title={category}>{category}</p>
                    {adminActionsEnabled ? (
                      <input
                        type="number"
                        min="0"
                        value={qty}
                        onChange={(e) => handleStockChange(category, e.target.value)}
                        className="w-full px-2 py-1 text-sm font-bold text-gray-900 border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                      />
                    ) : (
                      <p className="text-base font-bold text-gray-900">{qty.toLocaleString()}</p>
                    )}
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

          {/* LGU Buffer Stock Capacity (Separate Food & Non-Food Inputs) */}
          <div className={`p-4 rounded-xl border ${
            adminActionsEnabled
              ? 'bg-blue-50/60 border-blue-200'
              : 'bg-gray-50 border-gray-200'
          } space-y-3`}>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-800">
                LGU Buffer Stock Capacities
              </label>
              {adminActionsEnabled ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Admin Editable
                </span>
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-gray-500 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Admin Mode Required</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Target baseline capacities for Food Items (Family Food Packs & RTEF) and Non-Food Items (Hygiene, Sleeping, Kitchen, Family Kits & Sacks).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-amber-900">
                  Food Items Buffer Capacity (Packs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={foodCap}
                  disabled={!adminActionsEnabled}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                    setFoodCap(val);
                    handleChange('maxStock', val + nonFoodCap);
                  }}
                  className={`w-full px-3 py-2 border rounded-lg font-semibold text-sm ${
                    adminActionsEnabled
                      ? 'bg-white border-amber-300 text-gray-900 focus:ring-2 focus:ring-amber-500'
                      : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                />
              </div>

              <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-blue-900">
                  Non-Food Items Buffer Capacity (Units)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={nonFoodCap}
                  disabled={!adminActionsEnabled}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                    setNonFoodCap(val);
                    handleChange('maxStock', foodCap + val);
                  }}
                  className={`w-full px-3 py-2 border rounded-lg font-semibold text-sm ${
                    adminActionsEnabled
                      ? 'bg-white border-blue-300 text-gray-900 focus:ring-2 focus:ring-blue-500'
                      : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-gray-200">
              <span className="font-semibold text-gray-600">Total Combined Stock Quota:</span>
              <strong className="text-gray-900 font-mono text-sm">{(foodCap + nonFoodCap).toLocaleString()} units</strong>
            </div>

            {!adminActionsEnabled && (
              <p className="text-[11px] text-gray-500 italic">
                Enable Administrative Mode in the dashboard to modify stock capacity thresholds.
              </p>
            )}
          </div>

          {/* Facility Geographic Location: Interactive Map Pinpoint Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-orange-600" />
                <span>Facility Map Location (Pinpoint)</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                {(Number(formData.latitude) || 10.7202).toFixed(5)}° N, {(Number(formData.longitude) || 122.5621).toFixed(5)}° E
              </span>
            </div>

            <p className="text-xs text-gray-500">
              {adminActionsEnabled
                ? 'Click anywhere on the map or drag the orange marker to pinpoint the exact municipal distribution hub location.'
                : 'Facility coordinates are locked. Enable Administrative Mode in Settings to modify pin.'}
            </p>

            <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-300 relative shadow-inner z-0">
              <MapContainer
                center={[Number(formData.latitude) || 10.7202, Number(formData.longitude) || 122.5621]}
                zoom={12}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  url={MAP_TILE_CONFIG.url}
                  attribution={MAP_TILE_CONFIG.attribution}
                  maxZoom={MAP_TILE_CONFIG.maxZoom}
                />
                <MapClickHandler
                  disabled={!adminActionsEnabled}
                  onPinChange={(lat, lng) => {
                    handleChange('latitude', lat);
                    handleChange('longitude', lng);
                  }}
                />
                <RecenterMap lat={Number(formData.latitude) || 10.7202} lng={Number(formData.longitude) || 122.5621} />
                <Marker
                  position={[Number(formData.latitude) || 10.7202, Number(formData.longitude) || 122.5621]}
                  draggable={adminActionsEnabled}
                  icon={lguPinIcon}
                  eventHandlers={{
                    dragend(e) {
                      const pos = e.target.getLatLng();
                      handleChange('latitude', Number(pos.lat.toFixed(5)));
                      handleChange('longitude', Number(pos.lng.toFixed(5)));
                    }
                  }}
                />
              </MapContainer>
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
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-xs"
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
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !adminActionsEnabled}
              className={`flex-1 px-6 py-3 font-semibold rounded-lg shadow-sm transition-colors text-xs ${
                !adminActionsEnabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
              }`}
            >
              {!adminActionsEnabled
                ? 'Admin Mode Required to Save'
                : isSubmitting
                  ? 'Updating...'
                  : 'Update LGU Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
