import { useState } from 'react';
import { LayoutDashboard, PackagePlus, PackageMinus, Package, MapPin, Settings, Truck, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsModal } from '../modals/SettingsModal';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({ currentView, onNavigate, onSignOut, onOpenSettings }: SidebarProps) {
  const { profile } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incoming', label: 'Incoming', icon: PackagePlus },
    { id: 'outgoing', label: 'Outgoing', icon: PackageMinus },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'lgu-monitoring', label: 'LGU Monitor', icon: MapPin },
    { id: 'truck-tracking', label: 'Trucking', icon: Truck },
    { id: 'accounts', label: 'Accounts', icon: Users }
  ];

  return (
    <div className="w-64 bg-white h-full flex flex-col border-r border-gray-200 shadow-sm select-none">
      {/* Navigation */}
      <div className="flex-1 p-4 overflow-y-auto">
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

      {/* Footer / Profile Status & Settings Button */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* User Profile Card (Display Badge - Non-clickable) */}
        {profile && (
          <div
            className={`mb-2 p-2.5 rounded-xl border flex items-center gap-2.5 select-none ${
              !profile.walletAddress
                ? 'bg-red-50/80 border-red-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="relative flex-shrink-0">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName || 'Admin avatar'}
                  className={`h-8 w-8 rounded-full object-cover flex-shrink-0 ${
                    !profile.walletAddress ? 'border-2 border-red-500' : 'border border-blue-500/40'
                  }`}
                />
              ) : (
                <div className={`h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  !profile.walletAddress ? 'bg-red-600' : 'bg-blue-700'
                }`}>
                  {(profile.fullName || 'AD').slice(0, 2).toUpperCase()}
                </div>
              )}
              {!profile.walletAddress && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center ring-1 ring-white shadow">
                  <AlertTriangle className="w-2 h-2" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {profile.fullName || 'DSWD Officer'}
                </p>
                {!profile.walletAddress && (
                  <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                )}
              </div>
              <p className={`text-[10px] truncate ${!profile.walletAddress ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                {!profile.walletAddress ? 'Smart Account Unprovisioned' : (profile.role === 'dswd_admin' ? 'DSWD Admin' : 'Officer')}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => (onOpenSettings ? onOpenSettings() : setIsProfileModalOpen(true))}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5 text-gray-600" />
          <span>Settings</span>
        </button>

        {/* Settings Modal fallback if rendered inside Sidebar */}
        {profile && !onOpenSettings && (
          <SettingsModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            profile={profile}
          />
        )}
      </div>
    </div>
  );
}
