'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  AlertTriangle,
  Camera, 
  Check, 
  FlipHorizontal, 
  Lock,
  LogOut,
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Trash2, 
  Upload, 
  User, 
  X 
} from 'lucide-react';
import { authApi, type UserProfile } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';
import { blockchain } from '../../services/blockchain';
import { sanitizeTextOnly } from '../../lib/inputValidation';

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

  const [fullName, setFullName] = useState(profile.fullName || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl || null);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);

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
      setFeedbackMessage({ type: 'success', text: `Wallet permanently linked: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` });
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to link wallet.' });
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync with profile prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setFullName(profile.fullName || '');
      setAvatarUrl(profile.avatarUrl || null);
      setIsPhotoMenuOpen(false);
      setIsCameraActive(false);
      setFeedbackMessage(null);
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

  // Crop & compress image to square canvas (256x256)
  const processImageToDataUrl = (image: CanvasImageSource, naturalWidth: number, naturalHeight: number): string => {
    const targetSize = 256;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Calculate center square crop
    const minDim = Math.min(naturalWidth, naturalHeight);
    const sx = (naturalWidth - minDim) / 2;
    const sy = (naturalHeight - minDim) / 2;

    ctx.drawImage(image, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setFeedbackMessage({ type: 'error', text: 'Camera feed not ready yet.' });
      return;
    }

    const compressed = processImageToDataUrl(video, video.videoWidth, video.videoHeight);
    if (compressed) {
      setAvatarUrl(compressed);
      setFeedbackMessage({ type: 'success', text: 'Photo captured. Click Save Changes to apply.' });
    }
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPhotoMenuOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMessage({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const compressed = processImageToDataUrl(img, img.width, img.height);
        setAvatarUrl(compressed);
        setFeedbackMessage({ type: 'success', text: 'Image loaded. Click Save Changes to apply.' });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setIsPhotoMenuOpen(false);
    setAvatarUrl(null);
    setFeedbackMessage({ type: 'success', text: 'Photo removed. Click Save Changes to apply.' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Full name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      await authApi.updateProfile(profile.id, {
        fullName: fullName.trim(),
        avatarUrl
      });

      await refreshProfile();
      onProfileUpdated?.();

      setFeedbackMessage({ type: 'success', text: 'Profile updated successfully.' });
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 900);
    } catch (err) {
      setIsSaving(false);
      setFeedbackMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile.'
      });
    }
  };

  if (!isOpen) return null;

  // Initials fallback
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    if (profile.role === 'dswd_admin') return 'DSWD Administrator';
    if (profile.lguName) return `LGU Receiver (${profile.lguName})`;
    if (profile.truckId) return `Truck Driver (${profile.truckId})`;
    return 'Authorized Receiver';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-bold text-gray-900">Profile Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* Feedback Toast */}
          {feedbackMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <Check size={16} className="text-emerald-600 flex-shrink-0" />
              ) : (
                <X size={16} className="text-red-600 flex-shrink-0" />
              )}
              <span className="leading-tight">{feedbackMessage.text}</span>
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full overflow-hidden shadow-md focus:outline-none transition bg-gray-100 cursor-pointer ${
                  !profile.walletAddress
                    ? 'border-2 border-red-500 ring-4 ring-red-400/40'
                    : 'border-2 border-blue-600/30 focus:ring-4 focus:ring-blue-100'
                }`}
                title={!profile.walletAddress ? "You need to open profile and link it to MetaMask." : "Click to change profile picture"}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Profile avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center text-white text-2xl font-black ${
                    !profile.walletAddress ? 'bg-red-600' : 'bg-blue-700'
                  }`}>
                    {getInitials(fullName)}
                  </div>
                )}

                {/* Hover Camera Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                  <Camera size={20} />
                  <span>Change</span>
                </div>
              </button>

              {/* Warning sign badge if unlinked */}
              {!profile.walletAddress && (
                <span
                  className="absolute -top-1 -right-1 z-10 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg ring-2 ring-white"
                  title="You need to open profile and link it to MetaMask."
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
              )}

              {/* Bottom camera button badge */}
              <button
                type="button"
                onClick={() => setIsPhotoMenuOpen((prev) => !prev)}
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-white shadow-md border-2 border-white hover:bg-blue-800 transition cursor-pointer"
                title="Change Photo"
              >
                <Camera size={13} />
              </button>
            </div>

            <p className="mt-2 text-xs font-bold text-gray-800">
              {fullName || 'User Profile'}
            </p>
            {!profile.walletAddress ? (
              <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                You need to open profile and link it to MetaMask.
              </p>
            ) : (
              <p className="text-[11px] text-gray-500">
                Click photo to take picture or upload file
              </p>
            )}

            {/* Photo Actions Dropdown / Sheet */}
            {isPhotoMenuOpen && (
              <div className="mt-3 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => startCamera('user')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-left transition"
                >
                  <Camera size={14} className="text-blue-600" />
                  <span>Take a Picture</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-left transition"
                >
                  <Upload size={14} className="text-indigo-600" />
                  <span>Upload from Files</span>
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg text-left transition"
                  >
                    <Trash2 size={14} className="text-red-500" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Camera Viewfinder View (When taking a picture) */}
          {isCameraActive && (
            <div className="p-3 bg-gray-900 rounded-xl space-y-3">
              <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-lg overflow-hidden bg-black border border-gray-700">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Circular target frame */}
                <div className="absolute inset-0 pointer-events-none border-2 border-white/40 rounded-full m-4 shadow-inner" />
              </div>

              <div className="flex items-center justify-between gap-2 px-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-200 text-xs font-medium hover:bg-gray-700 transition"
                  title="Switch Camera (Front / Back)"
                >
                  <FlipHorizontal size={14} />
                  <span>Flip</span>
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold shadow hover:bg-blue-500 transition"
                >
                  <Camera size={14} />
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Full Name Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(sanitizeTextOnly(e.target.value))}
              placeholder="e.g. Maria Santos"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              required
            />
          </div>

          {/* Email (Read-Only) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Account Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-xs font-mono text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Wallet Address Section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Linked MetaMask Wallet
              </label>
              {profile.walletAddress && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <Lock size={10} className="text-emerald-600" />
                  Permanently Bound
                </span>
              )}
            </div>
            {profile.walletAddress ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-mono text-gray-700 break-all select-all">
                  <Lock size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 font-semibold">{profile.walletAddress}</span>
                </div>
                <p className="text-[10.5px] text-gray-500 leading-tight">
                  For blockchain accountability and audit integrity, linked wallets cannot be modified or unlinked after registration.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleLinkWallet}
                  disabled={isLinkingWallet}
                  className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-[#2500ba]/40 text-xs font-bold text-[#2500ba] hover:bg-[#2500ba]/5 disabled:opacity-50 transition cursor-pointer"
                >
                  {isLinkingWallet ? 'Connecting MetaMask...' : 'Link MetaMask Wallet'}
                </button>
                <p className="text-[10.5px] text-gray-500 leading-tight">
                  Once linked, this wallet will be permanently bound to your account for signing delivery and receipt proofs.
                </p>
              </div>
            )}
          </div>

          {/* Role & Assignment Info */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Designated Role
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
              <ShieldCheck size={16} className="text-blue-600 flex-shrink-0" />
              <span>{getRoleLabel()}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#2500ba] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

          {/* Sign Out Section - Last Option */}
          {onSignOut && (
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-700">Account Session</p>
                <p className="text-[11px] text-gray-500">Sign out of this device</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition cursor-pointer"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

