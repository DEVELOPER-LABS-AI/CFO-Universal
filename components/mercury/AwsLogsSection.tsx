'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils/error';

interface AwsLog {
  timestamp: string;
  message: string;
  logStreamName: string;
}

interface AwsLogsSectionProps {
  organizationId: string;
}

export function AwsLogsSection({ organizationId }: AwsLogsSectionProps) {
  const [logs, setLogs] = useState<AwsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/mercury/logs/aws?organizationId=${organizationId}&hours=${hours}&limit=100`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch AWS logs');
      }

      setLogs(data.logs || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [organizationId, hours]);

  const downloadLogs = () => {
    const logsText = logs
      .map((log) => `[${log.timestamp}] ${log.message}`)
      .join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mercury-aws-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLogLevel = (message: string): 'info' | 'error' | 'success' => {
    if (message.includes('ERROR') || message.includes('Error') || message.includes('Failed')) {
      return 'error';
    }
    if (message.includes('success') || message.includes('✓') || message.includes('completed')) {
      return 'success';
    }
    return 'info';
  };

  const LogLevelIcon = ({ level }: { level: 'info' | 'error' | 'success' }) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AWS Lambda Logs</CardTitle>
            <CardDescription>
              CloudWatch logs from AWS Lambda function execution
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={1}>Last hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last week</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {logs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading AWS logs...</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">Error Loading AWS Logs</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                {error.includes('credentials') && (
                  <p className="text-xs text-red-600 mt-2">
                    Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your environment variables.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-8 border rounded-lg bg-muted/50">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No AWS Lambda logs found in the selected time period.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Logs will appear here after the Lambda function is invoked.
            </p>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Showing {logs.length} log entries from the last {hours === 1 ? 'hour' : `${hours} hours`}
              </p>
              <Badge variant="outline">
                Static IP: 52.1.18.251
              </Badge>
            </div>

            <div className="max-h-[600px] overflow-y-auto space-y-1 border rounded-lg p-4 bg-slate-50 font-mono text-xs">
              {logs.map((log, index) => {
                const level = getLogLevel(log.message);
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-2 p-2 rounded hover:bg-white transition-colors ${
                      level === 'error' ? 'bg-red-50' : level === 'success' ? 'bg-green-50' : ''
                    }`}
                  >
                    <LogLevelIcon level={level} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.logStreamName.split('/').pop()}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-foreground">
                        {log.message}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
