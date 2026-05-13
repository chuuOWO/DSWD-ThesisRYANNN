export function MunicipalityStatus() {
  const municipalities = [
    {
      name: 'Leon',
      status: 'Incomplete',
      statusColor: 'bg-red-500',
      avatar: '👤'
    },
    {
      name: 'Guinhol',
      status: 'Incomplete',
      statusColor: 'bg-yellow-400',
      avatar: '👤'
    },
    {
      name: 'Miag-ao',
      status: 'Completed',
      statusColor: 'bg-green-500',
      avatar: '👤'
    },
    {
      name: 'Banate Nuevo',
      status: 'Completed',
      statusColor: 'bg-green-500',
      details: {
        stockInventory: 'Last Delivery Received',
        deliveryDate: 'in transit',
        destination: 'Warehouse 4',
        deliveryStatus: 'On Progress'
      }
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-5">Municipality Inventory Status</h2>

      <div className="space-y-3">
        {municipalities.map((municipality, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                  {municipality.avatar}
                </div>
                <span className="font-semibold text-gray-900 tracking-tight">{municipality.name}</span>
              </div>
              <span className={`${municipality.statusColor} text-white px-3 py-1 rounded-full text-xs font-bold tracking-tight`}>
                {municipality.status}
              </span>
            </div>

            {municipality.details && (
              <div className="ml-12 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Stocks Inventory</span>
                  <span className="text-gray-500 font-normal">{municipality.details.stockInventory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Last Delivery Received</span>
                  <span className="text-gray-500 font-normal">{municipality.details.deliveryDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">in transit</span>
                  <span className="text-gray-500 font-normal">{municipality.details.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Distribution</span>
                  <span className="text-gray-500 font-normal"></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Delivery Status</span>
                  <span className="text-green-600 font-semibold">{municipality.details.deliveryStatus}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
