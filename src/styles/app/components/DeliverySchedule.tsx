import { Calendar, Clock, MapPin, Package } from 'lucide-react';

export function DeliverySchedule() {
  const schedules = [
    {
      time: '08:00 AM',
      destination: 'Leon',
      truck: 'Truck 2',
      items: 'Food Packs (500)',
      status: 'completed',
      statusLabel: 'Completed',
      eta: 'Delivered'
    },
    {
      time: '10:30 AM',
      destination: 'Miag-ao',
      truck: 'Truck 1',
      items: 'Medical Kits (300)',
      status: 'in-progress',
      statusLabel: 'In Transit',
      eta: '45 mins'
    },
    {
      time: '01:00 PM',
      destination: 'Guinhol',
      truck: 'Truck 3',
      items: 'Food & Water (800)',
      status: 'scheduled',
      statusLabel: 'Scheduled',
      eta: '2h 15m'
    },
    {
      time: '03:30 PM',
      destination: 'Banate Nuevo',
      truck: 'Truck 4',
      items: 'Emergency Supplies',
      status: 'scheduled',
      statusLabel: 'Scheduled',
      eta: '4h 45m'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Delivery Schedule</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span className="font-semibold">Today, May 12</span>
        </div>
      </div>

      <div className="space-y-4">
        {schedules.map((schedule, index) => (
          <div key={index} className="relative">
            {index !== schedules.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200"></div>
            )}

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  schedule.status === 'completed' ? 'bg-green-100 border-green-500' :
                  schedule.status === 'in-progress' ? 'bg-blue-100 border-blue-500' :
                  'bg-gray-100 border-gray-300'
                }`}>
                  <Clock className={`w-5 h-5 ${
                    schedule.status === 'completed' ? 'text-green-600' :
                    schedule.status === 'in-progress' ? 'text-blue-600' :
                    'text-gray-500'
                  }`} />
                </div>
              </div>

              <div className="flex-1 pb-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{schedule.time}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          schedule.status === 'completed' ? 'bg-green-100 text-green-700' :
                          schedule.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {schedule.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">{schedule.truck}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-600">ETA</p>
                      <p className="text-sm font-bold text-gray-900">{schedule.eta}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="font-semibold text-gray-900">{schedule.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">{schedule.items}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2 text-blue-600 font-semibold text-sm hover:bg-blue-50 rounded-lg transition-all">
        View Full Calendar
      </button>
    </div>
  );
}
