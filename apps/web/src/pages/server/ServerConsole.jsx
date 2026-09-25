import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.js';
import { Button, Card } from '../../components/ui.jsx';

export default function ServerConsole({ server }) {
  const [lines, setLines] = useState([]);
  const [error, setError] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef(null);

  async function load() {
    try {
      const data = await api.get(`/servers/${server.id}/logs`, { limit: 200 });
      const entries = (data.logs || data || []).map((l) => ({
        timestamp: l.timestamp,
        message: l.message || l.text || JSON.stringify(l),
      }));
      setLines(entries);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000); // polling — Render doesn't give us a websocket here
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, autoScroll]);

  return (
    <Card className="flex h-[60vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-2">
        <span className="text-xs font-medium text-slate-400">Console</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
          <Button variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>
      <div className="terminal flex-1 overflow-y-auto bg-black/40 p-4 text-xs text-emerald-300">
        {error && <p className="text-red-400">{error}</p>}
        {!error && lines.length === 0 && <p className="text-slate-600">No logs yet. Deploy the service to see build/runtime output.</p>}
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap">
            <span className="text-slate-500">{l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : ''} </span>
            {l.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </Card>
  );
}
