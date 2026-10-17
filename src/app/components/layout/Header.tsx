import type { IncomingGoods, OutgoingRelease, UserRole } from '../../hooks/useInventoryState';
import type { UserProfile } from '../../services/authApi';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  profile?: UserProfile | null;
  email?: string;
  roleLabel?: string;
  onSignOut?: () => void;
  currentRole: UserRole;
  walletAddress: string | null;
  walletMessage?: string | null;
  onConnectWallet: () => void;
  onOpenProfileSettings?: () => void;
  incomingGoodsList?: IncomingGoods[];
  outgoingReleasesList?: OutgoingRelease[];
  inventory?: { category: string; totalStock?: number; available?: number }[];
  onNavigate?: (view: string) => void;
}

export function Header({
  profile,
  email = '',
  roleLabel = 'DSWD Admin',
  onSignOut,
  currentRole,
  walletAddress,
  walletMessage,
  onConnectWallet,
  onOpenProfileSettings,
  incomingGoodsList = [],
  outgoingReleasesList = [],
  inventory = [],
  onNavigate
}: HeaderProps) {
  return (
    <div className="bg-blue-700 h-16 px-6 flex items-center justify-between shadow-sm select-none">
      <div className="flex items-center gap-3">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg"
          alt="DSWD Seal"
          className="h-12 w-auto drop-shadow-md"
        />
        <div>
          <h1 className="text-white text-sm font-extrabold tracking-wide uppercase leading-tight">
            Department of Social Welfare and Development
          </h1>
          <p className="text-blue-100 text-[11px] font-medium">
            Disaster Response Operations & Logistics Management System &mdash; Field Office VI
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onNavigate && (
          <NotificationDropdown
            incomingGoodsList={incomingGoodsList}
            outgoingReleasesList={outgoingReleasesList}
            inventory={inventory}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}
export default Header;

