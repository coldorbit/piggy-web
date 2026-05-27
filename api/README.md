# ApplyPilot API

Dedicated Express API for ApplyPilot.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Default API URL: `http://localhost:4000`.

## Scripts

```bash
pnpm dev
pnpm start
pnpm check
```

## Environment

- `WEB_PORT`: API port, defaults to `4000` in package scripts.
- `CLIENT_ORIGIN`: default allowed browser origin.
- `CORS_ORIGINS`: comma-separated allowed origins. Use `*` only for local throwaway testing.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: local Docker Postgres credentials.
- `DATABASE_URL`: PostgreSQL connection string for non-Docker API runs.
- `DATABASE_SSL`: set to `true` for SSL databases.
- `WEB_SESSION_SECRET`: session signing secret.
- `WEB_USERS` or `WEB_USERNAME` / `WEB_PASSWORD`: first-run admin seed users, created only when `web_users` is empty.
- `TAILOR_SERVICE_URL`: optional resume tailoring service endpoint.
- `AWS_REGION`: AWS region for SQS, defaults to `us-east-1`.
- `AWS_SQS_ENDPOINT`: optional SQS-compatible endpoint, such as LocalStack.
- `TAILORING_QUEUE_URL`: SQS queue URL for tailored resume generation requests.
