# ApplyPilot API

Dedicated Express API for ApplyPilot.

The API publishes tailored resume requests to SQS. The actual OpenAI/PDF generation runs in the separate `worker/` app.

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

Create `api/.env` for local API-only development:

```bash
WEB_PORT=4000
CLIENT_ORIGIN=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

DATABASE_URL=postgres://user:password@localhost:5432/applypilot
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=false

WEB_SESSION_SECRET=change-me
WEB_USERNAME=admin@example.com
WEB_PASSWORD=change-me

AWS_REGION=us-east-1
AWS_S3_BUCKET=your-private-resume-bucket
TAILORING_QUEUE_URL=
```

For Docker Compose from the workspace root, put the shared values in the root `.env` instead. The client uses `client/.env` only for browser build-time values such as `VITE_API_BASE_URL`.

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
- `AWS_REGION`: AWS region for S3 and SQS, defaults to `us-east-1`.
- `AWS_S3_BUCKET`: private S3 bucket used to download generated tailored resumes. `tailored_resumes.file_path` should contain the object key inside this bucket, not a public URL.
- `AWS_SQS_ENDPOINT`: optional SQS-compatible endpoint, such as LocalStack.
- `TAILORING_QUEUE_URL`: SQS queue URL where the API publishes tailored resume generation requests.
