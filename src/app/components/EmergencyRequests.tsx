import { AlertCircle, Clock, MapPin } from 'lucide-react';

export function EmergencyRequests() {
  const requests = [
    {
      id: 'REQ-2026-045',
      municipality: 'Banate Nuevo',
      urgency: 'Critical',
      urgencyColor: 'bg-red-500',
      items: ['Food Packs: 1,000', 'Water: 500L', 'Medical Kits: 200'],
      reason: 'Flooding aftermath',
      requestedBy: 'Municipal Office',
      timeAgo: '30 mins ago',
      status: 'Pending Approval'
    },
    {
      id: 'REQ-2026-044',
      municipality: 'Leon',
      urgency: 'High',
      urgencyColor: 'bg-orange-500',
      items: ['Food Packs: 500', 'Blankets: 300'],
      reason: 'Evacuation center support',
      requestedBy: 'Barangay Captain',
      timeAgo: '2 hours ago',
      status: 'Approved'
    },
    {
      id: 'REQ-2026-043',
      municipality: 'Guinhol',
      urgency: 'Medium',
      urgencyColor: 'bg-yellow-500',
      items: ['Medical Kits: 100', 'Food Packs: 300'],
      reason: 'Health emergency',
      requestedBy: 'Health Center',
      timeAgo: '5 hours ago',
      status: 'In Progress'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Emergency Requests</h2>
        <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-bold text-red-600">{requests.length} Active</span>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((request, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full ${request.urgencyColor} mt-2`}></div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 tracking-tight">{request.municipality}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{request.id}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${request.urgencyColor} text-white`}>
                {request.urgency}
              </span>
            </div>

            <div className="space-y-2 ml-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-600">Reason:</p>
                  <p className="text-sm font-semibold text-gray-900">{request.reason}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Requested Items:</p>
                <div className="space-y-1">
                  {request.items.map((item, idx) => (
                    <div key={idx} className="text-sm text-gray-900 font-semibold bg-white px-2 py-1 rounded">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 font-medium">{request.requestedBy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-600 font-medium">{request.timeAgo}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold ${
                  request.status === 'Approved' ? 'text-green-600' :
                  request.status === 'In Progress' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>
                  {request.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 bg-red-600 text-white font-semibold text-sm hover:bg-red-700 rounded-lg transition-all">
        Create New Emergency Request
      </button>
    </div>
  );
}
