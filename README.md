# ApplyPilot Web

ApplyPilot is split into two dedicated apps:

- `client/`: React + Vite browser app.
- `api/`: Express API, database layer, SQS publisher, and resume download endpoints.
- `worker/`: SQS consumer for tailored resume generation.

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

AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-resume-bucket
TAILORING_QUEUE_URL=

# Worker-only values.
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_TIMEOUT_SECONDS=300
OPENAI_MODEL=gpt-5-mini
TAILORING_CONCURRENCY=4
```

For API-only development, use `api/.env`. For worker-only development, use `worker/.env`. For client-only development, use `client/.env` with `VITE_API_BASE_URL`.

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

The compose file runs `api`, `worker`, and `client` as separate services.
It also starts a local Postgres service using `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` from `.env`.

Tailored resume generation runs in the separate SQS worker using OpenAI, and resume downloads use private S3 through the API. Set `TAILORING_QUEUE_URL` and `AWS_S3_BUCKET` for both API and worker. Set `OPENAI_API_KEY` only on the worker host. Set `AWS_SQS_ENDPOINT` too when using LocalStack or another SQS-compatible local endpoint.

## Split Repository Notes

To split into multiple repositories:

1. Move `web/client` into a new React client repository.
2. Move `web/api` into a new Express API repository.
3. Move `web/worker` into a worker repository, or keep `worker/` in the same deployment repository and build `worker/Dockerfile`.
4. Configure `client/.env` with the deployed API URL:
   ```bash
   VITE_API_BASE_URL=https://api.example.com
   ```
5. Configure API CORS:
   ```bash
   CLIENT_ORIGIN=https://app.example.com
   CORS_ORIGINS=https://app.example.com
   ```
