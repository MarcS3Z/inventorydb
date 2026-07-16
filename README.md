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

Then generate the Prisma client and sync the schema:

```bash
npm run db:generate --prefix server
npm run db:push --prefix server
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/items` | List items |
| GET | `/api/items/:id` | Get item |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |
