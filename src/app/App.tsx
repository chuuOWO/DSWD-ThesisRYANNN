import { useEffect, useState } from 'react';
import {
  Header,
  Sidebar,
  DashboardView,
  IncomingModule,
  OutgoingModule,
  InventoryMonitoring,
  LGUMonitoring,
  TruckTracking,
  ReceiverPage,
  AuthPage,
  LGUReceiverPage,
  QrCodeGeneratorModal,
  AccountManagement,
  ProfileSettingsModal,
  ConfirmLogoutModal,
  MetaMaskMismatchModal
} from './components';
import { useInventoryState, type UserRole } from './hooks/useInventoryState';
import { useAuth } from './contexts/AuthContext';
import { authApi, type UserProfile } from './services/authApi';
import { blockchain } from './services/blockchain';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
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
        <LGUReceiverPage
          profile={activeProfile}
          releases={inventoryState.outgoingReleasesList}
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
      </>
    );
  }

  // If receiver has no assigned LGU, route to ReceiverPage (Receiver view)
  if (activeProfile.role === 'receiver' || ['/receiver', '/trucker'].includes(window.location.pathname)) {
    return (
      <>
        <ReceiverPage profile={activeProfile} onSignOut={requestSignOut} />
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
        return <TruckTracking outgoingReleasesList={inventoryState.outgoingReleasesList} />;
      case 'qr-generator':
        return <OutgoingModule inventoryState={inventoryState} currentRole={currentRole} />;
      case 'accounts':
        return <AccountManagement currentAdminEmail={activeProfile.email} />;
      case 'dashboard':
      default:
        return <DashboardView inventoryState={inventoryState} onNavigate={setCurrentView} />;
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
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentView={currentView} onNavigate={setCurrentView} onSignOut={requestSignOut} />

        <main className="flex-1 overflow-auto p-8">
          {renderView()}
        </main>
      </div>

      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={activeProfile}
        onSignOut={requestSignOut}
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
