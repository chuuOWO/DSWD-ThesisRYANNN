import { useState, useMemo, useEffect } from 'react';
import { X, ShieldAlert, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { sanitizeNumbersOnly } from '../../lib/inputValidation';
import type { LguRecord, KitTypeRecord } from '../../services/backendApi';
import { DEFAULT_KIT_NAMES } from '../../lib/lguMatching';

interface EmergencyStockCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lgusList: LguRecord[];
  kitTypesList?: KitTypeRecord[];
  initialLguId?: string;
  onCorrectStock: (
    lguId: string,
    newStock: Record<string, number>,
    reason: string
  ) => Promise<{ ok: boolean; message?: string }>;
}

export function EmergencyStockCorrectionModal({
  isOpen,
  onClose,
  lgusList,
  kitTypesList,
  initialLguId,
  onCorrectStock
}: EmergencyStockCorrectionModalProps) {
  const [selectedLguId, setSelectedLguId] = useState<string>(initialLguId || lgusList[0]?.id || '');
  const [stockInputs, setStockInputs] = useState<Record<string, number>>({});
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeLgu = useMemo(() => {
    return lgusList.find(l => l.id === selectedLguId) || lgusList[0] || null;
  }, [lgusList, selectedLguId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    if (kitTypesList && kitTypesList.length > 0) {
      kitTypesList.filter(k => k.isActive !== false).forEach(k => set.add(k.name));
    } else {
      DEFAULT_KIT_NAMES.forEach(c => set.add(c));
    }
    if (activeLgu?.currentStock) {
      Object.keys(activeLgu.currentStock).forEach(k => set.add(k));
    }
    return Array.from(set).sort();
  }, [kitTypesList, activeLgu]);

  // Synchronize stock inputs when active LGU changes
  useEffect(() => {
    if (!activeLgu) return;
    const initialValues: Record<string, number> = {};
    const stockMap = activeLgu.currentStock || {};

    categories.forEach(cat => {
      let baseline = stockMap[cat] ?? 0;
      const catLower = cat.toLowerCase();
      if (baseline === 0) {
        if (catLower.includes('food')) baseline = activeLgu.foodPacks || 0;
        else if (catLower.includes('hygiene')) baseline = activeLgu.hygieneKits || 0;
        else if (catLower.includes('family')) baseline = activeLgu.familyKits || 0;
        else if (catLower.includes('sleeping')) baseline = activeLgu.sleepingKits || 0;
        else if (catLower.includes('kitchen')) baseline = activeLgu.kitchenKits || 0;
        else if (catLower.includes('sack')) baseline = activeLgu.laminatedSacks || 0;
        else if (catLower.includes('rtef')) baseline = activeLgu.rtef || 0;
      }
      initialValues[cat] = baseline;
    });

    setStockInputs(initialValues);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [activeLgu, categories]);

  if (!isOpen) return null;

  const handleStockChange = (category: string, value: string) => {
    const cleaned = sanitizeNumbersOnly(value);
    const parsed = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setStockInputs(prev => ({
      ...prev,
      [category]: parsed
    }));
  };

  const getBaseline = (cat: string): number => {
    if (!activeLgu) return 0;
    const stockMap = activeLgu.currentStock || {};
    let baseline = stockMap[cat] ?? 0;
    const catLower = cat.toLowerCase();
    if (baseline === 0) {
      if (catLower.includes('food')) baseline = activeLgu.foodPacks || 0;
      else if (catLower.includes('hygiene')) baseline = activeLgu.hygieneKits || 0;
      else if (catLower.includes('family')) baseline = activeLgu.familyKits || 0;
      else if (catLower.includes('sleeping')) baseline = activeLgu.sleepingKits || 0;
      else if (catLower.includes('kitchen')) baseline = activeLgu.kitchenKits || 0;
      else if (catLower.includes('sack')) baseline = activeLgu.laminatedSacks || 0;
      else if (catLower.includes('rtef')) baseline = activeLgu.rtef || 0;
    }
    return baseline;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!activeLgu) {
      setErrorMessage('Please select a valid LGU.');
      return;
    }

    if (!justification.trim() || justification.trim().length < 8) {
      setErrorMessage('A detailed emergency reason (at least 8 characters) is required for audit compliance.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onCorrectStock(activeLgu.id, stockInputs, justification.trim());
      if (result.ok) {
        setSuccessMessage(result.message || 'LGU inventory record updated successfully in database.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(result.message || 'Emergency stock correction failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update LGU stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-950">Emergency LGU Stock Correction</h2>
              <p className="text-xs text-red-700">Special Administrative Override &middot; Directly updates database record</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 transition-colors cursor-pointer text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Controlled Administrative Action</p>
              <p className="text-amber-800 mt-0.5">
                Standard LGU stock is automated via dispatch workflows and incoming manifests. Only perform manual overrides for physical recount adjustments, damaged goods, or emergency field audits.
              </p>
            </div>
          </div>

          {/* LGU Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Target Municipality / LGU <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLguId}
              onChange={e => setSelectedLguId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {lgusList.map(l => (
                <option key={l.id} value={l.id}>
                  {l.municipality}, {l.province} — {l.lguName || 'Municipal Office'}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Quantities Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700">
                Adjust On-Hand Stock Counts
              </label>
              <span className="text-[11px] text-gray-500">
                Current total: {activeLgu ? Object.values(activeLgu.currentStock || {}).reduce((s, v) => s + v, 0).toLocaleString() : 0} items
              </span>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {categories.map(cat => {
                const currentVal = getBaseline(cat);
                const newVal = stockInputs[cat] ?? currentVal;
                const delta = newVal - currentVal;

                return (
                  <div key={cat} className="p-3 bg-white hover:bg-gray-50 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{cat}</p>
                      <p className="text-[11px] text-gray-500">
                        Recorded Baseline: <strong className="text-gray-700">{currentVal.toLocaleString()}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {delta !== 0 && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          delta > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                      <div className="w-28">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={stockInputs[cat] !== undefined ? stockInputs[cat] : currentVal}
                          onChange={e => handleStockChange(cat, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-right font-bold text-gray-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Required Justification */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Emergency Justification / Incident Reference <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="e.g. Physical inventory count verified by DSWD regional audit team; emergency damage adjustment post-typhoon."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Recorded in the system audit trail and discrepancy logs for administrative accountability.
            </p>
          </div>

          {/* Error & Success Feedback */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying Override...</span>
                </>
              ) : (
                <span>Confirm Emergency Correction</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
