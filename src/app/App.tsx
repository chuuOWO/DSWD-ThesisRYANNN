import { useState } from 'react';
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
import { useInventoryState } from './hooks/useInventoryState';
import { useAuth } from './contexts/AuthContext';
import { authApi } from './services/authApi';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const { session, profile, isLoading, signOut } = useAuth();
  const inventoryState = useInventoryState(Boolean(session));

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

  if (profile.role === 'receiver' && ['/lgu', '/lgu-receipt'].includes(window.location.pathname)) {
    return (
      <LGUReceiptPage
        profile={profile}
        releases={inventoryState.outgoingReleasesList}
        onAccept={inventoryState.receiverAcceptWithGps}
        onSignOut={signOut}
      />
    );
  }

  if (profile.role === 'receiver' || window.location.pathname === '/trucker') {
    return <TruckerLocationPage profile={profile} onSignOut={signOut} />;
  }

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
      <Header
        email={profile.email}
        roleLabel={authApi.roleLabels[profile.role]}
        onSignOut={signOut}
      />

      <div className="flex flex-1 overflow-hidden">
        <SidebarNew currentView={currentView} onNavigate={setCurrentView} />

        <main className="flex-1 overflow-auto p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
