import { HelpCircle } from 'lucide-react';
import type { IncomingGoods, OutgoingRelease, UserRole } from '../../hooks/useInventoryState';
import type { UserProfile } from '../../services/authApi';
import { useGuideMode } from '../../contexts/GuideContext';
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
  const { showDescriptions, toggleDescriptions } = useGuideMode();

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
        {/* Global Guide Instructions Toggle Pill */}
        <button
          type="button"
          onClick={toggleDescriptions}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
            showDescriptions
              ? 'bg-amber-400 text-amber-950 border-amber-300 hover:bg-amber-300'
              : 'bg-white/15 text-blue-100 hover:bg-white/25 border-white/20'
          }`}
          title="Toggle descriptive help notes and subtitles under charts and tables"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Instructions: {showDescriptions ? 'ON' : 'OFF'}</span>
        </button>

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

