import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Bell,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import type { IncomingGoods, OutgoingRelease } from '../../hooks/useInventoryState';
import { getDaysRemaining, EXPIRY_THRESHOLDS } from '../../lib/expiryConstants';

interface NotificationDropdownProps {
  incomingGoodsList?: IncomingGoods[];
  outgoingReleasesList?: OutgoingRelease[];
  inventory?: { category: string; totalStock?: number; available?: number }[];
  onNavigate: (view: string) => void;
}

export interface NotificationItem {
  id: string;
  type: 'expiry' | 'incoming' | 'correction' | 'transit' | 'delivered' | 'lowstock';
  title: string;
  description: string;
  timestamp: string;
  targetView: string;
  isUrgent?: boolean;
}

const STORAGE_KEY = 'dswd_read_notification_ids';

function formatRelativeTime(dateInput?: string | number | Date): string {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationDropdown({
  incomingGoodsList = [],
  outgoingReleasesList = [],
  inventory = [],
  onNavigate
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // Read notification IDs stored in localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Aggregate individual operational event notifications
  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    // 1. Critical Expiring Lots (<= 100 days)
    incomingGoodsList
      .filter((item) => item.status === 'Verified' && Boolean(item.expirationDate))
      .forEach((item) => {
        const days = getDaysRemaining(item.expirationDate);
        if (days <= EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS) {
          list.push({
            id: `expiry-${item.id}`,
            type: 'expiry',
            title: 'Critical Shelf-Life Alert',
            description: `${item.fnfiCategory} (${(item.quantity || 0).toLocaleString()} ${item.unitType || 'packs'}) has ${days <= 0 ? 'expired' : `${days} days left`} (${item.expirationDate}) at ${item.destination || item.warehouseSource || 'Warehouse'}.`,
            timestamp: item.dateReceived || item.verifiedAt || new Date().toISOString(),
            targetView: 'inventory',
            isUrgent: true
          });
        }
      });

    // 2. Pending Verification Intakes
    incomingGoodsList
      .filter((item) => item.status === 'Pending Verification')
      .forEach((item) => {
        list.push({
          id: `pending-${item.id}`,
          type: 'incoming',
          title: 'Physical Intake Inspection Pending',
          description: `Shipment ${item.manifestNumber || item.id} (${(item.quantity || 0).toLocaleString()} ${item.unitType || 'packs'} of ${item.fnfiCategory}) from ${item.source} is waiting for physical inspection.`,
          timestamp: item.dateReceived || new Date().toISOString(),
          targetView: 'incoming',
          isUrgent: true
        });
      });

    // 3. Correction Requested on Intake
    incomingGoodsList
      .filter((item) => item.status === 'Correction Requested')
      .forEach((item) => {
        list.push({
          id: `correction-${item.id}`,
          type: 'correction',
          title: 'Intake Discrepancy Flagged',
          description: `Shipment ${item.manifestNumber || item.id} flagged for correction: ${item.discrepancyNote || 'Quantity or packaging discrepancy noted.'}`,
          timestamp: item.dateReceived || new Date().toISOString(),
          targetView: 'incoming',
          isUrgent: true
        });
      });

    // 4. Active In-Transit Convoys
    outgoingReleasesList
      .filter((rel) => rel.deliveryStatus === 'In Transit')
      .forEach((rel) => {
        const qty = rel.amountApproved || rel.amountRequested || 0;
        list.push({
          id: `transit-${rel.id}`,
          type: 'transit',
          title: 'Convoy En Route to Consignee',
          description: `Dispatch ${rel.drNumber} carrying ${qty.toLocaleString()} ${rel.fnfiCategory} is in transit to ${rel.lguName || rel.municipality}.`,
          timestamp: rel.dateReleased || rel.dateAllocated || new Date().toISOString(),
          targetView: 'truck-tracking',
          isUrgent: false
        });
      });

    // 5. Confirmed Receipts by Consignee / LGU
    outgoingReleasesList
      .filter((rel) => rel.deliveryStatus === 'Delivered' || rel.deliveryStatus === 'Accepted')
      .slice(0, 10)
      .forEach((rel) => {
        const qty = rel.amountApproved || rel.amountRequested || 0;
        list.push({
          id: `delivered-${rel.id}`,
          type: 'delivered',
          title: 'Consignment Received & Verified',
          description: `${rel.lguName || rel.municipality} successfully confirmed receipt of ${rel.drNumber} (${qty.toLocaleString()} ${rel.fnfiCategory}).`,
          timestamp: rel.acceptedAt || rel.dateReleased || rel.dateAllocated || new Date().toISOString(),
          targetView: 'outgoing',
          isUrgent: false
        });
      });

    // 6. Low Hub Stock Warnings (< 500 units)
    inventory
      .filter((item) => (item.available ?? item.totalStock ?? 0) < 500)
      .forEach((item) => {
        const qty = item.available ?? item.totalStock ?? 0;
        list.push({
          id: `lowstock-${item.category}`,
          type: 'lowstock',
          title: 'Low Stock Buffer Warning',
          description: `${item.category} stockpile is low with only ${qty.toLocaleString()} units remaining across hubs.`,
          timestamp: new Date().toISOString(),
          targetView: 'inventory',
          isUrgent: true
        });
      });

    // Sort by timestamp descending (newest first)
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [incomingGoodsList, outgoingReleasesList, inventory]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !readIds.has(n.id));
    }
    return notifications;
  }, [notifications, activeTab, readIds]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Storage unavailable
      }
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Storage unavailable
      }
      return next;
    });
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setIsOpen(false);
    onNavigate(item.targetView);
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'expiry':
        return {
          icon: Clock,
          iconBg: 'bg-red-100 text-red-600',
          dotBg: 'bg-red-500'
        };
      case 'incoming':
        return {
          icon: Package,
          iconBg: 'bg-amber-100 text-amber-600',
          dotBg: 'bg-amber-500'
        };
      case 'correction':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-orange-100 text-orange-600',
          dotBg: 'bg-orange-500'
        };
      case 'transit':
        return {
          icon: Truck,
          iconBg: 'bg-blue-100 text-blue-600',
          dotBg: 'bg-blue-500'
        };
      case 'delivered':
        return {
          icon: CheckCircle2,
          iconBg: 'bg-emerald-100 text-emerald-600',
          dotBg: 'bg-emerald-500'
        };
      case 'lowstock':
        return {
          icon: AlertCircle,
          iconBg: 'bg-purple-100 text-purple-600',
          dotBg: 'bg-purple-500'
        };
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button with Red Circle Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl text-blue-100 hover:text-white hover:bg-blue-800/60 transition cursor-pointer select-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center ring-2 ring-blue-700 shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook-style Dropdown Container */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 select-none">
          {/* Header */}
          <div className="p-4 pb-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-[#2500ba] hover:text-blue-800 flex items-center gap-1 cursor-pointer transition"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all as read</span>
                </button>
              )}
            </div>

            {/* Facebook-style All vs Unread Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#2500ba] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'unread'
                    ? 'bg-[#2500ba] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      activeTab === 'unread' ? 'bg-white text-[#2500ba]' : 'bg-red-500 text-white'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Notifications Feed */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="font-bold text-sm text-gray-800">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
                <p className="text-xs text-gray-500">
                  {activeTab === 'unread'
                    ? 'You have caught up with all operational alerts.'
                    : 'All warehouse operations and relief convoys are up to date.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const isUnread = !readIds.has(item.id);
                const { icon: Icon, iconBg, dotBg } = getNotificationIcon(item.type);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition cursor-pointer group ${
                      isUnread
                        ? 'bg-blue-50/60 hover:bg-blue-100/60'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {/* Event Icon Avatar */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {item.isUrgent && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-600 ring-2 ring-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs truncate ${
                            isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed line-clamp-2 ${
                          isUnread ? 'text-gray-800 font-medium' : 'text-gray-600'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>

                    {/* Unread Blue Dot or Chevron */}
                    <div className="flex-shrink-0 self-center pl-1">
                      {isUnread ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 block shadow-xs" title="Unread" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-500 flex items-center justify-between px-4">
            <span>Click any item to inspect and mark as read</span>
            {unreadCount > 0 && (
              <span className="font-bold text-gray-700">{unreadCount} unread</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default NotificationDropdown;
