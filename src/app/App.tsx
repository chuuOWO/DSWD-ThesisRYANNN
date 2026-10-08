import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { AuthPage } from './components/auth/AuthPage';
import { SettingsModal } from './components/modals/SettingsModal';
import { ConfirmLogoutModal } from './components/modals/ConfirmLogoutModal';
import { MetaMaskMismatchModal } from './components/modals/MetaMaskMismatchModal';
import { useInventoryState, type UserRole } from './hooks/useInventoryState';
import { useAuth } from './contexts/AuthContext';
import { authApi, type UserProfile } from './services/authApi';
import { blockchain } from './services/blockchain';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded operational views for bundle splitting and faster initial load
const DashboardView = lazy(() => import('./components/views/DashboardView').then(m => ({ default: m.DashboardView })));
const IncomingModule = lazy(() => import('./components/views/IncomingModule').then(m => ({ default: m.IncomingModule })));
const OutgoingModule = lazy(() => import('./components/views/OutgoingModule').then(m => ({ default: m.OutgoingModule })));
const InventoryMonitoring = lazy(() => import('./components/views/InventoryMonitoring').then(m => ({ default: m.InventoryMonitoring })));
const LGUMonitoring = lazy(() => import('./components/views/LGUMonitoring').then(m => ({ default: m.LGUMonitoring || m.default })));
const TruckTracking = lazy(() => import('./components/views/TruckTracking').then(m => ({ default: m.TruckTracking })));
const ReceiverPage = lazy(() => import('./components/views/ReceiverPage').then(m => ({ default: m.ReceiverPage })));
const LGUReceiverPage = lazy(() => import('./components/views/LGUReceiverPage').then(m => ({ default: m.LGUReceiverPage })));
const AccountManagement = lazy(() => import('./components/views/AccountManagement').then(m => ({ default: m.AccountManagement })));
const MasterDataView = lazy(() => import('./components/views/MasterDataView').then(m => ({ default: m.MasterDataView })));

function ViewLoading() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-[#2500ba] border-t-transparent" />
        <span className="text-xs font-semibold text-gray-500">Loading module...</span>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('Unregistered');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletMismatch, setWalletMismatch] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const { session, profile, isLoading, signOut } = useAuth();
  const inventoryState = useInventoryState(Boolean(session), profile);

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
      setWalletMessage(null);
    }
  };

  useEffect(() => {
    refreshWalletRole().catch(() => {
      setWalletAddress(null);
      setCurrentRole('Unregistered');
      setWalletMismatch(false);
      setWalletMessage(null);
    });

    return blockchain.onAccountsChanged(() => {
      refreshWalletRole().catch(() => {
        setWalletAddress(null);
        setCurrentRole('Unregistered');
        setWalletMismatch(false);
        setWalletMessage(null);
      });
    });
  }, [profile?.walletAddress]);

  // Preload primary view modules after authentication
  useEffect(() => {
    if (session) {
      import('./components/views/DashboardView').catch(() => {});
      import('./components/views/ReceiverPage').catch(() => {});
      import('./components/views/LGUReceiverPage').catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    if (session || profile) {
      console.log('[DSWD App State] Session:', session?.user?.email, '| Profile:', profile?.email, '| Role:', profile?.role, '| Status:', profile?.status);
    }
  }, [session, profile]);

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
        <div className="rounded-lg bg-white border border-gray-200 px-6 py-4 text-sm font-bold text-gray-700 shadow-sm flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2500ba] border-t-transparent" />
          <span>Loading secure session...</span>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  // Non-verified accounts cannot access operational interfaces
  if (profile.status !== 'verified' && profile.role !== 'dswd_admin') {
    void signOut();
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
      <Suspense fallback={<ViewLoading />}>
        <LGUReceiverPage
          profile={activeProfile}
          releases={inventoryState.outgoingReleasesList}
          lgusList={inventoryState.lgusList}
          onAccept={inventoryState.receiverAcceptWithGps}
          onSignOut={requestSignOut}
        />
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
      </Suspense>
    );
  }

  // If receiver has no assigned LGU, route to ReceiverPage (Receiver view)
  if (activeProfile.role === 'receiver' || ['/receiver', '/trucker'].includes(window.location.pathname)) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <ReceiverPage profile={activeProfile} lgusList={inventoryState.lgusList} onSignOut={requestSignOut} />
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
      </Suspense>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'incoming':
        return <IncomingModule inventoryState={inventoryState} currentRole={currentRole} />;
      case 'outgoing':
        return <OutgoingModule inventoryState={inventoryState} currentRole={currentRole} />;
      case 'inventory':
        return <InventoryMonitoring inventoryState={inventoryState} />;
      case 'lgu-monitoring':
        return <LGUMonitoring inventoryState={inventoryState} currentRole={currentRole} />;
      case 'truck-tracking':
        return <TruckTracking outgoingReleasesList={inventoryState.outgoingReleasesList} lgusList={inventoryState.lgusList} />;
      case 'qr-generator':
        return <OutgoingModule inventoryState={inventoryState} currentRole={currentRole} />;
      case 'accounts':
        return <AccountManagement currentAdminEmail={activeProfile.email} releases={inventoryState.outgoingReleasesList} lgusList={inventoryState.lgusList} />;
      case 'master-data':
        return <MasterDataView />;
      case 'dashboard':
      default:
        return <DashboardView inventoryState={inventoryState} onNavigate={setCurrentView} adminProfile={activeProfile} />;
    }
  };

  return (
    <div className="size-full flex flex-col bg-gray-50">
      {walletMismatch && profile?.walletAddress && walletAddress && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="font-bold">MetaMask Account Mismatch</span>
            <span className="text-amber-700">
              Registered: <span className="font-mono">{profile.walletAddress.slice(0, 6)}...{profile.walletAddress.slice(-4)}</span>
              {' '}&mdash; Active: <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </span>
          </div>
          <button
            onClick={async () => {
              try {
                const eth = (window as any).ethereum;
                await eth?.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
              } catch { /* user cancelled */ }
            }}
            className="flex-shrink-0 px-3 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700 transition"
          >
            Switch Account
          </button>
        </div>
      )}
      <Header
        profile={activeProfile}
        email={activeProfile.email}
        roleLabel="DSWD Admin"
        onSignOut={requestSignOut}
        currentRole={currentRole}
        walletAddress={walletAddress}
        walletMessage={walletMessage}
        onConnectWallet={handleConnectWallet}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          currentView={currentView} 
          onNavigate={setCurrentView} 
          onSignOut={requestSignOut}
          onOpenSettings={() => setIsProfileModalOpen(true)}
        />

        <main className="flex-1 overflow-auto p-8">
          <ErrorBoundary key={currentView}>
            <Suspense fallback={<ViewLoading />}>
              {renderView()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <SettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={activeProfile}
        onSignOut={requestSignOut}
        adminActionsEnabled={inventoryState.adminActionsEnabled}
        onToggleAdminActions={inventoryState.setAdminActionsEnabled}
      />

      <ConfirmLogoutModal
        isOpen={isLogoutConfirmOpen}
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false);
          await signOut();
        }}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />

      <MetaMaskMismatchModal
        isOpen={walletMismatch && Boolean(profile?.walletAddress)}
        registeredWallet={profile?.walletAddress || ''}
        activeWallet={walletAddress}
        onSignOut={async () => {
          await signOut();
        }}
      />
    </div>
  );
}
