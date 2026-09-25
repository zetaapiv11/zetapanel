import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { Button, Card } from '../../components/ui.jsx';

export default function ServerSettings({ server }) {
  const navigate = useNavigate();
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete() {
    if (!confirm(`This will permanently delete "${server.name}" from Render${deleteFiles ? ' and remove its R2 files' : ''}. Continue?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/servers/${server.id}?deleteFiles=${deleteFiles}`);
      navigate('/servers');
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-semibold text-slate-300">Server Info</h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Render Service ID</dt>
          <dd className="text-slate-200">{server.renderServiceId || '—'}</dd>
          <dt className="text-slate-500">Repository</dt>
          <dd className="text-slate-200">{server.repository}</dd>
          <dt className="text-slate-500">R2 Prefix</dt>
          <dd className="font-mono text-xs text-slate-400">{server.r2Prefix}</dd>
        </dl>
      </Card>

      <Card className="border-red-900/50">
        <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
        <p className="mt-1 text-xs text-slate-500">
          Deleting a server calls the Render API to delete the underlying service first. Your database record and
          (optionally) R2 files are only removed after that succeeds.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />
          Also delete files stored in R2
        </label>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <Button variant="danger" className="mt-3" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete Server'}
        </Button>
      </Card>
    </div>
  );
}
