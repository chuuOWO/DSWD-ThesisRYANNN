import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit, ExternalLink, Filter, Loader2, MapPin, Maximize2, Minimize2, PackageCheck, Plus, QrCode, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, TruckIcon, X } from 'lucide-react';
import { AddReleaseModal, type ReleaseForm } from '../modals/AddReleaseModal';
import { parseIncidentInfo, resolveDisasterReason, getDisasterReasonStyle, DISASTER_REPORT_REASONS } from '../../lib/incidentHelper';
import { QrCodeGeneratorModal } from '../modals/QrCodeGeneratorModal';
import { SuccessModal } from '../modals/SuccessModal';
import { OutgoingTransactionDetailModal } from '../modals/OutgoingTransactionDetailModal';
import { blockchain } from '../../services/blockchain';
import { sanitizeNumbersOnly } from '../../lib/inputValidation';
import type { DiscrepancyReport, InventoryItem, OutgoingRelease, OutgoingStatus, UserRole } from '../../hooks/useInventoryState';
import { backendApi, type LguRecord, type ProvinceRecord, type WarehouseRecord, type SupplySourceRecord, type KitTypeRecord, type TruckRecord, type EscortProfile } from '../../services/backendApi';
import { resolveEscortName, registerEscortProfiles } from '../../lib/escortHelper';
import {
  type CommodityTypeFilter,
  matchesCommodityFilter
} from '../../lib/commodityClassification';
import { useGuideMode } from '../../contexts/GuideContext';
import { formatOutgoingReference } from '../../lib/referenceCodeHelper';

interface InventoryState {
  inventory: InventoryItem[];
  outgoingReleasesList: OutgoingRelease[];
  discrepancyReports: DiscrepancyReport[];
  lgusList?: LguRecord[];
  provincesList?: ProvinceRecord[];
  warehousesList?: WarehouseRecord[];
  supplySourcesList?: SupplySourceRecord[];
  kitTypesList?: KitTypeRecord[];
  trucksList?: TruckRecord[];
  addOutgoingRelease: (data: Omit<OutgoingRelease, 'drNumber' | 'allocatedBatches' | 'auditTrail'> & { allocatedBatches?: any[] }) => void;
  updateOutgoingRelease: (drNumber: string, patch: Partial<OutgoingRelease>) => void;
  approveAllocation: (drNumber: string, amountApproved: number) => Promise<{ ok: boolean; message: string }>;
  cancelOutgoingRelease?: (drNumber: string) => Promise<{ ok: boolean; message?: string }>;
  senderSignAndRelease: (drNumber: string, actorRole?: UserRole) => Promise<{ ok: boolean; message: string }>;
  markInTransit: (drNumber: string) => void;
  receiverAcceptWithGps: (drNumber: string, actorRole?: UserRole) => Promise<{ ok: boolean; message: string }>;
  adminEmergencyBypassAccept?: (drNumber: string, reason: string) => Promise<{ ok: boolean; message: string; txHash?: string }>;
  adminActionsEnabled?: boolean;
  requestOutgoingCorrection: (drNumber: string, note: string) => void;
}

interface OutgoingModuleProps {
  inventoryState: InventoryState;
  currentRole: UserRole;
}

const statusStyles: Record<OutgoingStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border border-slate-200',
  Allocating: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
  Approved: 'bg-blue-50 text-blue-800 border border-blue-200',
  Packed: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
  Released: 'bg-purple-50 text-purple-800 border border-purple-200',
  'In Transit': 'bg-amber-50 text-amber-800 border border-amber-300',
  Delivered: 'bg-purple-50 text-purple-900 border border-purple-200 font-semibold',
  Accepted: 'bg-green-50 text-green-800 border border-green-200',
  Distributed: 'bg-teal-50 text-teal-800 border border-teal-200',
  'Correction Requested': 'bg-red-50 text-red-800 border border-red-200',
  Cancelled: 'bg-gray-100 text-gray-500 border border-gray-200 line-through'
};

const editableStatuses: OutgoingStatus[] = ['Draft', 'Allocating', 'Approved', 'Packed'];

type ReleaseAction = 'senderSign' | 'inTransit' | 'receiverAccept' | 'message' | 'adminBypass';

interface ReleaseActionModalState {
  type: ReleaseAction;
  release?: OutgoingRelease;
  requestedAmount?: number;
  note?: string;
  message?: string;
  title?: string;
}

export function OutgoingModule({ inventoryState, currentRole }: OutgoingModuleProps) {
  const { showDescriptions } = useGuideMode();
  const {
    inventory,
    outgoingReleasesList,
    discrepancyReports,
    lgusList,
    addOutgoingRelease,
    updateOutgoingRelease,
    approveAllocation,
    cancelOutgoingRelease,
    senderSignAndRelease,
    markInTransit,
    receiverAcceptWithGps,
    requestOutgoingCorrection,
    provincesList = [],
    warehousesList = [],
    supplySourcesList = [],
    kitTypesList = [],
    trucksList = []
  } = inventoryState;

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState<OutgoingRelease | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [selectedCommodityType, setSelectedCommodityType] = useState<CommodityTypeFilter>('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedProvince, setSelectedProvince] = useState('All');
  const [selectedMunicipality, setSelectedMunicipality] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState('All');
  const [selectedIncident, setSelectedIncident] = useState('All');
  const [selectedVerification, setSelectedVerification] = useState('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<
    'date_desc' | 'date_asc' | 'dr_asc' | 'dr_desc' | 'qty_desc' | 'qty_asc' | 'destination_asc'
  >('date_desc');

  // Escort Officer Profiles for displaying officer human names instead of UUIDs
  const [escortProfiles, setEscortProfiles] = useState<EscortProfile[]>([]);
  const [, setProfileVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;
    backendApi
      .getEscortProfiles()
      .then((list) => {
        if (isMounted && list && list.length > 0) {
          setEscortProfiles(list);
          registerEscortProfiles(list);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResolved = () => setProfileVersion((v) => v + 1);
    window.addEventListener('escort-profile-resolved', handleResolved);
    return () => window.removeEventListener('escort-profile-resolved', handleResolved);
  }, []);

  // Maximize & Minimize Table States
  const [isTableMaximized, setIsTableMaximized] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [normalPageSize, setNormalPageSize] = useState<number>(5);
  const [maximizedPageSize, setMaximizedPageSize] = useState<number>(15);

  // Close maximized view on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTableMaximized) {
        setIsTableMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTableMaximized]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<OutgoingRelease | null>(null);
  const [approvalAmount, setApprovalAmount] = useState(0);
  const [isApproving, setIsApproving] = useState(false);
  const [cancellingRelease, setCancellingRelease] = useState<OutgoingRelease | null>(null);
  const [isCancellingRelease, setIsCancellingRelease] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionModal, setActionModal] = useState<ReleaseActionModalState | null>(null);
  const [qrModalRelease, setQrModalRelease] = useState<OutgoingRelease | null>(null);
  const [detailRelease, setDetailRelease] = useState<OutgoingRelease | null>(null);
  const autoCloseDelayMs = 1800;

  const sourceOptions = useMemo(() => {
    const warehouses = warehousesList.length > 0 ? warehousesList.map(w => w.name) : ['Oton Main Warehouse', 'Pototan Main Warehouse'];
    const lguSources = new Set<string>();
    (outgoingReleasesList || []).forEach(r => {
      if (r.warehouseSource && !warehouses.includes(r.warehouseSource)) {
        lguSources.add(r.warehouseSource);
      }
    });
    (lgusList || []).forEach(l => {
      if (l.lguName && !warehouses.includes(l.lguName)) {
        lguSources.add(l.lguName);
      }
    });
    return {
      warehouses,
      lguSites: Array.from(lguSources).sort()
    };
  }, [warehousesList, outgoingReleasesList, lgusList]);

  const handleAddRelease = (newRelease: ReleaseForm) => {
    addOutgoingRelease({
      ...newRelease,
      deliveryStatus: newRelease.deliveryStatus,
      receiverGps: newRelease.receiverGps || undefined,
      destinationAddress: newRelease.destinationAddress || undefined,
      lguId: newRelease.lguId || undefined,
      handoverContractId: undefined,
      senderSignature: undefined,
      receiverSignature: undefined,
      senderGps: undefined,
      blockchainTxHash: undefined,
      correctionNote: undefined,
      assignedTruckId: newRelease.assignedTruckId,
      assigned_truck_id: newRelease.assignedTruckId,
      assignedEscortProfileId: newRelease.assignedEscortProfileId,
      assignedDriverProfileId: newRelease.assignedEscortProfileId,
      kitTypeId: newRelease.kitTypeId,
      sourceWarehouseId: newRelease.sourceWarehouseId,
      sourceLguId: newRelease.sourceLguId,
      destinationLguId: newRelease.destinationLguId,
      allocatedBatches: newRelease.allocatedBatches || []
    });
    setShowReleaseModal(false);
    showResult(`Release allocation for ${newRelease.municipality || 'LGU'} (${(newRelease.amountRequested ?? 0).toLocaleString()} ${newRelease.fnfiCategory}) created successfully.`);
  };

  const handleEditRelease = (updatedRelease: ReleaseForm) => {
    if (!editingRelease) return;
    updateOutgoingRelease(editingRelease.drNumber, {
      dateAllocated: updatedRelease.dateAllocated,
      lguName: updatedRelease.lguName,
      province: updatedRelease.province,
      municipality: updatedRelease.municipality,
      fnfiCategory: updatedRelease.fnfiCategory,
      amountRequested: updatedRelease.amountRequested,
      amountApproved: updatedRelease.amountApproved,
      warehouseSource: updatedRelease.warehouseSource,
      deliveryMode: updatedRelease.deliveryMode,
      deliveryStatus: updatedRelease.deliveryStatus,
      incidentCode: updatedRelease.incidentCode,
      incidentDate: updatedRelease.incidentDate,
      reportReason: updatedRelease.reportReason,
      receiverGps: updatedRelease.receiverGps,
      destinationAddress: updatedRelease.destinationAddress,
      assignedTruckId: updatedRelease.assignedTruckId,
      assigned_truck_id: updatedRelease.assignedTruckId,
      assignedEscortProfileId: updatedRelease.assignedEscortProfileId,
      assignedDriverProfileId: updatedRelease.assignedEscortProfileId,
      kitTypeId: updatedRelease.kitTypeId,
      sourceWarehouseId: updatedRelease.sourceWarehouseId,
      sourceLguId: updatedRelease.sourceLguId,
      destinationLguId: updatedRelease.destinationLguId
    });
    setEditingRelease(null);
    const releaseDisplayCode = parseIncidentInfo(editingRelease.incidentCode).incidentCode || editingRelease.incidentCode || formatOutgoingReference(editingRelease);
    showResult(`Release request ${releaseDisplayCode} updated successfully.`);
  };

  const openApprovalModal = (release: OutgoingRelease) => {
    setSelectedRelease(release);
    setApprovalAmount(release.amountApproved || release.amountRequested);
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!selectedRelease) return;
    setIsApproving(true);
    try {
      const result = await approveAllocation(selectedRelease.drNumber, approvalAmount);
      if (result.ok) {
        setShowApprovalModal(false);
        setSelectedRelease(null);
        setApprovalAmount(0);
      }
      setActionModal({ type: 'message', message: result.message });
    } catch (err) {
      setActionModal({ type: 'message', message: err instanceof Error ? err.message : 'Release authorization failed.' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmCancelRelease = async () => {
    if (!cancellingRelease || !cancelOutgoingRelease || isCancellingRelease) return;
    setIsCancellingRelease(true);
    try {
      const result = await cancelOutgoingRelease(cancellingRelease.drNumber);
      setCancellingRelease(null);
      if (!result.ok) {
        setActionModal({ type: 'message', title: 'Cancellation Failed', message: result.message || 'Failed to cancel release.' });
      } else {
        setActionModal({ type: 'message', title: 'Successful!', message: result.message || 'Release cancelled.' });
      }
    } catch (err) {
      setActionModal({ type: 'message', title: 'Cancellation Failed', message: err instanceof Error ? err.message : 'Failed to cancel release.' });
    } finally {
      setIsCancellingRelease(false);
    }
  };

  const openReleaseAction = (type: ReleaseAction, release: OutgoingRelease) => {
    setActionModal({
      type,
      release,
      requestedAmount: release.amountRequested,
      note: release.correctionNote || release.incidentCode || ''
    });
  };

  const closeActionModal = () => setActionModal(null);

  const showResult = (message: string, autoClose = false) => {
    setActionModal({ type: 'message', message });
    if (autoClose) {
      setTimeout(() => {
        setActionModal(null);
      }, autoCloseDelayMs);
    }
  };

  const handleConfirmReleaseAction = async () => {
    if (!actionModal?.release || isSubmittingAction) return;
    const release = actionModal.release;
    setIsSubmittingAction(true);

    try {
      if (actionModal.type === 'senderSign') {
        const result = await senderSignAndRelease(release.drNumber, currentRole);
        showResult(result.message.replace('handover contract opened', 'release record signed'), result.ok);
        return;
      }

      if (actionModal.type === 'inTransit') {
        markInTransit(release.drNumber);
        closeActionModal();
        return;
      }

      if (actionModal.type === 'receiverAccept') {
        const result = await receiverAcceptWithGps(release.drNumber, currentRole);
        showResult(result.message, result.ok);
        return;
      }

      if (actionModal.type === 'adminBypass') {
        if (!inventoryState.adminEmergencyBypassAccept) {
          showResult('Emergency bypass handler not configured.', false);
          return;
        }
        if (!actionModal.note || !actionModal.note.trim()) {
          showResult('Emergency authorization reason is required.', false);
          return;
        }
        const result = await inventoryState.adminEmergencyBypassAccept(release.drNumber, actionModal.note.trim());
        showResult(result.message, result.ok);
        return;
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    (outgoingReleasesList || []).forEach((r) => {
      if (r?.province && r.province.trim()) set.add(r.province.trim());
    });
    if (provincesList) {
      provincesList.forEach((p) => {
        if (p?.name && p.name.trim()) set.add(p.name.trim());
      });
    }
    return Array.from(set).sort();
  }, [outgoingReleasesList, provincesList]);

  const municipalityOptions = useMemo(() => {
    const set = new Set<string>();
    (outgoingReleasesList || []).forEach((r) => {
      if (
        selectedProvince === 'All' ||
        (r?.province || '').toLowerCase() === selectedProvince.toLowerCase()
      ) {
        if (r?.municipality && r.municipality.trim()) set.add(r.municipality.trim());
      }
    });
    if (lgusList) {
      lgusList.forEach((l) => {
        if (
          selectedProvince === 'All' ||
          (l?.province || '').toLowerCase() === selectedProvince.toLowerCase()
        ) {
          if (l?.municipality && l.municipality.trim()) set.add(l.municipality.trim());
        }
      });
    }
    return Array.from(set).sort();
  }, [outgoingReleasesList, lgusList, selectedProvince]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (outgoingReleasesList || []).forEach((r) => {
      if (r?.fnfiCategory && r.fnfiCategory.trim()) set.add(r.fnfiCategory.trim());
    });
    if (kitTypesList) {
      kitTypesList.forEach((k) => {
        if (k?.name && k.name.trim()) set.add(k.name.trim());
      });
    }
    return Array.from(set).sort();
  }, [outgoingReleasesList, kitTypesList]);

  const incidentOptions = useMemo(() => {
    const set = new Set<string>();
    (outgoingReleasesList || []).forEach((r) => {
      const raw = (r?.incidentCode || '').trim();
      if (raw && raw.toLowerCase() !== 'none') {
        const parsed = parseIncidentInfo(raw);
        set.add(parsed.incidentCode || raw);
      }
    });
    return Array.from(set).sort();
  }, [outgoingReleasesList]);

  const isWithinDateFilter = (dateStr?: string) => {
    if (dateFilter === 'all') return true;
    if (!dateStr) return false;
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return true;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (dateFilter === 'today') {
      return dateStr.slice(0, 10) === todayStr;
    }
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return targetDate >= sevenDaysAgo;
    }
    if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return targetDate >= thirtyDaysAgo;
    }
    if (dateFilter === 'custom') {
      const dayStr = dateStr.slice(0, 10);
      if (customStartDate && dayStr < customStartDate) return false;
      if (customEndDate && dayStr > customEndDate) return false;
      return true;
    }
    return true;
  };

  const matchesVerification = (release: OutgoingRelease) => {
    if (selectedVerification === 'All') return true;
    if (selectedVerification === 'blockchain') return Boolean(release.blockchainTxHash);
    if (selectedVerification === 'gps') return Boolean(release.receiverGps || release.senderGps);
    if (selectedVerification === 'pending_gps') return !release.receiverGps;
    return true;
  };

  const matchesIncident = (release: OutgoingRelease) => {
    if (selectedIncident === 'All') return true;
    const resolvedReason = resolveDisasterReason(release.incidentCode, release.reportReason);
    if (selectedIncident === 'with_incident') {
      return resolvedReason !== 'Relief Prepositioning / Augmentation';
    }
    if (selectedIncident === 'no_incident') {
      return resolvedReason === 'Relief Prepositioning / Augmentation';
    }
    const rawCode = (release.incidentCode || '').trim();
    const parsed = parseIncidentInfo(rawCode);
    const code = parsed.incidentCode || rawCode;
    return (
      resolvedReason.toLowerCase() === selectedIncident.toLowerCase() ||
      code.toLowerCase() === selectedIncident.toLowerCase()
    );
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedWarehouse !== 'All') count++;
    if (selectedCommodityType !== 'All') count++;
    if (selectedStatus !== 'All') count++;
    if (selectedProvince !== 'All') count++;
    if (selectedMunicipality !== 'All') count++;
    if (selectedCategory !== 'All') count++;
    if (selectedDeliveryMode !== 'All') count++;
    if (selectedIncident !== 'All') count++;
    if (selectedVerification !== 'All') count++;
    if (dateFilter !== 'all') count++;
    if (sortOrder !== 'date_desc') count++;
    return count;
  }, [
    searchTerm,
    selectedWarehouse,
    selectedCommodityType,
    selectedStatus,
    selectedProvince,
    selectedMunicipality,
    selectedCategory,
    selectedDeliveryMode,
    selectedIncident,
    selectedVerification,
    dateFilter,
    sortOrder
  ]);

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedWarehouse('All');
    setSelectedCommodityType('All');
    setSelectedStatus('All');
    setSelectedProvince('All');
    setSelectedMunicipality('All');
    setSelectedCategory('All');
    setSelectedDeliveryMode('All');
    setSelectedIncident('All');
    setSelectedVerification('All');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortOrder('date_desc');
    setCurrentPage(1);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const effectivePageSize = isTableMaximized ? maximizedPageSize : normalPageSize;

  const sortedAndFilteredReleases = useMemo(() => {
    const list = (outgoingReleasesList || []).filter((release) => {
      if (!release) return false;
      const batches = Array.isArray(release.allocatedBatches) ? release.allocatedBatches : [];
      const searchLower = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !searchLower ||
        (release.lguName || '').toLowerCase().includes(searchLower) ||
        (release.municipality || '').toLowerCase().includes(searchLower) ||
        (release.province || '').toLowerCase().includes(searchLower) ||
        (release.fnfiCategory || '').toLowerCase().includes(searchLower) ||
        (release.drNumber || '').toLowerCase().includes(searchLower) ||
        (release.incidentCode || '').toLowerCase().includes(searchLower) ||
        (release.handoverContractId || '').toLowerCase().includes(searchLower) ||
        (release.warehouseSource || '').toLowerCase().includes(searchLower) ||
        (release.deliveryMode || '').toLowerCase().includes(searchLower) ||
        (release.blockchainTxHash || '').toLowerCase().includes(searchLower) ||
        (release.assignedTruckId || '').toLowerCase().includes(searchLower) ||
        (release.assignedEscortProfileId || '').toLowerCase().includes(searchLower) ||
        resolveEscortName(release.assignedEscortProfileId || release.assignedDriverProfileId, escortProfiles).toLowerCase().includes(searchLower) ||
        batches
          .map((batch) => batch?.batchTokenId || batch?.batchNumber || '')
          .join(' ')
          .toLowerCase()
          .includes(searchLower);

      const matchesWarehouse =
        selectedWarehouse === 'All' || release.warehouseSource === selectedWarehouse;
      const matchesCommodity =
        selectedCommodityType === 'All' || matchesCommodityFilter(release.fnfiCategory, selectedCommodityType);
      const matchesStatus =
        selectedStatus === 'All' || release.deliveryStatus === selectedStatus;
      const matchesProv =
        selectedProvince === 'All' ||
        (release.province || '').toLowerCase() === selectedProvince.toLowerCase();
      const matchesMuni =
        selectedMunicipality === 'All' ||
        (release.municipality || '').toLowerCase() === selectedMunicipality.toLowerCase();
      const matchesCat =
        selectedCategory === 'All' ||
        (release.fnfiCategory || '').toLowerCase() === selectedCategory.toLowerCase();
      const matchesMode =
        selectedDeliveryMode === 'All' ||
        (release.deliveryMode || '').toLowerCase() === selectedDeliveryMode.toLowerCase();

      return (
        matchesSearch &&
        matchesWarehouse &&
        matchesCommodity &&
        matchesStatus &&
        matchesProv &&
        matchesMuni &&
        matchesCat &&
        matchesMode &&
        matchesIncident(release) &&
        matchesVerification(release) &&
        isWithinDateFilter(release.dateAllocated)
      );
    });

    list.sort((a, b) => {
      if (sortOrder === 'date_desc') {
        const cmp = (b.dateAllocated || '').localeCompare(a.dateAllocated || '');
        if (cmp !== 0) return cmp;
        return (b.drNumber || '').localeCompare(a.drNumber || '');
      }
      if (sortOrder === 'date_asc') {
        const cmp = (a.dateAllocated || '').localeCompare(b.dateAllocated || '');
        if (cmp !== 0) return cmp;
        return (a.drNumber || '').localeCompare(b.drNumber || '');
      }
      if (sortOrder === 'dr_asc') {
        const codeA = parseIncidentInfo(a.incidentCode).incidentCode || a.incidentCode || formatOutgoingReference(a) || '';
        const codeB = parseIncidentInfo(b.incidentCode).incidentCode || b.incidentCode || formatOutgoingReference(b) || '';
        return codeA.localeCompare(codeB);
      }
      if (sortOrder === 'dr_desc') {
        const codeA = parseIncidentInfo(a.incidentCode).incidentCode || a.incidentCode || formatOutgoingReference(a) || '';
        const codeB = parseIncidentInfo(b.incidentCode).incidentCode || b.incidentCode || formatOutgoingReference(b) || '';
        return codeB.localeCompare(codeA);
      }
      if (sortOrder === 'qty_desc') {
        const qtyA = a.amountApproved || a.amountRequested || 0;
        const qtyB = b.amountApproved || b.amountRequested || 0;
        return qtyB - qtyA;
      }
      if (sortOrder === 'qty_asc') {
        const qtyA = a.amountApproved || a.amountRequested || 0;
        const qtyB = b.amountApproved || b.amountRequested || 0;
        return qtyA - qtyB;
      }
      if (sortOrder === 'destination_asc') {
        return (a.municipality || a.lguName || '').localeCompare(b.municipality || b.lguName || '');
      }
      return 0;
    });

    return list;
  }, [
    outgoingReleasesList,
    searchTerm,
    selectedWarehouse,
    selectedStatus,
    selectedProvince,
    selectedMunicipality,
    selectedCategory,
    selectedDeliveryMode,
    selectedIncident,
    selectedVerification,
    dateFilter,
    customStartDate,
    customEndDate,
    sortOrder
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFilteredReleases.length / effectivePageSize));
  const paginatedReleases = useMemo(() => {
    const start = (currentPage - 1) * effectivePageSize;
    return sortedAndFilteredReleases.slice(start, start + effectivePageSize);
  }, [sortedAndFilteredReleases, currentPage, effectivePageSize]);

  const allocatingCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus === 'Allocating').length;
  const approvedCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus === 'Approved').length;
  const activeReleaseCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus && ['Released', 'In Transit', 'Delivered'].includes(r.deliveryStatus)).length;
  const acceptedCount = (outgoingReleasesList || []).filter(r => r?.deliveryStatus && (r.deliveryStatus === 'Accepted' || r.deliveryStatus === 'Distributed')).length;
  const outgoingDiscrepancies = (discrepancyReports || []).filter(report => report.reportType === 'Outgoing');
  const renderTableContent = () => (
    <table className="w-full min-w-[1300px]">
      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-gray-200">
        <tr>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[18%]">INC Code</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[20%]">Destination</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[16%]">Goods & Allocation</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[18%]">Delivery Status</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[16%]">Incident Reason</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-[12%]">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {paginatedReleases.map((release) => {
          const displayCode = formatOutgoingReference(release);
          const incidentInfo = parseIncidentInfo(release.incidentCode);
          const calamityReason = resolveDisasterReason(release.incidentCode, release.reportReason);
          const reasonStyle = getDisasterReasonStyle(calamityReason);
          const disasterDate = incidentInfo.incidentDate || release.incidentDate;
          const statusStyle = statusStyles[release.deliveryStatus] || 'bg-gray-100 text-gray-700 border border-gray-200';

          return (
            <tr
              key={release.drNumber}
              onClick={() => setDetailRelease(release)}
              className="hover:bg-blue-50/40 transition-colors align-top cursor-pointer border-b border-gray-100 group"
              title="Click row to inspect complete transaction details"
            >
              {/* Column 1: Incident / Outgoing Code */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-sm text-gray-900 font-mono group-hover:text-blue-900 transition-colors">
                    {displayCode}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                  <p>Allocated: <span className="text-gray-700">{release.dateAllocated || '-'}</span></p>
                  <p>Source: <span className="text-gray-700">{release.warehouseSource || '-'}</span></p>
                </div>
                <div className="mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {release.deliveryMode || 'Delivery'}
                  </span>
                </div>
              </td>

              {/* Column 2: Destination */}
              <td className="px-4 py-3.5">
                <p className="font-bold text-sm text-gray-900">{release.lguName || 'LGU'}</p>
                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{release.municipality || '-'}, {release.province || '-'}</span>
                </p>
                {release.destinationAddress && (
                  <p className="text-[11px] text-gray-400 truncate max-w-xs mt-0.5" title={release.destinationAddress}>
                    {release.destinationAddress}
                  </p>
                )}
              </td>

              {/* Column 3: Goods & Allocation */}
              <td className="px-4 py-3.5">
                <p className="font-bold text-sm text-gray-900">{release.fnfiCategory || 'Relief Goods'}</p>
                <div className="mt-1 space-y-0.5 text-xs">
                  <p className="text-gray-600">
                    Requested: <span className="font-semibold text-gray-800">{(release.amountRequested ?? 0).toLocaleString()}</span> kits
                  </p>
                  <p className="text-green-700 font-semibold">
                    Approved: {release.amountApproved ? `${release.amountApproved.toLocaleString()} kits` : 'Pending'}
                  </p>
                </div>
              </td>

              {/* Column 4: Delivery Status & Telemetry */}
              <td className="px-4 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>
                  {release.deliveryStatus === 'Delivered' ? 'Dropped Off (Pending LGU Scan)' : release.deliveryStatus}
                </span>

                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {(release.assignedEscortProfileId || release.assignedDriverProfileId) && (
                    <p
                      className="text-[11px] text-indigo-700 font-medium truncate"
                      title={resolveEscortName(release.assignedEscortProfileId || release.assignedDriverProfileId, escortProfiles)}
                    >
                      Escort: {resolveEscortName(release.assignedEscortProfileId || release.assignedDriverProfileId, escortProfiles)}
                    </p>
                  )}
                  {release.assignedTruckId && (
                    <p className="font-semibold text-purple-700 flex items-center gap-1 text-[11px]">
                      <TruckIcon className="w-3 h-3 shrink-0" />
                      <span>Truck: {release.assignedTruckId}</span>
                    </p>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {release.receiverGps ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> GPS verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 text-gray-500 px-2 py-0.5 text-[10px] font-medium border border-gray-200">
                      Pending drop-off GPS
                    </span>
                  )}
                  {release.blockchainTxHash && release.blockchainTxHash.startsWith('0x') ? (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${release.blockchainTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold border border-indigo-200 transition"
                      title={`View Sepolia transaction ${release.blockchainTxHash} on Etherscan`}
                    >
                      <ExternalLink className="w-2.5 h-2.5 text-indigo-600" />
                      <span>Sepolia Verified</span>
                    </a>
                  ) : null}
                </div>
                {release.correctionNote && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 truncate" title={release.correctionNote}>
                    Correction: {release.correctionNote}
                  </p>
                )}
              </td>

              {/* Column 5: Incident Reason */}
              <td className="px-4 py-3.5">
                <div className="space-y-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${reasonStyle}`}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span>{calamityReason}</span>
                  </span>

                  {disasterDate ? (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                      <span>Date: <strong className="text-gray-700">{disasterDate}</strong></span>
                    </p>
                  ) : null}
                </div>
              </td>

              {/* Column 6: Actions */}
              <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap gap-1.5">
                  {!['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrModalRelease(release);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition shadow-xs cursor-pointer border border-blue-200/60"
                      title="View & Print Incident Allocation QR Code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Code</span>
                    </button>
                  )}
                  {editableStatuses.includes(release.deliveryStatus) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRelease(release);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer border border-gray-200"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                  {['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openApprovalModal(release);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer shadow-xs"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancellingRelease(release);
                        }}
                        disabled={currentRole !== 'Admin'}
                        title={currentRole !== 'Admin' ? 'Admin privileges required to cancel release' : 'Cancel release and return allocated stock'}
                        className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          currentRole === 'Admin'
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </>
                  )}
                  {['Approved', 'Packed'].includes(release.deliveryStatus) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {currentRole === 'Admin' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReleaseAction('senderSign', release);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                          title="Authorize warehouse dispatch and broadcast custody handover to Ethereum Sepolia"
                        >
                          <Send className="w-3 h-3" />
                          <span>Dispatch &amp; Sign (Sepolia)</span>
                        </button>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200" title="Can also be scanned at warehouse gate by Escort">
                        <QrCode className="w-3 h-3 text-amber-600" />
                        <span>Awaiting Escort Scan</span>
                      </span>
                    </div>
                  )}
                  {['In Transit', 'Delivered'].includes(release.deliveryStatus) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReleaseAction('receiverAccept', release);
                        }}
                        disabled={currentRole !== 'LGUReceiver'}
                        title={currentRole !== 'LGUReceiver' ? 'RBAC: LGUReceiver privileges required to confirm receipt.' : 'Confirm receipt with LGUReceiver account.'}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                          currentRole === 'LGUReceiver'
                            ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Confirm</span>
                      </button>

                      {inventoryState.adminActionsEnabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReleaseAction('adminBypass', release);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-2xs"
                          title="Emergency Administrative Bypass: Confirm LGU receipt without mobile QR scan."
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>Bypass QR</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderPagination = (isMaximizedMode: boolean) => {
    if (sortedAndFilteredReleases.length === 0) return null;
    const startIdx = (currentPage - 1) * effectivePageSize + 1;
    const endIdx = Math.min(currentPage * effectivePageSize, sortedAndFilteredReleases.length);

    return (
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            Showing <span className="font-bold text-gray-900">{startIdx}</span> to{' '}
            <span className="font-bold text-gray-900">{endIdx}</span> of{' '}
            <span className="font-bold text-gray-900">{sortedAndFilteredReleases.length}</span> releases
          </div>
          <div className="flex items-center gap-1.5 pl-3 border-l border-gray-300">
            <span className="text-gray-500 font-medium">Per page:</span>
            <select
              value={effectivePageSize >= 99999 ? 'all' : effectivePageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 99999 : Number(e.target.value);
                if (isMaximizedMode) {
                  setMaximizedPageSize(val);
                } else {
                  setNormalPageSize(val);
                }
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-gray-300 rounded font-bold text-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <span className="font-bold text-gray-800 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderCompleteFilters = (isMaximizedView: boolean) => (
    <div className={`p-4 md:p-5 border-b border-gray-200 bg-gray-50/80 space-y-3 flex-shrink-0 ${isMaximizedView ? '' : 'rounded-lg mb-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-green-700" />
          <span className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
            Operational Filters & Parameters
          </span>
          <span className="text-[11px] font-bold text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
            {sortedAndFilteredReleases.length} {sortedAndFilteredReleases.length === 1 ? 'match' : 'matches'}
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Search */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Search Keywords</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Incident Code, LGU, Batch, Inv Ref, Hash..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Delivery Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Statuses</option>
            {Object.keys(statusStyles).map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Origin / Source Facility */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Source Facility / Origin</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Sources (Warehouses & LGU Sites)</option>
            <optgroup label="Regional Warehouses">
              {sourceOptions.warehouses.map((wh) => (
                <option key={wh} value={wh}>{wh}</option>
              ))}
            </optgroup>
            {sourceOptions.lguSites.length > 0 && (
              <optgroup label="LGU Preposition Sites">
                {sourceOptions.lguSites.map((site) => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Province */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Province</label>
          <select
            value={selectedProvince}
            onChange={(e) => {
              setSelectedProvince(e.target.value);
              setSelectedMunicipality('All');
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Provinces</option>
            {provinceOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Municipality */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Municipality</label>
          <select
            value={selectedMunicipality}
            onChange={(e) => {
              setSelectedMunicipality(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Municipalities</option>
            {municipalityOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Commodity Classification */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Classification Type</label>
          <select
            value={selectedCommodityType}
            onChange={(e) => {
              setSelectedCommodityType(e.target.value as CommodityTypeFilter);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Classifications</option>
            <option value="Food Items">Food Items (FFP & RTEF)</option>
            <option value="Non-Food Items">Non-Food Items (NFIs)</option>
          </select>
        </div>

        {/* Relief Goods */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Goods Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Categories</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Delivery Mode */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Delivery Mode</label>
          <select
            value={selectedDeliveryMode}
            onChange={(e) => {
              setSelectedDeliveryMode(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Modes</option>
            <option value="Delivery">Delivery (Convoy/Truck)</option>
            <option value="Pick-up">Pick-up (LGU Vehicle)</option>
          </select>
        </div>

        {/* Incident Reason */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Incident Reason</label>
          <select
            value={selectedIncident}
            onChange={(e) => {
              setSelectedIncident(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Incident Reasons</option>
            <option value="with_incident">Any Active Calamity</option>
            <option value="no_incident">Prepositioning / Non-Calamity</option>
            {DISASTER_REPORT_REASONS.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </div>

        {/* Verification Proof */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Proof / Verification</label>
          <select
            value={selectedVerification}
            onChange={(e) => {
              setSelectedVerification(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Proof Statuses</option>
            <option value="blockchain">Digital Audit Confirmed</option>
            <option value="gps">GPS Telemetry Verified</option>
            <option value="pending_gps">Pending GPS Telemetry</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Date Allocated</label>
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Sort Ledger By</label>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="date_desc">Date Allocated (Newest)</option>
            <option value="date_asc">Date Allocated (Oldest)</option>
            <option value="dr_asc">Incident Code (Ascending)</option>
            <option value="dr_desc">Incident Code (Descending)</option>
            <option value="qty_desc">Quantity (High to Low)</option>
            <option value="qty_asc">Quantity (Low to High)</option>
            <option value="destination_asc">Destination (A to Z)</option>
          </select>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      {dateFilter === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-700">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-700">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white font-medium"
            />
          </div>
          {(customStartDate || customEndDate) && (
            <button
              type="button"
              onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setCurrentPage(1); }}
              className="text-[11px] text-gray-500 hover:text-gray-800 underline cursor-pointer"
            >
              Clear Date Range
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-700 to-teal-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Outgoing Goods Release</h1>
            {showDescriptions && (
              <p className="text-sm text-green-100 mt-1">
                Approve stock, release goods from the warehouse, and confirm LGU receipt with location details.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowReleaseModal(true)}
              className="flex items-center justify-center gap-2 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              New Release Draft
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <PackageCheck className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">For Allocation</p>
              <p className="text-2xl font-bold text-yellow-600">{allocatingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <TruckIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Active Releases</p>
              <p className="text-2xl font-bold text-purple-600">{activeReleaseCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-600">Confirmed Receipts</p>
              <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Maximized Fullscreen Modal */}
      {isTableMaximized && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex flex-col p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-700 text-white flex items-center justify-center shadow-xs">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-gray-900">
                      Outgoing Relief Transactions & Release Manifests
                    </h2>
                    <span className="text-xs font-bold text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full border border-green-200">
                      {sortedAndFilteredReleases.length} {sortedAndFilteredReleases.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  {showDescriptions && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Full transaction ledger with digital audit receipts, GPS tracking, and batch manifest allocations
                    </p>
                  )}
                </div>
              </div>

              {/* Status pills */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  In Transit: {(outgoingReleasesList || []).filter(r => r.deliveryStatus === 'In Transit').length}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  Accepted: {acceptedCount}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Approved: {approvedCount}
                </span>
              </div>

              {/* Header Controls: Rows per page, Minimize View, Close */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-xl">
                  <span>Rows:</span>
                  <select
                    value={maximizedPageSize >= 99999 ? 'all' : maximizedPageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 99999 : Number(e.target.value);
                      setMaximizedPageSize(val);
                      setCurrentPage(1);
                    }}
                    className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTableMaximized(false)}
                  className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                  title="Minimize to normal view (Esc)"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Minimize View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsTableMaximized(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Complete Filters Panel */}
            {renderCompleteFilters(true)}

            {/* Table Area (Full Viewport Height) */}
            <div className="flex-1 overflow-auto bg-white">
              {sortedAndFilteredReleases.length === 0 ? (
                <div className="text-center py-16">
                  <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-bold">No outgoing releases match your filter criteria</p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="mt-3 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-bold text-xs rounded-lg transition inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset All Filters
                  </button>
                </div>
              ) : (
                renderTableContent()
              )}
            </div>

            {/* Footer */}
            {renderPagination(true)}
          </div>
        </div>
      )}

      {/* 2. Embedded Normal View Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Card Header with Maximize & Minimize/Collapse buttons */}
        <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-green-700" />
            <h3 className="font-bold text-gray-900 text-sm">Outgoing Relief Transactions</h3>
            <span className="text-[11px] font-bold text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full border border-green-200">
              {sortedAndFilteredReleases.length} {sortedAndFilteredReleases.length === 1 ? 'record' : 'records'}
            </span>
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                {activeFilterCount} active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFilterExpanded((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isFilterExpanded || activeFilterCount > 0
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title="Toggle complete filter panel"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-green-700 text-white text-[9px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsTableMaximized(true)}
              className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Maximize table to full screen with complete filters"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Maximize View</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTableCollapsed((prev) => !prev)}
              className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
              title={isTableCollapsed ? 'Expand table' : 'Minimize / Collapse table'}
            >
              {isTableCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* If Not Collapsed, render body */}
        {!isTableCollapsed && (
          <>
            {/* If filters expanded in normal mode */}
            {isFilterExpanded && renderCompleteFilters(false)}

            {/* If filters not expanded, show the 3 quick filters */}
            {!isFilterExpanded && (
              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search Incident Code, LGU, batch record, Inv Ref..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <select
                    value={selectedCommodityType}
                    onChange={(e) => {
                      setSelectedCommodityType(e.target.value as CommodityTypeFilter);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="All">All Classifications</option>
                    <option value="Food Items">Food Items (FFP & RTEF)</option>
                    <option value="Non-Food Items">Non-Food Items (NFIs)</option>
                  </select>

                  <select
                    value={selectedWarehouse}
                    onChange={(e) => {
                      setSelectedWarehouse(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="All">All Sources (Warehouses & LGU Sites)</option>
                    <optgroup label="Regional Warehouses">
                      {sourceOptions.warehouses.map((wh) => (
                        <option key={wh} value={wh}>{wh}</option>
                      ))}
                    </optgroup>
                    {sourceOptions.lguSites.length > 0 && (
                      <optgroup label="LGU Preposition Sites">
                        {sourceOptions.lguSites.map((site) => (
                          <option key={site} value={site}>{site}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="All">All Statuses</option>
                    {Object.keys(statusStyles).map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Scrollable table container */}
            <div className="max-h-[400px] overflow-auto">
              {sortedAndFilteredReleases.length === 0 ? (
                <div className="text-center py-12">
                  <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No outgoing releases found</p>
                </div>
              ) : (
                renderTableContent()
              )}
            </div>

            {/* Pagination footer */}
            {renderPagination(false)}
          </>
        )}
      </div>

      <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-3">Available Warehouse Stock Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(inventory || []).map(item => (
            <div key={item.category} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="font-bold text-sm text-gray-900">{item.category}</p>
              <p className="text-xs text-gray-600 mt-1">Oton: {(item.warehouseA ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-600">Pototan: {(item.warehouseB ?? 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Outgoing Discrepancy Reports</h3>
            <p className="text-sm text-gray-600">LGU-reported issues on release quantities or deliveries.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
            {outgoingDiscrepancies.length} total
          </span>
        </div>
        <div className="p-6">
          {outgoingDiscrepancies.length > 0 ? (
            <div className="space-y-3">
              {outgoingDiscrepancies.slice(0, 5).map(report => (
                <div key={report.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="min-w-0">
                    {(() => {
                      const rel = outgoingReleasesList.find(r => r.drNumber === report.drNumber);
                      const incInfo = rel ? parseIncidentInfo(rel.incidentCode) : null;
                      const incCode = incInfo?.incidentCode || rel?.incidentCode;
                      return (
                        <>
                          <p className="text-sm font-bold text-gray-900">{incCode || formatOutgoingReference(rel || report.drNumber)}</p>
                          {report.drNumber && (
                            <p className="text-[10px] text-gray-400 font-mono">Inv Ref: #{formatOutgoingReference(rel || report.drNumber)}</p>
                          )}
                        </>
                      );
                    })()}
                    <p className="text-xs text-gray-600 mt-1">{report.note}</p>
                    <p className="text-[11px] text-gray-500 mt-2">Reported {report.reportedAt}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                    Outgoing
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-sm font-bold text-green-900">No discrepancy reports yet</p>
              <p className="text-xs text-green-700 mt-1">Outgoing mismatches will appear here once filed.</p>
            </div>
          )}
        </div>
      </div>

      {showReleaseModal && (
        <AddReleaseModal
          onClose={() => setShowReleaseModal(false)}
          onSubmit={handleAddRelease}
          availableStock={inventory}
          lgusList={lgusList}
          provincesList={provincesList}
          warehousesList={warehousesList}
          supplySourcesList={supplySourcesList}
          kitTypesList={kitTypesList}
          trucksList={trucksList}
          escortProfilesList={escortProfiles}
          mode="add"
        />
      )}

      {editingRelease && (
        <AddReleaseModal
          onClose={() => setEditingRelease(null)}
          onSubmit={handleEditRelease}
          availableStock={inventory}
          lgusList={lgusList}
          provincesList={provincesList}
          warehousesList={warehousesList}
          supplySourcesList={supplySourcesList}
          kitTypesList={kitTypesList}
          trucksList={trucksList}
          escortProfilesList={escortProfiles}
          mode="edit"
          initialData={{
            dateAllocated: editingRelease.dateAllocated,
            lguId: editingRelease.lguId,
            lguName: editingRelease.lguName,
            province: editingRelease.province,
            municipality: editingRelease.municipality,
            fnfiCategory: editingRelease.fnfiCategory,
            amountRequested: editingRelease.amountRequested,
            amountApproved: editingRelease.amountApproved,
            sourceType: (warehousesList.some(w => (w?.name || '').toLowerCase() === (editingRelease.warehouseSource || '').toLowerCase()) || ['Oton Main Warehouse', 'Pototan Main Warehouse'].includes(editingRelease.warehouseSource || '')) ? 'Warehouse' : 'LGU',
            warehouseSource: editingRelease.warehouseSource,
            deliveryMode: editingRelease.deliveryMode,
            deliveryStatus: editingRelease.deliveryStatus,
            incidentCode: editingRelease.incidentCode,
            incidentDate: editingRelease.incidentDate || '',
            reportReason: editingRelease.reportReason || resolveDisasterReason(editingRelease.incidentCode, editingRelease.reportReason),
            receiverGps: editingRelease.receiverGps,
            destinationAddress: editingRelease.destinationAddress,
            assignedTruckId: editingRelease.assignedTruckId || editingRelease.assigned_truck_id,
            assignedEscortProfileId: editingRelease.assignedEscortProfileId || editingRelease.assignedDriverProfileId
          }}
        />
      )}

      {showApprovalModal && selectedRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Approve Allocation</h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Incident Code:</span>
                    {(() => {
                      const incidentInfo = parseIncidentInfo(selectedRelease.incidentCode);
                      const displayCode = incidentInfo.incidentCode || selectedRelease.incidentCode || formatOutgoingReference(selectedRelease);
                      return (
                        <>
                          <p className="font-bold text-blue-600">{displayCode}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Inv Ref: #{formatOutgoingReference(selectedRelease)}</p>
                        </>
                      );
                    })()}
                  </div>
                  <div><span className="text-gray-600">LGU:</span><p className="font-bold text-gray-900">{selectedRelease.lguName}</p></div>
                  <div><span className="text-gray-600">Category:</span><p className="font-bold text-gray-900">{selectedRelease.fnfiCategory}</p></div>
                  <div><span className="text-gray-600">Warehouse:</span><p className="font-bold text-gray-900">{selectedRelease.warehouseSource}</p></div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Quantity Requested</label>
                <div className="px-4 py-3 bg-gray-100 rounded-lg">
                  <span className="text-lg font-bold text-gray-900">{(selectedRelease.amountRequested ?? 0).toLocaleString()} kits</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Quantity to Approve <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={approvalAmount || ''}
                  onChange={(e) => {
                    const c = sanitizeNumbersOnly(e.target.value);
                    const n = c ? parseInt(c, 10) : 0;
                    setApprovalAmount(selectedRelease ? Math.min(n, selectedRelease.amountRequested) : n);
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                />
                <p className="text-xs text-gray-600 mt-1">Approval confirms the digital release authorization and records the Admin verification.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRelease(null);
                  setApprovalAmount(0);
                }}
                disabled={isApproving}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="flex-1 px-6 py-3 bg-[#2500ba] text-white font-semibold rounded-lg hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isApproving ? 'Authorizing Release...' : 'Authorize Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionModal?.type === 'message' && (
        <SuccessModal
          isOpen={true}
          onClose={closeActionModal}
          message={actionModal.message}
          title={actionModal.title || 'Successful!'}
          buttonText="Done"
        />
      )}

      {actionModal && actionModal.type !== 'message' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {actionModal.type === 'senderSign' && 'Dispatch & Sign on Ethereum Sepolia'}
                  {actionModal.type === 'inTransit' && 'Mark as In Transit'}
                  {actionModal.type === 'receiverAccept' && 'Confirm LGU Receipt'}
                  {actionModal.type === 'adminBypass' && 'Emergency Administrative Bypass'}
                </h2>
                {actionModal.release && (
                  <p className="text-sm text-gray-500 mt-1">
                    {parseIncidentInfo(actionModal.release.incidentCode).incidentCode || actionModal.release.incidentCode || formatOutgoingReference(actionModal.release)}
                    <span className="text-[11px] text-gray-400 ml-1.5 font-mono">(Inv Ref: #{formatOutgoingReference(actionModal.release)})</span> | {actionModal.release.lguName}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionModal.type === 'senderSign' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    Authorize dispatch and record cryptographic custody handover on the <strong>Ethereum Sepolia Testnet</strong>?
                  </p>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Blockchain Custody Handover (ERC-1155)
                    </p>
                    <p className="text-blue-700 leading-relaxed">
                      This action signs the handover contract with origin warehouse GPS coordinates and broadcasts the release transaction to Ethereum Sepolia. The status will immediately advance to <strong>In Transit</strong>.
                    </p>
                  </div>
                </div>
              )}

              {actionModal.type === 'inTransit' && (
                <p className="text-sm text-gray-700">Update this release as in transit to the receiving LGU?</p>
              )}

              {actionModal.type === 'receiverAccept' && (
                <p className="text-sm text-gray-700">Confirm LGU receipt and record the receiving location details?</p>
              )}

              {actionModal.type === 'adminBypass' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Administrative Override Protocol</p>
                      <p className="mt-0.5 text-amber-800 leading-relaxed">
                        This action bypasses the mandatory recipient physical QR scan. Goods will be directly finalized as Accepted in the inventory ledger. Reserved for power outages, disaster site network collapse, or emergency handovers.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Emergency Authorization Reason / Incident Note <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={actionModal.note || ''}
                      onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-24 font-sans text-gray-900 placeholder-gray-400"
                      placeholder="e.g. Total cellular communication outage in Tubungan; manual paper signed RIS received from CDRRMO officer."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={closeActionModal}
                className="flex-1 px-5 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReleaseAction}
                disabled={isSubmittingAction || (actionModal.type === 'adminBypass' && !actionModal.note?.trim())}
                className={`flex-1 px-5 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer ${
                  actionModal.type === 'adminBypass'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  actionModal.type === 'adminBypass'
                    ? 'Confirm Emergency Bypass'
                    : actionModal.type === 'senderSign'
                    ? 'Sign & Dispatch (Sepolia)'
                    : 'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancellingRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-bold text-gray-900">Cancel Outgoing Release</h2>
              </div>
              <button
                type="button"
                onClick={() => setCancellingRelease(null)}
                disabled={isCancellingRelease}
                className="p-2 rounded-lg hover:bg-red-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700">
                Are you sure you want to cancel outgoing release{' '}
                <strong className="font-semibold text-gray-900">
                  {parseIncidentInfo(cancellingRelease.incidentCode).incidentCode || cancellingRelease.incidentCode || formatOutgoingReference(cancellingRelease)}
                </strong>{' '}
                <span className="text-xs text-gray-400 font-mono">(Inv Ref: #{formatOutgoingReference(cancellingRelease)})</span>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <p className="font-bold">What will happen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Allocated batch units (<span className="font-semibold">{cancellingRelease.amountRequested} {cancellingRelease.fnfiCategory || 'items'}</span>) will be restored to warehouse stock and batch inventory.</li>
                  <li>The release status will be changed to <span className="font-semibold text-red-800">Cancelled</span>.</li>
                  <li>Stock allocation records for this release will be removed.</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setCancellingRelease(null)}
                disabled={isCancellingRelease}
                className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Release
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelRelease}
                disabled={isCancellingRelease}
                className="flex-1 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isCancellingRelease ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailRelease && (
        <OutgoingTransactionDetailModal
          isOpen={Boolean(detailRelease)}
          release={detailRelease}
          onClose={() => setDetailRelease(null)}
          onOpenQr={(rel) => setQrModalRelease(rel)}
          onEdit={(rel) => setEditingRelease(rel)}
          onApprove={(rel) => openApprovalModal(rel)}
          onCancel={(rel) => setCancellingRelease(rel)}
          onEmergencyBypass={(rel) => openReleaseAction('adminBypass', rel)}
          adminActionsEnabled={inventoryState.adminActionsEnabled}
          currentRole={currentRole}
          escortProfiles={escortProfiles}
        />
      )}

      {qrModalRelease && (
        <QrCodeGeneratorModal
          releases={outgoingReleasesList}
          initialRelease={qrModalRelease}
          onClose={() => setQrModalRelease(null)}
        />
      )}
    </div>
  );
}
