# AWS GitHub Actions Deployment

This repository deploys the API with GitHub Actions:

- `.github/workflows/deploy-api.yml`
- `.github/workflows/deploy-tailoring-workers.yml`

## AWS Targets

- API: Docker image pushed to GitHub Container Registry, then restarted on an EC2 host.
- Tailoring worker: build `worker/Dockerfile` and run it on a separate EC2 host with the same database and SQS queue.

## EC2 API Env File

Put the API runtime env file directly on the EC2 host. By default, the workflow starts the container with:

```bash
--env-file /home/ubuntu/.env
```

Set the `API_ENV_FILE` repository variable if you want to use a different path.

Required:

- `NODE_ENV=production`
- `WEB_PORT=4000`
- `CLIENT_ORIGIN`: public client origin.
- `CORS_ORIGINS`: comma-separated allowed origins.
- `DATABASE_URL`: production database URL for the API.
- `WEB_SESSION_SECRET`: production session signing secret.

Optional:

- `DATABASE_SSL`, defaults to `false`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`, defaults to `false`
- `DATABASE_CONNECT_TIMEOUT_MS`, defaults to `10000`
- `WEB_USERNAME` and `WEB_PASSWORD`: first-run admin seed credentials.
- `WEB_USERS`: comma-separated seed users, such as `admin@example.com:password:admin`.
- `AWS_REGION`
- `AWS_SQS_ENDPOINT`
- `AWS_S3_BUCKET`
- `TAILORING_QUEUE_URL`

## EC2 Worker Env File

Run the tailoring worker on a separate EC2 host with an env file such as `/home/ubuntu/worker.env`.

Required:

- `NODE_ENV=production`
- `DATABASE_URL`: same production database used by the API.
- `TAILORING_QUEUE_URL`: same SQS queue where the API publishes tailoring requests.
- `OPENAI_API_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`

Optional:

- `DATABASE_SSL`, defaults to `false`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`, defaults to `false`
- `DATABASE_CONNECT_TIMEOUT_MS`, defaults to `10000`
- `OPENAI_TIMEOUT_SECONDS`, defaults to `300`
- `OPENAI_MODEL`, defaults to `gpt-5-mini`
- `AWS_SQS_ENDPOINT`
- `TAILORING_CONCURRENCY`, defaults to `4`
- `TAILORING_MAX_ATTEMPTS`, defaults to `3`
- `TAILORING_VISIBILITY_TIMEOUT_SECONDS`, defaults to `600`

## Repository Variables

Use GitHub repository variables for non-secret workflow configuration.

Shared required:

- `EC2_USER`: SSH user, such as `ubuntu` or `ec2-user`. Defaults to `ubuntu`.

API required:

- `EC2_HOST`: public DNS or IP for the API EC2 instance.

API optional:

- `API_GHCR_IMAGE_NAME`, defaults to `applypilot-api`
- `API_CONTAINER_NAME`, defaults to `applypilot-api`
- `API_HOST_PORT`, defaults to `4000`
- `API_ENV_FILE`, defaults to `/home/ubuntu/.env`

Worker required:

- `WORKER_EC2_HOSTS`: JSON array of worker EC2 public DNS names or IPs, such as `["worker-1.example.com","worker-2.example.com"]`.

Worker optional:

- `WORKER_EC2_USER`, defaults to `EC2_USER`, then `ubuntu`.
- `WORKER_GHCR_IMAGE_NAME`, defaults to `applypilot-tailoring-worker`.
- `WORKER_CONTAINER_NAME`, defaults to `applypilot-tailoring-worker`.
- `WORKER_ENV_FILE`, defaults to `/home/ubuntu/worker.env`.

## Required GitHub Secrets

- `EC2_SSH_KEY`: private SSH key that can access the EC2 host.
- `WORKER_EC2_SSH_KEY`: optional private SSH key for worker hosts. If unset, the worker workflow uses `EC2_SSH_KEY`.

## EC2 Prerequisites

Install Docker on each EC2 instance. The deploy workflows log Docker into GHCR during the restart step so each host can pull the image built by GitHub Actions.

The workflow expects the API env file to already exist on EC2 and runs the API container on `API_HOST_PORT`.

The worker workflow expects `WORKER_ENV_FILE` to already exist on every worker EC2. Each worker runs the same container image and consumes from the same SQS queue. Add or remove worker capacity by changing the `WORKER_EC2_HOSTS` JSON array and rerunning the workflow.

For RDS, use the RDS endpoint hostname in `DATABASE_URL` and enable SSL:

```env
DATABASE_URL=postgres://user:password@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/applypilot
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

If the database username or password contains URL-reserved characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode them in `DATABASE_URL`. For example, `p@ss:word` becomes `p%40ss%3Aword`.

The RDS security group must allow inbound PostgreSQL `5432` from the API EC2 security group.

## IAM Permissions For GitHub Role

The GitHub OIDC role no longer needs S3 permissions for client deployment. Keep only the permissions needed to run the API deployment workflow.
