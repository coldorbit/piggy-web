# ApplyPilot Client

React/Vite client for ApplyPilot.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Default client URL: `http://localhost:3000`.

The client expects the API at `VITE_API_BASE_URL`, defaulting to relative API paths when unset.

Maintenance mode is controlled by the GrowthBook React SDK when these values are set:

```bash
VITE_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
VITE_GROWTHBOOK_CLIENT_KEY=sdk-your-client-key
VITE_GROWTHBOOK_ENVIRONMENT=production
VITE_GROWTHBOOK_MAINTENANCE_FLAG=maintenance-mode
VITE_GROWTHBOOK_INIT_TIMEOUT_MS=2000
```

When configured, the app fetches GrowthBook flags before mounting the workspace, so
internal API-backed auth checks do not run while maintenance mode is being decided.
For local fallback only, set `VITE_LOCAL_MAINTENANCE_MODE=true`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm check
```
