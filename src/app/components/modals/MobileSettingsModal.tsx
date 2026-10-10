import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  FlipHorizontal,
  LogOut,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  User,
  Wallet,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, type UserProfile } from '../../services/authApi';

export interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  initialTab?: 'profile' | 'wallet';
  onSignOut?: () => void;
  onProfileUpdated?: () => void;
}

export function MobileSettingsModal({
  isOpen,
  onClose,
  profile,
  initialTab = 'profile',
  onSignOut,
  onProfileUpdated
}: MobileSettingsModalProps) {
  const { refreshProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>(initialTab);

  // Tab 1: Profile Form States
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

  // Refs for camera and file upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFirstName(profile.firstName || profile.fullName?.split(' ')[0] || '');
      setLastName(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
      setJobPosition(profile.jobPosition || '');
      setPhoneNumber(profile.phoneNumber || '');
      setAvatarUrl(profile.avatarUrl || null);
      setActiveWallet(profile.walletAddress || null);
      setActiveTab(initialTab);
      setIsPhotoMenuOpen(false);
      setIsCameraActive(false);
      setProfileFeedback(null);
      setCopiedWallet(false);
    } else {
      stopCamera();
    }
  }, [isOpen, profile, initialTab]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (facing: 'user' | 'environment' = cameraFacing) => {
    stopCamera();
    setIsPhotoMenuOpen(false);
    setIsCameraActive(true);
    setProfileFeedback(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setProfileFeedback({ type: 'error', text: 'Camera access is not supported on this browser.' });
      setIsCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 640 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setProfileFeedback({ type: 'error', text: 'Camera permission denied or camera unavailable.' });
      setIsCameraActive(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const processImageToDataUrl = (image: CanvasImageSource, naturalWidth: number, naturalHeight: number): string => {
    const targetSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const minDim = Math.min(naturalWidth, naturalHeight);
    const sx = (naturalWidth - minDim) / 2;
    const sy = (naturalHeight - minDim) / 2;

    ctx.drawImage(image, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setProfileFeedback({ type: 'error', text: 'Camera feed not ready yet.' });
      return;
    }

    const compressed = processImageToDataUrl(video, video.videoWidth, video.videoHeight);
    if (compressed) {
      setAvatarUrl(compressed);
      setProfileFeedback({ type: 'success', text: 'Photo captured. Tap Save Changes to apply.' });
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPhotoMenuOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const compressed = processImageToDataUrl(img, img.width, img.height);
        setAvatarUrl(compressed);
        setProfileFeedback({ type: 'success', text: 'Image loaded. Tap Save Changes to apply.' });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setIsPhotoMenuOpen(false);
    setAvatarUrl(null);
    setProfileFeedback({ type: 'success', text: 'Photo removed. Tap Save Changes to apply.' });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const compiledFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!compiledFullName) {
      setProfileFeedback({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);

    try {
      await authApi.updateProfile(profile.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: compiledFullName,
        jobPosition: jobPosition.trim(),
        phoneNumber: phoneNumber.trim(),
        avatarUrl
      });

      await refreshProfile();
      onProfileUpdated?.();

      setProfileFeedback({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => {
        setIsSavingProfile(false);
        onClose();
      }, 700);
    } catch (err) {
      setIsSavingProfile(false);
      setProfileFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile.'
      });
    }
  };

  const copyAddressToClipboard = () => {
    if (!activeWallet) return;
    navigator.clipboard.writeText(activeWallet);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };


  const handleSignOutClick = () => {
    onClose();
    if (onSignOut) {
      onSignOut();
    } else {
      void signOut();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* =================================================================
            HEADER: Brand Identity matching Admin SettingsModal
            ================================================================= */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2500ba] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-gray-900 tracking-tight leading-tight">Settings</h2>
              <p className="text-[10px] text-gray-500 font-medium">System & Account Control</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* =================================================================
            MOBILE SEGMENTED TAB BAR
            ================================================================= */}
        <div className="px-5 pt-3 pb-1 border-b border-gray-100 bg-gray-50/70 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-gray-200/80 p-1 rounded-xl">
            {/* Tab 1: Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User size={14} className={activeTab === 'profile' ? 'text-[#2500ba]' : 'text-gray-500'} />
              <span>Profile</span>
            </button>

            {/* Tab 2: Smart Account */}
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                activeTab === 'wallet'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Wallet size={14} className={activeTab === 'wallet' ? 'text-[#2500ba]' : 'text-gray-500'} />
              <span>Smart Account</span>
              {!activeWallet && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute top-1.5 right-2" />
              )}
            </button>
          </div>
        </div>

        {/* =================================================================
            SCROLLABLE CONTENT BODY
            ================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ===============================================================
              TAB 1: PROFILE
              =============================================================== */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {profileFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    profileFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {profileFeedback.text}
                </div>
              )}

              {/* Avatar Section */}
              <div className="flex flex-col items-center justify-center pt-1 pb-1">
                <div className="relative group">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-blue-600 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
                      {(firstName[0] || 'D').toUpperCase()}{(lastName[0] || 'R').toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#10069f] hover:bg-blue-800 text-white shadow-lg transition cursor-pointer"
                    title="Change Photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Photo Options Menu */}
                {isPhotoMenuOpen && (
                  <div className="mt-3 flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 text-xs animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
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
                        onClick={handleRemovePhoto}
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

                {/* Live Camera Viewfinder */}
                {isCameraActive && (
                  <div className="mt-3 w-full rounded-2xl overflow-hidden border border-gray-300 bg-black p-2 flex flex-col items-center">
                    <video ref={videoRef} autoPlay playsInline className="w-48 h-48 object-cover rounded-xl" />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="p-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                        title="Flip Camera"
                      >
                        <FlipHorizontal size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                      >
                        Capture
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-lg hover:bg-gray-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Job Position & Phone Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Job Position</label>
                  <input
                    type="text"
                    value={jobPosition}
                    onChange={(e) => setJobPosition(e.target.value)}
                    placeholder="e.g. Officer / Driver"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="09XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Official Account Email (Read-Only) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Account Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-100 text-xs text-gray-600 font-mono"
                />
              </div>

              {/* Designated Role Badge */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-blue-900">Designated Role</p>
                  <p className="text-[10.5px] text-blue-700">
                    {profile.role === 'dswd_admin'
                      ? 'DSWD Regional Administrator'
                      : profile.lguName
                      ? `LGU Authorized Receiver (${profile.lguName})`
                      : 'Field Logistics Driver'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {profile.role === 'dswd_admin'
                    ? 'Admin'
                    : profile.lguName
                    ? 'LGU Receiver'
                    : 'Field Driver'}
                </span>
              </div>

              {/* Save Profile Button */}
              <button
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ===============================================================
              TAB 2: SMART ACCOUNT (ERC-4337)
              =============================================================== */}
          {activeTab === 'wallet' && (
            <div className="space-y-3.5">
              {/* Web3 Card */}
              <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-blue-950 p-4 text-white shadow-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-400" />
                    <span className="text-[10.5px] font-bold text-blue-200 uppercase tracking-wider">
                      Sepolia Testnet (11155111)
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                      activeWallet
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {activeWallet ? 'Active' : 'Unprovisioned'}
                  </span>
                </div>

                <div>
                  <p className="text-[10.5px] text-slate-300">Smart Account Address:</p>
                  {activeWallet ? (
                    <div className="mt-1 flex items-center justify-between p-2 rounded-xl bg-slate-800/90 border border-slate-700 font-mono text-[11px] text-blue-100 break-all">
                      <span className="truncate mr-2">{activeWallet}</span>
                      <button
                        type="button"
                        onClick={copyAddressToClipboard}
                        className="p-1 rounded text-slate-400 hover:text-white transition flex-shrink-0 cursor-pointer"
                        title="Copy Address"
                      >
                        {copiedWallet ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-amber-200 font-semibold">
                      No smart account provisioned yet.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between text-[10.5px] text-slate-300 border-t border-slate-800">
                  <span>
                    Role: <strong className="text-white">{profile.lguName ? 'LGU Receiver' : 'Field Driver'}</strong>
                  </span>
                  {activeWallet && (
                    <a
                      href={`https://sepolia.etherscan.io/address/${activeWallet}#nfttransfers`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Etherscan</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================
            FOOTER: Centralized Session Control (Sign Out)
            ================================================================= */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-bold text-gray-700">Account Session</p>
            <p className="text-[10px] text-gray-500">Sign out of this device</p>
          </div>
          <button
            type="button"
            onClick={handleSignOutClick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition cursor-pointer active:scale-95"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

