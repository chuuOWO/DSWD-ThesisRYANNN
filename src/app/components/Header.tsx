import { LogOut } from 'lucide-react';
import type { UserRole } from '../hooks/useInventoryState';

interface HeaderProps {
  email?: string;
  roleLabel?: string;
  onSignOut?: () => void;
  currentRole: UserRole;
  walletAddress: string | null;
  walletMessage: string | null;
  onConnectWallet: () => void;
}

const roleDescriptions: Record<UserRole, string> = {
  Admin: 'Can verify/post batch tokens and approve allocations',
  Trucker: 'Can sign release and move shipment in transit',
  LGU: 'Can submit LGU stock reports and confirm receipt',
  Unregistered: 'Connect an assigned MetaMask wallet'
};

const shortenWallet = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function Header({
  email = 'novrindept@swsu.com',
  roleLabel = 'DSWD Admin',
  onSignOut,
  currentRole,
  walletAddress,
  walletMessage,
  onConnectWallet
}: HeaderProps) {
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
        <div className="hidden md:block text-right">
          <p className="text-[11px] uppercase tracking-wide text-blue-100 font-bold">MetaMask RBAC Role</p>
          <p className="text-xs text-blue-50">{roleDescriptions[currentRole]}</p>
          {walletMessage && <p className="text-[11px] font-semibold text-yellow-100">{walletMessage}</p>}
        </div>
        <button
          type="button"
          onClick={onConnectWallet}
          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white"
        >
          {walletAddress ? `${currentRole}: ${shortenWallet(walletAddress)}` : 'Connect MetaMask'}
        </button>
        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center ring-2 ring-blue-500/30">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4 1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-medium">{email}</p>
          <p className="text-blue-100 text-xs">{roleLabel}</p>
        </div>
      </div>
    </div>
  );
}
