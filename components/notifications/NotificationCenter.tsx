'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, X, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  message: string;
  source: string;
  action_url?: string;
  created_at: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (!authFailed) {
        fetchNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [authFailed]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.status === 401) {
        setAuthFailed(true);
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
        setAuthFailed(false);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const archiveNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/archive`, { method: 'POST' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const notification = notifications.find((n) => n.id === id);
      if (notification?.status === 'UNREAD') {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'XERO':
        return 'bg-purple-100 text-purple-800';
      case 'MERCURY':
        return 'bg-green-100 text-green-800';
      case 'SYSTEM':
        return 'bg-gray-100 text-gray-800';
      case 'CFO_STRATEGIST':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  /**
   * Returns type-specific styling for utilization alert notification types.
   * Provides a border color class, icon component, and icon color for visual distinction.
   */
  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'UTILIZATION_WARNING':
        return {
          borderClass: 'border-l-4 border-l-yellow-400 bg-yellow-50/40',
          icon: AlertTriangle,
          iconColor: 'text-yellow-500',
        };
      case 'UTILIZATION_CRITICAL':
        return {
          borderClass: 'border-l-4 border-l-red-500 bg-red-50/40',
          icon: AlertOctagon,
          iconColor: 'text-red-500',
        };
      default:
        return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[600px] overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          <div className="divide-y">
            {notifications.slice(0, 10).map((notification) => {
              const typeStyle = getTypeStyle(notification.type);
              const TypeIcon = typeStyle?.icon;

              return (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 transition ${
                  typeStyle?.borderClass ??
                  (notification.status === 'UNREAD' ? 'bg-blue-50' : '')
                }`}
              >
                <div className="flex items-start gap-3">
                  {TypeIcon && (
                    <div className="flex-shrink-0 mt-0.5">
                      <TypeIcon className={`h-5 w-5 ${typeStyle.iconColor}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${getSourceBadge(notification.source)} text-xs`}>
                        {notification.source}
                      </Badge>
                      <Badge className={`${getPriorityColor(notification.priority)} text-xs`}>
                        {notification.priority}
                      </Badge>
                      {notification.status === 'UNREAD' && (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <h4 className="font-medium text-sm truncate">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                    <a
                      href={notification.action_url ?? (
                        notification.type === 'UTILIZATION_WARNING' || notification.type === 'UTILIZATION_CRITICAL'
                          ? '/dashboard/utilization'
                          : `/dashboard/notifications/${notification.id}`
                      )}
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      {notification.type === 'UTILIZATION_WARNING' || notification.type === 'UTILIZATION_CRITICAL'
                        ? 'View utilization details →'
                        : 'View details →'}
                    </a>
                  </div>
                  <div className="flex flex-col gap-1">
                    {notification.status === 'UNREAD' && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => archiveNotification(notification.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Archive"
                    >
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {notifications.length > 10 && (
          <div className="p-4 border-t text-center">
            <a
              href="/dashboard/notifications"
              className="text-sm text-blue-600 hover:underline"
            >
              View all notifications
            </a>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
