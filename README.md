# Retro Board

Real-time collaborative retrospective board. React client, Express and Socket.IO server, PostgreSQL.

## Features

- Rooms with optional passwords, teams, and several board templates
- Phases: creation, voting, discussion, roadmap, rating
- Live cards, votes, comments, reactions, and a phase timer
- Room settings for anonymity, media, chat, drawing, and content checks

## Prerequisites

- Node.js 22 or newer
- PostgreSQL

## Setup

The repository is an npm workspace (`shared`, `server`, `client`) with one lockfile at the root.

```bash
cp server/.env.example server/.env
npm install
npm run dev
```

`npm run dev` builds `shared/`, applies SQL migrations, starts the API on http://localhost:3001, and starts the client on http://localhost:3000. Vite proxies `/api`, `/socket.io`, and `/uploads` to the server. In development the socket client talks to `http://localhost:3001` directly unless `VITE_API_BASE` is set.

`npm run build` builds `shared/`, the server, and the client in that order.

## Health

- `GET /health` returns process status
- `GET /healthz` checks that PostgreSQL answers; deploy nginx proxies it, and the systemd unit documents `curl -fsS http://127.0.0.1:3001/healthz`

## Tests

```bash
npm test
npm run lint
npm run test:e2e
```

Server tests use Vitest. The Postgres socket test runs when `INTEGRATION_DATABASE_URL` points at a database whose name contains `test`. Playwright expects the app at `BASE_URL`, or at http://localhost:3000.

## Project layout

```
client/     React, TypeScript, Vite, Material UI, MobX
server/     Express, Socket.IO, PostgreSQL
shared/     Domain types, room templates, and the socket event contract shared by the client and the server
deploy/     nginx, systemd, deploy scripts
```
