import React, { useState, useRef, useEffect } from 'react';
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
  LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, type UserProfile } from '../../services/authApi';
import { blockchain } from '../../services/blockchain';
import { backendApi, type LguRecord } from '../../services/backendApi';
import { PANAY_LGUS, PANAY_PROVINCES } from '../../data/panayLguDirectory';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialTab?: 'profile' | 'metamask' | 'data';
  onSignOut?: () => void;
}

type SettingsTab = 'profile' | 'metamask' | 'data';
type MasterDataSubTab = 'kits' | 'sources' | 'warehouses' | 'lgus';

interface KitTypeItem {
  id: string;
  name: string;
  category: 'Food Item' | 'Non-Food Item';
  unitType: string;
  description: string;
  isDefault?: boolean;
}

interface SupplySourceItem {
  id: string;
  name: string;
  facilityType: 'National Resource Center' | 'Regional Logistics Hub' | 'Staging Warehouse' | 'External Partner';
  region: string;
  location: string;
  isDefault?: boolean;
}

interface WarehouseFacilityItem {
  id: string;
  name: string;
  province: string;
  municipality: string;
  capacityPacks: number;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

const DEFAULT_KIT_TYPES: KitTypeItem[] = [
  { id: 'kit-1', name: 'Family Food Pack', category: 'Food Item', unitType: 'packs', description: 'Standard 6kg emergency nutritional food pack (rice, canned goods, coffee)', isDefault: true },
  { id: 'kit-2', name: 'Hygiene Kit', category: 'Non-Food Item', unitType: 'kits', description: 'Personal sanitation supplies, soap, toothpaste, toothbrush, sanitary napkins', isDefault: true },
  { id: 'kit-3', name: 'Sleeping Kit', category: 'Non-Food Item', unitType: 'kits', description: 'Blankets, sleeping mats, mosquito nets, and pillowcases', isDefault: true },
  { id: 'kit-4', name: 'Kitchen Kit', category: 'Non-Food Item', unitType: 'kits', description: 'Cooking pots, frying pan, plates, cups, spoons, forks, and cooking utensils', isDefault: true },
  { id: 'kit-5', name: 'Family Kit', category: 'Non-Food Item', unitType: 'kits', description: 'Clothing apparel, underwear, bath towels, and footwear for families', isDefault: true },
  { id: 'kit-6', name: 'Laminated Sacks', category: 'Non-Food Item', unitType: 'sacks', description: 'Heavy-duty weatherproofing tarpaulins for temporary roof shelters', isDefault: true },
  { id: 'kit-7', name: 'Ready-to-Eat Food (RTEF)', category: 'Food Item', unitType: 'packs', description: 'Pre-cooked retort pouch meals requiring zero preparation', isDefault: true }
];

const DEFAULT_SOURCES: SupplySourceItem[] = [
  { id: 'src-1', name: 'Visayas Disaster Resource Center (VDRC)', facilityType: 'National Resource Center', region: 'Region VII (Central Visayas)', location: 'Tingub, Mandaue City, Cebu', isDefault: true },
  { id: 'src-2', name: 'Luzon Disaster Resource Center (LDRC)', facilityType: 'National Resource Center', region: 'National Capital Region', location: 'Pasay City / Clark Special Zone', isDefault: true },
  { id: 'src-3', name: 'Oton Regional Warehouse Hub', facilityType: 'Regional Logistics Hub', region: 'Region VI (Western Visayas)', location: 'Brgy. Tagbac, Oton, Iloilo', isDefault: true },
  { id: 'src-4', name: 'Pototan Secondary Depot', facilityType: 'Regional Logistics Hub', region: 'Region VI (Western Visayas)', location: 'Pototan, Iloilo', isDefault: true }
];

const DEFAULT_WAREHOUSES: WarehouseFacilityItem[] = [
  { id: 'wh-1', name: 'Oton Main Warehouse', province: 'Iloilo', municipality: 'Oton', capacityPacks: 150000, latitude: 10.6975, longitude: 122.4764, isDefault: true },
  { id: 'wh-2', name: 'Pototan Main Warehouse', province: 'Iloilo', municipality: 'Pototan', capacityPacks: 80000, latitude: 10.9492, longitude: 122.6289, isDefault: true }
];

export function SettingsModal({
  isOpen,
  onClose,
  profile,
  initialTab = 'profile',
  onSignOut
}: SettingsModalProps) {
  const { refreshProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

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

  // Tab 2: MetaMask States
  const [activeWallet, setActiveWallet] = useState<string | null>(profile.walletAddress || null);
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [walletFeedback, setWalletFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Tab 3: Data States
  const [dataSubTab, setDataSubTab] = useState<MasterDataSubTab>('kits');
  const [kitTypes, setKitTypes] = useState<KitTypeItem[]>(() => {
    try {
      const saved = localStorage.getItem('dswd_custom_kit_types');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KIT_TYPES;
  });
  const [sources, setSources] = useState<SupplySourceItem[]>(() => {
    try {
      const saved = localStorage.getItem('dswd_custom_sources');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_SOURCES;
  });
  const [warehouses, setWarehouses] = useState<WarehouseFacilityItem[]>(() => {
    try {
      const saved = localStorage.getItem('dswd_custom_warehouses');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_WAREHOUSES;
  });
  const [dbLgus, setDbLgus] = useState<LguRecord[]>([]);

  // Camera & File upload refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFirstName(profile.firstName || profile.fullName?.split(' ')[0] || '');
      setLastName(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
      setJobPosition(profile.jobPosition || '');
      setPhoneNumber(profile.phoneNumber || '');
      setAvatarUrl(profile.avatarUrl || null);
      setActiveWallet(profile.walletAddress || null);
      setProfileFeedback(null);
      setWalletFeedback(null);
    }
  }, [isOpen, initialTab, profile]);

  // Load live LGUs for Data tab
  useEffect(() => {
    if (isOpen && activeTab === 'data') {
      backendApi.getLgus()
        .then(list => setDbLgus(list))
        .catch(err => console.warn('Failed to load lgus in settings:', err));
    }
  }, [isOpen, activeTab]);

  // Sync active MetaMask wallet on mount or tab change
  useEffect(() => {
    if (isOpen && activeTab === 'metamask') {
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

  // MetaMask Handlers
  const handleLinkMetaMask = async () => {
    setIsLinkingWallet(true);
    setWalletFeedback(null);
    try {
      const { walletAddress } = await blockchain.connectWallet();
      if (!walletAddress) throw new Error('No account returned from MetaMask.');
      const isLinked = await authApi.isWalletLinked(walletAddress, profile.id);
      if (isLinked) {
        setWalletFeedback({ type: 'error', text: 'This MetaMask wallet is already linked to another account.' });
        return;
      }
      await authApi.updateWalletAddress(profile.id, walletAddress);
      await refreshProfile();
      setActiveWallet(walletAddress);
      setWalletFeedback({ type: 'success', text: `MetaMask wallet successfully linked: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` });
    } catch (err) {
      setWalletFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to connect MetaMask.' });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleSwitchMetaMask = async () => {
    setIsLinkingWallet(true);
    setWalletFeedback(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask not detected.');
      await eth.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const accounts = await eth.request({ method: 'eth_accounts' }) as string[];
      const newAddress = accounts?.[0];
      if (!newAddress) return;
      const isLinked = await authApi.isWalletLinked(newAddress, profile.id);
      if (isLinked) {
        setWalletFeedback({ type: 'error', text: 'This MetaMask wallet is already linked to another account.' });
        return;
      }
      await authApi.updateWalletAddress(profile.id, newAddress);
      await refreshProfile();
      setActiveWallet(newAddress);
      setWalletFeedback({ type: 'success', text: `Switched to active wallet: ${newAddress.slice(0, 6)}...${newAddress.slice(-4)}` });
    } catch (err) {
      setWalletFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to switch MetaMask account.' });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const copyAddressToClipboard = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
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

              {/* MetaMask Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('metamask')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'metamask'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'
                }`}
              >
                <Wallet className={`w-4 h-4 flex-shrink-0 ${activeTab === 'metamask' ? 'text-white' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="leading-tight">MetaMask</span>
                    {!profile.walletAddress && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Wallet unlinked" />
                    )}
                  </div>
                  <div className={`text-[10px] font-normal truncate ${activeTab === 'metamask' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Web3 wallet & signing
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
                {activeTab === 'metamask' && 'MetaMask Wallet Connection'}
                {activeTab === 'data' && 'Master Data Configuration'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {activeTab === 'profile' && 'Manage your officer credentials, avatar photo, and contact information.'}
                {activeTab === 'metamask' && 'Link your MetaMask Ethereum address to sign relief operations on blockchain.'}
                {activeTab === 'data' && 'View and configure relief items, distribution supply sources, and warehouses.'}
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
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>

                <div className="flex items-center gap-2">
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
              </div>
            </form>
          )}

          {/* =================================================================
              TAB 2: METAMASK
              ================================================================= */}
          {activeTab === 'metamask' && (
            <div className="space-y-4">
              {walletFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  walletFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {walletFeedback.text}
                </div>
              )}

              {/* Web3 Card */}
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                      MetaMask Web3 Wallet
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeWallet ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {activeWallet ? 'Wallet Connected' : 'Unlinked'}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] text-slate-300">Registered Blockchain Address:</p>
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
                      No MetaMask account linked yet. Link a wallet to sign relief manifests on blockchain.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-300 border-t border-slate-800">
                  <span>RBAC Role: <strong className="text-white">DSWD Administrator</strong></span>
                  <span>Network: <strong className="text-blue-300">Sepolia / Local Testnet</strong></span>
                </div>
              </div>

              {/* Wallet Actions */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70 space-y-3">
                <p className="text-xs font-bold text-gray-800">Manage Linked Account</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLinkMetaMask}
                    disabled={isLinkingWallet}
                    className="px-4 py-2.5 rounded-xl bg-[#2500ba] hover:bg-blue-800 text-white text-xs font-bold shadow transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{activeWallet ? 'Re-link Active Wallet' : 'Connect MetaMask Wallet'}</span>
                  </button>

                  {activeWallet && (
                    <button
                      type="button"
                      onClick={handleSwitchMetaMask}
                      disabled={isLinkingWallet}
                      className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLinkingWallet ? 'animate-spin' : ''}`} />
                      <span>Switch MetaMask Account</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  Only one MetaMask account can be linked per officer. Switching accounts requires confirmation in the MetaMask browser extension.
                </p>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: DATA (MASTER DATA & SCALABILITY)
              ================================================================= */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* Sub-tab Navigation */}
              <div className="flex border-b border-gray-200 gap-1 pb-1">
                {[
                  { id: 'kits', label: 'Kit Types', icon: Boxes },
                  { id: 'sources', label: 'Sources', icon: Building2 },
                  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
                  { id: 'lgus', label: 'Provinces & LGUs', icon: MapPin }
                ].map(sub => {
                  const Icon = sub.icon;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDataSubTab(sub.id as MasterDataSubTab)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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

              {/* Sub-Tab: Kits */}
              {dataSubTab === 'kits' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-semibold">Active Relief Kit Packages ({kitTypes.length})</p>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {kitTypes.map(kit => (
                      <div key={kit.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{kit.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              {kit.unitType}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{kit.description}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab: Sources */}
              {dataSubTab === 'sources' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-semibold">National Distribution Centers ({sources.length})</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {sources.map(src => (
                      <div key={src.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-900">{src.name}</p>
                          <p className="text-[11px] text-gray-500">{src.facilityType} &middot; {src.region}</p>
                          <p className="text-[10px] text-gray-400">{src.location}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Source Hub
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab: Warehouses */}
              {dataSubTab === 'warehouses' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-semibold">Regional Storage Warehouses ({warehouses.length})</p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {warehouses.map(wh => (
                      <div key={wh.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-900">{wh.name}</p>
                          <p className="text-[11px] text-gray-500">{wh.municipality}, {wh.province}</p>
                          <p className="text-[10px] text-gray-400">Capacity: {wh.capacityPacks.toLocaleString()} packs &middot; ({wh.latitude}, {wh.longitude})</p>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Operational
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Tab: LGUs */}
              {dataSubTab === 'lgus' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-semibold">
                      Panay Provinces & Municipalities ({dbLgus.length || PANAY_LGUS.length})
                    </p>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(dbLgus.length > 0 ? dbLgus : PANAY_LGUS).map((lgu: any) => (
                      <div key={lgu.id || lgu.municipality} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{lgu.municipality}</span>
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              {lgu.province}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">{lgu.lguName || lgu.defaultFacility || 'Municipal Hall'}</p>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">
                          {Number(lgu.latitude || lgu.lat).toFixed(3)}, {Number(lgu.longitude || lgu.lng).toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
}

