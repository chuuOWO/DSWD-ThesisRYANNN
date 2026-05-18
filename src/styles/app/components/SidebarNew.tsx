import { LayoutDashboard, PackagePlus, PackageMinus, Package, MapPin, Settings, Truck } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function SidebarNew({ currentView, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incoming', label: 'Incoming', icon: PackagePlus },
    { id: 'outgoing', label: 'Outgoing', icon: PackageMinus },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'lgu-monitoring', label: 'LGU Monitor', icon: MapPin },
    { id: 'truck-tracking', label: 'Trucking', icon: Truck }
  ];

  return (
    <div className="w-64 bg-white h-full flex flex-col border-r border-gray-200 shadow-sm">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/7/76/Seal_of_the_Department_of_Social_Welfare_and_Development.svg" 
            alt="DSWD Seal" 
            className="h-12 w-auto" 
          />
          <div>
            <h1 className="text-sm font-bold text-gray-900">DSWD FNFI</h1>
            <p className="text-xs text-gray-600">Warehouse System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
