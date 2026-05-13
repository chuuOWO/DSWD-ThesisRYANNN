import { Users, UserCheck, UserPlus, TrendingUp } from 'lucide-react';

export function BeneficiaryStats() {
  const stats = [
    {
      label: 'Total Beneficiaries',
      value: '24,567',
      change: '+12%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Served This Month',
      value: '8,432',
      change: '+8%',
      trend: 'up',
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'New Registrations',
      value: '1,245',
      change: '+23%',
      trend: 'up',
      icon: UserPlus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Active Requests',
      value: '342',
      change: '-5%',
      trend: 'down',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-5">Beneficiary Statistics</h2>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`${stat.bgColor} p-4 rounded-xl border border-gray-100`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center ring-2 ring-white`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  stat.trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {stat.change}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 tracking-tight mb-1">{stat.value}</div>
                <div className="text-xs font-semibold text-gray-600 tracking-tight">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-5 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Distribution Coverage</p>
            <p className="text-xs text-gray-600 mt-0.5">12 municipalities served</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">87%</p>
            <p className="text-xs text-gray-600">Target achieved</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: '87%' }}></div>
        </div>
      </div>
    </div>
  );
}
