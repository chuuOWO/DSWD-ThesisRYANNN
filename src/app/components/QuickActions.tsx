import { Plus, TruckIcon, FileText, Users, BarChart3, Download } from 'lucide-react';

export function QuickActions() {
  const actions = [
    {
      icon: Plus,
      label: 'New Delivery',
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Schedule new distribution'
    },
    {
      icon: TruckIcon,
      label: 'Track Vehicle',
      color: 'bg-green-600 hover:bg-green-700',
      description: 'Real-time tracking'
    },
    {
      icon: FileText,
      label: 'Generate Report',
      color: 'bg-purple-600 hover:bg-purple-700',
      description: 'Export data'
    },
    {
      icon: Users,
      label: 'Beneficiaries',
      color: 'bg-orange-600 hover:bg-orange-700',
      description: 'Manage recipients'
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      color: 'bg-indigo-600 hover:bg-indigo-700',
      description: 'View insights'
    },
    {
      icon: Download,
      label: 'Import Data',
      color: 'bg-teal-600 hover:bg-teal-700',
      description: 'Upload inventory'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-5">Quick Actions</h2>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={index}
              className={`${action.color} text-white p-4 rounded-xl transition-all hover:shadow-lg group`}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight">{action.label}</div>
                  <div className="text-xs opacity-90 mt-0.5">{action.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
