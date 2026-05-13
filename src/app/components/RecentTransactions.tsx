import { ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';

export function RecentTransactions() {
  const transactions = [
    {
      id: 'TXN-2024-001',
      type: 'outgoing',
      item: 'Food Packs',
      quantity: 500,
      destination: 'Leon',
      status: 'Delivered',
      statusColor: 'text-green-600',
      timestamp: 'May 12, 2026 10:30 AM',
      hash: '0x7a8f...3d2e'
    },
    {
      id: 'TXN-2024-002',
      type: 'incoming',
      item: 'Medical Kits',
      quantity: 300,
      destination: 'Warehouse 1',
      status: 'Received',
      statusColor: 'text-blue-600',
      timestamp: 'May 12, 2026 09:15 AM',
      hash: '0x9b4c...7f1a'
    },
    {
      id: 'TXN-2024-003',
      type: 'outgoing',
      item: 'Food Packs',
      quantity: 750,
      destination: 'Miag-ao',
      status: 'In Transit',
      statusColor: 'text-yellow-600',
      timestamp: 'May 12, 2026 08:45 AM',
      hash: '0x5e2a...8c9b'
    },
    {
      id: 'TXN-2024-004',
      type: 'incoming',
      item: 'Water Supplies',
      quantity: 1000,
      destination: 'Warehouse 3',
      status: 'Received',
      statusColor: 'text-blue-600',
      timestamp: 'May 11, 2026 04:20 PM',
      hash: '0x3f7d...6a5e'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Recent Transactions</h2>
        <Package className="w-5 h-5 text-gray-600" />
      </div>

      <div className="space-y-3">
        {transactions.map((transaction, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 flex-1">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  transaction.type === 'outgoing' ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {transaction.type === 'outgoing' ? (
                    <ArrowUpRight className="w-5 h-5 text-red-600" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-green-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm text-gray-900 tracking-tight">{transaction.item}</h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{transaction.id}</p>
                    </div>
                    <span className={`${transaction.statusColor} font-bold text-xs tracking-tight`}>
                      {transaction.status}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">Quantity:</span>
                      <span className="text-gray-900 font-semibold">{transaction.quantity.toLocaleString()} units</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">{transaction.type === 'outgoing' ? 'Destination:' : 'Location:'}</span>
                      <span className="text-gray-900 font-semibold">{transaction.destination}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">Time:</span>
                      <span className="text-gray-900 font-semibold">{transaction.timestamp}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">Hash:</span>
                      <span className="text-blue-600 font-mono font-semibold">{transaction.hash}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-blue-600 font-semibold text-sm hover:bg-blue-50 rounded-lg transition-all">
        View All Transactions
      </button>
    </div>
  );
}
