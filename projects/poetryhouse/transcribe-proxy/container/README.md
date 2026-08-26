# Transcribe Proxy Container

Node.js WebSocket server that proxies binary audio from Unreal Engine to AWS Transcribe Streaming.

## How It Works

```
Unreal (UAwsTranscriptionWebSocket)
    ↓ Binary WebSocket: [4-byte sample rate][PCM16 audio]
This Container (server.js)
    ↓ AWS SDK: StartStreamTranscription
Amazon Transcribe
    ↓ Transcript events
This Container
    ↓ JSON: {"transcript": "...", "isPartial": true/false}
Unreal
```

## Protocol

### Incoming (from Unreal)

Binary WebSocket frames:

```
[0-3]:  uint32 (little-endian) = sample rate in Hz (e.g., 48000)
[4-N]:  PCM16 audio data (signed 16-bit little-endian, mono)
```

### Outgoing (to Unreal)

JSON text frames:

```json
{
  "transcript": "the spoken text",
  "isPartial": true  // or false for final results
}
```

Error messages:

```json
{
  "error": "error type",
  "message": "error description"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | WebSocket port |
| `AWS_REGION` | `ca-central-1` | AWS region for Transcribe |
| `LANGUAGE_CODE` | `en-US` | Transcribe language code |

## Local Development

```bash
# Install dependencies
npm install

# Run locally (requires AWS credentials)
export AWS_REGION=ca-central-1
export LANGUAGE_CODE=en-US
npm start

# Or with auto-reload
npm run dev
```

Point Unreal to `ws://localhost:8080`.

## Building

```bash
# Build image
docker build -t transcribe-proxy .

# Run locally
docker run -p 8080:8080 -p 8081:8081 \
  -e AWS_REGION=ca-central-1 \
  -e LANGUAGE_CODE=en-US \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  transcribe-proxy

# Test health check
curl http://localhost:8081/health
```

## Deploying to ECR

See the parent `README.md` for the full Terraform deployment flow. In summary:

```bash
# Get ECR login (replace <account-id> and <region>)
aws ecr get-login-password --region ca-central-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ca-central-1.amazonaws.com

# Build
docker build -t transcribe-proxy .

# Tag
docker tag transcribe-proxy:latest <ecr_repository_url>:latest

# Push
docker push <ecr_repository_url>:latest

# Force ECS to redeploy
aws ecs update-service \
  --cluster poetryhouse-transcribe-proxy-dev-cluster \
  --service poetryhouse-transcribe-proxy-dev-service \
  --force-new-deployment \
  --region ca-central-1
```

## Ports

- **8080**: WebSocket server (for Unreal connections)
- **8081**: HTTP health check (for ALB target group)

The ALB routes traffic to port 8080, but checks health on port 8081.

## Health Check

```bash
curl http://localhost:8081/health
```

Response:

```json
{
  "status": "healthy",
  "activeConnections": 2,
  "timestamp": "2026-08-26T18:00:00.000Z"
}
```

## Logging

Logs are sent to stdout/stderr and captured by CloudWatch Logs.

View in AWS:

```bash
aws logs tail /ecs/poetryhouse-transcribe-proxy-dev --follow --region ca-central-1
```

## Supported Audio Formats

- **Sample rate**: Any rate supported by Transcribe (8000, 16000, 22050, 24000, 44100, 48000 Hz)
- **Encoding**: PCM16 (signed 16-bit little-endian)
- **Channels**: Mono only

If the sample rate changes mid-session, the server automatically restarts the Transcribe session.

## Error Handling

If Transcribe returns an error (e.g., `LimitExceededException`, invalid audio), the server sends a JSON error message to the client but keeps the WebSocket open. The client can continue sending audio or close the connection.

## Performance

- Each WebSocket connection opens one Transcribe stream
- Transcribe has a concurrent stream limit (default 25/region)
- Auto-scaling is configured to handle bursts (up to 3 tasks)
- Scale to zero when idle to minimize costs

## Troubleshooting

### "LimitExceededException"

You've exceeded Transcribe's concurrent stream quota. Either:
- Wait for existing streams to close
- Request a quota increase in AWS Service Quotas

### "Your request timed out because no new audio was received for 15 seconds"

Transcribe automatically closes idle streams after 15 seconds. If your use case has pauses, consider:
- Sending silent audio (zeros) every 10 seconds
- Restarting the stream after each utterance

### WebSocket disconnects immediately

Check CloudWatch logs for startup errors:
- IAM permissions missing for Transcribe
- Invalid AWS region
- ECR image pull failures
