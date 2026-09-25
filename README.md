# ZetaPanel

A Pterodactyl-inspired hosting control panel where the "hardware" is real
[Render](https://render.com) services and file storage is real
[Cloudflare R2](https://developers.cloudflare.com/r2/). ZetaPanel itself
never runs your code or stores your files — it's a control plane that talks
to Render's and Cloudflare's real APIs on your behalf.

## What's real here (and what isn't yet)

Every server action (create, deploy, restart, delete, env var changes,
status, logs) makes an actual authenticated request to the Render API.
Every file action (upload, download, list, delete, rename, extract,
compress) makes an actual request to Cloudflare R2 via the S3-compatible
API. Nothing flips a database flag and pretends something happened on
Render's or Cloudflare's side.

### The ZIP-upload deploy bridge

Render cannot run code straight out of R2 — it can only build from a Git
repo or a Docker image. So "upload a ZIP → it runs" is implemented as a
real bridge (`apps/runtime/`), not a claim without a mechanism:

1. Pick **Deployment Source: Upload ZIP** on Create Server. ZetaPanel
   creates a Render **Docker**-runtime service that points at
   `apps/runtime/Dockerfile` in this same repo (configured via
   `ZETAPANEL_RUNTIME_REPO`).
2. Upload your project ZIP via the Files tab — it's extracted into R2 for
   real, at `users/<userId>/servers/<serverId>/files/`.
3. Hit **Deploy**. The container's entrypoint (`sync-and-run.js`)
   downloads every object at that R2 prefix into the container, runs your
   build command, then `exec`s your start command.

Redeploying re-runs the container from scratch, so editing files and
clicking Deploy again really does ship the new version. The server will
fail to boot until something has actually been uploaded — that's Render
reporting a real failure, not ZetaPanel faking a status.

**Security note:** this passes the R2 secret key into a container running
arbitrary user-uploaded code, scoped to the right prefix only by
convention, not by the credential itself. Before offering ZIP deploys to
untrusted users, create the R2 API token with a bucket/prefix-scoped
policy (Cloudflare supports this) instead of using an account-wide key.

Other known, explicitly-documented limitations (see `/docs` in the running app):

- **Git-based deploys still need a real Git URL**, obviously — Render has
  no way around that for the `git` deployment source.
- **Console logs are polled**, not streamed over a websocket, since
  Render's real-time SSE log subscription endpoint is not yet wired up
  (`renderLogs.js` documents this and throws instead of faking it).
- **Suspend/resume** is only exposed for service types Render actually
  supports it for (web services, private services, background workers) —
  not cron jobs.

## Stack

- **Frontend**: React + Vite + Tailwind CSS, React Router, Zustand
- **Backend**: Node.js + Express, PostgreSQL + Prisma, JWT auth (argon2 +
  refresh token rotation)
- **Infrastructure**: Render REST API (`https://api.render.com/v1`)
- **Storage**: Cloudflare R2 via AWS SDK v3 (S3-compatible)

## Requirements

- Node.js 20+
- PostgreSQL 14+
- A Render account and API key (Account Settings → API Keys)
- A Cloudflare R2 bucket + S3 API token (R2 → Manage R2 API Tokens)

## Setup

```bash
npm install

cp apps/api/.env.example apps/api/.env
# edit apps/api/.env with your DATABASE_URL, JWT_SECRET, RENDER_API_KEY,
# and R2_* credentials

npm run prisma:generate
npm run prisma:migrate   # applies the schema in apps/api/prisma/schema.prisma

npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173 (proxies /api to :4000)
```

The **first account you register becomes the super admin** automatically.

### Environment variables (`apps/api/.env`)

```
DATABASE_URL=postgresql://user:password@localhost:5432/zetapanel
JWT_SECRET=replace-with-a-long-random-string
RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RENDER_API_BASE_URL=https://api.render.com/v1
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=zetapanel-storage
```

None of these secrets are ever sent to the browser — the frontend only ever
receives a short-lived JWT and, for file transfers, short-lived presigned R2
URLs.

## Running tests

```bash
npm run test:api
```

Tests cover the Render payload builder, status normalization, and the
Render API client's retry/error-mapping logic against a mocked `fetch` —
they check that ZetaPanel behaves correctly when Render responds a certain
way, not that Render itself works (that would require live credentials).

## Project structure

```
zetapanel/
  apps/
    api/                  Express backend
      src/
        services/render/  Render API client + wrappers (services, deploys, env, logs)
        services/storage/ Cloudflare R2 client + file/archive operations
        controllers/       Request handlers
        routes/            Express routers (session + admin + public /api/v1)
        middleware/        auth, rate limiting, error handling
        validators/        Zod schemas
      prisma/schema.prisma
      tests/
    web/                  React frontend
      src/
        pages/            Dashboard, Servers, Create Server, Server detail tabs, Admin, Docs
        stores/           Zustand auth store
        services/api.js   fetch wrapper with access-token refresh
```

## Discord bot example (the motivating use case)

1. Create Server → Service Type: **Background Worker**, Runtime: **Node**,
   Repository: your bot's Git repo, Start Command: `npm start`.
2. Environment tab → add `DISCORD_TOKEN`.
3. Deploy. The Console tab polls Render's real logs — you'll see your bot's
   actual `Logged in as ...` output once it's live.

## Extending this further

Sections of the original spec intentionally left as clearly-marked
extension points rather than faked:

- Real-time SSE log streaming (`renderLogs.js` → `subscribeToLogs`)
- Docker/image-based deploys in the Create Server form (the payload builder
  already supports `dockerfilePath`, the form just doesn't collect it yet)
- A ZIP→Git bridge (e.g. pushing an uploaded ZIP to a temporary GitHub repo
  via the GitHub API) if you want ZIP uploads to become deployable — this
  needs its own credential (a GitHub token) and its own audit trail, so it
  was left out rather than half-implemented.
