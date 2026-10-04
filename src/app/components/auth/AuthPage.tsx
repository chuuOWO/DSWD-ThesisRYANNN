import { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Upload,
  Wallet,
  X
} from 'lucide-react';
import { authApi, UserRole } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';
import { blockchain } from '../../services/blockchain';
import { FiveDotsLoadingModal } from '../design/FiveDotsLoadingModal';
import { sanitizeTextOnly } from '../../lib/inputValidation';
import dswdLogo from '../../../imports/dswdlogo.png';
import dswdBuilding from '../../../imports/dswd_building.png';

const generateTruckId = () => {
  const number = Math.floor(1 + Math.random() * 9999);
  return `RCVR-${String(number).padStart(4, '0')}`;
};

// Moving watercolor gradient styling for mobile views
const mobileWatercolorStyle: React.CSSProperties = {
  backgroundColor: '#f2f8fc',
  backgroundImage: `
    radial-gradient(ellipse at 85% 15%, rgba(162, 206, 233, 0.6) 0%, transparent 55%),
    radial-gradient(ellipse at 15% 35%, rgba(185, 219, 239, 0.7) 0%, transparent 60%),
    radial-gradient(ellipse at 75% 65%, rgba(153, 201, 232, 0.55) 0%, transparent 55%),
    radial-gradient(ellipse at 25% 85%, rgba(197, 227, 245, 0.75) 0%, transparent 50%),
    linear-gradient(135deg, #f7fbfd 0%, #e8f4fa 45%, #d9edf7 75%, #eff7fb 100%)
  `
};

export function AuthPage() {
  const { refreshProfile } = useAuth();

  // Mode for authentication flow
  // Mobile uses: 'landpage' -> 'login' | 'signup' | 'awaiting_verification'
  // Desktop straight up uses: 'login' | 'signup' | 'awaiting_verification'
  const [mobileScreen, setMobileScreen] = useState<'landpage' | 'login' | 'signup' | 'awaiting_verification'>('landpage');
  const [desktopMode, setDesktopMode] = useState<'login' | 'signup' | 'awaiting_verification'>('login');

  const [role, setRole] = useState<UserRole>('dswd_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [jobPosition, setJobPosition] = useState('');
  const [workIdUrl, setWorkIdUrl] = useState<string | null>(null);
  const [workIdFileName, setWorkIdFileName] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [truckId] = useState(generateTruckId);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Work ID Image Upload Handler (reads, resizes, and base64 encodes)
  const handleWorkIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, or JPEG) for your Work ID.');
      return;
    }
    setWorkIdFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setWorkIdUrl(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Transition state for mobile screen glide
  const [isMobileTransitioning, setIsMobileTransitioning] = useState(false);

  // 5-dots Loading modal state
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [loadingTitle, setLoadingTitle] = useState('Authenticating Account');
  const [loadingSubtitle, setLoadingSubtitle] = useState('Verifying credentials...');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transitionMobileTo = (nextScreen: 'landpage' | 'login' | 'signup' | 'awaiting_verification') => {
    setErrorMessage(null);
    setIsMobileTransitioning(true);
    setTimeout(() => {
      setMobileScreen(nextScreen);
      setIsMobileTransitioning(false);
    }, 200);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    setLoadingTitle('Logging In');
    setLoadingSubtitle('Verifying your account details...');
    setIsLoadingModalOpen(true);

    try {
      await authApi.signIn(email.trim(), password);
      await refreshProfile();
    } catch (authErr: any) {
      if (authErr?.message === 'PENDING_VERIFICATION') {
        setSubmittedEmail(email.trim());
        setMobileScreen('awaiting_verification');
        setDesktopMode('awaiting_verification');
        return;
      }
      if (authErr?.message === 'ACCOUNT_REJECTED') {
        setErrorMessage('Account registration was declined by the administrator. Please contact your coordinator.');
        return;
      }
      setErrorMessage(authErr instanceof Error ? authErr.message : 'Invalid credentials. Please try again.');
    } finally {
      setIsLoadingModalOpen(false);
    }
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter both your First Name and Last Name.');
      return;
    }
    if (!jobPosition.trim()) {
      setErrorMessage('Please enter your Job Position / Designation.');
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your contact phone number.');
      return;
    }
    if (!workIdUrl) {
      setErrorMessage('Please upload a photo of your official DSWD Work ID or Government ID.');
      return;
    }

    setLoadingTitle('Creating Account');
    setLoadingSubtitle('Recording your details for verification...');
    setIsLoadingModalOpen(true);

    try {
      const computedFullName = `${firstName.trim()} ${lastName.trim()}`;
      await authApi.signUp({
        email: email.trim(),
        password,
        fullName: computedFullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        jobPosition: jobPosition.trim(),
        workIdUrl: workIdUrl || undefined,
        role,
        truckId: role === 'receiver' ? truckId.trim() : undefined,
        walletAddress: walletAddress.trim() || undefined
      });

      setSubmittedEmail(email.trim());
      setMobileScreen('awaiting_verification');
      setDesktopMode('awaiting_verification');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoadingModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen w-full select-none font-sans antialiased">
      {/* ====================================================================
          1. DESKTOP VIEW (hidden on mobile, visible on md and up)
          Straight up Login or Register card matching user's reference photo
          with the DSWD building image on the right.
          ==================================================================== */}
      <div className="hidden md:flex min-h-screen w-full bg-gradient-to-br from-[#060c28] via-[#0b1754] to-[#122475] animate-dark-blue-shift items-center justify-center p-6 lg:p-10 relative overflow-hidden">
        {/* Moving Luminous White & Pale Ice Ambient Glows */}
        <div
          className="absolute -top-32 -left-20 w-[650px] h-[650px] rounded-full bg-white/20 blur-[130px] animate-white-glow-1 pointer-events-none"
          style={{ willChange: 'transform' }}
        />
        <div
          className="absolute -bottom-36 -right-20 w-[700px] h-[700px] rounded-full bg-white/25 blur-[140px] animate-white-glow-2 pointer-events-none"
          style={{ willChange: 'transform' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none"
        />

        {/* Desktop Card (matches media_1790442167680.png) with luminous ambient rim halo */}
        <div className="w-full max-w-4xl bg-white rounded-[32px] p-8 lg:p-12 shadow-[0_25px_70px_rgba(0,0,0,0.5),0_0_90px_rgba(255,255,255,0.18)] border border-white/60 grid grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-center relative z-10 animate-in fade-in duration-300">
          {/* Left Column: Direct Authentication / Form */}
          <div className="flex flex-col justify-between h-full py-2">
            <div>
              {/* Header Branding Row */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-white border-2 border-yellow-400 p-1.5 shadow-sm flex items-center justify-center flex-shrink-0">
                  <img
                    src={dswdLogo}
                    alt="DSWD Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-xs font-bold text-[#10069f] leading-snug">
                  Department of Social Welfare<br />and Development
                </div>
              </div>

              {/* DESKTOP MODE: LOGIN */}
              {desktopMode === 'login' && (
                <form onSubmit={handleLogin} className="mt-8 space-y-4">
                  <h1 className="text-3xl font-black text-[#10069f] tracking-tight">
                    Login
                  </h1>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  {/* Username / Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Username
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter username / email"
                      className="w-full px-4 py-3 rounded-2xl border border-indigo-200/90 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                  </div>

                  {/* Wallet / Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Wallet/Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-4 py-3 pr-10 rounded-2xl border border-indigo-200/90 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit / Connect Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoadingModalOpen}
                      className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      Login
                    </button>
                  </div>

                  {/* Register Switch */}
                  <div className="pt-2 text-center text-xs text-slate-500">
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setDesktopMode('signup');
                      }}
                      className="font-bold text-[#10069f] hover:underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </div>
                </form>
              )}

              {/* DESKTOP MODE: REGISTER */}
              {desktopMode === 'signup' && (
                <form onSubmit={handleSignUp} className="mt-6 space-y-3">
                  <h1 className="text-3xl font-black text-[#10069f] tracking-tight">
                    Register
                  </h1>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                      {errorMessage}
                    </div>
                  )}

                  {/* Role Switcher */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Role
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setRole('dswd_admin')}
                        className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                          role === 'dswd_admin'
                            ? 'bg-[#10069f] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        DSWD Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('receiver')}
                        className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                          role === 'receiver'
                            ? 'bg-[#10069f] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Receiver / LGU
                      </button>
                    </div>
                  </div>

                  {/* Names (2 Columns) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(sanitizeTextOnly(e.target.value))}
                        placeholder="e.g. Maria"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(sanitizeTextOnly(e.target.value))}
                        placeholder="e.g. Santos"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                    </div>
                  </div>

                  {/* Job Position & Contact Phone Number (2 Columns) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Job Position <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={jobPosition}
                        onChange={(e) => setJobPosition(sanitizeTextOnly(e.target.value))}
                        placeholder="e.g. Relief Driver / Officer"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. 09171234567"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                    </div>
                  </div>

                  {/* Username / Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter official email address"
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Work ID Photo Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Work ID / Driver&apos;s License <span className="text-red-500">*</span>
                    </label>
                    {workIdUrl ? (
                      <div className="flex items-center gap-3 p-2 rounded-2xl border border-emerald-300 bg-emerald-50/70">
                        <img
                          src={workIdUrl}
                          alt="Work ID Preview"
                          className="w-12 h-12 object-cover rounded-xl border border-emerald-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-emerald-900 truncate">
                            {workIdFileName || 'Work ID Photo Attached'}
                          </p>
                          <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Ready for verification review
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setWorkIdUrl(null);
                            setWorkIdFileName(null);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Remove photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-[#10069f] bg-slate-50/60 hover:bg-indigo-50/30 transition cursor-pointer text-xs text-[#10069f] font-semibold">
                        <Upload className="w-4 h-4 text-[#10069f]" />
                        <span>Upload Work ID / Driver&apos;s License</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWorkIdFileChange}
                          className="hidden"
                          required
                        />
                      </label>
                    )}
                  </div>

                  {/* Optional MetaMask Link */}
                  <div>
                    {walletAddress ? (
                      <div className="w-full py-2 px-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-[11px] font-mono text-emerald-800 flex items-center justify-between">
                        <span className="truncate">{walletAddress}</span>
                        <button
                          type="button"
                          onClick={() => setWalletAddress('')}
                          className="text-emerald-600 hover:text-emerald-800 ml-2 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setErrorMessage(null);
                          try {
                            const { walletAddress: addr } = await blockchain.connectWallet();
                            if (addr) {
                              const isLinked = await authApi.isWalletLinked(addr);
                              if (isLinked) {
                                setErrorMessage('This wallet is already linked to another account.');
                                return;
                              }
                              setWalletAddress(addr);
                            }
                          } catch {
                            // user cancelled
                          }
                        }}
                        className="w-full py-2 rounded-2xl border border-dashed border-indigo-300 hover:border-[#10069f] text-xs font-medium text-[#10069f] hover:bg-indigo-50/50 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Link MetaMask Wallet (Optional)</span>
                      </button>
                    )}
                  </div>

                  {/* Submit Register Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoadingModalOpen}
                      className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      Register
                    </button>
                  </div>

                  {/* Back to Login */}
                  <div className="pt-1 text-center text-xs text-slate-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setDesktopMode('login');
                      }}
                      className="font-bold text-[#10069f] hover:underline cursor-pointer"
                    >
                      Login here
                    </button>
                  </div>
                </form>
              )}

              {/* DESKTOP MODE: AWAITING VERIFICATION */}
              {desktopMode === 'awaiting_verification' && (
                <div className="mt-8 space-y-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-100/50">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>

                  <h2 className="text-2xl font-black text-[#10069f] tracking-tight">
                    WAITING FOR VERIFICATION
                  </h2>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Your account has been submitted and is currently awaiting administrator review. You will be able to log in once verified.
                  </p>

                  {submittedEmail && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>{submittedEmail}</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setPassword('');
                        setDesktopMode('login');
                      }}
                      className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Help & Info Button */}
            <div className="pt-6 flex justify-between items-center text-xs text-slate-400 border-t border-slate-100 mt-6">
              <span>Relief Goods Tracker &bull; DSWD</span>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="hover:text-[#10069f] transition cursor-pointer"
              >
                Help &bull; Contact
              </button>
            </div>
          </div>

          {/* Right Column: DSWD Building Image (exactly as in media_1790442167680.png) */}
          <div className="w-full h-full min-h-[440px] rounded-[28px] overflow-hidden shadow-xl border border-slate-100 flex items-center justify-center bg-slate-50">
            <img
              src={dswdBuilding}
              alt="Department of Social Welfare and Development Building Facade"
              className="w-full h-full object-cover rounded-[28px]"
            />
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. MOBILE VIEW (visible on mobile screens, hidden on md and up)
          Multi-step flow matching media_1790441434376.png:
          - Landing intro view first with "Next" button only
          - Smooth transition into login or register card
          ==================================================================== */}
      <div
        className="flex md:hidden min-h-screen w-full flex-col justify-between relative overflow-hidden"
        style={mobileWatercolorStyle}
      >
        {/* Floating animated blobs for mobile watercolor aesthetic */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#9ed2f0]/40 blur-3xl animate-blob-1" />
          <div className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-[#bde0f5]/50 blur-3xl animate-blob-2" />
        </div>

        {/* ----------------------------------------------------
            MOBILE SCREEN 1: LANDING INTRO VIEW (with Next button only)
            ---------------------------------------------------- */}
        {mobileScreen === 'landpage' && (
          <div
            className={`w-full min-h-screen p-6 sm:p-7 flex flex-col justify-between relative z-10 transition-all duration-300 transform ${
              isMobileTransitioning
                ? 'opacity-0 scale-95 translate-y-3'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {/* Top Right Help (?) Icon */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="w-8 h-8 rounded-full border border-[#10069f]/30 flex items-center justify-center text-[#10069f] font-bold text-sm bg-white/50 hover:bg-white transition cursor-pointer"
                title="Help"
              >
                ?
              </button>
            </div>

            {/* Bottom Content Area */}
            <div className="mt-auto pb-6 space-y-6">
              {/* DSWD Logo + Text in a row */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border-2 border-yellow-400 p-1.5 shadow-sm flex items-center justify-center flex-shrink-0">
                  <img
                    src={dswdLogo}
                    alt="DSWD Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-[11px] font-semibold text-slate-800 leading-tight">
                  Department of Social Welfare<br />and Development
                </div>
              </div>

              {/* Title & Official Tagline */}
              <div>
                <h1 className="text-3xl font-black text-[#10069f] tracking-tight leading-[1.08]">
                  RELIEF<br />GOODS TRACKER
                </h1>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Prioritizing the greatest need. Securing every handover.
                </p>
              </div>

              {/* Next Button Only (as explicitly requested) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => transitionMobileTo('login')}
                  className="w-full py-4 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-xl shadow-blue-900/30 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            MOBILE SCREEN 2: LOGIN (login)
            ---------------------------------------------------- */}
        {mobileScreen === 'login' && (
          <div
            className={`w-full min-h-screen flex flex-col justify-between bg-white relative z-10 transition-all duration-300 transform ${
              isMobileTransitioning
                ? 'opacity-0 scale-95 translate-y-3'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {/* Top Area with Watercolor Wash + DSWD Logo */}
            <div
              className="w-full h-[220px] p-6 flex flex-col justify-between relative flex-shrink-0"
              style={mobileWatercolorStyle}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => transitionMobileTo('landpage')}
                  className="w-8 h-8 rounded-full border border-[#10069f]/20 flex items-center justify-center text-[#10069f] hover:bg-white/60 transition cursor-pointer"
                  title="Back to landing"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className="w-8 h-8 rounded-full border border-[#10069f]/30 flex items-center justify-center text-[#10069f] font-bold text-sm hover:bg-white/60 transition cursor-pointer"
                  title="Help"
                >
                  ?
                </button>
              </div>

              <div className="flex justify-center pb-2">
                <div className="w-16 h-16 rounded-xl bg-white border-2 border-yellow-400 p-2 shadow-md flex items-center justify-center">
                  <img
                    src={dswdLogo}
                    alt="DSWD Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Bottom White Card */}
            <div className="flex-1 bg-white px-7 pt-6 pb-8 flex flex-col justify-between rounded-t-[32px] -mt-6 relative z-10 shadow-lg">
              <form onSubmit={handleLogin} className="space-y-4 my-auto">
                <h2 className="text-2xl font-black text-[#10069f] tracking-wide mb-5">
                  WELCOME
                </h2>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {errorMessage}
                  </div>
                )}

                {/* User / Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    User
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-4 py-3 rounded-2xl border border-indigo-200/90 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-4 py-3 pr-10 rounded-2xl border border-indigo-200/90 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Login Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isLoadingModalOpen}
                    className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    Login
                  </button>
                </div>

                {/* Register Link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => transitionMobileTo('signup')}
                    className="text-xs font-semibold text-slate-500 hover:text-[#10069f] transition cursor-pointer"
                  >
                    Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            MOBILE SCREEN 3: REGISTER (signup)
            ---------------------------------------------------- */}
        {mobileScreen === 'signup' && (
          <div
            className={`w-full min-h-screen flex flex-col justify-between bg-white relative z-10 transition-all duration-300 transform ${
              isMobileTransitioning
                ? 'opacity-0 scale-95 translate-y-3'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {/* Top Area with Watercolor Wash + DSWD Logo */}
            <div
              className="w-full h-[180px] p-6 flex flex-col justify-between relative flex-shrink-0"
              style={mobileWatercolorStyle}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => transitionMobileTo('login')}
                  className="w-8 h-8 rounded-full border border-[#10069f]/20 flex items-center justify-center text-[#10069f] hover:bg-white/60 transition cursor-pointer"
                  title="Back to login"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className="w-8 h-8 rounded-full border border-[#10069f]/30 flex items-center justify-center text-[#10069f] font-bold text-sm hover:bg-white/60 transition cursor-pointer"
                  title="Help"
                >
                  ?
                </button>
              </div>

              <div className="flex justify-center pb-1">
                <div className="w-14 h-14 rounded-xl bg-white border-2 border-yellow-400 p-2 shadow-md flex items-center justify-center">
                  <img
                    src={dswdLogo}
                    alt="DSWD Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Bottom White Card */}
            <div className="flex-1 bg-white px-7 pt-5 pb-8 flex flex-col justify-between rounded-t-[32px] -mt-5 relative z-10 shadow-lg overflow-y-auto">
              <form onSubmit={handleSignUp} className="space-y-3.5 my-auto">
                <h2 className="text-2xl font-black text-[#10069f] tracking-wide mb-2">
                  REGISTER
                </h2>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {errorMessage}
                  </div>
                )}

                {/* Role Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setRole('dswd_admin')}
                      className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                        role === 'dswd_admin'
                          ? 'bg-[#10069f] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      DSWD Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('receiver')}
                      className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                        role === 'receiver'
                          ? 'bg-[#10069f] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Receiver / LGU
                    </button>
                  </div>
                </div>

                {/* First and Last Name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(sanitizeTextOnly(e.target.value))}
                      placeholder="e.g. Maria"
                      className="w-full px-3 py-2 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(sanitizeTextOnly(e.target.value))}
                      placeholder="e.g. Santos"
                      className="w-full px-3 py-2 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                  </div>
                </div>

                {/* Job Position */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Position / Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={jobPosition}
                    onChange={(e) => setJobPosition(sanitizeTextOnly(e.target.value))}
                    placeholder="e.g. Relief Truck Driver / Dispatcher"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 09171234567"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3.5 py-2.5 pr-9 rounded-2xl border border-indigo-200/90 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#10069f] focus:ring-2 focus:ring-indigo-100 transition bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Work ID Photo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Work ID Photo <span className="text-red-500">*</span>
                  </label>
                  {workIdUrl ? (
                    <div className="flex items-center gap-3 p-2 rounded-2xl border border-emerald-300 bg-emerald-50/70">
                      <img
                        src={workIdUrl}
                        alt="Work ID Preview"
                        className="w-12 h-12 object-cover rounded-xl border border-emerald-200"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-emerald-900 truncate">
                          {workIdFileName || 'Work ID Photo Attached'}
                        </p>
                        <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Attached
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkIdUrl(null);
                          setWorkIdFileName(null);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-[#10069f] bg-slate-50/60 hover:bg-indigo-50/30 transition cursor-pointer text-xs text-[#10069f] font-semibold">
                      <Upload className="w-4 h-4 text-[#10069f]" />
                      <span>Upload Work ID Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleWorkIdFileChange}
                        className="hidden"
                        required
                      />
                    </label>
                  )}
                </div>

                {/* Optional MetaMask Link */}
                <div>
                  {walletAddress ? (
                    <div className="w-full py-2 px-3 rounded-2xl border border-emerald-300 bg-emerald-50 text-[11px] font-mono text-emerald-800 flex items-center justify-between">
                      <span className="truncate">{walletAddress}</span>
                      <button
                        type="button"
                        onClick={() => setWalletAddress('')}
                        className="text-emerald-600 hover:text-emerald-800 ml-2 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setErrorMessage(null);
                        try {
                          const { walletAddress: addr } = await blockchain.connectWallet();
                          if (addr) {
                            const isLinked = await authApi.isWalletLinked(addr);
                            if (isLinked) {
                              setErrorMessage('This wallet is already linked to another account.');
                              return;
                            }
                            setWalletAddress(addr);
                          }
                        } catch {
                          // user cancelled
                        }
                      }}
                      className="w-full py-2 rounded-2xl border border-dashed border-indigo-300 hover:border-[#10069f] text-xs font-medium text-[#10069f] hover:bg-indigo-50/50 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Link MetaMask Wallet (Optional)</span>
                    </button>
                  )}
                </div>

                {/* Submit Register Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoadingModalOpen}
                    className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    Register
                  </button>
                </div>

                {/* Back to Login Link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => transitionMobileTo('login')}
                    className="text-xs font-semibold text-slate-500 hover:text-[#10069f] transition cursor-pointer"
                  >
                    Already have an account? Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            MOBILE SCREEN 4: AWAITING VERIFICATION
            ---------------------------------------------------- */}
        {mobileScreen === 'awaiting_verification' && (
          <div
            className={`w-full min-h-screen flex flex-col justify-between bg-white relative z-10 transition-all duration-300 transform ${
              isMobileTransitioning
                ? 'opacity-0 scale-95 translate-y-3'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {/* Top Area with Watercolor Wash + DSWD Logo */}
            <div
              className="w-full h-[220px] p-6 flex flex-col justify-between relative flex-shrink-0"
              style={mobileWatercolorStyle}
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(true)}
                  className="w-8 h-8 rounded-full border border-[#10069f]/30 flex items-center justify-center text-[#10069f] font-bold text-sm hover:bg-white/60 transition cursor-pointer"
                  title="Help"
                >
                  ?
                </button>
              </div>

              <div className="flex justify-center pb-2">
                <div className="w-16 h-16 rounded-xl bg-white border-2 border-yellow-400 p-2 shadow-md flex items-center justify-center">
                  <img
                    src={dswdLogo}
                    alt="DSWD Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Bottom White Card */}
            <div className="flex-1 bg-white px-7 pt-8 pb-8 flex flex-col justify-between rounded-t-[32px] -mt-6 relative z-10 shadow-lg text-center">
              <div className="my-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-100/50">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>

                <h2 className="text-xl font-black text-[#10069f] tracking-tight">
                  WAITING FOR VERIFICATION
                </h2>

                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Your account has been submitted and is currently awaiting administrator review. You will be able to log in once verified.
                </p>

                {submittedEmail && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>{submittedEmail}</span>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setPassword('');
                    transitionMobileTo('login');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#10069f] hover:bg-[#0c0480] text-white font-bold text-sm shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5-Dots Loading Screen */}
      <FiveDotsLoadingModal
        isOpen={isLoadingModalOpen}
        title={loadingTitle}
        subtitle={loadingSubtitle}
      />

      {/* Clean Minimalist Help (?) Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#10069f]">
                Relief Goods Tracker
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                <strong>DSWD Relief Goods Tracker</strong> monitors relief pack distribution from regional warehouses to local government units.
              </p>
              <p className="text-[11px] italic text-slate-500">
                &ldquo;Prioritizing the greatest need. Securing every handover.&rdquo;
              </p>
              <div className="rounded-2xl bg-blue-50/80 p-3 space-y-1 text-slate-700">
                <p className="font-bold text-[#10069f]">Account Verification</p>
                <p className="text-[11px] leading-relaxed">
                  All accounts require administrator verification prior to sign-in.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
