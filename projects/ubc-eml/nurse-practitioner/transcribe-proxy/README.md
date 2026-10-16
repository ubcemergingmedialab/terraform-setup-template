# NursePractitioner — Transcribe Proxy

WebSocket proxy that connects Unreal Engine to AWS Transcribe Streaming. Replaces
the STT leg of the EC2 "MOOT-API" websocket proxy. The Unreal client keeps its
existing DXL `UDXLWebsocket` (STT interaction) and just points at this service.

Same pattern as `projects/poetryhouse/transcribe-proxy`.

## Architecture

```
Unreal Engine (DXL UDXLWebsocket, STT)
    ↓ Binary PCM16 audio via WebSocket ([4-byte sample rate][PCM16])
ALB + Fargate (Node.js proxy, container/)
    ↓ AWS SDK for JavaScript
Amazon Transcribe Streaming API
    ↓ JSON transcription results ({"transcript","isPartial"})
Back to Unreal Engine (OnDataReceived)
```

## What This Project Creates

| Resource | Purpose |
|----------|---------|
| ECR Repository (`ecr-repository` module) | Stores the proxy Docker image |
| ECS Cluster + Fargate Service (`ecs-fargate-service` module) | Runs the Node.js proxy |
| Application Load Balancer + Target Group | Exposes the WebSocket endpoint |
| Security Groups | ALB → ECS |
| IAM task role | `transcribe:StartStreamTranscription(WebSocket)` (same shape as episode) |
| CloudWatch Logs | Container logs |

## Auth

Two options (not mutually exclusive):

- **Shared secret** (optional): set `transcribe_shared_secret` as a **sensitive
  HCP workspace variable**. The container then requires it at connect time via
  `x-transcribe-secret` header or `?secret=` query param. Because Unreal's
  WebSocket can't set custom headers, the game appends `?secret=<value>` to the
  connect URL.
- **CIDR restriction**: narrow `allowed_cidr_blocks` from `0.0.0.0/0`.

## Deployment Steps

### 1. Create HCP Workspace

- Workspace: **ubc-eml-np-transcribe**
- Working directory: `projects/ubc-eml/nurse-practitioner/transcribe-proxy`
- Configure AWS credentials; the identity needs ECS, ECR, EC2 (ALB/SG), IAM, and
  CloudWatch Logs permissions.
- (Optional) add `transcribe_shared_secret` as a sensitive variable.

### 2. First Apply (Infrastructure Only)

The ECR repo is created but no image exists yet. Apply once, note
`ecr_repository_url`.

### 3. Build and Push the Image

```powershell
cd container
docker build -t np-transcribe-proxy .
aws ecr get-login-password --region ca-central-1 | `
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ca-central-1.amazonaws.com
docker tag np-transcribe-proxy:latest <ecr_repository_url>:latest
docker push <ecr_repository_url>:latest
```

### 4. Apply again / force a new deployment

```powershell
aws ecs update-service `
  --cluster ubc-eml-np-transcribe-dev-cluster `
  --service ubc-eml-np-transcribe-dev-service `
  --force-new-deployment --region ca-central-1
```

### 5. Wire the game

Point the DXL STT socket at the `websocket_url` output (see the project README
for the exact Unreal changes, including 48 kHz → 16 kHz resampling and the JSON
transcript parse).

## Configuration

See `variables.tf`. Common knobs live in `terraform.auto.tfvars`: `fargate_cpu`,
`fargate_memory_mb`, `transcribe_language_code`, `allowed_cidr_blocks`, and the
auto-scaling block (`autoscaling_min_capacity = 0` scales to zero when idle).

## Cost (dev, auto-scale to zero)

Fargate ~$2/mo (light use) + ALB ~$16/mo + Transcribe $0.025/min of audio.
