import { AlertTriangle, TrendingUp, Users, Home } from 'lucide-react';

interface LGUData {
  municipality: string;
  affectedFamilies: number;
  displacedFamilies: number;
  requested: number;
  allocated: number;
  released: number;
  variance: number;
  completionPercentage: number;
}

export function LGUMonitoring() {
  const lguData: LGUData[] = [
    {
      municipality: 'Leon',
      affectedFamilies: 2500,
      displacedFamilies: 1200,
      requested: 1000,
      allocated: 800,
      released: 800,
      variance: -200,
      completionPercentage: 80
    },
    {
      municipality: 'Miag-ao',
      affectedFamilies: 1800,
      displacedFamilies: 900,
      requested: 750,
      allocated: 750,
      released: 500,
      variance: 0,
      completionPercentage: 67
    },
    {
      municipality: 'Banate Nuevo',
      affectedFamilies: 3200,
      displacedFamilies: 1500,
      requested: 1200,
      allocated: 600,
      released: 0,
      variance: -600,
      completionPercentage: 50
    },
    {
      municipality: 'Guinhol',
      affectedFamilies: 1500,
      displacedFamilies: 700,
      requested: 500,
      allocated: 0,
      released: 0,
      variance: -500,
      completionPercentage: 0
    },
    {
      municipality: 'Iloilo City',
      affectedFamilies: 4500,
      displacedFamilies: 2000,
      requested: 2000,
      allocated: 2000,
      released: 2000,
      variance: 0,
      completionPercentage: 100
    }
  ];

  const totalStats = {
    totalAffected: lguData.reduce((sum, lgu) => sum + lgu.affectedFamilies, 0),
    totalDisplaced: lguData.reduce((sum, lgu) => sum + lgu.displacedFamilies, 0),
    totalRequested: lguData.reduce((sum, lgu) => sum + lgu.requested, 0),
    totalAllocated: lguData.reduce((sum, lgu) => sum + lgu.allocated, 0),
    totalReleased: lguData.reduce((sum, lgu) => sum + lgu.released, 0)
  };

  const overallCompletion = Math.round((totalStats.totalReleased / totalStats.totalRequested) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">LGU Allocation Monitoring</h1>
        <p className="text-sm text-gray-600 mt-1">Monitor allocation progress across municipalities</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalStats.totalAffected.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Affected Families</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Home className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalStats.totalDisplaced.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Displaced Families</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalStats.totalRequested.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Requested</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-between">
              <span className="text-2xl font-bold">{overallCompletion}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{totalStats.totalAllocated.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Allocated</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-bold">{totalStats.totalReleased.toLocaleString()}</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Released</p>
        </div>
      </div>

      {/* Municipality Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lguData.map((lgu, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{lgu.municipality}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Municipality Profile</p>
              </div>
              {lgu.variance < 0 && lgu.completionPercentage < 50 && (
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Affected Families</span>
                <span className="text-sm font-bold text-gray-900">{lgu.affectedFamilies.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Displaced Families</span>
                <span className="text-sm font-bold text-gray-900">{lgu.displacedFamilies.toLocaleString()}</span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600">REQUESTED</span>
                  <span className="text-sm font-bold text-gray-900">{lgu.requested.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600">ALLOCATED</span>
                  <span className="text-sm font-bold text-blue-600">{lgu.allocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600">RELEASED</span>
                  <span className="text-sm font-bold text-green-600">{lgu.released.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-600">VARIANCE</span>
                  <span className={`text-sm font-bold ${lgu.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {lgu.variance > 0 ? '+' : ''}{lgu.variance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-700">Completion</span>
                  <span className={`text-sm font-bold ${
                    lgu.completionPercentage >= 75 ? 'text-green-600' :
                    lgu.completionPercentage >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {lgu.completionPercentage}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      lgu.completionPercentage >= 75 ? 'bg-green-500' :
                      lgu.completionPercentage >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${lgu.completionPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Allocation Alerts */}
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900">Low Allocation Alerts</h3>
            <div className="mt-3 space-y-2">
              {lguData
                .filter(lgu => lgu.completionPercentage < 50)
                .map((lgu, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-gray-900">{lgu.municipality}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Only {lgu.completionPercentage}% of requested items allocated
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{lgu.variance.toLocaleString()} shortage</p>
                        <p className="text-xs text-gray-600">{lgu.affectedFamilies.toLocaleString()} affected</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Detailed Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Municipality</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Affected</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Displaced</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Requested</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Allocated</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Released</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Variance</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lguData.map((lgu, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-gray-900">{lgu.municipality}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-sm text-gray-900">{lgu.affectedFamilies.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-sm text-gray-900">{lgu.displacedFamilies.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-sm text-gray-900">{lgu.requested.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-sm text-blue-600">{lgu.allocated.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-sm text-green-600">{lgu.released.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-sm ${lgu.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {lgu.variance > 0 ? '+' : ''}{lgu.variance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            lgu.completionPercentage >= 75 ? 'bg-green-500' :
                            lgu.completionPercentage >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${lgu.completionPercentage}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-sm text-gray-900 w-12 text-right">
                        {lgu.completionPercentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
