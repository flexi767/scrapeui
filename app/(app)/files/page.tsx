'use client';

import { useEffect, useState } from 'react';
import { errorMessage, parseApiResponse } from '@/lib/utils';

interface UploadRow {
  id: number;
  filename: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  entity_type: string | null;
  entity_id: number | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function loadFiles() {
    setLoading(true);
    return fetch('/api/uploads')
      .then((r) => parseApiResponse<UploadRow[]>(r, 'Failed to load files'))
      .then(setFiles)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;

    const formData = new FormData();
    for (const file of selected) {
      formData.append('files', file);
    }

    setUploading(true);
    setError('');
    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      });
      await parseApiResponse<unknown>(response, 'Failed to upload files');
      await loadFiles();
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Failed to upload files'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Files</h1>
        <label className="inline-flex cursor-pointer items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
          {uploading ? 'Uploading...' : 'Upload files'}
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={uploadFiles}
          />
        </label>
      </div>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-400">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <a
              key={f.id}
              href={`/api/uploads/${f.stored_name}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 transition-colors hover:border-gray-500"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-100">{f.filename}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {f.mime_type} — {formatBytes(f.size_bytes)}
                  {f.entity_type && ` — ${f.entity_type} #${f.entity_id}`}
                  {f.uploaded_by_name && ` — by ${f.uploaded_by_name}`}
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(f.created_at).toLocaleDateString()}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
