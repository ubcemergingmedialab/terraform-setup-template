# Poetry House — Transcribe Proxy

WebSocket proxy service that connects Unreal Engine to AWS Transcribe Streaming. Replaces the problematic AWS SDK for Unreal integration.

## Architecture

```
Unreal Engine (C++ WebSocket client)
    ↓ Binary PCM16 audio via WebSocket
ALB + Fargate (Node.js proxy)
    ↓ AWS SDK for JavaScript
Amazon Transcribe Streaming API
    ↓ JSON transcription results
Back to Unreal Engine
```

## What This Project Creates

| Resource | Purpose |
|----------|---------|
| ECR Repository | Stores the Docker image for the transcribe proxy |
| ECS Cluster | Runs the Fargate tasks |
| Fargate Service | Hosts the Node.js WebSocket proxy |
| Application Load Balancer | Exposes WebSocket endpoint to Unreal |
| Target Group | Routes traffic to Fargate tasks |
| Security Groups | ALB → ECS communication |
| IAM Roles | Task execution + Transcribe permissions |
| CloudWatch Logs | Container logs |

## Deployment Steps

### 1. Build and Push Container Image

The container code lives in `container/` (see that folder's README for details).

```bash
cd container

# Build the image
docker build -t transcribe-proxy .

# Get ECR login
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ca-central-1.amazonaws.com

# Tag and push
docker tag transcribe-proxy:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest
```

The `ecr_repository_url` is output by Terraform after the first apply (see step 3).

### 2. Create HCP Workspace

In HCP Terraform:

1. Create new workspace: **poetryhouse-transcribe-proxy**
2. Connect to this GitHub repo
3. Set working directory: `projects/poetryhouse/transcribe-proxy`
4. Configure AWS credentials (use HCP dynamic credentials or set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` as sensitive environment variables)
5. Ensure the IAM role/user has permissions for:
   - ECS (cluster, service, task definition)
   - ECR (repository)
   - EC2 (ALB, target group, security groups)
   - IAM (roles, policies for ECS tasks)
   - CloudWatch Logs

### 3. First Apply (Infrastructure Only)

On the first apply, the ECR repository is created but the container image doesn't exist yet.

1. Merge this branch to trigger HCP plan
2. Confirm and apply
3. Note the `ecr_repository_url` output
4. Follow step 1 to build and push the image
5. Apply again (or force a new ECS deployment)

### 4. Deploy New Versions

After infrastructure is up:

```bash
# Build and push new version
cd container
docker build -t transcribe-proxy .
docker tag transcribe-proxy:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest

# Force ECS to deploy the new image
aws ecs update-service \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --service poetryhouse-transcribe-proxy-dev-service \
  --force-new-deployment \
  --region ca-central-1
```

### 5. Configure Unreal Engine

In your Unreal Blueprint or C++, set the WebSocket URL to the `websocket_url` output:

```cpp
// In UAwsTranscriptionWebSocket
ProxyUrl = TEXT("ws://poetryhouse-transcribe-proxy-dev-alb-123456789.ca-central-1.elb.amazonaws.com");
```

You can find this value in:
- HCP Terraform workspace outputs
- Or run: `aws elbv2 describe-load-balancers --region ca-central-1 --query "LoadBalancers[?LoadBalancerName=='poetryhouse-transcribe-proxy-dev-alb'].DNSName"`

## Configuration

Edit `terraform.auto.tfvars` to customize:

### Fargate Sizing

```hcl
fargate_cpu       = 512  # 0.5 vCPU = $11.82/month (24/7)
fargate_memory_mb = 1024 # 1 GB = $2.60/month (24/7)
```

For heavier usage, increase to 1024 CPU / 2048 MB.

### Auto-Scaling

```hcl
enable_autoscaling       = true
autoscaling_min_capacity = 0  # Scale to zero when idle!
autoscaling_max_capacity = 3
```

With `min_capacity = 0`, the service shuts down when no connections are active, saving costs.

### Language

```hcl
transcribe_language_code = "en-US"  # or "fr-CA", "es-ES", etc.
```

See [AWS Transcribe language codes](https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html).

## Monitoring

### View Logs

```bash
aws logs tail /ecs/poetryhouse-transcribe-proxy-dev --follow --region ca-central-1
```

Or in the AWS Console: CloudWatch → Log Groups → `/ecs/poetryhouse-transcribe-proxy-dev`

### Check Service Health

```bash
aws ecs describe-services \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --services poetryhouse-transcribe-proxy-dev-service \
  --region ca-central-1
```

Look for `runningCount` and `desiredCount` matching.

## Cost Estimate

Assuming dev environment with auto-scaling to zero:

| Component | Cost (dev, auto-scale) | Cost (prod, 24/7) |
|-----------|------------------------|-------------------|
| Fargate (0.5 vCPU, 1 GB ARM) | ~$1.58/month (80 hrs) | ~$14.42/month |
| ALB | ~$16/month | ~$16/month |
| Data Transfer | ~$1-5/month | ~$5-20/month |
| Transcribe | $0.025/min of audio | $0.025/min of audio |
| **Total (without Transcribe)** | ~$18-22/month | ~$35-40/month |

Transcribe usage depends entirely on audio volume. For 100 minutes/month: $2.50.

## Troubleshooting

### Container won't start

Check logs in CloudWatch. Common issues:
- Image not found in ECR (did you push?)
- IAM permissions missing for Transcribe
- Health check failing (is port 8081 responding?)

### WebSocket connection fails from Unreal

1. Check ALB security group allows your IP
2. Verify ALB DNS name is correct
3. Check Fargate task is running: `aws ecs list-tasks --cluster <cluster-name>`
4. Look for errors in CloudWatch logs

### "LimitExceededException" from Transcribe

You've hit the concurrent stream limit (default 25/region). Either:
- Wait for existing streams to close
- Request a quota increase in Service Quotas console

## Transplant to Client

When delivering to the client:

1. Copy this folder to client's repo
2. Edit `versions.tf`: change `organization` to client's HCP org
3. Edit `terraform.auto.tfvars`: change `client_name` and `tags`
4. Client creates their ECR repository and pushes the container
5. Client runs `terraform apply` in their AWS account

No code changes needed — the convention variables handle everything.
