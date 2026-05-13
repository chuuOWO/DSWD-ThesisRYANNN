import { ChevronDown, Truck } from 'lucide-react';

export function GoodsTracker() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-5">Goods Tracker</h2>

      <div className="mb-5">
        <button className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
          <span className="text-sm font-semibold text-gray-700">Truck 1</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="relative bg-gray-100 rounded-xl p-6 mb-4 h-48 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 200">
          <path d="M 50 100 Q 100 50 150 100 T 250 100" stroke="#94a3b8" strokeWidth="2" fill="none" />
          <path d="M 30 130 L 80 130 L 80 180 L 30 180 Z" fill="#cbd5e1" opacity="0.5" />
          <path d="M 100 80 L 140 80 L 140 120 L 100 120 Z" fill="#cbd5e1" opacity="0.5" />
          <path d="M 180 110 L 220 110 L 220 150 L 180 150 Z" fill="#cbd5e1" opacity="0.5" />
          <text x="40" y="160" fontSize="8" fill="#64748b">Iloilo City</text>
          <text x="110" y="110" fontSize="8" fill="#64748b">Leon</text>
          <text x="185" y="140" fontSize="8" fill="#64748b">Miag-ao</text>
        </svg>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              Truck 1
            </div>
          </div>
        </div>
      </div>

      <button className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold tracking-tight hover:bg-blue-50 transition-all hover:shadow-md">
        Open Map
      </button>
    </div>
  );
}
