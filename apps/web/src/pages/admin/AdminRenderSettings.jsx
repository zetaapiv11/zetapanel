import { useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card } from '../../components/ui.jsx';

export default function AdminRenderSettings() {
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    setTesting(true);
    setResult(null);
    try {
      const res = await api.post('/admin/render/test-connection');
      setResult(res);
    } catch (e) {
      setResult({ connected: false, error: e.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="max-w-lg space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Render API Connection</h2>
      <p className="text-xs text-slate-500">
        The Render API key is configured server-side via the <code>RENDER_API_KEY</code> environment variable — it is
        never stored in the database in plaintext and never sent to the browser. This button performs a real request
        to Render's <code>/v1/owners</code> endpoint to verify the key.
      </p>
      <Button onClick={testConnection} disabled={testing}>
        {testing ? 'Testing…' : 'Test Connection'}
      </Button>
      {result && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${result.connected ? 'border-emerald-700/50 text-emerald-300' : 'border-red-700/50 text-red-300'}`}>
          {result.connected ? 'Connected.' : `Not connected: ${result.error}`}
        </div>
      )}
    </Card>
  );
}
