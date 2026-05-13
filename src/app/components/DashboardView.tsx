import { Package, TruckIcon, TrendingUp, AlertTriangle, MapPin, CheckCircle } from 'lucide-react';

export function DashboardView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">FNFI Warehouse Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Real-time inventory and logistics overview</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">8,450</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Total Inventory</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">2,450</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Items Received</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <TruckIcon className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">1,850</p>
          <p className="text-sm font-semibold opacity-90 mt-1">Items Released</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-8 h-8" />
          </div>
          <p className="text-3xl font-bold">5</p>
          <p className="text-sm font-semibold opacity-90 mt-1">LGUs Served</p>
        </div>
      </div>

      {/* Warehouse Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Warehouse A</h3>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Total Stock</span>
              <span className="text-xl font-bold text-gray-900">4,850</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Available</span>
              <span className="text-lg font-bold text-green-600">3,200</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Released</span>
              <span className="text-lg font-bold text-orange-600">1,650</span>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-700">Capacity Usage</span>
                <span className="text-sm font-bold text-green-600">66%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '66%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Warehouse B</h3>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Total Stock</span>
              <span className="text-xl font-bold text-gray-900">3,600</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Available</span>
              <span className="text-lg font-bold text-purple-600">2,400</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Released</span>
              <span className="text-lg font-bold text-orange-600">1,200</span>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-700">Capacity Usage</span>
                <span className="text-sm font-bold text-purple-600">67%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '67%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Alerts */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">System Alerts</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-yellow-900">Low Stock Warning</p>
                <p className="text-xs text-yellow-800 mt-1">Kitchen Kit inventory below 500 units</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-orange-900">Expiration Alert</p>
                <p className="text-xs text-orange-800 mt-1">250 items expiring within 30 days</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-blue-900">Delivery Completed</p>
                <p className="text-xs text-blue-800 mt-1">500 Food Packs delivered to Leon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Incoming: Food Pack</p>
                <p className="text-xs text-gray-600">1,000 units • Warehouse A</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">2h ago</span>
            </div>

            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TruckIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Outgoing: Hygiene Kit</p>
                <p className="text-xs text-gray-600">300 units • Miag-ao</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">4h ago</span>
            </div>

            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Delivered: Sleeping Kit</p>
                <p className="text-xs text-gray-600">200 units • Banate</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">6h ago</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900">Incoming: Family Kit</p>
                <p className="text-xs text-gray-600">500 units • Warehouse B</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">8h ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* FNFI Categories Quick View */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">FNFI Categories Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { name: 'Food Pack', count: 2700, icon: '🍱' },
            { name: 'Hygiene Kit', count: 1300, icon: '🧼' },
            { name: 'Sleeping Kit', count: 700, icon: '🛏️' },
            { name: 'Kitchen Kit', count: 500, icon: '🍳' },
            { name: 'Family Kit', count: 1000, icon: '👨‍👩‍👧‍👦' },
            { name: 'Laminated Sack', count: 3500, icon: '🛍️' },
            { name: 'RTEF', count: 400, icon: '🏕️' }
          ].map((item) => (
            <div key={item.name} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
              <div className="text-3xl mb-2">{item.icon}</div>
              <p className="text-lg font-bold text-gray-900">{item.count.toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-600 mt-1">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
