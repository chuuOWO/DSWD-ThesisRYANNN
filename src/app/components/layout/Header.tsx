import type { UserRole } from '../../hooks/useInventoryState';
import type { UserProfile } from '../../services/authApi';

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
}

const roleDescriptions: Record<UserRole, string> = {
  Admin: 'Can verify/post batch tokens and approve allocations',
  Receiver: 'Can sign release and move shipment in transit',
  LGUReceiver: 'Can submit LGU stock reports and confirm receipt',
  Unregistered: 'Provision a gasless Smart Account'
};

const shortenWallet = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export function Header({
  profile,
  email = '',
  roleLabel = 'DSWD Admin',
  onSignOut,
  currentRole,
  walletAddress,
  walletMessage,
  onConnectWallet,
  onOpenProfileSettings
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
    </div>
  );
}
