import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, PackagePlus, PackageMinus, Package, MapPin, Settings, Truck, LogOut, Sliders, Bell } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onSignOut?: () => void;
}

export function SidebarNew({ currentView, onNavigate, onSignOut }: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

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

      {/* Footer / Settings */}
      <div ref={settingsRef} className="p-4 border-t border-gray-200 relative">
        {/* Settings Text Bubble */}
        {isSettingsOpen && (
          <div className="absolute bottom-full left-4 mb-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* Bubble arrow pointing down */}
            <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-white border-b border-r border-gray-200 rotate-45" />

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg text-left transition"
              >
                <Sliders className="w-4 h-4 text-gray-400" />
                <span>Temporary Option 1</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg text-left transition"
              >
                <Bell className="w-4 h-4 text-gray-400" />
                <span>Temporary Option 2</span>
              </button>

              <div className="my-1.5 border-t border-gray-100" />

              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  onSignOut?.();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg text-left transition"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            isSettingsOpen ? 'bg-gray-200 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
