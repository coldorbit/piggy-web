# ApplyPilot Tailoring Worker

Dedicated SQS worker for tailored resume generation.

The API creates `tailored_resumes` rows and pushes request messages to SQS. This worker runs on a separate host, receives those messages, generates the tailored resume, uploads the DOCX to S3, and updates the row status to `ready` or `dead_letter`.

The worker is intentionally standalone: it has its own env loader, DB connection, Sequelize models, package dependencies, lockfile, and Dockerfile.

## Local Development

```bash
cp worker/.env.example worker/worker.env
pnpm install
pnpm --dir worker dev
```

Required environment:

- `DATABASE_URL`: same database used by the API.
- `TAILORING_QUEUE_URL`: SQS queue used by the API publisher.
- `OPENAI_API_KEY`: OpenAI API key for resume generation.
- `AWS_REGION`: AWS region for SQS and S3.
- `AWS_S3_BUCKET`: private bucket for generated DOCX resumes.

Optional environment:

- `AWS_SQS_ENDPOINT`: SQS-compatible endpoint for local development.
- `TAILORING_CONCURRENCY`: concurrent messages, defaults to `4`.
- `TAILORING_MAX_ATTEMPTS`: attempts before `dead_letter`, defaults to `3`.
- `TAILORING_VISIBILITY_TIMEOUT_SECONDS`: SQS visibility timeout, defaults to `600`.

## Docker

Build from the workspace root:

```bash
docker build -t applypilot-tailoring-worker worker
docker run --env-file worker/worker.env applypilot-tailoring-worker
```
