# ApplyPilot Tailoring Worker

Dedicated RabbitMQ worker for tailored resume generation.

The API creates `tailored_resumes` rows and publishes durable request messages to RabbitMQ. This worker receives those messages with manual acknowledgements, generates the tailored resume, uploads the DOCX to S3, and updates the row status to `ready` or `dead_letter`.

The worker is intentionally standalone: it has its own env loader, DB connection, Sequelize models, package dependencies, lockfile, and Dockerfile.

## Local Development

```bash
cp worker/.env.example worker/worker.env
pnpm install
pnpm --dir worker dev
```

Required environment:

- `DATABASE_URL`: same database used by the API.
- `RABBITMQ_URL`: AMQP connection URL for the RabbitMQ broker.
- `TAILORING_QUEUE_NAME`: queue used by the API publisher, defaults to `applypilot.tailoring`.
- `OPENAI_API_KEY`: OpenAI API key for resume generation.
- `AWS_REGION`: AWS region for S3.
- `AWS_S3_BUCKET`: private bucket for generated DOCX resumes.

Optional environment:

- `TAILORING_CONCURRENCY`: concurrent messages, defaults to `4`.
- `TAILORING_MAX_ATTEMPTS`: attempts before `dead_letter`, defaults to `3`.
- `TAILORING_STALE_PROCESSING_SECONDS`: age after which an interrupted processing claim may be reclaimed, defaults to `600`.

Retries use durable TTL queues that dead-letter messages back to the main queue after the exponential backoff. This works with stock RabbitMQ and does not require the delayed-message plugin.

## Docker

Build from the workspace root:

```bash
docker build -t applypilot-tailoring-worker worker
docker run --env-file worker/worker.env applypilot-tailoring-worker
```
