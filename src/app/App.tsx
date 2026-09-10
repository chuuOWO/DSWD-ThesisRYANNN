import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SidebarNew } from './components/SidebarNew';
import { DashboardView } from './components/DashboardView';
import { IncomingModule } from './components/IncomingModule';
import { OutgoingModuleNew } from './components/OutgoingModuleNew';
import { InventoryMonitoring } from './components/InventoryMonitoring';
import { LGUMonitoringNew } from './components/LGUMonitoringNew';
import { TruckTracking } from './components/TruckTracking';
import { TruckerLocationPage } from './components/TruckerLocationPage';
import { AuthPage } from './components/AuthPage';
import { LGUReceiptPage } from './components/LGUReceiptPage';
import { useInventoryState, type UserRole } from './hooks/useInventoryState';
import { useAuth } from './contexts/AuthContext';
import { authApi } from './services/authApi';
import { blockchain } from './services/blockchain';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('Unregistered');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const { session, profile, isLoading, signOut } = useAuth();
  const inventoryState = useInventoryState(Boolean(session));

  const refreshWalletRole = async () => {
    const address = await blockchain.getConnectedWalletAddress();
    setWalletAddress(address);
    setCurrentRole(blockchain.getWalletRole(address));
  };

  useEffect(() => {
    refreshWalletRole().catch(() => {
      setWalletAddress(null);
      setCurrentRole('Unregistered');
    });

    return blockchain.onAccountsChanged(() => {
      refreshWalletRole().catch(() => {
        setWalletAddress(null);
        setCurrentRole('Unregistered');
      });
    });
  }, []);

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

  if (activeProfile.role === 'receiver' && ['/lgu', '/lgu-receipt'].includes(window.location.pathname)) {
    return (
      <LGUReceiptPage
        profile={activeProfile}
        releases={inventoryState.outgoingReleasesList}
        onAccept={inventoryState.receiverAcceptWithGps}
        onSignOut={signOut}
      />
    );
  }

  if (activeProfile.role === 'receiver' || window.location.pathname === '/trucker') {
    return <TruckerLocationPage profile={activeProfile} onSignOut={signOut} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'incoming':
        return <IncomingModule inventoryState={inventoryState} currentRole={currentRole} />;
      case 'outgoing':
        return <OutgoingModuleNew inventoryState={inventoryState} currentRole={currentRole} />;
      case 'inventory':
        return <InventoryMonitoring inventoryState={inventoryState} />;
      case 'lgu-monitoring':
        return <LGUMonitoringNew inventoryState={inventoryState} currentRole={currentRole} />;
      case 'truck-tracking':
        return <TruckTracking outgoingReleasesList={inventoryState.outgoingReleasesList} />;
      case 'dashboard':
      default:
        return <DashboardView inventoryState={inventoryState} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="size-full flex flex-col bg-gray-50">
      <Header
        email={activeProfile.email}
        roleLabel={authApi.roleLabels[activeProfile.role]}
        onSignOut={signOut}
        currentRole={currentRole}
        walletAddress={walletAddress}
        walletMessage={walletMessage}
        onConnectWallet={handleConnectWallet}
      />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNew currentView={currentView} onNavigate={setCurrentView} onSignOut={signOut} />

        <main className="flex-1 overflow-auto p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
