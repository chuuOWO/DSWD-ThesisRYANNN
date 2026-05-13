import { Package } from 'lucide-react';

export function WarehouseStock() {
  const stockItems = [
    { label: 'Total Food Packs', value: '10,000' },
    { label: 'Total Health Kit', value: '10,000' },
    { label: 'Others', value: '10,000' }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Warehouse Stock</h2>
          <p className="text-sm text-gray-500 font-medium mt-0.5">Last Update: 17 Nov 2021 12:31</p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <Package className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <div className="flex justify-between gap-4 pt-2">
        {stockItems.map((item, index) => (
          <div key={index} className="text-center flex-1">
            <div className="font-bold text-2xl mb-1 tracking-tight text-gray-900">{item.value}</div>
            <div className="text-xs font-semibold text-gray-600 tracking-tight">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
