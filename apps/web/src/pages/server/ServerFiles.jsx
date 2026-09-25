import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card, Input, Skeleton } from '../../components/ui.jsx';

export default function ServerFiles({ server }) {
  const [path, setPath] = useState('');
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/servers/${server.id}/files`, { path });
      setListing(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [server.id, path]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const targetPath = path ? `${path.replace(/\/$/, '')}/${file.name}` : file.name;
      // 1. Ask backend for a presigned PUT URL (backend never touches the bytes)
      const { url } = await api.post(`/servers/${server.id}/files/upload-url`, {
        path: targetPath,
        contentType: file.type,
      });
      // 2. Upload straight to R2 from the browser
      const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!putRes.ok) throw new Error(`Upload to R2 failed with status ${putRes.status}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(filePath) {
    const { url } = await api.get(`/servers/${server.id}/files/download-url`, { path: filePath });
    window.open(url, '_blank');
  }

  async function handleDelete(filePath, isDirectory) {
    if (!confirm(`Delete ${filePath}?`)) return;
    await api.post(`/servers/${server.id}/files/delete`, { path: filePath, isDirectory });
    load();
  }

  async function handleExtract(filePath) {
    setError(null);
    try {
      const destPath = path;
      const result = await api.post(`/servers/${server.id}/files/extract`, { zipPath: filePath, destPath });
      alert(`Extracted ${result.extractedFiles} file(s).`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleNewFolder() {
    const name = prompt('Folder name');
    if (!name) return;
    const folderPath = path ? `${path.replace(/\/$/, '')}/${name}` : name;
    await api.post(`/servers/${server.id}/files/folder`, { path: folderPath });
    load();
  }

  const breadcrumbs = path.split('/').filter(Boolean);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-400">
          <button className="hover:text-panel-accent" onClick={() => setPath('')}>root</button>
          {breadcrumbs.map((seg, i) => (
            <span key={i}>
              {' / '}
              <button className="hover:text-panel-accent" onClick={() => setPath(breadcrumbs.slice(0, i + 1).join('/'))}>
                {seg}
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleNewFolder}>+ Folder</Button>
          <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!listing && !error && <Skeleton className="h-40" />}

      {listing && (
        <table className="w-full text-sm">
          <thead className="border-b border-panel-border text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Size</th>
              <th className="py-2">Modified</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listing.folders.map((f) => (
              <tr key={f.path} className="border-b border-panel-border/50">
                <td className="py-2">
                  <button className="text-slate-200 hover:text-panel-accent" onClick={() => setPath(f.path.replace(/\/$/, ''))}>
                    📁 {f.name}
                  </button>
                </td>
                <td className="py-2 text-slate-500">—</td>
                <td className="py-2 text-slate-500">—</td>
                <td className="py-2 text-right">
                  <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleDelete(f.path, true)}>Delete</button>
                </td>
              </tr>
            ))}
            {listing.files.map((f) => (
              <tr key={f.path} className="border-b border-panel-border/50">
                <td className="py-2 text-slate-200">📄 {f.name}</td>
                <td className="py-2 text-slate-500">{formatBytes(f.size)}</td>
                <td className="py-2 text-slate-500">{f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : '—'}</td>
                <td className="py-2">
                  <div className="flex justify-end gap-3 text-xs">
                    <button className="text-slate-400 hover:text-panel-accent" onClick={() => handleDownload(f.path)}>Download</button>
                    {f.name.endsWith('.zip') && (
                      <button className="text-slate-400 hover:text-panel-accent" onClick={() => handleExtract(f.path)}>Extract</button>
                    )}
                    <button className="text-red-400 hover:text-red-300" onClick={() => handleDelete(f.path, false)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {listing.folders.length === 0 && listing.files.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500">
                  This folder is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
