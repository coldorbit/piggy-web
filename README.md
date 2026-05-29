# ApplyPilot Web

ApplyPilot is split into two dedicated apps:

- `client/`: React + Vite browser app.
- `api/`: Express API and database layer.

Each directory has its own `package.json`, Dockerfile, README, and `.env.example`, so either app can be moved into a separate repository.

## Local Development

From this `web/` workspace:

```bash
pnpm install
pnpm dev
```

Defaults:

- Client: `http://localhost:3000`
- API: `http://localhost:4000`

For separate terminals:

```bash
pnpm --dir api dev
pnpm --dir client dev
```

The client reads `VITE_API_BASE_URL`; use `client/.env` to override it.

## Environment Files

Use the root `.env` when running the full workspace with `pnpm dev` or Docker Compose:

```bash
CLIENT_PORT=3000
API_PORT=4000
VITE_API_BASE_URL=http://localhost:4000

DATABASE_URL=postgres://applypilot:change-me@localhost:5433/applypilot
DATABASE_SSL=false
WEB_SESSION_SECRET=change-me
WEB_USERNAME=admin@example.com
WEB_PASSWORD=change-me

TAILOR_SERVICE_URL=http://localhost:5000
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-resume-bucket
TAILORING_QUEUE_URL=
```

For API-only development, use `api/.env`. For client-only development, use `client/.env` with `VITE_API_BASE_URL`.

## Build

```bash
pnpm build
pnpm check
```

`pnpm build` builds the React client. The API is runtime JavaScript and is checked with `pnpm check`.

## Docker

```bash
docker compose up --build
```

The compose file runs `api` and `client` as separate services.
It also starts a local Postgres service using `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env`.

Tailored resume generation uses AWS SQS, and resume downloads use private S3. Set `TAILORING_QUEUE_URL` and `AWS_S3_BUCKET` in `.env`; set `AWS_SQS_ENDPOINT` too when using LocalStack or another SQS-compatible local endpoint.

## Split Repository Notes

To split into multiple repositories:

1. Move `web/client` into a new React client repository.
2. Move `web/api` into a new Express API repository.
3. Configure `client/.env` with the deployed API URL:
   ```bash
   VITE_API_BASE_URL=https://api.example.com
   ```
4. Configure API CORS:
   ```bash
   CLIENT_ORIGIN=https://app.example.com
   CORS_ORIGINS=https://app.example.com
   ```
