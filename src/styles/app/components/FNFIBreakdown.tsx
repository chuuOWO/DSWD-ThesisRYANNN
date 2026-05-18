import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Package, TrendingUp, AlertCircle } from 'lucide-react';

interface FNFIItem {
  category: string;
  requested: number;
  allocated: number;
  released: number;
  distributed: number;
  icon: string;
  color: string;
}

export function FNFIBreakdown() {
  const fnfiData: FNFIItem[] = [
    {
      category: 'Food Packs',
      requested: 5000,
      allocated: 4200,
      released: 3800,
      distributed: 3500,
      icon: '🍱',
      color: 'bg-blue-500'
    },
    {
      category: 'Hygiene Kits',
      requested: 3000,
      allocated: 2800,
      released: 2500,
      distributed: 2300,
      icon: '🧼',
      color: 'bg-green-500'
    },
    {
      category: 'Family Kits',
      requested: 2500,
      allocated: 2000,
      released: 1800,
      distributed: 1600,
      icon: '👨‍👩‍👧‍👦',
      color: 'bg-purple-500'
    },
    {
      category: 'Sleeping Kits',
      requested: 2000,
      allocated: 1800,
      released: 1500,
      distributed: 1400,
      icon: '🛏️',
      color: 'bg-orange-500'
    },
    {
      category: 'Kitchen Kits',
      requested: 1500,
      allocated: 1200,
      released: 1000,
      distributed: 900,
      icon: '🍳',
      color: 'bg-pink-500'
    },
    {
      category: 'Laminated Sacks',
      requested: 4000,
      allocated: 3500,
      released: 3200,
      distributed: 3000,
      icon: '🛍️',
      color: 'bg-teal-500'
    },
    {
      category: 'RTEF',
      requested: 1800,
      allocated: 1600,
      released: 1400,
      distributed: 1200,
      icon: '🏕️',
      color: 'bg-indigo-500'
    }
  ];

  const chartData = fnfiData.map(item => ({
    name: item.category,
    Requested: item.requested,
    Allocated: item.allocated,
    Released: item.released,
    Distributed: item.distributed
  }));

  const totalStats = {
    requested: fnfiData.reduce((sum, item) => sum + item.requested, 0),
    allocated: fnfiData.reduce((sum, item) => sum + item.allocated, 0),
    released: fnfiData.reduce((sum, item) => sum + item.released, 0),
    distributed: fnfiData.reduce((sum, item) => sum + item.distributed, 0)
  };

  const allocationRate = Math.round((totalStats.allocated / totalStats.requested) * 100);
  const releaseRate = Math.round((totalStats.released / totalStats.allocated) * 100);
  const distributionRate = Math.round((totalStats.distributed / totalStats.released) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">FNFI Breakdown</h1>
        <p className="text-sm text-gray-600 mt-1">Track inventory movement by item category</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5" />
            <span className="text-sm font-semibold opacity-90">Total Requested</span>
          </div>
          <p className="text-3xl font-bold">{totalStats.requested.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">Baseline requirement</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold opacity-90">Total Allocated</span>
          </div>
          <p className="text-3xl font-bold">{totalStats.allocated.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${allocationRate}%` }}></div>
            </div>
            <span className="text-xs font-bold">{allocationRate}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold opacity-90">Total Released</span>
          </div>
          <p className="text-3xl font-bold">{totalStats.released.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${releaseRate}%` }}></div>
            </div>
            <span className="text-xs font-bold">{releaseRate}%</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-semibold opacity-90">Total Distributed</span>
          </div>
          <p className="text-3xl font-bold">{totalStats.distributed.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${distributionRate}%` }}></div>
            </div>
            <span className="text-xs font-bold">{distributionRate}%</span>
          </div>
        </div>
      </div>

      {/* Inventory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {fnfiData.map((item, index) => {
          const allocationPct = Math.round((item.allocated / item.requested) * 100);
          const releasePct = Math.round((item.released / item.allocated) * 100);
          const distributionPct = Math.round((item.distributed / item.released) * 100);

          return (
            <div key={index} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-2xl`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900">{item.category}</h3>
                    <p className="text-xs text-gray-500">FNFI Category</p>
                  </div>
                </div>
                {allocationPct < 70 && (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600">Requested</span>
                    <span className="text-sm font-bold text-gray-900">{item.requested.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full"></div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600">Allocated</span>
                    <span className="text-sm font-bold text-purple-600">{item.allocated.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${allocationPct}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{allocationPct}% of requested</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600">Released</span>
                    <span className="text-sm font-bold text-green-600">{item.released.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${releasePct}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{releasePct}% of allocated</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-600">Distributed</span>
                    <span className="text-sm font-bold text-teal-600">{item.distributed.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${distributionPct}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{distributionPct}% of released</p>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700">Pending</span>
                    <span className="text-sm font-bold text-orange-600">
                      {(item.requested - item.distributed).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stacked Bar Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Movement Comparison Chart</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 12, fontWeight: 600 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
              <Bar dataKey="Requested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Allocated" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Released" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Distributed" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Warehouse Movement Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Warehouse Movement Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Item Category</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Requested</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Allocated</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Released</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Distributed</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fnfiData.map((item, index) => {
                const pending = item.requested - item.distributed;
                const completionPct = Math.round((item.distributed / item.requested) * 100);

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <span className="font-bold text-sm text-gray-900">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-gray-900">{item.requested.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-purple-600">{item.allocated.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-green-600">{item.released.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-teal-600">{item.distributed.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-orange-600">{pending.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              completionPct >= 75 ? 'bg-green-500' :
                              completionPct >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${completionPct}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-sm text-gray-900 w-12 text-right">
                          {completionPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
