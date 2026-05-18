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

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const inventoryState = useInventoryState();

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
          {renderView()}
        </main>
      </div>
    </div>
  );
}
