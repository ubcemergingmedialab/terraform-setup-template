#!/usr/bin/env bash
# Start the health endpoint (background) then run the LiveKit agent worker in the
# foreground. If the worker exits, the container exits and ECS restarts the task.
set -euo pipefail

# Health server for the ALB target group.
python healthcheck.py &
HEALTH_PID=$!

# Stop the health server when the agent exits.
trap 'kill "$HEALTH_PID" 2>/dev/null || true' EXIT

# `start` runs the worker in production mode: it registers with LiveKit Cloud and
# waits to be dispatched into rooms. LIVEKIT_URL / LIVEKIT_API_KEY /
# LIVEKIT_API_SECRET come from the environment (plain + Secrets Manager). AWS
# creds for Transcribe/Bedrock/Polly come from the ECS task role.
exec python agent.py start
