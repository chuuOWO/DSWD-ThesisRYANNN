import { Bell, AlertTriangle, CheckCircle, Info, TruckIcon } from 'lucide-react';

export function NotificationsPanel() {
  const notifications = [
    {
      type: 'warning',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      title: 'Low Stock Alert',
      message: 'Medical kits running low in Warehouse 2',
      time: '5 mins ago'
    },
    {
      type: 'success',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      title: 'Delivery Completed',
      message: 'Truck 3 completed delivery to Miag-ao',
      time: '15 mins ago'
    },
    {
      type: 'info',
      icon: TruckIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      title: 'In Transit',
      message: 'Truck 1 is 30 mins away from Leon',
      time: '1 hour ago'
    },
    {
      type: 'urgent',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      title: 'Emergency Request',
      message: 'Urgent relief needed in Banate Nuevo',
      time: '2 hours ago'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Notifications</h2>
        <div className="relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            4
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.map((notification, index) => {
          const Icon = notification.icon;
          return (
            <div key={index} className={`${notification.bgColor} p-3 rounded-xl border border-gray-100`}>
              <div className="flex gap-3">
                <div className={`${notification.color} mt-0.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-gray-900 tracking-tight">{notification.title}</h3>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{notification.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full mt-4 py-2 text-blue-600 font-semibold text-sm hover:bg-blue-50 rounded-lg transition-all">
        View All Notifications
      </button>
    </div>
  );
}
