'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Image } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';

interface ReceiptUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

/**
 * File upload component for expense receipts with drag-and-drop support.
 */
export function ReceiptUpload({ onFileSelect, selectedFile }: ReceiptUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10 MB';
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'File type not allowed. Accepted: PDF, JPG, PNG';
    }
    return null;
  };

  const handleFile = (file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      onFileSelect(null);
    } else {
      setError(null);
      onFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearFile = () => {
    onFileSelect(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fileIcon = selectedFile?.type === 'application/pdf' ? FileText : Image;
  const FileIcon = fileIcon;

  return (
    <div className="space-y-2">
      {!selectedFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">Drop receipt here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <FileIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
