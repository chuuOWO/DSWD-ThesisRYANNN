import { useEffect, useState, useMemo, useRef } from 'react';
import { X, Calendar, MapPin, TruckIcon, AlertCircle, Package, ShieldAlert, Building2, Clock, Sparkles, CheckCircle2, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OutgoingStatus } from '../../hooks/useInventoryState';
import {
  backendApi,
  DEFAULT_TRUCKS,
  type LguRecord,
  type ProvinceRecord,
  type WarehouseRecord,
  type SupplySourceRecord,
  type KitTypeRecord,
  type TruckRecord,
  type EscortProfile,
  type ExpiryDateBatch
} from '../../services/backendApi';
import { LocationPickerMap } from '../design/LocationPickerMap';
import { sanitizeNumbersOnly, sanitizeAlphanumeric, sanitizeSlipReference } from '../../lib/inputValidation';
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
  assignedTruckId?: string;
  assigned_truck_id?: string;
  assignedEscortProfileId?: string;
  assignedDriverProfileId?: string;
  kitTypeId?: string;
  sourceWarehouseId?: string;
  sourceLguId?: string;
  destinationWarehouseId?: string;
  destinationLguId?: string;
  allocatedBatches?: {
    batchTokenId: string;
    batchNumber?: string;
    expirationDate?: string;
    quantity: number;
  }[];
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
  trucksList?: TruckRecord[];
  escortProfilesList?: EscortProfile[];
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
  deliveryMode: 'Delivery',
  deliveryStatus: 'Allocating',
  destinationAddress: '',
  receiverGps: '',
  assignedTruckId: '',
  assignedEscortProfileId: ''
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
  kitTypesList = [],
  trucksList = [],
  escortProfilesList: propEscortProfiles
}: AddReleaseModalProps) {
  const [escorts, setEscorts] = useState<EscortProfile[]>(propEscortProfiles || []);

  useEffect(() => {
    if (propEscortProfiles && propEscortProfiles.length > 0) {
      setEscorts(propEscortProfiles);
      return;
    }
    let isMounted = true;
    backendApi.getEscortProfiles().then(list => {
      if (isMounted && list && list.length > 0) setEscorts(list);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [propEscortProfiles]);

  const availableTrucks = useMemo(() => {
    if (trucksList && trucksList.length > 0) return trucksList;
    return DEFAULT_TRUCKS;
  }, [trucksList]);

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
      lguName: cleanBuildingName(initialData.lguName),
      assignedTruckId: initialData.assignedTruckId || initialData.assigned_truck_id || '',
      assignedEscortProfileId: initialData.assignedEscortProfileId || initialData.assignedDriverProfileId || ''
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
      lguName: cleanBuildingName(initialData.lguName),
      assignedTruckId: initialData.assignedTruckId || initialData.assigned_truck_id || '',
      assignedEscortProfileId: initialData.assignedEscortProfileId || initialData.assignedDriverProfileId || ''
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

  // FEFO Expiry Date Stock Picker State
  const [availableDateBatches, setAvailableDateBatches] = useState<ExpiryDateBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [dateAllocations, setDateAllocations] = useState<Record<string, number>>({});
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);

  // Load available batches ordered by expiration date (FEFO) whenever Category or Source changes
  useEffect(() => {
    if (!formData.fnfiCategory) {
      setAvailableDateBatches([]);
      setSelectedBatchId(null);
      setDateAllocations({});
      return;
    }

    const sourceName = formData.sourceType === 'Warehouse' ? formData.warehouseSource : sourceMunicipality;
    if (!sourceName) {
      setAvailableDateBatches([]);
      setSelectedBatchId(null);
      setDateAllocations({});
      return;
    }

    let isMounted = true;
    setIsLoadingBatches(true);

    backendApi.getStockByExpirationDate({
      categoryName: formData.fnfiCategory,
      sourceType: formData.sourceType,
      sourceName
    }).then(batches => {
      if (!isMounted) return;
      setAvailableDateBatches(batches);
      if (batches.length > 0) {
        setSelectedBatchId(batches[0].batchTokenId);
      } else {
        setSelectedBatchId(null);
      }
      setDateAllocations({});
    }).catch(err => {
      console.warn('Failed to load expiration date batches:', err);
    }).finally(() => {
      if (isMounted) setIsLoadingBatches(false);
    });

    return () => { isMounted = false; };
  }, [formData.fnfiCategory, formData.sourceType, formData.warehouseSource, sourceMunicipality]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return availableDateBatches[0] || null;
    return availableDateBatches.find(b => b.batchTokenId === selectedBatchId) || availableDateBatches[0] || null;
  }, [selectedBatchId, availableDateBatches]);

  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const totalAllocatedFromDates = useMemo(() => {
    return Object.values(dateAllocations).reduce((sum, q) => sum + (Number(q) || 0), 0);
  }, [dateAllocations]);

  // Synchronize amountRequested and amountApproved from date allocations
  useEffect(() => {
    if (availableDateBatches.length > 0) {
      setFormData(prev => ({
        ...prev,
        amountRequested: totalAllocatedFromDates,
        amountApproved: totalAllocatedFromDates
      }));
      if (totalAllocatedFromDates > 0 && errors.amountRequested) {
        setErrors(prev => ({ ...prev, amountRequested: '' }));
      }
    }
  }, [totalAllocatedFromDates, availableDateBatches.length]);

  const handleDateAllocationChange = (batchTokenId: string, val: number) => {
    const batch = availableDateBatches.find(b => b.batchTokenId === batchTokenId);
    if (!batch) return;
    const safeVal = Math.max(0, Math.min(batch.quantityAvailable, val || 0));
    setDateAllocations(prev => {
      const next = { ...prev, [batchTokenId]: safeVal };
      if (safeVal === 0) delete next[batchTokenId];
      return next;
    });
  };

  const handleMaxForDate = (batch: ExpiryDateBatch) => {
    handleDateAllocationChange(batch.batchTokenId, batch.quantityAvailable);
  };

  const handleAutoPickFefo = () => {
    if (availableDateBatches.length === 0) return;
    const earliest = availableDateBatches[0];
    const initialPick = Math.min(earliest.quantityAvailable, 100);
    setDateAllocations({ [earliest.batchTokenId]: initialPick });
    setSelectedBatchId(earliest.batchTokenId);
  };

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

    const effectiveQty = totalAllocatedFromDates > 0 ? totalAllocatedFromDates : (Number(formData.amountRequested) || 0);

    if (availableDateBatches.length > 0) {
      if (effectiveQty <= 0) {
        newErrors.amountRequested = 'Please specify a quantity requested from at least one expiration date lot.';
      } else if (effectiveQty > availableQty) {
        const sourceLabel = formData.sourceType === 'Warehouse' ? formData.warehouseSource : (sourceMunicipality || 'Source LGU');
        newErrors.amountRequested = `Insufficient stock in ${sourceLabel} (${availableQty.toLocaleString()} available).`;
      }
    } else {
      if (effectiveQty <= 0) {
        newErrors.amountRequested = 'Quantity requested must be greater than 0';
      } else if (effectiveQty > availableQty) {
        const sourceLabel = formData.sourceType === 'Warehouse' ? formData.warehouseSource : (sourceMunicipality || 'Source LGU');
        newErrors.amountRequested = `Insufficient stock in ${sourceLabel} (${availableQty.toLocaleString()} available).`;
      }
    }

    // 5. Destination Selection
    if (!formData.province) {
      newErrors.province = 'Destination province is required';
    }

    if (!formData.municipality) {
      newErrors.municipality = 'Destination municipality is required';
    }

    // For LGU-to-LGU transfers, destination barangay/address is optional
    // Relaxed for regional prepositioning mutual aid

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

      const matchedKit = kitTypesList?.find(k => k.name.toLowerCase() === formData.fnfiCategory.toLowerCase());
      let srcWhId: string | undefined;
      let srcLguId: string | undefined;
      if (formData.sourceType === 'Warehouse') {
        srcWhId = warehousesList?.find(w => w.name.toLowerCase() === formData.warehouseSource.toLowerCase())?.id;
      } else {
        srcLguId = availableLgus.find(l => l.municipality.toLowerCase() === sourceMunicipality.toLowerCase())?.id;
      }
      const destLgu = availableLgus.find(l => l.municipality.toLowerCase() === formData.municipality.toLowerCase());
      const destLguId = destLgu?.id;

      const effectiveQty = totalAllocatedFromDates > 0 ? totalAllocatedFromDates : (Number(formData.amountRequested) || 0);

      const allocatedBatchesPayload = Object.entries(dateAllocations)
        .filter(([, qty]) => qty > 0)
        .map(([batchTokenId, qty]) => {
          const b = availableDateBatches.find(item => item.batchTokenId === batchTokenId);
          return {
            batchTokenId,
            batchNumber: b?.batchNumber || batchTokenId,
            expirationDate: b?.expirationDate || '',
            quantity: qty
          };
        });

      const submissionData: ReleaseForm = {
        ...formData,
        amountRequested: effectiveQty,
        amountApproved: effectiveQty,
        incidentCode: formattedIncident,
        reportReason: finalReason,
        lguName: buildingFinal,
        deliveryStatus: initialStatus,
        assignedTruckId: formData.assignedTruckId?.trim() || undefined,
        assigned_truck_id: formData.assignedTruckId?.trim() || undefined,
        assignedEscortProfileId: formData.assignedEscortProfileId?.trim() || undefined,
        assignedDriverProfileId: formData.assignedEscortProfileId?.trim() || undefined,
        kitTypeId: matchedKit?.id,
        sourceWarehouseId: srcWhId,
        sourceLguId: srcLguId,
        lguId: destLguId,
        destinationLguId: destLguId,
        allocatedBatches: allocatedBatchesPayload.length > 0 ? allocatedBatchesPayload : undefined
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
                onChange={(e) => handleChange('incidentCode', sanitizeSlipReference(e.target.value.toUpperCase()))}
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
                        <p className="text-sm font-bold text-purple-950 font-mono">{(Number(sourceLguRecord.currentStock?.['Family Food Pack'] ?? sourceLguRecord.currentStock?.['Food Pack'] ?? sourceLguRecord.foodPacks) || 0).toLocaleString()}</p>
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
                      .filter(([k, v]) => Number(v) > 0 && !['Family Food Pack', 'Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit'].includes(k))
                      .length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(sourceLguRecord.currentStock || {})
                          .filter(([k, v]) => Number(v) > 0 && !['Family Food Pack', 'Food Pack', 'Hygiene Kit', 'Family Kit', 'Sleeping Kit'].includes(k))
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

            {/* Transportation Mode */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Transportation Mode <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, deliveryMode: 'Delivery' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.deliveryMode !== 'Pick up'
                      ? 'bg-[#2500ba] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <TruckIcon className="w-3.5 h-3.5" />
                  <span>Delivery (DSWD)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, deliveryMode: 'Pick up' }))}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.deliveryMode === 'Pick up'
                      ? 'bg-[#2500ba] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Pick up (LGU)</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {formData.deliveryMode === 'Pick up'
                  ? 'Consignee / LGU dispatches their own vehicle for pickup at facility.'
                  : 'DSWD logistics fleet transports relief consignment to destination.'}
              </p>
            </div>

            {/* FEFO Expiration Date Stock Picker */}
            {formData.fnfiCategory && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <div>
                      <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                        FEFO Stock by Expiration Date
                      </span>
                      <p className="text-[11px] text-blue-800">
                        Pick an expiration date lot to view available quantity and specify dispatch quantity
                      </p>
                    </div>
                  </div>

                  {availableDateBatches.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAutoPickFefo}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
                      title="Automatically allocate starting from the earliest-expiring stock"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Pick Earliest (FEFO)</span>
                    </button>
                  )}
                </div>

                {isLoadingBatches ? (
                  <div className="py-6 text-center text-xs text-blue-700 font-medium animate-pulse">
                    Loading stock lots and expiration dates for {formData.fnfiCategory}...
                  </div>
                ) : availableDateBatches.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    No active stock lots found for {formData.fnfiCategory} at {formData.sourceType === 'Warehouse' ? formData.warehouseSource : (sourceMunicipality || 'selected source')}.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Expiration Date Carousel Strip */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase">
                          Available Expiration Dates (Earliest First):
                        </label>
                        {availableDateBatches.length > 2 && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <button
                              type="button"
                              onClick={() => scrollCarousel('left')}
                              className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                              title="Scroll left"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => scrollCarousel('right')}
                              className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                              title="Scroll right"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        ref={carouselRef}
                        className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scroll-smooth no-scrollbar"
                        style={{ scrollSnapType: 'x mandatory' }}
                      >
                        {availableDateBatches.map(batch => {
                          const isSelected = selectedBatch?.batchTokenId === batch.batchTokenId;
                          const allocatedFromThis = dateAllocations[batch.batchTokenId] || 0;
                          const isCritical = batch.daysToExpiry <= 100;
                          const isModerate = batch.daysToExpiry > 100 && batch.daysToExpiry <= 150;

                          return (
                            <button
                              key={batch.batchTokenId}
                              type="button"
                              onClick={() => setSelectedBatchId(batch.batchTokenId)}
                              style={{ scrollSnapAlign: 'start' }}
                              className={`flex-shrink-0 min-w-[170px] px-3 py-2 rounded-xl text-left border transition cursor-pointer flex flex-col gap-0.5 ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/50'
                                  : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                                <span className="font-bold text-xs">{batch.expirationDate}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : isCritical
                                    ? 'bg-red-100 text-red-700 border border-red-200'
                                    : isModerate
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {batch.daysToExpiry <= 0 ? 'Expired' : `${batch.daysToExpiry}d left`}
                                </span>
                                <span className={isSelected ? 'text-blue-100 font-mono font-medium' : 'text-gray-600 font-mono font-medium'}>
                                  {batch.quantityAvailable.toLocaleString()} units
                                </span>
                              </div>
                              {allocatedFromThis > 0 && (
                                <span className={`mt-0.5 text-[10px] font-bold ${isSelected ? 'text-amber-200' : 'text-blue-600'}`}>
                                  Allocating: {allocatedFromThis.toLocaleString()}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Date Detail Banner & Allocation Control */}
                    {selectedBatch && (
                      <div className="rounded-xl border border-blue-300 bg-white p-3.5 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-blue-950">
                                Expiration Date: {selectedBatch.expirationDate}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                selectedBatch.daysToExpiry <= 100
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : selectedBatch.daysToExpiry <= 150
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {selectedBatch.daysToExpiry <= 100
                                  ? 'Critical (<= 100 days) - Prioritize'
                                  : selectedBatch.daysToExpiry <= 150
                                  ? 'Moderate (101-150 days)'
                                  : 'Safe (> 150 days)'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                              Lot ID: {selectedBatch.batchTokenId}
                            </p>
                          </div>

                          <div className="text-left sm:text-right bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200/60">
                            <p className="text-[10px] uppercase font-bold text-blue-800">
                              Stock Available for this Date
                            </p>
                            <p className="text-lg font-black text-blue-950 font-mono">
                              {selectedBatch.quantityAvailable.toLocaleString()} <span className="text-xs font-normal text-gray-600">units</span>
                            </p>
                          </div>
                        </div>

                        {/* Quantity Requested for this Date */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div>
                            <label className="text-xs font-bold text-gray-700 block">
                              Quantity Requested:
                            </label>
                            <span className="text-[11px] text-gray-500">
                              Units allocated from lot {selectedBatch.expirationDate}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={dateAllocations[selectedBatch.batchTokenId] || ''}
                              onChange={(e) => {
                                const cleaned = sanitizeNumbersOnly(e.target.value);
                                handleDateAllocationChange(selectedBatch.batchTokenId, cleaned ? parseInt(cleaned, 10) : 0);
                              }}
                              placeholder="0"
                              className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold font-mono text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleMaxForDate(selectedBatch)}
                              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition cursor-pointer"
                              title="Allocate all available units from this date"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Live Allocation Summary Tracker */}
                    <div className="rounded-lg bg-white border border-gray-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-gray-700">
                          Total Quantity Requested:
                        </span>
                        <strong className="font-mono text-blue-900 font-bold text-sm">
                          {totalAllocatedFromDates.toLocaleString()} units
                        </strong>
                      </div>

                      <div>
                        {totalAllocatedFromDates > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ready for Dispatch ({Object.keys(dateAllocations).length} lot{Object.keys(dateAllocations).length > 1 ? 's' : ''} allocated)</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            Select an expiration date lot above and enter quantity
                          </span>
                        )}
                      </div>
                    </div>

                    {errors.amountRequested && (
                      <p className="text-red-500 text-xs flex items-center gap-1 font-medium mt-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.amountRequested}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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
