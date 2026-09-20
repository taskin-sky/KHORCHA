# Khorocha

**Plan. Track. Save.** Khorocha is a mobile-first personal finance PWA for individual users in Bangladesh. It keeps income, expenses, and savings distinct, supports a balanced monthly budget, tracks Rajshahi trips, and calculates every dashboard total on the server.

## Features

- JWT registration, login, protected routes, refresh, and safe logout
- Monthly plans with category allocations, reconciliation, copy support, and unique month/year enforcement
- Income, expense, and saving transactions with search, filters, pagination, editing, and deletion
- Backend-calculated available balance, budget usage, category remaining, and saving progress
- Trip budgets and linked transaction summaries
- Saving goals and monthly saving history
- Responsive charts, accessible summaries, dark/light themes, CSV export
- Eight-step onboarding with the exact 35,000 BDT sample plan
- Installable PWA with cached app shell, offline fallback, and update-ready service worker
- Mobile bottom navigation and one-hand quick transaction entry

## Architecture

```text
client/  React + Vite PWA, TanStack Query server state, Zustand session state
server/  Express API, thin route handlers, Mongoose models, finance services
```

All private database queries are scoped with the authenticated user's ID. Transaction month/year are derived from the submitted date on the server. Money is stored as positive integer BDT values. Planned allocations never become transactions automatically.

## Requirements and setup

1. Install Node.js 20+ and obtain a MongoDB Atlas connection string.
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI` and a long random `JWT_SECRET`.
3. Optionally copy `client/.env.example` to `client/.env` if the API is not at the default URL.
4. Run:

```bash
npm run install:all
npm run seed
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/health`.

### Environment variables

Server: `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`.

Client: `VITE_API_BASE_URL` (default: `http://localhost:5000/api`). Never place MongoDB or JWT secrets in client environment variables.

## Commands

```bash
npm run dev          # API and web app concurrently
npm run test         # server and client tests
npm run lint         # both ESLint configurations
npm run build        # production PWA build
npm run seed         # reset the development demo user's data
```

## Demo data

After seeding: `demo@khorocha.app` / `Khorocha123!`. Change or remove this user before a public deployment. The seed only runs on explicit command and refuses to run when `NODE_ENV=production`.

## API overview

The API uses the `/api` prefix and consistent `{ success, message, data }` responses. Major resources are `/auth`, `/categories`, `/plans`, `/transactions`, `/trips`, `/savings`, `/dashboard/summary`, and `/reports`. CSV export is available at `/api/reports/export`.

## Production and deployment

Run `npm run build`, serve `client/dist` from a static host, and deploy `server` to a Node host with environment variables configured. Restrict `CLIENT_URL` to the deployed frontend origin and allow that host's IP in MongoDB Atlas Network Access. Use HTTPS and rotate secrets before launch.

To install the PWA, open the deployed HTTPS site in a supported browser and choose **Install app** or **Add to Home Screen**.

## Known limitations

- JWTs are stored in browser storage for this first version; production can be hardened further with rotating refresh tokens in secure HTTP-only cookies.
- The app shell works offline, but financial writes intentionally require connectivity and are not queued.
- Currency is currently BDT-only in calculations and formatting.
- Printable reports use the browser print flow; PDF generation is not included.
