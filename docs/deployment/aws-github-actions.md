# AWS GitHub Actions Deployment

This repository deploys with `.github/workflows/deploy.yml`.

## AWS Targets

- API: Docker image pushed to ECR, then restarted on an EC2 host.
- Client: Vite build uploaded to S3 and invalidated through CloudFront.

## Required GitHub Secrets

- `AWS_ROLE_TO_ASSUME`: IAM role ARN for GitHub OIDC.
- `AWS_REGION`: AWS region, unless set as a repository variable.
- `EC2_HOST`: public DNS or IP for the API EC2 instance.
- `EC2_USER`: SSH user, such as `ubuntu` or `ec2-user`.
- `EC2_SSH_KEY`: private SSH key that can access the EC2 host.
- `DATABASE_URL`: production database URL for the API.
- `WEB_SESSION_SECRET`: production session signing secret.
- `CLIENT_ORIGIN`: CloudFront/client origin, for example `https://app.example.com`.
- `CORS_ORIGINS`: comma-separated allowed origins.
- `VITE_API_BASE_URL`: public API base URL used in the client build.
- `CLIENT_S3_BUCKET`: S3 bucket that backs the CloudFront distribution.
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution id.

Optional:

- `DATABASE_SSL`: `true` for SSL databases, defaults to `false`.
- `WEB_USERNAME` and `WEB_PASSWORD`: first-run admin seed credentials.
- `WEB_USERS`: comma-separated seed users, such as `admin@example.com:password:admin`.
- `TAILOR_SERVICE_URL`
- `TAILORING_QUEUE_URL`
- `AWS_SQS_ENDPOINT`

## Recommended Repository Variables

- `AWS_REGION`
- `API_ECR_REPOSITORY`, defaults to `applypilot-api`
- `API_CONTAINER_NAME`, defaults to `applypilot-api`
- `API_HOST_PORT`, defaults to `4000`

## EC2 Prerequisites

Install Docker and AWS CLI on the EC2 instance. The instance role also needs permission to pull from ECR:

- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:GetDownloadUrlForLayer`
- `ecr:BatchGetImage`

The workflow stores the API env file at `/opt/applypilot/api.env` and runs the API container on `API_HOST_PORT`.

## IAM Permissions For GitHub Role

The GitHub OIDC role needs permissions for:

- ECR repository describe/create and image push.
- S3 object sync to the client bucket.
- CloudFront invalidation.
- STS `GetCallerIdentity`.
