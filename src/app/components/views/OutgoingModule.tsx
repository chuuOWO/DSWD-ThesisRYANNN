import { useState, useMemo, useEffect } from 'react';
import { AlertCircle, Calendar, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit, Filter, Loader2, MapPin, Maximize2, Minimize2, PackageCheck, Plus, QrCode, RotateCcw, Search, ShieldCheck, TruckIcon, X } from 'lucide-react';
import { AddReleaseModal, type ReleaseForm } from '../modals/AddReleaseModal';
import { parseIncidentInfo } from '../../lib/incidentHelper';
import { QrCodeGeneratorModal } from '../modals/QrCodeGeneratorModal';
import { SuccessModal } from '../modals/SuccessModal';
import { blockchain } from '../../services/blockchain';
import { sanitizeNumbersOnly } from '../../lib/inputValidation';
import type { DiscrepancyReport, InventoryItem, OutgoingRelease, OutgoingStatus, UserRole } from '../../hooks/useInventoryState';
import type { LguRecord, ProvinceRecord, WarehouseRecord, SupplySourceRecord, KitTypeRecord, TruckRecord } from '../../services/backendApi';

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
  requestOutgoingCorrection: (drNumber: string, note: string) => void;
}

interface OutgoingModuleProps {
  inventoryState: InventoryState;
  currentRole: UserRole;
}

const statusStyles: Record<OutgoingStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Allocating: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-blue-100 text-blue-700',
  Packed: 'bg-indigo-100 text-indigo-700',
  Released: 'bg-purple-100 text-purple-700',
  'In Transit': 'bg-orange-100 text-orange-700',
  Delivered: 'bg-emerald-100 text-emerald-700',
  Accepted: 'bg-green-100 text-green-700',
  Distributed: 'bg-green-200 text-green-800',
  'Correction Requested': 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-200 text-gray-700'
};

const editableStatuses: OutgoingStatus[] = ['Draft', 'Allocating', 'Approved', 'Packed'];

type ReleaseAction = 'senderSign' | 'inTransit' | 'receiverAccept' | 'correction' | 'message';

interface ReleaseActionModalState {
  type: ReleaseAction;
  release?: OutgoingRelease;
  requestedAmount?: number;
  note?: string;
  message?: string;
  title?: string;
}

export function OutgoingModule({ inventoryState, currentRole }: OutgoingModuleProps) {
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
  const autoCloseDelayMs = 1800;

  const warehouseOptions = useMemo(() => {
    if (warehousesList.length > 0) return warehousesList.map(w => w.name);
    return ['Oton Main Warehouse', 'Pototan Main Warehouse'];
  }, [warehousesList]);

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
    const releaseDisplayCode = parseIncidentInfo(editingRelease.incidentCode).incidentCode || editingRelease.incidentCode || editingRelease.drNumber;
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
      setActionModal({ type: 'message', message: err instanceof Error ? err.message : 'Approval and minting failed.' });
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

      if (actionModal.type === 'correction') {
        if (actionModal.note) requestOutgoingCorrection(release.drNumber, actionModal.note);
        closeActionModal();
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
    const rawCode = (release.incidentCode || '').trim();
    const hasIncident = Boolean(rawCode && rawCode.toLowerCase() !== 'none');
    if (selectedIncident === 'with_incident') return hasIncident;
    if (selectedIncident === 'no_incident') return !hasIncident;
    const parsed = parseIncidentInfo(rawCode);
    const code = parsed.incidentCode || rawCode;
    return code.toLowerCase() === selectedIncident.toLowerCase();
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedWarehouse !== 'All') count++;
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
        batches
          .map((batch) => batch?.batchTokenId || batch?.batchNumber || '')
          .join(' ')
          .toLowerCase()
          .includes(searchLower);

      const matchesWarehouse =
        selectedWarehouse === 'All' || release.warehouseSource === selectedWarehouse;
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
        const codeA = parseIncidentInfo(a.incidentCode).incidentCode || a.incidentCode || a.drNumber || '';
        const codeB = parseIncidentInfo(b.incidentCode).incidentCode || b.incidentCode || b.drNumber || '';
        return codeA.localeCompare(codeB);
      }
      if (sortOrder === 'dr_desc') {
        const codeA = parseIncidentInfo(a.incidentCode).incidentCode || a.incidentCode || a.drNumber || '';
        const codeB = parseIncidentInfo(b.incidentCode).incidentCode || b.incidentCode || b.drNumber || '';
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
      <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Incident Code</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Destination</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Goods</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Release Record</th>
          <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {paginatedReleases.map((release) => (
          <tr key={release.drNumber} className="hover:bg-gray-50 transition-colors align-top">
            <td className="px-4 py-4">
              {(() => {
                const incidentInfo = parseIncidentInfo(release.incidentCode);
                const displayCode = incidentInfo.incidentCode || release.incidentCode || release.drNumber;
                return (
                  <>
                    <p className="font-bold text-sm text-green-700">{displayCode}</p>
                    <p className="text-[10px] text-gray-400 font-mono">Inv Ref: #{release.drNumber}</p>
                  </>
                );
              })()}
              <p className="text-xs text-gray-500 mt-1">Allocated: {release.dateAllocated || '-'}</p>
              <p className="text-xs text-gray-500">Mode: {release.deliveryMode || '-'}</p>
              <p className="text-xs text-gray-500">Source: {release.warehouseSource || '-'}</p>
            </td>
            <td className="px-4 py-4">
              <p className="font-bold text-sm text-gray-900">{release.lguName || 'LGU'}</p>
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-red-500" /> {release.municipality || '-'}, {release.province || '-'}
              </p>
              {release.destinationAddress && (
                <p className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5" title={release.destinationAddress}>
                  {release.destinationAddress}
                </p>
              )}
            </td>
            <td className="px-4 py-4">
              <p className="font-bold text-sm text-gray-900">{release.fnfiCategory || 'Relief Goods'}</p>
              <p className="text-sm text-gray-700">Requested: {(release.amountRequested ?? 0).toLocaleString()} kits</p>
              <p className="text-sm text-green-700 font-semibold">
                Approved: {release.amountApproved ? `${release.amountApproved.toLocaleString()} kits` : '-'}
              </p>
              {(() => {
                const incidentInfo = parseIncidentInfo(release.incidentCode);
                if (!incidentInfo.reportReason && !incidentInfo.incidentDate) return null;
                return (
                  <div className="mt-2 space-y-1 pt-1.5 border-t border-gray-100">
                    {incidentInfo.reportReason && (
                      <p className="text-xs text-gray-700 font-medium">
                        <span className="text-gray-500 font-normal">Reason:</span> {incidentInfo.reportReason}
                      </p>
                    )}
                    {incidentInfo.incidentDate && (
                      <p className="text-[11px] text-gray-500">
                        <span>Disaster Date:</span> {incidentInfo.incidentDate}
                      </p>
                    )}
                  </div>
                );
              })()}
            </td>
            <td className="px-4 py-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyles[release.deliveryStatus] || 'bg-gray-100 text-gray-700'}`}>
                {release.deliveryStatus}
              </span>
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <p>Sender GPS: {release.senderGps || '-'}</p>
                <p>Receiver GPS: {release.receiverGps || '-'}</p>
                {release.assignedTruckId && (
                  <p className="font-semibold text-purple-700 flex items-center gap-1">
                    <TruckIcon className="w-3 h-3" />
                    <span>Truck: {release.assignedTruckId}</span>
                  </p>
                )}
                {release.assignedEscortProfileId && (
                  <p className="text-[11px] text-indigo-700 font-medium">
                    <span>Escort Officer: {release.assignedEscortProfileId}</span>
                  </p>
                )}
              </div>
              {release.receiverGps && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-bold border border-emerald-200">
                  <MapPin className="w-3 h-3" /> GPS verified
                </div>
              )}
              {release.correctionNote && <p className="text-xs text-red-700 mt-2">Correction: {release.correctionNote}</p>}
            </td>
            <td className="px-4 py-4 max-w-xs">
              {Array.isArray(release.allocatedBatches) && release.allocatedBatches.length > 0 ? (
                <div className="flex flex-wrap gap-1 mb-2">
                  {release.allocatedBatches.map((batch) => (
                    <span
                      key={batch?.batchTokenId || Math.random()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-xs font-bold"
                    >
                      <span>{batch?.batchNumber || batch?.batchTokenId || 'Batch'}</span>
                      {batch?.expirationDate && (
                        <span className="text-[10px] text-blue-600 font-normal">
                          (Exp: {batch.expirationDate})
                        </span>
                      )}
                      <span className="font-mono bg-blue-200/70 text-blue-900 px-1 py-0.2 rounded text-[10px]">
                        {batch?.quantity ?? 0}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-2">No batch record assigned</p>
              )}
              <p className="text-xs text-gray-600">Release agreement: {release.handoverContractId ? 'On file' : 'Not set'}</p>
              {release.blockchainTxHash && (
                <div className="mt-1.5">
                  <a
                    href={`https://sepolia.etherscan.io/tx/${release.blockchainTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-purple-700 hover:text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 transition"
                    title="View on Sepolia Etherscan"
                  >
                    <span>Sepolia ({release.blockchainTxHash.slice(0, 6)}...{release.blockchainTxHash.slice(-4)})</span>
                  </a>
                </div>
              )}
            </td>
            <td className="px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {!['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                  <button
                    onClick={() => setQrModalRelease(release)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition shadow-xs cursor-pointer"
                    title="View & Print Delivery Receipt QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR Code
                  </button>
                )}
                {editableStatuses.includes(release.deliveryStatus) && (
                  <button
                    onClick={() => {
                      if (!editableStatuses.includes(release.deliveryStatus)) {
                        setActionModal({
                          type: 'message',
                          message: 'This release already has signed movement activity. Please file a correction record.'
                        });
                        return;
                      }
                      setEditingRelease(release);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                )}
                {['Draft', 'Allocating'].includes(release.deliveryStatus) && (
                  <>
                    <button
                      onClick={() => openApprovalModal(release)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancellingRelease(release)}
                      disabled={currentRole !== 'Admin'}
                      title={currentRole !== 'Admin' ? 'Admin privileges required to cancel release' : 'Cancel release and return allocated stock'}
                      className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg border transition ${
                        currentRole === 'Admin'
                          ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200 cursor-pointer'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </>
                )}
                {['Approved', 'Packed'].includes(release.deliveryStatus) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <QrCode className="w-3.5 h-3.5 text-amber-600" /> Awaiting Escort Scan
                  </span>
                )}
                {['In Transit', 'Delivered'].includes(release.deliveryStatus) && (
                  <button
                    onClick={() => openReleaseAction('receiverAccept', release)}
                    disabled={currentRole !== 'LGUReceiver'}
                    title={currentRole !== 'LGUReceiver' ? 'RBAC: LGUReceiver privileges required to confirm receipt.' : 'Confirm receipt with LGUReceiver account.'}
                    className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg transition ${
                      currentRole === 'LGUReceiver'
                        ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <MapPin className="w-3 h-3" /> Confirm Receipt
                  </button>
                )}
                {['Accepted', 'Distributed', 'Correction Requested'].includes(release.deliveryStatus) && (
                  <button
                    onClick={() => openReleaseAction('correction', release)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Correction
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
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

        {/* Warehouse */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Source Warehouse</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Warehouses</option>
            {warehouseOptions.map(wh => (
              <option key={wh} value={wh}>{wh}</option>
            ))}
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

        {/* Incident Code */}
        <div>
          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Disaster Incident</label>
          <select
            value={selectedIncident}
            onChange={(e) => {
              setSelectedIncident(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 font-medium"
          >
            <option value="All">All Allocations</option>
            <option value="with_incident">Any Disaster Incident</option>
            <option value="no_incident">Standard (No Disaster)</option>
            {incidentOptions.map(inc => (
              <option key={inc} value={inc}>{inc}</option>
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
            <option value="blockchain">Sepolia Blockchain Confirmed</option>
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
            <p className="text-sm text-green-100 mt-1">
              Approve stock, release goods from the warehouse, and confirm LGU receipt with location details.
            </p>
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    Full transaction ledger with blockchain receipts, GPS telemetries, and batch manifest allocations
                  </p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    value={selectedWarehouse}
                    onChange={(e) => {
                      setSelectedWarehouse(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="All">All Warehouses</option>
                    {warehouseOptions.map((wh) => (
                      <option key={wh} value={wh}>{wh}</option>
                    ))}
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
                          <p className="text-sm font-bold text-gray-900">{incCode || report.drNumber || 'Unknown Release'}</p>
                          {report.drNumber && (
                            <p className="text-[10px] text-gray-400 font-mono">Inv Ref: #{report.drNumber}</p>
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
            reportReason: editingRelease.reportReason || '',
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
                      const displayCode = incidentInfo.incidentCode || selectedRelease.incidentCode || selectedRelease.drNumber;
                      return (
                        <>
                          <p className="font-bold text-blue-600">{displayCode}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Inv Ref: #{selectedRelease.drNumber}</p>
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
                <p className="text-xs text-gray-600 mt-1">Approval mints the on-chain batch token and records the Admin cryptographic signature.</p>
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
                {isApproving ? 'Authorizing & Minting...' : 'Approve & Mint Release'}
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
                  {actionModal.type === 'senderSign' && 'Sign Warehouse Release'}
                  {actionModal.type === 'inTransit' && 'Mark as In Transit'}
                  {actionModal.type === 'receiverAccept' && 'Confirm LGU Receipt'}
                  {actionModal.type === 'correction' && 'File Correction Record'}
                </h2>
                {actionModal.release && (
                  <p className="text-sm text-gray-500 mt-1">
                    {parseIncidentInfo(actionModal.release.incidentCode).incidentCode || actionModal.release.incidentCode || actionModal.release.drNumber}
                    <span className="text-[11px] text-gray-400 ml-1.5 font-mono">(Inv Ref: #{actionModal.release.drNumber})</span> | {actionModal.release.lguName}
                  </p>
                )}
              </div>
              <button type="button" onClick={closeActionModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionModal.type === 'senderSign' && (
                <p className="text-sm text-gray-700">Confirm that this warehouse release is ready for dispatch and record the sender signature?</p>
              )}

              {actionModal.type === 'inTransit' && (
                <p className="text-sm text-gray-700">Update this release as in transit to the receiving LGU?</p>
              )}

              {actionModal.type === 'receiverAccept' && (
                <p className="text-sm text-gray-700">Confirm LGU receipt and record the receiving location details?</p>
              )}

              {actionModal.type === 'correction' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Correction Details</label>
                  <textarea
                    value={actionModal.note || ''}
                    onChange={(e) => setActionModal({ ...actionModal, note: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
                    placeholder="Describe the quantity, location, or delivery issue."
                  />
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
                disabled={isSubmittingAction}
                className="flex-1 px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  'Confirm'
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
                  {parseIncidentInfo(cancellingRelease.incidentCode).incidentCode || cancellingRelease.incidentCode || cancellingRelease.drNumber}
                </strong>{' '}
                <span className="text-xs text-gray-400 font-mono">(Inv Ref: #{cancellingRelease.drNumber})</span>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <p className="font-bold">What will happen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Allocated batch units (<span className="font-semibold">{cancellingRelease.amountRequested} {cancellingRelease.fnfiCategory || 'items'}</span>) will be restored to warehouse stock and FEFO batches.</li>
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
