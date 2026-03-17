'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    fetch('/api/uploads')
      .then((r) => r.json())
      .then(setFiles)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Files</h1>

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
