# MootCourt LiveKit agent worker (Polly path: Transcribe STT -> Bedrock LLM ->
# Polly TTS, all AWS via livekit-plugins-aws). Long-lived ECS Fargate task.
#
# Build context expects the MootCourt livekit-agent sources copied in next to
# this Dockerfile before build (see README "Build the agent image"):
#   agent.py  prompts.py  requirements.txt
# plus the health wrapper shipped in this repo: healthcheck.py, entrypoint.sh
FROM python:3.12-slim

# System deps: the Silero VAD / audio stack needs libgomp; curl is for the
# container HEALTHCHECK.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App + health wrapper.
COPY agent.py prompts.py healthcheck.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Non-root.
RUN useradd --create-home --uid 1001 appuser && chown -R appuser:appuser /app
USER appuser

ENV HEALTH_PORT=8081
EXPOSE 8081

# Pre-download the Silero VAD weights at build time so the first dispatch is not
# delayed by a model download (best-effort; ignored if offline).
RUN python -c "from livekit.plugins import silero; silero.VAD.load()" || true

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${HEALTH_PORT}/health" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
