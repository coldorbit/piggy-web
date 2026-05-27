# AWS GitHub Actions Deployment

This repository deploys with two independent workflows:

- `.github/workflows/deploy-api.yml`
- `.github/workflows/deploy-client.yml`

Both workflows run on pushes to `main`, so API and client deployment can run in parallel.

## AWS Targets

- API: Docker image pushed to GitHub Container Registry, then restarted on an EC2 host.
- Client: Vite build uploaded to an S3 bucket configured for static website hosting.

## EC2 API Env File

Put the API runtime env file directly on the EC2 host. By default, the workflow starts the container with:

```bash
--env-file /home/ubuntu/.env
```

Set the `API_ENV_FILE` repository variable if you want to use a different path.

Required:

- `NODE_ENV=production`
- `WEB_PORT=4000`
- `CLIENT_ORIGIN`: public client origin, for example the S3 website endpoint or a custom domain.
- `CORS_ORIGINS`: comma-separated allowed origins.
- `DATABASE_URL`: production database URL for the API.
- `WEB_SESSION_SECRET`: production session signing secret.

Optional:

- `DATABASE_SSL`, defaults to `false`
- `WEB_USERNAME` and `WEB_PASSWORD`: first-run admin seed credentials.
- `WEB_USERS`: comma-separated seed users, such as `admin@example.com:password:admin`.
- `TAILOR_SERVICE_URL`
- `AWS_REGION`
- `AWS_SQS_ENDPOINT`
- `TAILORING_QUEUE_URL`

## Repository Variables

Use GitHub repository variables for non-secret workflow configuration.

Required:

- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME`: IAM role ARN for GitHub OIDC.
- `EC2_HOST`: public DNS or IP for the API EC2 instance.
- `EC2_USER`: SSH user, such as `ubuntu` or `ec2-user`.
- `VITE_API_BASE_URL`: public API base URL used in the client build.
- `CLIENT_S3_BUCKET`: S3 bucket configured for static website hosting.

Optional:

- `API_GHCR_IMAGE_NAME`, defaults to `applypilot-api`
- `API_CONTAINER_NAME`, defaults to `applypilot-api`
- `API_HOST_PORT`, defaults to `4000`
- `API_ENV_FILE`, defaults to `/home/ubuntu/.env`

## Required GitHub Secrets

- `EC2_SSH_KEY`: private SSH key that can access the EC2 host.

## EC2 Prerequisites

Install Docker on the EC2 instance. The deploy workflow logs Docker into GHCR during the restart step so it can pull the API image.

The workflow expects the API env file to already exist on EC2 and runs the API container on `API_HOST_PORT`.

## S3 Prerequisites

Configure the client bucket for static website hosting. Use `index.html` as the index document, and for a client-side routed SPA, use `index.html` as the error document too.

The bucket also needs a public-read bucket policy, or another access setup that lets browsers read the uploaded site files directly from S3.

## IAM Permissions For GitHub Role

The GitHub OIDC role needs permissions for:

- S3 object sync to the client bucket.
