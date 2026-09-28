import { AlertTriangle, Lock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';

interface MetaMaskMismatchModalProps {
  isOpen: boolean;
  registeredWallet: string;
  activeWallet: string | null;
  userRole?: string | null;
  onSignOut: () => void | Promise<void>;
  onSwitchAccount?: () => void | Promise<void>;
}

const shorten = (addr?: string | null) => {
  if (!addr) return 'None';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export function MetaMaskMismatchModal({
  isOpen,
  registeredWallet,
  activeWallet,
  userRole,
  onSignOut,
  onSwitchAccount
}: MetaMaskMismatchModalProps) {
  if (!isOpen) return null;

  // Strictly render if and only if user is Admin - field users never see MetaMask warnings
  if (userRole && userRole !== 'Admin' && userRole !== 'dswd_admin') {
    return null;
  }

  const handleRequestSwitch = async () => {
    if (onSwitchAccount) {
      await onSwitchAccount();
      return;
    }
    try {
      const eth = (window as any).ethereum;
      if (!eth) return;
      await eth.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch {
      // User dismissed prompt
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-red-200 overflow-hidden flex flex-col">
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-700 px-6 py-5 text-white flex items-center gap-3.5 shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center flex-shrink-0 ring-2 ring-white/30">
            <ShieldAlert className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight leading-tight">
              Wrong MetaMask Account Connected
            </h2>
            <p className="text-xs text-red-100 font-medium mt-0.5">
              Strict 1-to-1 account binding policy is active
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            For security, chain of custody, and tamper-proof audit trails, your DSWD profile is permanently bound to a registered MetaMask wallet. Operations are locked until your active wallet matches.
          </p>

          {/* Account Comparison Box */}
          <div className="space-y-3">
            {/* Registered Expected Account */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    Expected Wallet (Bound to Profile)
                  </p>
                  <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                    Authorized
                  </span>
                </div>
                <p className="font-mono text-xs font-bold text-emerald-950 mt-1 break-all select-all">
                  {registeredWallet}
                </p>
              </div>
            </div>

            {/* Active Connected Account */}
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-900">
                    Current Active Account in MetaMask
                  </p>
                  <span className="text-[10px] font-bold bg-red-200 text-red-900 px-2 py-0.5 rounded-full">
                    Unauthorized
                  </span>
                </div>
                <p className="font-mono text-xs font-bold text-red-950 mt-1 break-all select-all">
                  {activeWallet || 'No account active / MetaMask locked'}
                </p>
              </div>
            </div>
          </div>

          {/* Live Detection Radar Notice */}
          <div className="rounded-2xl bg-blue-50 border border-blue-200/80 p-3.5 flex items-center gap-3 text-xs text-blue-900">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600" />
            </span>
            <span className="leading-snug">
              <strong>Live Detection Active:</strong> Open your MetaMask extension and switch to{' '}
              <span className="font-mono font-bold text-blue-950">{shorten(registeredWallet)}</span>. This screen will unlock automatically the moment it matches.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleRequestSwitch}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#2500ba] hover:bg-[#1a008c] text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Switch Account in MetaMask</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
