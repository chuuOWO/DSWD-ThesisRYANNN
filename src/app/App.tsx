<<<<<<< Updated upstream
import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarNew } from './components/SidebarNew';
import { DashboardView } from './components/DashboardView';
import { IncomingModule } from './components/IncomingModule';
import { OutgoingModuleNew } from './components/OutgoingModuleNew';
import { InventoryMonitoring } from './components/InventoryMonitoring';
import { LGUMonitoringNew } from './components/LGUMonitoringNew';
import { TruckTracking } from './components/TruckTracking';
import { useInventoryState } from './hooks/useInventoryState';
=======
import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthPage } from './components/auth/AuthPage';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ProfileSettingsModal } from './components/modals/ProfileSettingsModal';
import { ConfirmLogoutModal } from './components/modals/ConfirmLogoutModal';
import { MetaMaskMismatchModal } from './components/modals/MetaMaskMismatchModal';
import { useInventoryState, type UserRole } from './hooks/useInventoryState';
import { useAuth } from './contexts/AuthContext';
import { authApi, type UserProfile } from './services/authApi';
import { blockchain } from './services/blockchain';
>>>>>>> Stashed changes

const DashboardView = lazy(() => import('./components/views/DashboardView').then(({ DashboardView }) => ({ default: DashboardView })));
const IncomingModule = lazy(() => import('./components/views/IncomingModule').then(({ IncomingModule }) => ({ default: IncomingModule })));
const OutgoingModule = lazy(() => import('./components/views/OutgoingModule').then(({ OutgoingModule }) => ({ default: OutgoingModule })));
const InventoryMonitoring = lazy(() => import('./components/views/InventoryMonitoring').then(({ InventoryMonitoring }) => ({ default: InventoryMonitoring })));
const LGUMonitoring = lazy(() => import('./components/views/LGUMonitoring').then(({ LGUMonitoring }) => ({ default: LGUMonitoring })));
const TruckTracking = lazy(() => import('./components/views/TruckTracking').then(({ TruckTracking }) => ({ default: TruckTracking })));
const ReceiverPage = lazy(() => import('./components/views/ReceiverPage').then(({ ReceiverPage }) => ({ default: ReceiverPage })));
const LGUReceiverPage = lazy(() => import('./components/views/LGUReceiverPage').then(({ LGUReceiverPage }) => ({ default: LGUReceiverPage })));
const AccountManagement = lazy(() => import('./components/views/AccountManagement').then(({ AccountManagement }) => ({ default: AccountManagement })));

const ViewLoading = () => (
  <div className="flex min-h-48 items-center justify-center text-sm text-gray-600" role="status" aria-live="polite">
    Loading view...
  </div>
);

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
<<<<<<< Updated upstream
  const inventoryState = useInventoryState();
=======
  const [currentRole, setCurrentRole] = useState<UserRole>('Unregistered');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletMismatch, setWalletMismatch] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const { session, profile, isLoading, signOut, refreshProfile } = useAuth();
  const inventoryState = useInventoryState(Boolean(session));

  const requestSignOut = () => setIsLogoutConfirmOpen(true);

  const refreshWalletRole = async () => {
    const address = await blockchain.getConnectedWalletAddress();
    setWalletAddress(address);
    if (address) {
      const role = await blockchain.getWalletRoleFromDb(address);
      setCurrentRole(role);
      if (profile?.walletAddress && address.toLowerCase() !== profile.walletAddress.toLowerCase()) {
        setWalletMismatch(true);
      } else {
        setWalletMismatch(false);
      }
    } else {
      setCurrentRole('Unregistered');
      setWalletMismatch(false);
    }
  };

  useEffect(() => {
    refreshWalletRole().catch(() => {
      setWalletAddress(null);
      setCurrentRole('Unregistered');
      setWalletMismatch(false);
    });

    return blockchain.onAccountsChanged(() => {
      refreshWalletRole().catch(() => {
        setWalletAddress(null);
        setCurrentRole('Unregistered');
        setWalletMismatch(false);
      });
    });
  }, [profile?.walletAddress]);

  const handleConnectWallet = async () => {
    try {
      const connected = await blockchain.connectWallet();
      setWalletAddress(connected.walletAddress);
      setCurrentRole(connected.role);
      setWalletMessage(connected.role === 'Unregistered' ? 'Connected wallet is not assigned to an RBAC role.' : null);
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : 'Unable to connect MetaMask.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-lg bg-white border border-gray-200 px-6 py-4 text-sm font-bold text-gray-700 shadow-sm">
          Loading secure session...
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  const activeProfile: UserProfile = profile;

  // If receiver has an assigned LGU, route directly to LGUReceiverPage (LGUReciever view)
  // Or if route is explicitly /lgu, /lgu-receipt, /lgu-receiver, or /lgu-reciever
  const isLguReceiver = activeProfile.role === 'receiver' && (
    Boolean(activeProfile.lguName && activeProfile.lguName.trim()) ||
    ['/lgu', '/lgu-receipt', '/lgu-receiver', '/lgu-reciever'].includes(window.location.pathname)
  );

  if (isLguReceiver) {
    return (
      <>
        <Suspense fallback={<ViewLoading />}>
          <LGUReceiverPage
            profile={activeProfile}
            releases={inventoryState.outgoingReleasesList}
            onAccept={inventoryState.receiverAcceptWithGps}
            onSignOut={requestSignOut}
          />
        </Suspense>
        <MetaMaskMismatchModal
          isOpen={walletMismatch && Boolean(profile?.walletAddress)}
          registeredWallet={profile?.walletAddress || ''}
          activeWallet={walletAddress}
          onSignOut={async () => {
            await signOut();
          }}
        />
        <ConfirmLogoutModal
          isOpen={isLogoutConfirmOpen}
          onConfirm={async () => {
            setIsLogoutConfirmOpen(false);
            await signOut();
          }}
          onCancel={() => setIsLogoutConfirmOpen(false)}
        />
      </>
    );
  }

  // If receiver has no assigned LGU, route to ReceiverPage (Receiver view)
  if (activeProfile.role === 'receiver' || ['/receiver', '/trucker'].includes(window.location.pathname)) {
    return (
      <>
        <Suspense fallback={<ViewLoading />}>
          <ReceiverPage profile={activeProfile} onSignOut={requestSignOut} />
        </Suspense>
        <MetaMaskMismatchModal
          isOpen={walletMismatch && Boolean(profile?.walletAddress)}
          registeredWallet={profile?.walletAddress || ''}
          activeWallet={walletAddress}
          onSignOut={async () => {
            await signOut();
          }}
        />
        <ConfirmLogoutModal
          isOpen={isLogoutConfirmOpen}
          onConfirm={async () => {
            setIsLogoutConfirmOpen(false);
            await signOut();
          }}
          onCancel={() => setIsLogoutConfirmOpen(false)}
        />
      </>
    );
  }
>>>>>>> Stashed changes

  const renderView = () => {
    switch (currentView) {
      case 'incoming':
        return <IncomingModule inventoryState={inventoryState} />;
      case 'outgoing':
        return <OutgoingModuleNew inventoryState={inventoryState} />;
      case 'inventory':
        return <InventoryMonitoring inventoryState={inventoryState} />;
      case 'lgu-monitoring':
        return <LGUMonitoringNew inventoryState={inventoryState} />;
      case 'truck-tracking':
        return <TruckTracking />;
      case 'dashboard':
      default:
        return <DashboardView inventoryState={inventoryState} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="size-full flex flex-col bg-gray-50">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNew currentView={currentView} onNavigate={setCurrentView} />

        <main className="flex-1 overflow-auto p-8">
          <Suspense fallback={<ViewLoading />}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
