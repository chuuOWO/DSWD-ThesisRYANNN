import { AlertTriangle, LogOut } from 'lucide-react';
import type { UserRole } from '../../hooks/useInventoryState';
import type { UserProfile } from '../../services/authApi';

interface HeaderProps {
  profile?: UserProfile | null;
  email?: string;
  roleLabel?: string;
  onSignOut?: () => void;
  currentRole: UserRole;
  walletAddress: string | null;
  walletMessage: string | null;
  onConnectWallet: () => void;
  onOpenProfileSettings?: () => void;
}

const roleDescriptions: Record<UserRole, string> = {
  Admin: 'Can verify/post batch tokens and approve allocations',
  Receiver: 'Can sign release and move shipment in transit',
  LGUReceiver: 'Can submit LGU stock reports and confirm receipt',
  Unregistered: 'Connect an assigned MetaMask wallet'
};

const shortenWallet = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function Header({
  profile,
  email = 'novrindept@swsu.com',
  roleLabel = 'DSWD Admin',
  onSignOut,
  currentRole,
  walletAddress,
  walletMessage,
  onConnectWallet,
  onOpenProfileSettings
}: HeaderProps) {
  const isAdmin = profile?.role === 'dswd_admin' || currentRole === 'Admin';
  const isWalletLinked = Boolean(profile?.walletAddress);

  // Clean field user role label & organization
  const fieldRoleBadge = profile?.role === 'receiver'
    ? (profile.lguName ? 'LGU Receiving Officer' : 'Field Transport Driver')
    : roleLabel;
  const fieldOrganization = profile?.lguName || 'DSWD Logistics Bureau';

  return (
    <div className="bg-blue-700 h-16 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg"
          alt="DSWD Seal"
          className="h-14 w-auto drop-shadow-lg"
        />
      </div>

      <div className="flex items-center gap-4">
        {isAdmin ? (
          <>
            <div className="hidden md:block text-right">
              <p className="text-[11px] uppercase tracking-wide text-blue-100 font-bold">MetaMask RBAC Role</p>
              <p className="text-xs text-blue-50">{roleDescriptions[currentRole]}</p>
              {walletMessage && <p className="text-[11px] font-semibold text-yellow-100">{walletMessage}</p>}
            </div>
            <button
              type="button"
              onClick={onConnectWallet}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white transition cursor-pointer"
            >
              {walletAddress ? `${currentRole}: ${shortenWallet(walletAddress)}` : 'Connect MetaMask'}
            </button>

            {/* Admin Profile Avatar & Warning Indicator */}
            <div className="relative group">
              <button
                type="button"
                onClick={onOpenProfileSettings}
                title={!isWalletLinked ? "You need to open profile and link it to MetaMask." : "Click to view profile settings"}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  !isWalletLinked
                    ? 'border-2 border-red-500 ring-2 ring-red-400/60 bg-red-950/20'
                    : 'ring-2 ring-blue-500/30 bg-blue-600 hover:ring-white/50'
                }`}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName || 'Admin avatar'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : profile?.fullName ? (
                  <span className="text-white text-xs font-bold">
                    {profile.fullName.slice(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4 1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}

                {!isWalletLinked && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md ring-2 ring-white">
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>

              {!isWalletLinked && (
                <div className="absolute top-full mt-2.5 right-0 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-red-900 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl border border-red-700/60">
                  You need to open profile and link it to MetaMask.
                  <div className="absolute -top-1 right-3 border-4 border-transparent border-b-red-900" />
                </div>
              )}
            </div>

            <div
              onClick={onOpenProfileSettings}
              className="text-right cursor-pointer group/user"
              title="Click to view profile settings"
            >
              <p className="text-white text-sm font-medium group-hover/user:underline">{profile?.fullName || email}</p>
              <p className={`text-xs ${!isWalletLinked ? 'text-red-300 font-semibold' : 'text-blue-100'}`}>
                {!isWalletLinked ? 'MetaMask Unlinked' : roleLabel}
              </p>
            </div>
          </>
        ) : (
          /* Field Personnel Header - Zero Web3 Mentions */
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 ring-2 ring-white/30 flex items-center justify-center text-white font-bold text-xs">
              {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : 'FD'}
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-bold">{profile?.fullName || email}</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/50 text-blue-100 text-[10px] font-extrabold uppercase tracking-wider">
                  {fieldRoleBadge}
                </span>
                <span className="text-[11px] text-blue-200 font-medium">
                  {fieldOrganization}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
