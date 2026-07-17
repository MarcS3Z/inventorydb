# InventoryDB

Simple inventory system with an Express API and React frontend.

## Structure

```
InventoryDB/
├── client/          # React (Vite) frontend
├── server/          # Express + Prisma API
└── package.json     # Root scripts (concurrently)
```

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm run install:all
cd server && npx prisma db push && cd ..
```

## Production build

On the server (or CI), install **including** client build tools, then build:

```bash
npm run install:all
# Important: do NOT use --omit=dev / --production for the build step,
# because Vite lives in client/devDependencies.
cd client && npm install && npm run build && cd ..
```

That writes static files to `client/dist`.

Serve `client/dist` with nginx (or similar) and run the API with:

```bash
cd server && npm install --omit=dev && npm start
```

Vite is a Node CLI and does not need a display. If you see a Qt/`xcb` display error during `npm run build`, the shell is almost certainly running some other `vite` binary from `PATH` instead of `client/node_modules/.bin/vite`. Check with:

```bash
cd ~/inventorydb/client
ls -la node_modules/.bin/vite
npm run build
# or explicitly:
./node_modules/.bin/vite build
```

If `node_modules/.bin/vite` is missing, run `npm install --prefix client` without omitting dev dependencies.

## Development

From the repo root:

```bash
npm run dev
```

This starts:

- API at http://localhost:3001
- Web app at http://localhost:5173 (proxies `/api` to the server)

## Configuration

Copy `server/.env.example` to `server/.env` and set:

- `DATABASE_URL` — MySQL connection string (URL-encode special characters in the password)
- `SMTP_*` — Amazon SES SMTP settings for outbound email
- Microsoft Entra ID SSO vars (see below)

Copy `client/.env.example` to `client/.env` and set the matching `VITE_AZURE_*` values.

Then generate the Prisma client and sync the schema:

```bash
npm run db:generate --prefix server
npm run db:push --prefix server
```

### Microsoft Entra ID SSO

InventoryDB uses Microsoft tenant SSO (MSAL on the client, JWT validation on the API).

1. In [Entra ID → App registrations](https://entra.microsoft.com/), create an app (single-tenant).
2. **Authentication**: add a SPA redirect URI, e.g. `http://localhost:5173`.
3. **Expose an API**: set Application ID URI to `api://<client-id>`, add scope `access_as_user`.
4. **API permissions**: add the app’s own `access_as_user` scope and grant admin consent if required.
5. Fill env vars (server `AZURE_AUDIENCE` must match the access token `aud`, usually `api://<client-id>`). The API accepts both Entra v1 and v2 token issuers.

| Variable | Where | Example |
|----------|-------|---------|
| `AZURE_TENANT_ID` | `server/.env` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | `server/.env` | Application (client) ID |
| `AZURE_AUDIENCE` | `server/.env` | `api://<client-id>` (must match token `aud`) |
| `VITE_AZURE_TENANT_ID` | `client/.env` | same tenant ID |
| `VITE_AZURE_CLIENT_ID` | `client/.env` | same client ID |
| `VITE_AZURE_API_SCOPE` | `client/.env` | `api://<client-id>/access_as_user` |

For local development without SSO, set:

```bash
# server/.env
AUTH_DISABLED=true

# client/.env
VITE_AUTH_DISABLED=true
```

When SSO is enabled, set both `AUTH_DISABLED` and `VITE_AUTH_DISABLED` to `false` (or remove them).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (public) |
| GET | `/api/me` | Current authenticated user |
| GET | `/api/items` | List items |
| GET | `/api/items/:id` | Get item |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |
