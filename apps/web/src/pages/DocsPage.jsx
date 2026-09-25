const ENDPOINTS = [
  ['GET', '/api/v1/user'],
  ['GET', '/api/v1/servers'],
  ['POST', '/api/v1/servers'],
  ['GET', '/api/v1/servers/:id'],
  ['PATCH', '/api/v1/servers/:id'],
  ['DELETE', '/api/v1/servers/:id'],
  ['POST', '/api/v1/servers/:id/deploy'],
  ['POST', '/api/v1/servers/:id/restart'],
  ['GET', '/api/v1/servers/:id/status'],
  ['GET', '/api/v1/servers/:id/logs'],
  ['GET', '/api/v1/servers/:id/env'],
  ['POST', '/api/v1/servers/:id/env'],
  ['PATCH', '/api/v1/servers/:id/env/:key'],
  ['DELETE', '/api/v1/servers/:id/env/:key'],
  ['GET', '/api/v1/servers/:id/files'],
  ['POST', '/api/v1/servers/:id/files/upload'],
  ['DELETE', '/api/v1/servers/:id/files'],
  ['POST', '/api/v1/servers/:id/files/extract'],
  ['POST', '/api/v1/servers/:id/files/compress'],
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl bg-panel-bg px-6 py-10 text-slate-200">
      <h1 className="text-2xl font-semibold text-white">ZetaPanel API Documentation</h1>
      <p className="mt-2 text-sm text-slate-400">
        Every endpoint below is real and backed by the Render API and Cloudflare R2 — nothing here is a mock.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Authentication</h2>
        <p className="mt-2 text-sm text-slate-400">
          Send your API key as a bearer token. Keys look like <code className="text-panel-accent">zp_live_...</code> and are
          created from the API Keys page — the full key is shown only once at creation time.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-emerald-300">
{`curl -X GET https://your-panel.example.com/api/v1/servers \\
  -H "Authorization: Bearer zp_live_xxxxxxxxxxxxxxxx"`}
        </pre>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Endpoints</h2>
        <div className="mt-3 divide-y divide-panel-border rounded-lg border border-panel-border">
          {ENDPOINTS.map(([method, path]) => (
            <div key={path} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className={`w-16 shrink-0 font-mono text-xs ${methodColor(method)}`}>{method}</span>
              <span className="font-mono text-slate-300">{path}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Example: trigger a deploy</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-emerald-300">
{`curl -X POST https://your-panel.example.com/api/v1/servers/srv_123/deploy \\
  -H "Authorization: Bearer zp_live_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"clearCache": false}'`}
        </pre>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-slate-300">
{`// Node.js (fetch)
const res = await fetch("https://your-panel.example.com/api/v1/servers/srv_123/deploy", {
  method: "POST",
  headers: {
    Authorization: "Bearer zp_live_xxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ clearCache: false }),
});`}
        </pre>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Uploading &amp; running a project (ZIP)</h2>
        <p className="mt-2 text-sm text-slate-400">
          When you create a server with <strong>Deployment Source: Upload ZIP</strong>, Render has no way to run code
          straight out of R2 — so ZetaPanel deploys a small Docker "runtime bridge" service instead (same repo as
          ZetaPanel itself, <code>apps/runtime/Dockerfile</code>). The actual flow:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>Upload your <code>project.zip</code> in the server's <strong>Files</strong> tab — this goes straight to R2 via a presigned URL.</li>
          <li>Click <strong>Extract</strong> next to the ZIP — the backend downloads it from R2, unpacks it with a real ZIP library, and re-uploads every file to R2 individually.</li>
          <li>Click <strong>Deploy</strong> — this restarts the Render container, which downloads every file at your R2 prefix, runs your build command, then execs your start command.</li>
        </ol>
        <p className="mt-3 text-sm text-slate-400">
          Redeploying re-syncs from R2 every time, so editing a file and hitting Deploy again really ships the new
          version. If nothing has been uploaded yet, the container fails to start with a clear error instead of
          pretending to be online.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Known limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li><strong>Git-based deploys</strong> (Deployment Source: Git Repository) still need a real, clonable Git URL — there's no way around that for that mode.</li>
          <li><strong>ZIP-based deploys</strong> currently support Node.js and Python projects (the runtime bridge image's toolchain) — Go/Rust/Ruby/Elixir would need that image extended first.</li>
          <li>Real-time log streaming uses polling against Render's Logs API, not a websocket, since ZetaPanel's console has not yet implemented Render's SSE log subscription.</li>
          <li><code>suspend</code>/<code>resume</code> are only available for web services, private services, and background workers — not cron jobs — because that's what Render itself supports.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Errors &amp; rate limits</h2>
        <p className="mt-2 text-sm text-slate-400">
          Errors are returned as <code>{'{ "error": { "message": "..." } }'}</code>. The public API is rate-limited to
          120 requests/minute per user; server creation and deploys have additional per-hour limits to prevent runaway
          automation.
        </p>
      </section>
    </div>
  );
}

function methodColor(method) {
  switch (method) {
    case 'GET':
      return 'text-sky-400';
    case 'POST':
      return 'text-emerald-400';
    case 'PATCH':
      return 'text-amber-400';
    case 'DELETE':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}
