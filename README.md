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

Tailored resume generation uses AWS SQS. Set `TAILORING_QUEUE_URL` in `.env`; set `AWS_SQS_ENDPOINT` too when using LocalStack or another SQS-compatible local endpoint.

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
