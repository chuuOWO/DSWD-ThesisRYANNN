import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  User,
  Wallet,
  Database,
  X,
  Camera,
  Upload,
  Trash2,
  Check,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Plus,
  Boxes,
  Building2,
  Warehouse,
  MapPin,
  RefreshCw,
  LogOut,
  Map,
  Search,
  Filter,
  ShieldAlert,
  Archive,
  RotateCcw,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Mail
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, type UserProfile } from '../../services/authApi';
import { blockchain } from '../../services/blockchain';
import { EmergencyStockCorrectionModal } from './EmergencyStockCorrectionModal';
import {
  backendApi,
  type LguRecord,
  type ProvinceRecord,
  type WarehouseRecord,
  type SupplySourceRecord,
  type KitTypeRecord
} from '../../services/backendApi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialTab?: 'profile' | 'security' | 'wallet' | 'data' | 'admin';
  onSignOut?: () => void;
  adminActionsEnabled?: boolean;
  onToggleAdminActions?: (enabled: boolean) => void;
  onMasterDataChanged?: () => void;
}

type SettingsTab = 'profile' | 'security' | 'wallet' | 'data' | 'admin';
type MasterDataSubTab = 'kits' | 'sources' | 'warehouses' | 'provinces' | 'lgus';

export function SettingsModal({
  isOpen,
  onClose,
  profile,
  initialTab = 'profile',
  onSignOut,
  adminActionsEnabled: adminActionsEnabledProp,
  onToggleAdminActions,
  onMasterDataChanged
}: SettingsModalProps) {
  const { refreshProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Administrative Actions State
  const [internalAdminActions, setInternalAdminActions] = useState<boolean>(() => {
    if (typeof adminActionsEnabledProp === 'boolean') return adminActionsEnabledProp;
    if (typeof window !== 'undefined') return localStorage.getItem('dswd_admin_actions_enabled') === 'true';
    return false;
  });

  useEffect(() => {
    if (typeof adminActionsEnabledProp === 'boolean') {
      setInternalAdminActions(adminActionsEnabledProp);
    }
  }, [adminActionsEnabledProp]);

  const effectiveAdminActionsEnabled = typeof adminActionsEnabledProp === 'boolean'
    ? adminActionsEnabledProp
    : internalAdminActions;

  const handleToggleAdminActions = (enabled: boolean) => {
    setInternalAdminActions(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dswd_admin_actions_enabled', String(enabled));
      window.dispatchEvent(new CustomEvent('dswd_admin_actions_changed', { detail: { enabled } }));
    }
    if (onToggleAdminActions) {
      onToggleAdminActions(enabled);
    }
  };

  // Tab 1: Profile States
  const [firstName, setFirstName] = useState(profile.firstName || profile.fullName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
  const [jobPosition, setJobPosition] = useState(profile.jobPosition || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl || null);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab 2: Smart Account States
  const [activeWallet, setActiveWallet] = useState<string | null>(profile.walletAddress || null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Security Tab States
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [copiedEmail, setCopiedEmail] = useState(false);

  // Tab 3: Master Data States (100% Supabase DB-driven via backendApi)
  const [dataSubTab, setDataSubTab] = useState<MasterDataSubTab>('kits');
  const [kitTypes, setKitTypes] = useState<KitTypeRecord[]>([]);
  const [sources, setSources] = useState<SupplySourceRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [dbLgus, setDbLgus] = useState<LguRecord[]>([]);
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(false);
  const [isMutatingMasterData, setIsMutatingMasterData] = useState(false);
  const [masterDataFeedback, setMasterDataFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Multi-select states for deletion in Master Data
  const [selectedKitIds, setSelectedKitIds] = useState<string[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  const [selectedProvinceIds, setSelectedProvinceIds] = useState<string[]>([]);
  const [selectedLguIds, setSelectedLguIds] = useState<string[]>([]);

  // LGU Filters
  const [lguProvinceFilter, setLguProvinceFilter] = useState('All');
  const [lguSearchQuery, setLguSearchQuery] = useState('');
  const [provinceStatusFilter, setProvinceStatusFilter] = useState<'active' | 'archived'>('active');
  const [lguStatusFilter, setLguStatusFilter] = useState<'active' | 'archived'>('active');

  // Add Item states
  const [isAddingKit, setIsAddingKit] = useState(false);
  const [newKit, setNewKit] = useState<{ name: string; category: 'Food Item' | 'Non-Food Item'; unitType: string; description: string }>({
    name: '',
    category: 'Food Item',
    unitType: 'packs',
    description: ''
  });

  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSource, setNewSource] = useState<{ name: string; shortCode: string; facilityType: string; region: string; location: string }>({
    name: '',
    shortCode: '',
    facilityType: 'Regional Logistics Hub',
    region: 'Region VI (Western Visayas)',
    location: ''
  });

  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState<{ name: string; province: string; municipality: string; capacityPacks: number; latitude: number; longitude: number }>({
    name: '',
    province: '',
    municipality: '',
    capacityPacks: 50000,
    latitude: 10.7,
    longitude: 122.5
  });

  const [isAddingProvince, setIsAddingProvince] = useState(false);
  const [newProvince, setNewProvince] = useState<{ name: string; region: string }>({
    name: '',
    region: 'Region VI (Western Visayas)'
  });

  const [isAddingLgu, setIsAddingLgu] = useState(false);
  const [isEmergencyCorrectionOpen, setIsEmergencyCorrectionOpen] = useState(false);
  const [emergencyCorrectionLguId, setEmergencyCorrectionLguId] = useState<string | undefined>(undefined);
  const [newLgu, setNewLgu] = useState<{ municipality: string; province: string; lguName: string; contactPerson: string; contactNumber: string; latitude: number; longitude: number }>({
    municipality: '',
    province: '',
    lguName: '',
    contactPerson: '',
    contactNumber: '',
    latitude: 10.7,
    longitude: 122.5
  });

  // Camera & File upload refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    // Only initialize activeTab and clear temporary fields when modal transitions from closed to open
    if (isOpen && !wasOpenRef.current) {
      setActiveTab(initialTab);
      setFirstName(profile.firstName || profile.fullName?.split(' ')[0] || '');
      setLastName(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
      setJobPosition(profile.jobPosition || '');
      setPhoneNumber(profile.phoneNumber || '');
      setAvatarUrl(profile.avatarUrl || null);
      setActiveWallet(profile.walletAddress || null);
      setProfileFeedback(null);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordFeedback(null);
      setCopiedEmail(false);
    } else if (!isOpen) {
      setPasswordFeedback(null);
      setProfileFeedback(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialTab]);

  // Load all master data records from Supabase
  const loadMasterData = async () => {
    setIsLoadingMasterData(true);
    setMasterDataFeedback(null);
    try {
      const [kitsData, sourcesData, warehousesData, provincesData, lgusData] = await Promise.all([
        backendApi.getKitTypes(),
        backendApi.getSupplySources(),
        backendApi.getWarehouses(),
        backendApi.getProvinces(true),
        backendApi.getLgus(undefined, true)
      ]);
      setKitTypes(kitsData);
      setSources(sourcesData);
      setWarehouses(warehousesData);
      setProvinces(provincesData);
      setDbLgus(lgusData);
      if (provincesData.length > 0) {
        setNewWarehouse(prev => ({ ...prev, province: prev.province || provincesData[0].name }));
        setNewLgu(prev => ({ ...prev, province: prev.province || provincesData[0].name }));
      }
    } catch (err) {
      console.error('Failed to load master data in settings:', err);
      setMasterDataFeedback({ type: 'error', text: 'Failed to load master data from database.' });
    } finally {
      setIsLoadingMasterData(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'data') {
      void loadMasterData();
    }
  }, [isOpen, activeTab]);

  // Sync active smart account on mount or tab change
  useEffect(() => {
    if (isOpen && activeTab === 'wallet') {
      blockchain.getConnectedWalletAddress().then(addr => {
        if (addr) setActiveWallet(addr);
      });
    }
  }, [isOpen, activeTab]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (facing: 'user' | 'environment') => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraFacing(facing);
      setIsCameraActive(true);
    } catch {
      setProfileFeedback({ type: 'error', text: 'Camera access denied or unavailable.' });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - minDim) / 2;
      const sy = (video.videoHeight - minDim) / 2;
      ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setAvatarUrl(dataUrl);
      setProfileFeedback({ type: 'success', text: 'Photo captured. Click Save Profile to apply.' });
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPhotoMenuOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ type: 'error', text: 'Please select an image file (PNG, JPG, WebP).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 300, 300);
          setAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
          setProfileFeedback({ type: 'success', text: 'Image loaded. Click Save Profile to apply.' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const compiledFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!compiledFullName) {
      setProfileFeedback({ type: 'error', text: 'First and last name cannot be empty.' });
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);
    try {
      await authApi.updateProfile(profile.id, {
        fullName: compiledFullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobPosition: jobPosition.trim(),
        phoneNumber: phoneNumber.trim(),
        avatarUrl: avatarUrl || undefined
      });
      await refreshProfile();
      setProfileFeedback({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile.' });
    } finally {
      setIsSavingProfile(false);
    }
  };


  const copyAddressToClipboard = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!oldPassword) {
      setPasswordFeedback({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordFeedback({ type: 'error', text: 'New password must be different from current password.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', text: 'New passwords do not match. Please verify your confirmation.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePasswordWithVerification(profile.email, oldPassword, newPassword);
      setPasswordFeedback({ type: 'success', text: 'Administrator password updated successfully.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // =================================================================
  // MASTER DATA CRUD HANDLERS (100% Supabase DB-driven via backendApi)
  // =================================================================

  // --- KIT TYPES ---
  const handleAddKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKit.name.trim()) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.createKitType({
        name: newKit.name.trim(),
        category: newKit.category,
        unitType: newKit.unitType.trim() || 'packs',
        description: newKit.description.trim()
      });
      const updated = await backendApi.getKitTypes();
      setKitTypes(updated);
      setNewKit({ name: '', category: 'Food Item', unitType: 'packs', description: '' });
      setIsAddingKit(false);
      setMasterDataFeedback({ type: 'success', text: 'Kit type created successfully.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create kit type.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSingleKit = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteKitType(id);
      setKitTypes(prev => prev.filter(k => k.id !== id));
      setSelectedKitIds(prev => prev.filter(kId => kId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Kit type deleted.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete kit type.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSelectedKits = async () => {
    if (selectedKitIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteKitTypesBatch(selectedKitIds);
      setKitTypes(prev => prev.filter(k => !selectedKitIds.includes(k.id)));
      setSelectedKitIds([]);
      setMasterDataFeedback({ type: 'success', text: `Deleted ${selectedKitIds.length} kit type(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch delete kit types.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleToggleSelectKit = (id: string) => {
    setSelectedKitIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  };

  const handleToggleSelectAllKits = () => {
    if (selectedKitIds.length === kitTypes.length) {
      setSelectedKitIds([]);
    } else {
      setSelectedKitIds(kitTypes.map(k => k.id));
    }
  };

  // --- SUPPLY SOURCES ---
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name.trim()) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.createSupplySource({
        name: newSource.name.trim(),
        shortCode: newSource.shortCode.trim() || newSource.name.trim().slice(0, 8).toUpperCase(),
        facilityType: newSource.facilityType,
        region: newSource.region.trim(),
        location: newSource.location.trim()
      });
      const updated = await backendApi.getSupplySources();
      setSources(updated);
      setNewSource({ name: '', shortCode: '', facilityType: 'Regional Logistics Hub', region: 'Region VI (Western Visayas)', location: '' });
      setIsAddingSource(false);
      setMasterDataFeedback({ type: 'success', text: 'Supply source created successfully.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create supply source.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSingleSource = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteSupplySource(id);
      setSources(prev => prev.filter(s => s.id !== id));
      setSelectedSourceIds(prev => prev.filter(sId => sId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Supply source deleted.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete supply source.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSelectedSources = async () => {
    if (selectedSourceIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteSupplySourcesBatch(selectedSourceIds);
      setSources(prev => prev.filter(s => !selectedSourceIds.includes(s.id)));
      setSelectedSourceIds([]);
      setMasterDataFeedback({ type: 'success', text: `Deleted ${selectedSourceIds.length} source(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch delete sources.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleToggleSelectSource = (id: string) => {
    setSelectedSourceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleToggleSelectAllSources = () => {
    if (selectedSourceIds.length === sources.length) {
      setSelectedSourceIds([]);
    } else {
      setSelectedSourceIds(sources.map(s => s.id));
    }
  };

  // --- WAREHOUSES ---
  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarehouse.name.trim()) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.createWarehouse({
        name: newWarehouse.name.trim(),
        province: newWarehouse.province.trim() || (provinces[0]?.name ?? 'Iloilo'),
        municipality: newWarehouse.municipality.trim() || 'Regional',
        capacityPacks: Number(newWarehouse.capacityPacks) || 50000,
        latitude: Number(newWarehouse.latitude) || 10.7,
        longitude: Number(newWarehouse.longitude) || 122.5
      });
      const updated = await backendApi.getWarehouses();
      setWarehouses(updated);
      setNewWarehouse({
        name: '',
        province: provinces[0]?.name ?? 'Iloilo',
        municipality: '',
        capacityPacks: 50000,
        latitude: 10.7,
        longitude: 122.5
      });
      setIsAddingWarehouse(false);
      setMasterDataFeedback({ type: 'success', text: 'Warehouse created successfully.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create warehouse.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSingleWarehouse = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteWarehouse(id);
      setWarehouses(prev => prev.filter(w => w.id !== id));
      setSelectedWarehouseIds(prev => prev.filter(wId => wId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Warehouse deleted.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete warehouse.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleDeleteSelectedWarehouses = async () => {
    if (selectedWarehouseIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteWarehousesBatch(selectedWarehouseIds);
      setWarehouses(prev => prev.filter(w => !selectedWarehouseIds.includes(w.id)));
      setSelectedWarehouseIds([]);
      setMasterDataFeedback({ type: 'success', text: `Deleted ${selectedWarehouseIds.length} warehouse(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch delete warehouses.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleToggleSelectWarehouse = (id: string) => {
    setSelectedWarehouseIds(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const handleToggleSelectAllWarehouses = () => {
    if (selectedWarehouseIds.length === warehouses.length) {
      setSelectedWarehouseIds([]);
    } else {
      setSelectedWarehouseIds(warehouses.map(w => w.id));
    }
  };

  // --- PROVINCES ---
  const filteredProvinces = useMemo(() => {
    return provinces.filter(p => {
      if (provinceStatusFilter === 'active') return p.isActive !== false;
      return p.isActive === false;
    });
  }, [provinces, provinceStatusFilter]);

  const handleAddProvince = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvince.name.trim()) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.createProvince(newProvince.name.trim(), newProvince.region.trim());
      const updated = await backendApi.getProvinces(true);
      setProvinces(updated);
      setNewProvince({ name: '', region: 'Region VI (Western Visayas)' });
      setIsAddingProvince(false);
      setMasterDataFeedback({ type: 'success', text: 'Province created successfully.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create province.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleArchiveSingleProvince = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      const prov = provinces.find(p => p.id === id);
      await backendApi.deleteProvince(id);
      await backendApi.logActivity({
        action: 'ARCHIVE_PROVINCE',
        entityType: 'province',
        entityId: id,
        details: `Archived province ${prov?.name || id}`
      });
      const updated = await backendApi.getProvinces(true);
      setProvinces(updated);
      setSelectedProvinceIds(prev => prev.filter(pId => pId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Province archived.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to archive province.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleRestoreSingleProvince = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      const prov = provinces.find(p => p.id === id);
      await backendApi.restoreProvince(id);
      await backendApi.logActivity({
        action: 'RESTORE_PROVINCE',
        entityType: 'province',
        entityId: id,
        details: `Restored province ${prov?.name || id}`
      });
      const updated = await backendApi.getProvinces(true);
      setProvinces(updated);
      setSelectedProvinceIds(prev => prev.filter(pId => pId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Province restored to active status.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to restore province.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleArchiveSelectedProvinces = async () => {
    if (selectedProvinceIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteProvincesBatch(selectedProvinceIds);
      const updated = await backendApi.getProvinces(true);
      setProvinces(updated);
      setSelectedProvinceIds([]);
      setMasterDataFeedback({ type: 'success', text: `Archived ${selectedProvinceIds.length} province(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch archive provinces.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleRestoreSelectedProvinces = async () => {
    if (selectedProvinceIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.restoreProvincesBatch(selectedProvinceIds);
      const updated = await backendApi.getProvinces(true);
      setProvinces(updated);
      setSelectedProvinceIds([]);
      setMasterDataFeedback({ type: 'success', text: `Restored ${selectedProvinceIds.length} province(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch restore provinces.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleToggleSelectProvince = (id: string) => {
    setSelectedProvinceIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleToggleSelectAllProvinces = () => {
    const ids = filteredProvinces.map(p => p.id);
    if (selectedProvinceIds.length === ids.length) {
      setSelectedProvinceIds([]);
    } else {
      setSelectedProvinceIds(ids);
    }
  };

  // --- MUNICIPALITIES / LGUS ---
  const filteredLgus = useMemo(() => {
    return dbLgus.filter(lgu => {
      const matchStatus = lguStatusFilter === 'active' ? (lgu.isActive !== false) : (lgu.isActive === false);
      if (!matchStatus) return false;
      const matchProv = lguProvinceFilter === 'All' || lgu.province.toLowerCase() === lguProvinceFilter.toLowerCase();
      const matchSearch = !lguSearchQuery.trim() ||
        lgu.municipality.toLowerCase().includes(lguSearchQuery.trim().toLowerCase()) ||
        lgu.province.toLowerCase().includes(lguSearchQuery.trim().toLowerCase()) ||
        lgu.lguName.toLowerCase().includes(lguSearchQuery.trim().toLowerCase());
      return matchProv && matchSearch;
    });
  }, [dbLgus, lguProvinceFilter, lguSearchQuery, lguStatusFilter]);

  const handleAddLgu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLgu.municipality.trim()) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.createLgu({
        municipality: newLgu.municipality.trim(),
        province: newLgu.province.trim() || (provinces[0]?.name ?? 'Iloilo'),
        lguName: newLgu.lguName.trim() || `${newLgu.municipality.trim()} Municipal Hall`,
        contactPerson: newLgu.contactPerson.trim(),
        contactNumber: newLgu.contactNumber.trim(),
        latitude: Number(newLgu.latitude) || 10.7,
        longitude: Number(newLgu.longitude) || 122.5
      });
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      setNewLgu({
        municipality: '',
        province: provinces[0]?.name ?? 'Iloilo',
        lguName: '',
        contactPerson: '',
        contactNumber: '',
        latitude: 10.7,
        longitude: 122.5
      });
      setIsAddingLgu(false);
      setMasterDataFeedback({ type: 'success', text: 'Municipality / LGU added successfully.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add LGU.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleArchiveSingleLgu = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      const lgu = dbLgus.find(l => l.id === id);
      await backendApi.deleteLgu(id);
      await backendApi.logActivity({
        action: 'ARCHIVE_LGU',
        entityType: 'lgu',
        entityId: id,
        details: `Archived municipality ${lgu?.municipality || id} (${lgu?.province || ''})`
      });
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      setSelectedLguIds(prev => prev.filter(lId => lId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Municipality archived.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to archive LGU.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleRestoreSingleLgu = async (id: string) => {
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      const lgu = dbLgus.find(l => l.id === id);
      await backendApi.restoreLgu(id);
      await backendApi.logActivity({
        action: 'RESTORE_LGU',
        entityType: 'lgu',
        entityId: id,
        details: `Restored municipality ${lgu?.municipality || id} (${lgu?.province || ''})`
      });
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      setSelectedLguIds(prev => prev.filter(lId => lId !== id));
      setMasterDataFeedback({ type: 'success', text: 'Municipality restored to active status.' });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to restore LGU.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleArchiveSelectedLgus = async () => {
    if (selectedLguIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.deleteLgusBatch(selectedLguIds);
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      setSelectedLguIds([]);
      setMasterDataFeedback({ type: 'success', text: `Archived ${selectedLguIds.length} LGU(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch archive LGUs.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleRestoreSelectedLgus = async () => {
    if (selectedLguIds.length === 0) return;
    setIsMutatingMasterData(true);
    setMasterDataFeedback(null);
    try {
      await backendApi.restoreLgusBatch(selectedLguIds);
      const updated = await backendApi.getLgus(undefined, true);
      setDbLgus(updated);
      setSelectedLguIds([]);
      setMasterDataFeedback({ type: 'success', text: `Restored ${selectedLguIds.length} LGU(s).` });
      onMasterDataChanged?.();
    } catch (err) {
      setMasterDataFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch restore LGUs.' });
    } finally {
      setIsMutatingMasterData(false);
    }
  };

  const handleEmergencyStockCorrection = async (
    lguId: string,
    newStock: Record<string, number>,
    reason: string
  ) => {
    const result = await backendApi.emergencyCorrectLguStock(
      lguId,
      newStock,
      reason,
      profile.fullName || profile.email || 'Administrator'
    );
    if (result.ok) {
      const updated = await backendApi.getLgus();
      setDbLgus(updated);
      setMasterDataFeedback({ type: 'success', text: result.message || 'LGU stock overridden and audit log saved.' });
      onMasterDataChanged?.();
    } else {
      setMasterDataFeedback({ type: 'error', text: result.message || 'Failed to update LGU stock.' });
    }
    return result;
  };

  const handleToggleSelectLgu = (id: string) => {
    setSelectedLguIds(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const handleToggleSelectAllLgus = () => {
    const filteredIds = filteredLgus.map(l => l.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedLguIds.includes(id));
    if (allSelected) {
      setSelectedLguIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedLguIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col md:flex-row h-[700px] max-h-[92vh]">
        {/* =================================================================
            LEFT COLUMN: SETTINGS SIDEBAR
            ================================================================= */}
        <aside className="w-full md:w-60 bg-gray-50/90 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col justify-between p-4 flex-shrink-0 select-none">
          <div className="space-y-4">
            {/* Settings Brand / Heading */}
            <div className="px-2 py-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#2500ba] text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-gray-900 tracking-tight leading-tight">Settings</h2>
                  <p className="text-[10.5px] text-gray-500 font-medium">System & Account Control</p>
                </div>
              </div>
            </div>

            {/* Vertical Navigation Links */}
            <nav className="space-y-1.5">
              {/* Profile Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <User className={`w-4 h-4 flex-shrink-0 ${activeTab === 'profile' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="leading-tight">Profile</div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'profile' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Personal details & photo
                  </div>
                </div>
              </button>

              {/* Security Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <Lock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'security' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="leading-tight">Security</div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'security' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Password & email control
                  </div>
                </div>
              </button>

              {/* Smart Account Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'wallet'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <Wallet className={`w-4 h-4 flex-shrink-0 ${activeTab === 'wallet' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="leading-tight">Smart Account</span>
                    {!profile.walletAddress && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Smart account not provisioned" />
                    )}
                  </div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'wallet' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Gasless ERC-4337 Web3
                  </div>
                </div>
              </button>

              {/* Master Data Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('data')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'data'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <Database className={`w-4 h-4 flex-shrink-0 ${activeTab === 'data' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="leading-tight">Master Data</div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'data' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Kits, hubs & warehouses
                  </div>
                </div>
              </button>

              {/* Administrative Actions Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <ShieldAlert className={`w-4 h-4 flex-shrink-0 ${activeTab === 'admin' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="leading-tight">Admin Actions</span>
                    {effectiveAdminActionsEnabled && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Administrative actions enabled" />
                    )}
                  </div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'admin' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Emergency recount controls
                  </div>
                </div>
              </button>
            </nav>
          </div>

          {/* Settings Sidebar Footer: Sign Out Button */}
          <div className="pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSignOut) {
                  onSignOut();
                } else {
                  signOut();
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 flex-shrink-0 text-red-600" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* =================================================================
            RIGHT COLUMN: TAB CONTENT WORKSPACE
            ================================================================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {/* Top Bar for Content Area */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">
                {activeTab === 'profile' && 'Profile Settings'}
                {activeTab === 'security' && 'Security & Credential Management'}
                {activeTab === 'wallet' && 'Gasless Smart Account (ERC-4337)'}
                {activeTab === 'data' && 'Master Data Configuration'}
                {activeTab === 'admin' && 'Administrative Actions'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {activeTab === 'profile' && 'Manage your officer credentials, avatar photo, and contact information.'}
                {activeTab === 'security' && 'Update administrator login credentials and manage verified account email.'}
                {activeTab === 'wallet' && 'View or provision your gasless smart account sponsored by Alchemy Paymaster.'}
                {activeTab === 'data' && 'View and configure relief items, distribution supply sources, and warehouses.'}
                {activeTab === 'admin' && 'Configure emergency stock recounts, inventory overrides, and LGU audit controls.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* =================================================================
              TAB 1: PROFILE
              ================================================================= */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {profileFeedback.text}
                </div>
              )}

              {/* Avatar Section */}
              <div className="flex flex-col items-center justify-center pt-1 pb-2">
                <div className="relative group">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-blue-600 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
                      {(firstName[0] || 'A')}{(lastName[0] || 'D')}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPhotoMenuOpen(prev => !prev)}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#10069f] hover:bg-blue-800 text-white shadow-lg transition cursor-pointer"
                    title="Change Photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isPhotoMenuOpen && (
                  <div className="mt-3 flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPhotoMenuOpen(false);
                        startCamera('user');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                    >
                      Use Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition"
                    >
                      Upload File
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl(null);
                          setIsPhotoMenuOpen(false);
                        }}
                        className="px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {isCameraActive && (
                  <div className="mt-3 w-full max-w-sm rounded-xl overflow-hidden border border-gray-200 bg-black p-2 flex flex-col items-center">
                    <video ref={videoRef} autoPlay playsInline className="w-48 h-48 object-cover rounded-lg" />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                      >
                        Capture
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* First & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Job Position & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Job Position / Designation</label>
                  <input
                    type="text"
                    value={jobPosition}
                    onChange={(e) => setJobPosition(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Official Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Official Account Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-xs text-gray-600 font-mono"
                />
              </div>

              {/* Designated Role Badge */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-blue-900">Designated Role</p>
                  <p className="text-[11px] text-blue-700">DSWD Regional Administrator (Full System Privileges)</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  Admin
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}

          {/* =================================================================
              TAB: SECURITY & CREDENTIAL MANAGEMENT
              ================================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Card 1: Password Management */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#2500ba] flex items-center justify-center">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Change Administrator Password</h4>
                    <p className="text-[10.5px] text-gray-500">Requires verification of your current administrative password</p>
                  </div>
                </div>

                {passwordFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-semibold ${
                      passwordFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {passwordFeedback.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-lg">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showOldPassword ? 'text' : 'password'}
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2500ba] focus:ring-1 focus:ring-blue-100 transition bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword((p) => !p)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title={showOldPassword ? 'Hide password' : 'Show password'}
                      >
                        {showOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2500ba] focus:ring-1 focus:ring-blue-100 transition bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((p) => !p)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2500ba] focus:ring-1 focus:ring-blue-100 transition bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPassword((p) => !p)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-5 py-2.5 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Lock size={13} />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 2: Administrator Email Display (Read-Only Official Credential) */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2500ba] flex items-center justify-center">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Administrator Account Email</h4>
                    <p className="text-[10.5px] text-gray-500">Official authentication identity for administrative dashboard access</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-gray-400 uppercase tracking-wider">
                      Official Account Email
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                      <ShieldCheck size={12} />
                      <span>Verified Official Account</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Lock size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="font-mono text-xs font-bold text-gray-800 truncate">
                        {profile.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (profile.email) {
                          navigator.clipboard.writeText(profile.email);
                          setCopiedEmail(true);
                          setTimeout(() => setCopiedEmail(false), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-[11px] font-bold text-gray-700 transition cursor-pointer flex-shrink-0"
                    >
                      {copiedEmail ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Administrative access credentials are permanently tied to this designated agency email. To maintain system security and prevent accidental lockout, administrative emails cannot be modified self-service.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: GASLESS SMART ACCOUNT (ERC-4337)
              ================================================================= */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              {/* Web3 Card */}
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                      Ethereum Sepolia Testnet (Chain ID 11155111)
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeWallet ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {activeWallet ? 'Sepolia Testnet Active' : 'Unprovisioned'}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] text-slate-300">Registered Testnet Wallet Address:</p>
                  {activeWallet ? (
                    <div className="mt-1 flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 font-mono text-xs text-blue-100 break-all">
                      <span>{activeWallet}</span>
                      <button
                        type="button"
                        onClick={copyAddressToClipboard}
                        className="p-1 rounded text-slate-400 hover:text-white transition ml-2 flex-shrink-0 cursor-pointer"
                        title="Copy Address"
                      >
                        {copiedWallet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-amber-200 font-semibold">
                      No testnet wallet registered yet. Connect your wallet to enable on-chain signing.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-1 text-[11px] text-slate-300 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span>RBAC Role: <strong className="text-white">DSWD Administrator</strong></span>
                    <span>Network: <strong className="text-blue-300">Ethereum Sepolia</strong></span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span>Contract: <a href="https://sepolia.etherscan.io/address/0xd2e957dda5a5099980a66ecc736b541590892588" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono">0xd2e9...2588</a></span>
                    <span className="text-slate-400">Zero real money (Free testnet ETH)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: DATA (MASTER DATA & SCALABILITY)
              ================================================================= */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* Feedback Alert */}
              {masterDataFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  masterDataFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {masterDataFeedback.text}
                </div>
              )}

              {/* Sub-tab Navigation */}
              <div className="flex border-b border-gray-200 gap-1 pb-1 overflow-x-auto">
                {[
                  { id: 'kits', label: 'Kit Types', icon: Boxes },
                  { id: 'sources', label: 'Sources', icon: Building2 },
                  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
                  { id: 'provinces', label: 'Provinces', icon: Map },
                  { id: 'lgus', label: 'LGUs & Municipalities', icon: MapPin }
                ].map(sub => {
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDataSubTab(sub.id as MasterDataSubTab)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-shrink-0 ${
                        dataSubTab === sub.id
                          ? 'bg-blue-100 text-blue-800'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              {isLoadingMasterData && (
                <div className="flex items-center justify-center py-8 text-xs text-gray-500 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#2500ba]" />
                  <span>Loading master database records...</span>
                </div>
              )}

              {/* Sub-Tab 1: Kits */}
              {!isLoadingMasterData && dataSubTab === 'kits' && (
                <div className="space-y-3">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={kitTypes.length > 0 && selectedKitIds.length === kitTypes.length}
                        onChange={handleToggleSelectAllKits}
                        className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Select All ({selectedKitIds.length}/{kitTypes.length})
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedKitIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteSelectedKits}
                          disabled={isMutatingMasterData}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Selected ({selectedKitIds.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAddingKit(!isAddingKit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingKit ? 'Cancel' : 'Add Kit Type'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Kit Form */}
                  {isAddingKit && (
                    <form onSubmit={handleAddKit} className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900">Add New Relief Kit Package</p>
                        <button type="button" onClick={() => setIsAddingKit(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Kit / Item Name *</label>
                          <input
                            type="text"
                            value={newKit.name}
                            onChange={e => setNewKit(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Hygiene Kit (Family)"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Category *</label>
                          <select
                            value={newKit.category}
                            onChange={e => setNewKit(prev => ({ ...prev, category: e.target.value as 'Food Item' | 'Non-Food Item' }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          >
                            <option value="Food Item">Food Item (FNI)</option>
                            <option value="Non-Food Item">Non-Food Item (NFI)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Unit of Measure *</label>
                          <input
                            type="text"
                            value={newKit.unitType}
                            onChange={e => setNewKit(prev => ({ ...prev, unitType: e.target.value }))}
                            placeholder="e.g. packs, kits, sets, boxes"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={newKit.description}
                            onChange={e => setNewKit(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Package description or standard contents"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingKit(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingMasterData}
                          className="px-4 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isMutatingMasterData ? 'Saving...' : 'Save Kit Type'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Kit Items List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {kitTypes.map(kit => {
                      const isSelected = selectedKitIds.includes(kit.id);
                      return (
                        <div
                          key={kit.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-xs'
                              : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectKit(kit.id)}
                              className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{kit.name}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  {kit.unitType}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-200 text-gray-700">
                                  {kit.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">{kit.description || 'Standard relief kit package'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Active
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleKit(kit.id)}
                              disabled={isMutatingMasterData}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                              title="Delete Kit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {kitTypes.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        No kit types defined in Supabase database. Click "+ Add Kit Type" to create one.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Sources */}
              {!isLoadingMasterData && dataSubTab === 'sources' && (
                <div className="space-y-3">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sources.length > 0 && selectedSourceIds.length === sources.length}
                        onChange={handleToggleSelectAllSources}
                        className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Select All ({selectedSourceIds.length}/{sources.length})
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedSourceIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteSelectedSources}
                          disabled={isMutatingMasterData}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Selected ({selectedSourceIds.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAddingSource(!isAddingSource)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingSource ? 'Cancel' : 'Add Source'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Source Form */}
                  {isAddingSource && (
                    <form onSubmit={handleAddSource} className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900">Add Supply Distribution Source</p>
                        <button type="button" onClick={() => setIsAddingSource(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Facility Name *</label>
                          <input
                            type="text"
                            value={newSource.name}
                            onChange={e => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Visayas Disaster Resource Center"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Short Code *</label>
                          <input
                            type="text"
                            value={newSource.shortCode}
                            onChange={e => setNewSource(prev => ({ ...prev, shortCode: e.target.value }))}
                            placeholder="e.g. VDRC"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Facility Type *</label>
                          <select
                            value={newSource.facilityType}
                            onChange={e => setNewSource(prev => ({ ...prev, facilityType: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          >
                            <option value="National Resource Center">National Resource Center</option>
                            <option value="Regional Logistics Hub">Regional Logistics Hub</option>
                            <option value="Staging Warehouse">Staging Warehouse</option>
                            <option value="External Partner">External Partner</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Region</label>
                          <input
                            type="text"
                            value={newSource.region}
                            onChange={e => setNewSource(prev => ({ ...prev, region: e.target.value }))}
                            placeholder="e.g. Region VI (Western Visayas)"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Location / Address</label>
                          <input
                            type="text"
                            value={newSource.location}
                            onChange={e => setNewSource(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="e.g. Tingub, Mandaue City, Cebu"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingSource(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingMasterData}
                          className="px-4 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isMutatingMasterData ? 'Saving...' : 'Save Source'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Sources List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {sources.map(src => {
                      const isSelected = selectedSourceIds.includes(src.id);
                      return (
                        <div
                          key={src.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-xs'
                              : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectSource(src.id)}
                              className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900">{src.name}</p>
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                  {src.shortCode}
                                </span>
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {src.facilityType}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500">{src.region}</p>
                              <p className="text-[10px] text-gray-400">{src.location}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleSource(src.id)}
                              disabled={isMutatingMasterData}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                              title="Delete Source"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {sources.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        No supply sources defined in Supabase database. Click "+ Add Source" to create one.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Warehouses */}
              {!isLoadingMasterData && dataSubTab === 'warehouses' && (
                <div className="space-y-3">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={warehouses.length > 0 && selectedWarehouseIds.length === warehouses.length}
                        onChange={handleToggleSelectAllWarehouses}
                        className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Select All ({selectedWarehouseIds.length}/{warehouses.length})
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedWarehouseIds.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteSelectedWarehouses}
                          disabled={isMutatingMasterData}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Selected ({selectedWarehouseIds.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAddingWarehouse(!isAddingWarehouse)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingWarehouse ? 'Cancel' : 'Add Warehouse'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Warehouse Form */}
                  {isAddingWarehouse && (
                    <form onSubmit={handleAddWarehouse} className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900">Add Storage Warehouse Facility</p>
                        <button type="button" onClick={() => setIsAddingWarehouse(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Warehouse Name *</label>
                          <input
                            type="text"
                            value={newWarehouse.name}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Roxas Sub-Regional Depot"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Province *</label>
                          <select
                            value={newWarehouse.province}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, province: e.target.value }))}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          >
                            <option value="">Select Province</option>
                            {provinces.map(prov => (
                              <option key={prov.id} value={prov.name}>{prov.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Municipality / City</label>
                          <input
                            type="text"
                            value={newWarehouse.municipality}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, municipality: e.target.value }))}
                            placeholder="e.g. Roxas City"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Capacity (Packs)</label>
                          <input
                            type="number"
                            value={newWarehouse.capacityPacks}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, capacityPacks: Number(e.target.value) }))}
                            min="100"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Latitude</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={newWarehouse.latitude}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Longitude</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={newWarehouse.longitude}
                            onChange={e => setNewWarehouse(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingWarehouse(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingMasterData}
                          className="px-4 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isMutatingMasterData ? 'Saving...' : 'Save Warehouse'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Warehouses List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {warehouses.map(wh => {
                      const isSelected = selectedWarehouseIds.includes(wh.id);
                      return (
                        <div
                          key={wh.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-xs'
                              : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectWarehouse(wh.id)}
                              className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                            />
                            <div>
                              <p className="font-bold text-gray-900">{wh.name}</p>
                              <p className="text-[11px] text-gray-500">{wh.municipality}, {wh.province}</p>
                              <p className="text-[10px] text-gray-400">
                                Capacity: {wh.capacityPacks.toLocaleString()} packs &middot; ({wh.latitude}, {wh.longitude})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Operational
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleWarehouse(wh.id)}
                              disabled={isMutatingMasterData}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
                              title="Delete Warehouse"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {warehouses.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        No warehouses defined in Supabase database. Click "+ Add Warehouse" to create one.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Provinces */}
              {!isLoadingMasterData && dataSubTab === 'provinces' && (
                <div className="space-y-3">
                  {/* Status Segmented Switcher */}
                  <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => { setProvinceStatusFilter('active'); setSelectedProvinceIds([]); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        provinceStatusFilter === 'active' ? 'bg-[#2500ba] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Active ({provinces.filter(p => p.isActive !== false).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProvinceStatusFilter('archived'); setSelectedProvinceIds([]); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        provinceStatusFilter === 'archived' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Archived ({provinces.filter(p => p.isActive === false).length})
                    </button>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filteredProvinces.length > 0 && selectedProvinceIds.length === filteredProvinces.length}
                        onChange={handleToggleSelectAllProvinces}
                        className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Select All ({selectedProvinceIds.length}/{filteredProvinces.length})
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedProvinceIds.length > 0 && (
                        provinceStatusFilter === 'active' ? (
                          <button
                            type="button"
                            onClick={handleArchiveSelectedProvinces}
                            disabled={isMutatingMasterData}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archive Selected ({selectedProvinceIds.length})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRestoreSelectedProvinces}
                            disabled={isMutatingMasterData}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore Selected ({selectedProvinceIds.length})</span>
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAddingProvince(!isAddingProvince)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingProvince ? 'Cancel' : 'Add Province'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Province Form */}
                  {isAddingProvince && (
                    <form onSubmit={handleAddProvince} className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900">Add New Province</p>
                        <button type="button" onClick={() => setIsAddingProvince(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Province Name *</label>
                          <input
                            type="text"
                            value={newProvince.name}
                            onChange={e => setNewProvince(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Guimaras"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Region *</label>
                          <input
                            type="text"
                            value={newProvince.region}
                            onChange={e => setNewProvince(prev => ({ ...prev, region: e.target.value }))}
                            placeholder="e.g. Region VI (Western Visayas)"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingProvince(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingMasterData}
                          className="px-4 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isMutatingMasterData ? 'Saving...' : 'Save Province'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Provinces List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredProvinces.map(prov => {
                      const isSelected = selectedProvinceIds.includes(prov.id);
                      const linkedLguCount = dbLgus.filter(l => l.province.toLowerCase() === prov.name.toLowerCase()).length;
                      return (
                        <div
                          key={prov.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-xs'
                              : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectProvince(prov.id)}
                              className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{prov.name}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  {linkedLguCount} Municipalities
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">{prov.region}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {prov.isActive === false ? (
                              <>
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                  Archived
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreSingleProvince(prov.id)}
                                  disabled={isMutatingMasterData}
                                  className="p-1 rounded text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50"
                                  title="Restore Province"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Active
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleArchiveSingleProvince(prov.id)}
                                  disabled={isMutatingMasterData}
                                  className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer disabled:opacity-50"
                                  title="Archive Province"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredProvinces.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        {provinceStatusFilter === 'active' ? 'No active provinces found.' : 'No archived provinces found.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: LGUs & Municipalities */}
              {!isLoadingMasterData && dataSubTab === 'lgus' && (
                <div className="space-y-3">
                  {/* Status Segmented Switcher & Search Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit">
                      <button
                        type="button"
                        onClick={() => { setLguStatusFilter('active'); setSelectedLguIds([]); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          lguStatusFilter === 'active' ? 'bg-[#2500ba] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Active ({dbLgus.filter(l => l.isActive !== false).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLguStatusFilter('archived'); setSelectedLguIds([]); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          lguStatusFilter === 'archived' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Archived ({dbLgus.filter(l => l.isActive === false).length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-lg">
                      <div className="relative min-w-[160px]">
                        <select
                          value={lguProvinceFilter}
                          onChange={e => setLguProvinceFilter(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                        >
                          <option value="All">All Provinces</option>
                          {provinces.map(prov => {
                            const count = dbLgus.filter(l => l.province.toLowerCase() === prov.name.toLowerCase()).length;
                            return (
                              <option key={prov.id} value={prov.name}>
                                {prov.name} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={lguSearchQuery}
                          onChange={e => setLguSearchQuery(e.target.value)}
                          placeholder="Search municipality..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filteredLgus.length > 0 && filteredLgus.every(l => selectedLguIds.includes(l.id))}
                        onChange={handleToggleSelectAllLgus}
                        className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Select All ({selectedLguIds.filter(id => filteredLgus.some(l => l.id === id)).length}/{filteredLgus.length})
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      {selectedLguIds.length > 0 && (
                        lguStatusFilter === 'active' ? (
                          <button
                            type="button"
                            onClick={handleArchiveSelectedLgus}
                            disabled={isMutatingMasterData}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archive Selected ({selectedLguIds.length})</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRestoreSelectedLgus}
                            disabled={isMutatingMasterData}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore Selected ({selectedLguIds.length})</span>
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEmergencyCorrectionLguId(undefined);
                          setIsEmergencyCorrectionOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold shadow-xs transition cursor-pointer"
                        title="Authorized Stock Overrides & Discrepancy Audits"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        <span>Emergency Recount</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingLgu(!isAddingLgu)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingLgu ? 'Cancel' : 'Add Municipality'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add LGU Form */}
                  {isAddingLgu && (
                    <form onSubmit={handleAddLgu} className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-blue-900">Add Panay Municipality / LGU</p>
                        <button type="button" onClick={() => setIsAddingLgu(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Province *</label>
                          <select
                            value={newLgu.province}
                            onChange={e => setNewLgu(prev => ({ ...prev, province: e.target.value }))}
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                          >
                            <option value="">Select Province</option>
                            {provinces.map(prov => (
                              <option key={prov.id} value={prov.name}>{prov.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Municipality / City *</label>
                          <input
                            type="text"
                            value={newLgu.municipality}
                            onChange={e => setNewLgu(prev => ({ ...prev, municipality: e.target.value }))}
                            placeholder="e.g. Pavia"
                            required
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">LGU Facility / Hall Name</label>
                          <input
                            type="text"
                            value={newLgu.lguName}
                            onChange={e => setNewLgu(prev => ({ ...prev, lguName: e.target.value }))}
                            placeholder="e.g. Pavia Municipal Hall / Evacuation Center"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Contact Officer</label>
                          <input
                            type="text"
                            value={newLgu.contactPerson}
                            onChange={e => setNewLgu(prev => ({ ...prev, contactPerson: e.target.value }))}
                            placeholder="e.g. Officer Juan Dela Cruz"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Latitude</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={newLgu.latitude}
                            onChange={e => setNewLgu(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">Longitude</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={newLgu.longitude}
                            onChange={e => setNewLgu(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingLgu(false)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isMutatingMasterData}
                          className="px-4 py-1.5 rounded-lg bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isMutatingMasterData ? 'Saving...' : 'Save Municipality'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* LGUs List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredLgus.map(lgu => {
                      const isSelected = selectedLguIds.includes(lgu.id);
                      return (
                        <div
                          key={lgu.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-blue-300 bg-blue-50/70 shadow-xs'
                              : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectLgu(lgu.id)}
                              className="w-4 h-4 rounded text-[#2500ba] focus:ring-[#2500ba] border-gray-300 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">{lgu.municipality}</span>
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {lgu.province}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">{lgu.lguName || 'Municipal Disaster Operations Center'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-400">
                              {Number(lgu.latitude).toFixed(3)}, {Number(lgu.longitude).toFixed(3)}
                            </span>
                            {lgu.isActive === false ? (
                              <>
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                  Archived
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreSingleLgu(lgu.id)}
                                  disabled={isMutatingMasterData}
                                  className="p-1 rounded text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer disabled:opacity-50"
                                  title="Restore LGU"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmergencyCorrectionLguId(lgu.id);
                                    setIsEmergencyCorrectionOpen(true);
                                  }}
                                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  title="Emergency Stock Recount"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleArchiveSingleLgu(lgu.id)}
                                  disabled={isMutatingMasterData}
                                  className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer disabled:opacity-50"
                                  title="Archive LGU"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredLgus.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                        {lguStatusFilter === 'active' ? 'No active municipalities found.' : 'No archived municipalities found.'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TAB 4: ADMINISTRATIVE ACTIONS
              ================================================================= */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              {/* Feature Switch Card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      effectiveAdminActionsEnabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-gray-900">
                          Administrative Actions
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          effectiveAdminActionsEnabled
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {effectiveAdminActionsEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-xl">
                        Enables privileged emergency actions on the LGU Monitor. When toggled on, authorized personnel can perform emergency recounts and manual stock corrections for relief goods.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleAdminActions(!effectiveAdminActionsEnabled)}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#2500ba] focus:ring-offset-2 self-start sm:self-auto ${
                      effectiveAdminActionsEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={effectiveAdminActionsEnabled}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        effectiveAdminActionsEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* State Banner */}
                <div className={`p-4 rounded-xl border text-xs leading-relaxed flex items-center justify-between gap-4 ${
                  effectiveAdminActionsEnabled
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {effectiveAdminActionsEnabled ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">
                        {effectiveAdminActionsEnabled
                          ? 'Emergency Recount is visible on LGU Monitor'
                          : 'Emergency Recount is hidden on LGU Monitor'}
                      </p>
                      <p className="text-[11px] opacity-80 mt-0.5">
                        {effectiveAdminActionsEnabled
                          ? 'Staff can view Emergency Stock Correction buttons on LGU cards, table rows, and the top toolbar.'
                          : 'Turn this on to view Emergency Recount buttons on the LGU Monitor page.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAdminActions(!effectiveAdminActionsEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                      effectiveAdminActionsEnabled
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-amber-700 hover:bg-amber-800 text-white'
                    }`}
                  >
                    {effectiveAdminActionsEnabled ? 'Disable' : 'Enable Administrative Actions'}
                  </button>
                </div>
              </div>

              {/* Scope of Administrative Actions */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 space-y-3">
                <h5 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Affected Controls in LGU Monitor
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-700">
                  <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs space-y-1">
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Header Emergency Correction
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Top-level button on LGU Monitor to recount and adjust any municipality.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs space-y-1">
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-purple-600" />
                      Card View Recount Buttons
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Emergency Recount trigger embedded in each municipality stock card.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs space-y-1">
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Table View Action Icons
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Direct row action icons for fast emergency stock corrections.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs space-y-1">
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                      Audit Trail Compliance
                    </p>
                    <p className="text-[11px] text-gray-500">
                      All emergency recounts require a mandatory justification and are logged.
                    </p>
                  </div>
                </div>

                {effectiveAdminActionsEnabled && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEmergencyCorrectionLguId(undefined);
                        setIsEmergencyCorrectionOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Open Emergency Recount Modal Now</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isEmergencyCorrectionOpen && (
        <EmergencyStockCorrectionModal
          isOpen={isEmergencyCorrectionOpen}
          onClose={() => {
            setIsEmergencyCorrectionOpen(false);
            setEmergencyCorrectionLguId(undefined);
          }}
          lgusList={dbLgus}
          kitTypesList={kitTypes}
          initialLguId={emergencyCorrectionLguId}
          onCorrectStock={handleEmergencyStockCorrection}
        />
      )}
    </div>
  </div>
);
}

