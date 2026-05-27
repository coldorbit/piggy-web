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
- `DATABASE_URL`: PostgreSQL connection string. For RDS, prefer the RDS endpoint hostname over a private IP.
- `DATABASE_SSL`: set to `true` for SSL databases such as RDS.
- `DATABASE_SSL_REJECT_UNAUTHORIZED`: set to `true` only when the runtime trusts the RDS CA certificate. Defaults to `false`.
- `DATABASE_CONNECT_TIMEOUT_MS`: Postgres connection timeout, defaults to `10000`.
- `DATABASE_POOL_MAX`, `DATABASE_POOL_MIN`, `DATABASE_POOL_ACQUIRE_MS`, `DATABASE_POOL_IDLE_MS`: optional Sequelize pool tuning.
- `WEB_SESSION_SECRET`: session signing secret.
- `WEB_USERS` or `WEB_USERNAME` / `WEB_PASSWORD`: first-run admin seed users, created only when `web_users` is empty.
- `TAILOR_SERVICE_URL`: optional resume tailoring service endpoint.
- `AWS_REGION`: AWS region for SQS, defaults to `us-east-1`.
- `AWS_SQS_ENDPOINT`: optional SQS-compatible endpoint, such as LocalStack.
- `TAILORING_QUEUE_URL`: SQS queue URL for tailored resume generation requests.
