interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Main Dash' },
    { id: 'outgoing', label: 'Outgoing' },
    { id: 'lgu-monitoring', label: 'LGU Monitor' },
    { id: 'fnfi-breakdown', label: 'FNFI Breakdown' },
    { id: 'delivery-status', label: 'Delivery Status' }
  ];

  return (
    <div className="w-36 bg-white h-full flex flex-col justify-between p-4 border-r border-gray-100">
      <div className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`px-4 py-3 rounded-xl text-xs font-semibold tracking-tight text-left transition-all ${
              currentView === item.id
                ? 'bg-blue-700 text-white'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button className="text-blue-700 px-4 py-3 text-xs font-semibold tracking-tight text-left border border-gray-200 rounded-xl hover:bg-blue-50 transition-all">
        Settings
      </button>
    </div>
  );
}
