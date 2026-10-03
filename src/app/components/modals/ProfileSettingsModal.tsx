'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  AlertTriangle,
  Camera, 
  Check, 
  Copy,
  ExternalLink,
  FlipHorizontal, 
  KeyRound,
  Lock,
  LogOut,
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Trash2, 
  Upload, 
  User, 
  Wallet,
  X 
} from 'lucide-react';
import { authApi, type UserProfile } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';
import { blockchain } from '../../services/blockchain';
import { sanitizeTextOnly } from '../../lib/inputValidation';

type SettingsTab = 'profile' | 'wallet' | 'security';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileUpdated?: () => void;
  onSignOut?: () => void;
}

export function ProfileSettingsModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onSignOut
}: ProfileSettingsModalProps) {
  const { refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [firstName, setFirstName] = useState(profile.firstName || profile.fullName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
  const [jobPosition, setJobPosition] = useState(profile.jobPosition || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl || null);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Security tab: Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync with profile prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setFirstName(profile.firstName || profile.fullName?.split(' ')[0] || '');
      setLastName(profile.lastName || profile.fullName?.split(' ').slice(1).join(' ') || '');
      setJobPosition(profile.jobPosition || '');
      setPhoneNumber(profile.phoneNumber || '');
      setFullName(profile.fullName || '');
      setAvatarUrl(profile.avatarUrl || null);
      setIsPhotoMenuOpen(false);
      setIsCameraActive(false);
      setFeedbackMessage(null);
      setSecurityMessage(null);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      stopCamera();
    }
  }, [isOpen, profile]);

  // Clean up camera on unmount
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
    setFeedbackMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedbackMessage({ type: 'error', text: 'Camera access is not supported on this browser.' });
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
      setFeedbackMessage({ type: 'error', text: 'Camera permission denied or camera unavailable.' });
      setIsCameraActive(false);
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;

    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setAvatarUrl(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMessage({ type: 'error', text: 'Please select a valid image file.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMessage({ type: 'error', text: 'Image file size must be less than 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setIsPhotoMenuOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    setIsPhotoMenuOpen(false);
  };

  const handleLinkWallet = async () => {
    setIsLinkingWallet(true);
    setFeedbackMessage(null);
    try {
      const { walletAddress } = await blockchain.connectWallet();
      if (!walletAddress) throw new Error('No account returned from MetaMask.');
      const isLinked = await authApi.isWalletLinked(walletAddress, profile.id);
      if (isLinked) {
        throw new Error('This MetaMask wallet is already bound to another account.');
      }
      await authApi.updateWalletAddress(profile.id, walletAddress);
      await refreshProfile();
      setFeedbackMessage({ type: 'success', text: `MetaMask wallet updated: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` });
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update wallet.' });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const handleCopyWallet = () => {
    if (!profile.walletAddress) return;
    navigator.clipboard.writeText(profile.walletAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setSecurityMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword(newPassword);
      setSecurityMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSecurityMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update password.'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      const computedFullName = `${firstName.trim()} ${lastName.trim()}`.trim() || fullName.trim();

      await authApi.updateProfile(profile.id, {
        fullName: computedFullName,
        jobPosition: jobPosition.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        avatarUrl: avatarUrl || undefined
      });

      await refreshProfile();

      setFeedbackMessage({ type: 'success', text: 'Profile changes saved successfully.' });
      if (onProfileUpdated) {
        onProfileUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save changes.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleLabel = () => {
    if (profile.role === 'dswd_admin') return 'DSWD Regional Administrator';
    if (profile.role === 'receiver') {
      if (profile.lguName) return `LGU Relief Officer - ${profile.lguName}`;
      return 'Relief Transporter / Driver';
    }
    return 'DSWD Relief Personnel';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-gray-100 flex flex-col md:flex-row overflow-hidden max-h-[92vh] md:h-[620px] animate-in zoom-in-95 duration-200">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200/80 p-5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="flex items-center justify-between md:justify-start gap-2.5 pb-4 border-b border-slate-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2500ba] text-white shadow-sm font-bold text-sm">
                DS
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Settings</h3>
                <p className="text-[10px] text-slate-500 font-medium">Relief Logistics System</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="mt-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setFeedbackMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer whitespace-nowrap md:whitespace-normal ${
                  activeTab === 'profile'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <User size={16} />
                <div className="flex-1">
                  <span className="block leading-none">Profile</span>
                  <span className={`text-[10px] font-normal hidden md:block mt-0.5 ${
                    activeTab === 'profile' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    Personal & ID Badge
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('wallet');
                  setFeedbackMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer whitespace-nowrap md:whitespace-normal relative ${
                  activeTab === 'wallet'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <Wallet size={16} />
                <div className="flex-1">
                  <span className="block leading-none">MetaMask Wallet</span>
                  <span className={`text-[10px] font-normal hidden md:block mt-0.5 ${
                    activeTab === 'wallet' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    Sepolia Blockchain
                  </span>
                </div>
                {!profile.walletAddress && (
                  <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('security');
                  setFeedbackMessage(null);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left cursor-pointer whitespace-nowrap md:whitespace-normal ${
                  activeTab === 'security'
                    ? 'bg-[#2500ba] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <Lock size={16} />
                <div className="flex-1">
                  <span className="block leading-none">Security</span>
                  <span className={`text-[10px] font-normal hidden md:block mt-0.5 ${
                    activeTab === 'security' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    Password & Access
                  </span>
                </div>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer: Sign Out */}
          {onSignOut && (
            <div className="pt-4 border-t border-slate-200 hidden md:block">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 active:scale-[0.99] transition cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </aside>

        {/* Right Main Content Panel */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {activeTab === 'profile' && 'Profile Settings'}
                {activeTab === 'wallet' && 'MetaMask Wallet Settings'}
                {activeTab === 'security' && 'Security & Account Access'}
              </h2>
              <p className="text-xs text-gray-500">
                {activeTab === 'profile' && 'Manage your official badge, personal identity, and photo'}
                {activeTab === 'wallet' && 'Cryptographic wallet bound to your official role on Sepolia'}
                {activeTab === 'security' && 'Manage authentication credentials and account security'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              aria-label="Close settings window"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Tab Body */}
          <div className="flex-1 overflow-y-auto p-6">
            
            {/* TAB 1: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {feedbackMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      feedbackMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {feedbackMessage.type === 'success' ? (
                      <Check size={16} className="text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-tight">{feedbackMessage.text}</span>
                  </div>
                )}

                {/* Official ID Badge Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                      Official DSWD Badge ID
                    </span>
                    <p className="text-sm font-mono font-black text-blue-950 mt-0.5 tracking-tight">
                      {profile.officialId || 'ADMN-2026-000000001'}
                    </p>
                    <p className="text-[10.5px] text-blue-800/80 mt-0.5">
                      Cryptographically mapped to your Sepolia blockchain transactions
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-xs">
                    <ShieldCheck size={12} />
                    Verified
                  </span>
                </div>

                {/* Profile Photo Section */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                  <div className="relative group flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                      className={`relative flex h-20 w-20 items-center justify-center rounded-full overflow-hidden shadow-md focus:outline-none transition bg-gray-100 cursor-pointer ${
                        !profile.walletAddress
                          ? 'border-2 border-red-500 ring-4 ring-red-400/40'
                          : 'border-2 border-blue-600/30 focus:ring-4 focus:ring-blue-100'
                      }`}
                      title="Click to change profile picture"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={fullName || 'Profile avatar'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className={`flex h-full w-full items-center justify-center text-white text-xl font-black ${
                          !profile.walletAddress ? 'bg-red-600' : 'bg-blue-700'
                        }`}>
                          {getInitials(fullName)}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9.5px] font-bold">
                        <Camera size={18} />
                        <span>Change</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                      className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-white shadow-md border-2 border-white hover:bg-blue-800 transition cursor-pointer"
                      title="Change Photo"
                    >
                      <Camera size={11} />
                    </button>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-xs font-bold text-gray-800">
                      {fullName || 'Personnel Photo'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Upload an official ID portrait or take a real-time camera photo.
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startCamera('user')}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Camera size={12} className="text-blue-600" />
                        <span>Take Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Upload size={12} className="text-indigo-600" />
                        <span>Upload File</span>
                      </button>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Camera Viewfinder */}
                {isCameraActive && (
                  <div className="p-3 bg-gray-900 rounded-2xl space-y-3">
                    <div className="relative aspect-square w-full max-w-[240px] mx-auto rounded-xl overflow-hidden bg-black border border-gray-700">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 pointer-events-none border-2 border-white/40 rounded-full m-3 shadow-inner" />
                    </div>

                    <div className="flex items-center justify-between gap-2 max-w-[280px] mx-auto">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-200 text-xs font-medium hover:bg-gray-700 transition cursor-pointer"
                      >
                        <FlipHorizontal size={14} />
                        <span>Flip</span>
                      </button>

                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold shadow hover:bg-blue-500 transition cursor-pointer"
                      >
                        <Camera size={14} />
                        <span>Snap Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(sanitizeTextOnly(e.target.value))}
                      placeholder="e.g. Maria"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(sanitizeTextOnly(e.target.value))}
                      placeholder="e.g. Santos"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Job Designation</label>
                    <input
                      type="text"
                      value={jobPosition}
                      onChange={(e) => setJobPosition(sanitizeTextOnly(e.target.value))}
                      placeholder="e.g. Logistics Officer"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Designated Role</label>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                    <ShieldCheck size={16} className="text-blue-600 flex-shrink-0" />
                    <span>{getRoleLabel()}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: WALLET */}
            {activeTab === 'wallet' && (
              <div className="space-y-5">
                {feedbackMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      feedbackMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {feedbackMessage.type === 'success' ? (
                      <Check size={16} className="text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-tight">{feedbackMessage.text}</span>
                  </div>
                )}

                {/* Wallet Connection Status Card */}
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Account Wallet Status</span>
                    {profile.walletAddress ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck size={11} className="text-emerald-600" />
                        Bound to Role
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/70 px-2.5 py-0.5 rounded-full border border-red-200">
                        <AlertTriangle size={11} className="text-red-600" />
                        Unlinked (Action Required)
                      </span>
                    )}
                  </div>

                  {profile.walletAddress ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white border border-gray-200 text-xs font-mono text-gray-800 break-all select-all">
                        <span className="flex-1 font-semibold">{profile.walletAddress}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={handleCopyWallet}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                            title="Copy address"
                          >
                            {copiedWallet ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                          <a
                            href={`https://sepolia.etherscan.io/address/${profile.walletAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="View on Sepolia Etherscan"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleLinkWallet}
                          disabled={isLinkingWallet}
                          className="px-4 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
                        >
                          {isLinkingWallet ? 'Switching MetaMask...' : 'Switch MetaMask Account'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        To sign relief dispatch manifests, package handovers, and recipient proofs on Ethereum Sepolia, you must bind your personal MetaMask address.
                      </p>
                      <button
                        type="button"
                        onClick={handleLinkWallet}
                        disabled={isLinkingWallet}
                        className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-[#2500ba]/40 text-xs font-bold text-[#2500ba] hover:bg-[#2500ba]/5 disabled:opacity-50 transition cursor-pointer"
                      >
                        {isLinkingWallet ? 'Connecting MetaMask...' : 'Connect MetaMask Wallet'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Blockchain Network Card */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Blockchain Network</span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-medium block">Target Network</span>
                      <span className="font-bold text-slate-800">Ethereum Sepolia</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-medium block">Chain ID</span>
                      <span className="font-mono font-bold text-slate-800">11155111 (0xaa36a7)</span>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed pt-1">
                    Smart contract events log your Official ID Badge (<code className="font-mono text-slate-700">{profile.officialId || 'ROLE-YYYY-NNNNNNNNN'}</code>) to protect personally identifiable information while guaranteeing immutability.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                {securityMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      securityMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {securityMessage.type === 'success' ? (
                      <Check size={16} className="text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                    )}
                    <span className="leading-tight">{securityMessage.text}</span>
                  </div>
                )}

                {/* Account Email (Read-Only) */}
                <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50 space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">Account Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-mono text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-[10.5px] text-gray-500">
                    Primary login identity managed through Supabase Authentication.
                  </p>
                </div>

                {/* Change Password Form */}
                <form onSubmit={handlePasswordSubmit} className="p-4 rounded-2xl border border-gray-200 bg-white space-y-3.5 shadow-xs">
                  <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                    <KeyRound size={16} className="text-[#2500ba]" />
                    <span className="text-xs font-bold text-gray-800">Change Account Password</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={isChangingPassword || !newPassword}
                      className="px-5 py-2 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Sign Out Option in Security Tab */}
                {onSignOut && (
                  <div className="p-4 rounded-2xl border border-red-200 bg-red-50/60 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-red-900">Active Device Session</p>
                      <p className="text-[10.5px] text-red-700/80">
                        Sign out of your account on this computer or terminal
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-[0.99] transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
