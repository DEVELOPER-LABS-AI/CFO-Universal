'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/error';

// T149: ExportButton component with progress indicator
// T150: Client-side download using Fetch API with progress tracking

interface ExportButtonProps {
  filters?: Record<string, any>;
  columns?: string[];
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
}

export function ExportButton({
  filters = {},
  columns,
  label = 'Export to CSV',
  variant = 'outline',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    try {
      // Build query parameters
      const params = new URLSearchParams();

      if (Object.keys(filters).length > 0) {
        params.append('filters', JSON.stringify(filters));
      }

      if (columns && columns.length > 0) {
        params.append('columns', columns.join(','));
      }

      const url = `/api/export/clients?${params.toString()}`;

      // Fetch with streaming
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Read the stream
      const reader = response.body.getReader();
      const contentLength = response.headers.get('Content-Length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let receivedBytes = 0;
      const chunks: BlobPart[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        // Update progress if we know the total size
        if (totalBytes > 0) {
          const progressPercent = Math.round((receivedBytes / totalBytes) * 100);
          setProgress(progressPercent);
        } else {
          // Indeterminate progress animation
          setProgress((prev) => (prev + 10) % 100);
        }
      }

      // Combine chunks into a single Blob
      const blob = new Blob(chunks, { type: 'text/csv' });

      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Extract filename from Content-Disposition header or use default
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch
        ? filenameMatch[1]
        : `clients-export-${new Date().toISOString().split('T')[0]}.csv`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setProgress(100);
      toast.success('Export completed successfully');
    } catch (error: unknown) {
      console.error('Export error:', error);
      toast.error(getErrorMessage(error) || 'Failed to export data');
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant={variant}
      className="relative overflow-hidden"
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting... {progress > 0 && `${progress}%`}
          {/* Progress bar */}
          {progress > 0 && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          )}
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  );
}
