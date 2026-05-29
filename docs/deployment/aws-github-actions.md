# AWS GitHub Actions Deployment

This repository deploys the API with GitHub Actions:

- `.github/workflows/deploy-api.yml`

## AWS Targets

- API: Docker image pushed to GitHub Container Registry, then restarted on an EC2 host.

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
- `TAILOR_SERVICE_URL`
- `AWS_REGION`
- `AWS_SQS_ENDPOINT`
- `AWS_S3_BUCKET`
- `TAILORING_QUEUE_URL`

## Repository Variables

Use GitHub repository variables for non-secret workflow configuration.

Required:

- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME`: IAM role ARN for GitHub OIDC.
- `EC2_HOST`: public DNS or IP for the API EC2 instance.
- `EC2_USER`: SSH user, such as `ubuntu` or `ec2-user`.

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

For RDS, use the RDS endpoint hostname in `DATABASE_URL` and enable SSL:

```env
DATABASE_URL=postgres://user:password@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/applypilot
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

The RDS security group must allow inbound PostgreSQL `5432` from the API EC2 security group.

## IAM Permissions For GitHub Role

The GitHub OIDC role no longer needs S3 permissions for client deployment. Keep only the permissions needed to run the API deployment workflow.
