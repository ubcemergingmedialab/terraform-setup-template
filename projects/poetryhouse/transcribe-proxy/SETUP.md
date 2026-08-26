# Quick Start Guide

Complete guide to deploying the Poetry House Transcribe Proxy using this Terraform setup.

## What Was Created

```
terraform-setup-template/
├── modules/
│   ├── ecr-repository/           ← NEW: ECR module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   └── README.md
│   │
│   └── ecs-fargate-service/      ← IMPLEMENTED (was stub)
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── versions.tf
│       └── README.md
│
└── projects/
    └── poetryhouse/
        └── transcribe-proxy/     ← NEW: Your deployment
            ├── main.tf
            ├── variables.tf
            ├── outputs.tf
            ├── versions.tf
            ├── terraform.auto.tfvars
            ├── README.md
            ├── SETUP.md          ← You are here
            └── container/
                ├── package.json
                ├── server.js
                ├── Dockerfile
                ├── .dockerignore
                └── README.md
```

## Step-by-Step Deployment

### 1. Review Configuration

Open `terraform.auto.tfvars` and verify the settings:

```hcl
client_name  = "poetryhouse"
project_name = "transcribe-proxy"
environment  = "dev"
aws_region   = "ca-central-1"

fargate_cpu       = 512  # 0.5 vCPU
fargate_memory_mb = 1024 # 1 GB

enable_autoscaling       = true
autoscaling_min_capacity = 0  # Scale to zero!
```

The defaults are sensible for dev. Adjust if needed.

### 2. Create HCP Workspace

In HCP Terraform (app.terraform.io):

1. **Organization**: `EML` (or yours if transplanting)
2. **New Workspace** → Version control workflow
3. **Repository**: This GitHub repo
4. **Working directory**: `projects/poetryhouse/transcribe-proxy`
5. **Workspace name**: `poetryhouse-transcribe-proxy`
6. **Auto-apply**: OFF (you want to review plans)

### 3. Configure AWS Credentials

In the HCP workspace settings:

**Option A: Dynamic Credentials (Recommended)**

Set up AWS OIDC integration following [HCP Terraform docs](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration).

**Option B: Static Credentials**

Add environment variables (mark as sensitive):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Ensure the IAM user/role has permissions for:
- ECS (full)
- ECR (full)
- EC2 (ALB, target groups, security groups)
- IAM (create roles for ECS tasks)
- CloudWatch Logs

### 4. First Terraform Apply (Infrastructure)

```bash
# Create a branch
git checkout -b poetryhouse-transcribe-proxy

# Stage all files
git add modules/ecr-repository
git add modules/ecs-fargate-service
git add projects/poetryhouse

# Commit
git commit -m "Add Poetry House transcribe proxy infrastructure"

# Push
git push origin poetryhouse-transcribe-proxy

# Open PR on GitHub
```

In the PR:
1. Review the HCP speculative plan
2. Verify resources look correct
3. Get approval from team
4. Merge to main

In HCP UI:
1. Wait for plan to run
2. Review the plan output
3. Click "Confirm & Apply"

Note the outputs (you'll need these):
- `ecr_repository_url`
- `websocket_url`

### 5. Build and Push Container

```bash
cd projects/poetryhouse/transcribe-proxy/container

# Install dependencies (optional, for local testing)
npm install

# Build Docker image
docker build -t transcribe-proxy .

# Login to ECR (replace <account-id> with your AWS account ID)
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ca-central-1.amazonaws.com

# Tag with the ECR URL from Terraform outputs
docker tag transcribe-proxy:latest <ecr_repository_url>:latest

# Push
docker push <ecr_repository_url>:latest
```

### 6. Deploy Container to ECS

Force ECS to pull the new image:

```bash
aws ecs update-service \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --service poetryhouse-transcribe-proxy-dev-service \
  --force-new-deployment \
  --region ca-central-1
```

Wait 2-3 minutes for the task to start. Check status:

```bash
aws ecs describe-services \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --services poetryhouse-transcribe-proxy-dev-service \
  --region ca-central-1 \
  --query 'services[0].{Running:runningCount,Desired:desiredCount}'
```

### 7. Configure Unreal Engine

In your Unreal project, update the WebSocket URL:

**Blueprint:**

Find the `UAwsTranscriptionWebSocket` component and set:

```
ProxyUrl = ws://<alb_dns_name>
```

Use the `websocket_url` output from Terraform (or `alb_dns_name`).

**C++ (if setting at runtime):**

```cpp
UAwsTranscriptionWebSocket* WebSocket = NewObject<UAwsTranscriptionWebSocket>(this);
WebSocket->ProxyUrl = TEXT("ws://poetryhouse-transcribe-proxy-dev-alb-123456789.ca-central-1.elb.amazonaws.com");
WebSocket->ConnectWebSocket();
```

### 8. Test the Connection

In Unreal:
1. Start play mode
2. Trigger transcription (speak into microphone)
3. Check for transcription results

If not working, check CloudWatch logs:

```bash
aws logs tail /ecs/poetryhouse-transcribe-proxy-dev --follow --region ca-central-1
```

## Updating the Container

When you make changes to the Node.js server:

```bash
cd container

# Rebuild
docker build -t transcribe-proxy .

# Tag and push
docker tag transcribe-proxy:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest

# Force deploy
aws ecs update-service \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --service poetryhouse-transcribe-proxy-dev-service \
  --force-new-deployment \
  --region ca-central-1
```

No Terraform apply needed for container updates!

## Updating Infrastructure

When you change Terraform files:

```bash
# Make changes to *.tf or terraform.auto.tfvars
git add .
git commit -m "Update transcribe proxy config"
git push

# Open PR, review plan, merge
# Apply in HCP UI
```

## Monitoring

### View Logs

```bash
aws logs tail /ecs/poetryhouse-transcribe-proxy-dev --follow --region ca-central-1
```

### Check Service Health

```bash
# Check ECS service
aws ecs describe-services \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --services poetryhouse-transcribe-proxy-dev-service \
  --region ca-central-1

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn <target_group_arn> \
  --region ca-central-1
```

### Test Health Endpoint

The service exposes a health check on port 8081, but it's not publicly accessible (only ALB can reach it). To test:

```bash
# From a task in the same VPC
curl http://<task-ip>:8081/health
```

## Costs

With auto-scaling enabled (min 0, max 3):

| Component | Dev (80 hrs/month) | Prod (24/7) |
|-----------|-------------------|-------------|
| Fargate | ~$1.58 | ~$14.42 |
| ALB | ~$16 | ~$16 |
| Data Transfer | ~$1-5 | ~$5-20 |
| CloudWatch Logs | ~$0.50 | ~$2 |
| **Total** | **~$19-23/month** | **~$37-42/month** |

Plus Transcribe usage: $0.025/minute of audio.

## Scaling for Production

Edit `terraform.auto.tfvars`:

```hcl
environment = "prod"

fargate_cpu       = 1024 # 1 vCPU
fargate_memory_mb = 2048 # 2 GB

enable_autoscaling       = true
autoscaling_min_capacity = 1  # Always have 1 running
autoscaling_max_capacity = 5

log_retention_days = 30
enable_container_insights = true

enable_https = true
certificate_arn = "arn:aws:acm:ca-central-1:123456789:certificate/..."
```

Then apply via Terraform.

## Troubleshooting

### Container won't start

Check CloudWatch logs for errors:

```bash
aws logs tail /ecs/poetryhouse-transcribe-proxy-dev --follow --region ca-central-1
```

Common issues:
- IAM role missing Transcribe permissions
- Container image not found (did you push to ECR?)
- Health check failing

### WebSocket connection fails

1. Verify ALB DNS name is correct
2. Check security groups allow your IP
3. Confirm Fargate task is running:
   ```bash
   aws ecs list-tasks --cluster poetryhouse-transcribe-proxy-dev-cluster
   ```
4. Check ALB target health:
   ```bash
   aws elbv2 describe-target-health --target-group-arn <arn>
   ```

### "LimitExceededException" from Transcribe

You've hit the concurrent stream limit (25/region). Request a quota increase in AWS Service Quotas console.

### Fargate task keeps restarting

Check the health check configuration. The task must respond on port 8081 at `/health` within 5 seconds.

## Next Steps

Once working in dev:

1. **Production deployment**: Copy to `poetryhouse/transcribe-proxy-prod/`, update environment to `"prod"`
2. **HTTPS**: Request ACM certificate, enable in `terraform.auto.tfvars`
3. **Custom domain**: Add Route53 alias record pointing to ALB
4. **Monitoring**: Set up CloudWatch alarms for errors, high CPU, etc.
5. **Cost optimization**: Review usage, adjust auto-scaling thresholds

## Support

For issues with:
- **Terraform setup**: See `docs/conventions.md` in repo root
- **Modules**: See module READMEs in `modules/`
- **Container code**: See `container/README.md`
- **AWS resources**: Check CloudWatch logs and ECS console

## Cleanup (Destroying Resources)

To tear down everything:

```bash
# In HCP workspace, go to Settings → Destruction and Deletion
# Click "Queue destroy plan"
# Review the plan
# Confirm destruction

# Or via CLI (if you have Terraform installed locally):
cd projects/poetryhouse/transcribe-proxy
terraform destroy
```

**Warning**: This deletes all resources including logs. Ensure you've saved any data you need first.
