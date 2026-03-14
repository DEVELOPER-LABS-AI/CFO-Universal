'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Archive, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  message: string;
  source: string;
  metadata: any;
  action_url?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  read_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export default function NotificationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchNotification();
    }
  }, [params.id]);

  const fetchNotification = async () => {
    try {
      const response = await fetch(`/api/notifications/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setNotification(data);
        // Auto-mark as read if unread
        if (data.status === 'UNREAD') {
          markAsRead();
        }
      } else {
        setError('Notification not found');
      }
    } catch (err) {
      console.error('Failed to fetch notification:', err);
      setError('Failed to load notification');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/notifications/${params.id}/read`, { method: 'POST' });
      setNotification((prev) => (prev ? { ...prev, status: 'READ' } : null));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const archiveNotification = async () => {
    try {
      await fetch(`/api/notifications/${params.id}/archive`, { method: 'POST' });
      router.push('/dashboard/notifications');
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'XERO':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MERCURY':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'SYSTEM':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/notifications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/notifications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Error</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error || 'Notification not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Notification Details</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`${getSourceBadge(notification.source)} border`}>
                    {notification.source}
                  </Badge>
                  <Badge className={`${getPriorityColor(notification.priority)} border`}>
                    {notification.priority}
                  </Badge>
                  <Badge variant={notification.status === 'UNREAD' ? 'default' : 'secondary'}>
                    {notification.status}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{notification.title}</CardTitle>
                <CardDescription className="mt-2">
                  {new Date(notification.created_at).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {notification.status === 'UNREAD' && (
                  <Button onClick={markAsRead} variant="outline" size="sm">
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Read
                  </Button>
                )}
                <Button onClick={archiveNotification} variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="text-base whitespace-pre-wrap">{notification.message}</p>
            </div>

            {notification.action_url && (
              <div className="mt-6 pt-6 border-t">
                <Link href={notification.action_url}>
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Related Item
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{notification.type}</dd>
              </div>

              {notification.related_entity_type && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Related Entity Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{notification.related_entity_type}</dd>
                </div>
              )}

              {notification.related_entity_id && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Related Entity ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{notification.related_entity_id}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(notification.created_at).toLocaleString()}
                </dd>
              </div>

              {notification.read_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Read At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(notification.read_at).toLocaleString()}
                  </dd>
                </div>
              )}

              {notification.archived_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Archived At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(notification.archived_at).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>

            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Metadata</h4>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(notification.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
