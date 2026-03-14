'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Archive, X, Filter, Search } from 'lucide-react';
import Link from 'next/link';

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, searchTerm, statusFilter, sourceFilter, priorityFilter]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNotifications = () => {
    let filtered = [...notifications];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(term) ||
          n.message.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((n) => n.status === statusFilter.toUpperCase());
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((n) => n.source === sourceFilter.toUpperCase());
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((n) => n.priority === priorityFilter.toUpperCase());
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const archiveNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/archive`, { method: 'POST' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = filteredNotifications
      .filter((n) => n.status === 'UNREAD')
      .map((n) => n.id);

    for (const id of unreadIds) {
      await markAsRead(id);
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
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const unreadCount = filteredNotifications.filter((n) => n.status === 'UNREAD').length;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          View and manage all your notifications
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" size="sm">
                <Check className="h-4 w-4 mr-2" />
                Mark All as Read ({unreadCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="xero">Xero</SelectItem>
                <SelectItem value="mercury">Mercury</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <span>Total: {filteredNotifications.length}</span>
            <span>Unread: {unreadCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading notifications...
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || priorityFilter !== 'all'
              ? 'No notifications match your filters'
              : 'No notifications yet'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition hover:shadow-md ${
                notification.status === 'UNREAD' ? 'border-l-4 border-l-blue-500' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
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

                    <Link
                      href={`/dashboard/notifications/${notification.id}`}
                      className="block hover:underline"
                    >
                      <h3 className="font-semibold text-lg mb-1">
                        {notification.title}
                      </h3>
                    </Link>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{new Date(notification.created_at).toLocaleString()}</span>
                      {notification.action_url && (
                        <Link
                          href={`/dashboard/notifications/${notification.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View details →
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {notification.status === 'UNREAD' && (
                      <Button
                        onClick={() => markAsRead(notification.id)}
                        variant="outline"
                        size="sm"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      onClick={() => archiveNotification(notification.id)}
                      variant="outline"
                      size="sm"
                      title="Archive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
