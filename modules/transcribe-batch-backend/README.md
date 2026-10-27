# `transcribe-batch-backend`

A Lambda that runs **record-then-transcribe** speech-to-text with Amazon
Transcribe, exposed via a Lambda **Function URL**, plus a short-lived S3 scratch
bucket for the audio and transcript.

This is the serverless alternative to the `ecs-fargate-service` /
`transcribe-proxy` pattern. Use it when the client can record a clip, send it,
and wait a few seconds for the text — i.e. **not** live/streaming transcription.
A Unity client (WebGL or native) reaches it with a single `UnityWebRequest` POST
and never needs the AWS SDK, SigV4 signing, raw sockets, or a long-running proxy.

> **Why not streaming?** AWS Transcribe *streaming* is unsupported by the AWS SDK
> for .NET and needs raw WebSockets (dead in Unity WebGL), which is exactly why
> the Unreal projects in this repo used a Fargate proxy. Batch Transcribe is a
> plain request → job → result flow a Lambda can own, so no proxy is needed.

## What it creates

- `aws_s3_bucket` (+ public-access block, SSE, lifecycle) — scratch space for
  uploaded audio and transcript JSON. Objects auto-expire (`object_expiration_days`).
- `aws_lambda_function` — your handler, with the scratch bucket + defaults as env vars.
- Execution role with basic logging + `transcribe:StartTranscriptionJob` /
  `GetTranscriptionJob` / `DeleteTranscriptionJob` + scoped S3 read/write on the bucket.
- `aws_lambda_function_url` — `NONE` auth by default (shared-secret gated), `BUFFERED`.
- CloudWatch log group.
- Optional (`create_invoker_user = true`): a scoped IAM user + access key for `AWS_IAM` auth.

## How the handler works (reference)

1. Receives the audio (base64 in JSON, or raw bytes) + optional `languageCode`.
2. Writes it to the scratch bucket under a unique key.
3. `StartTranscriptionJob` pointing at that S3 object.
4. Polls `GetTranscriptionJob` every `TRANSCRIBE_POLL_INTERVAL_MS` until COMPLETED/FAILED.
5. Fetches the transcript JSON from S3, returns `{ "text": "..." }`.
6. Best-effort cleanup of the audio + transcript objects (lifecycle rule is the backstop).

This is the **synchronous** design: one HTTP call in, transcript out. Set
`timeout_seconds` high enough to cover the batch-job latency (short clips are
typically ~5-25s). If you outgrow the Function URL timeout ceiling, split into a
start endpoint + a poll endpoint (async); the IAM/S3 scaffolding here supports it.

## Usage

```hcl
module "transcribe_backend" {
  source = "../../../modules/transcribe-batch-backend"

  name_prefix   = local.name_prefix
  source_path   = "${path.module}/lambda/transcribe-backend"
  auth_type     = "NONE"
  shared_secret = var.chat_shared_secret

  language_code          = "en-US"
  timeout_seconds        = 120
  object_expiration_days = 1

  tags = var.tags
}
```

## Dependencies — do NOT need to be packaged (for the default handler)

The reference handler imports only `@aws-sdk/client-transcribe` and
`@aws-sdk/client-s3`, both **preinstalled in the AWS Lambda Node.js runtime**.
The deploy zip only needs `handler.mjs`. See `bedrock-chat-backend/README.md` for
the full explanation of when you *would* need to bundle `node_modules`.

## Request / response contract (reference handler)

`POST`, `Content-Type: application/json`:

```json
{
  "audioBase64": "....",        // required: base64-encoded audio (WAV/FLAC/MP3/OGG/etc.)
  "mediaFormat": "wav",         // optional: wav | flac | mp3 | ogg | amr | webm
  "languageCode": "en-US"       // optional, defaults to TRANSCRIBE_LANGUAGE_CODE
}
```

Returns:

```json
{ "text": "the transcribed speech", "jobName": "..." }
```

On error: a non-2xx status with `{ "error": "..." }`.

## Inputs / outputs

See `variables.tf` and `outputs.tf`. Key knobs: `language_code`,
`object_expiration_days`, `poll_interval_ms`, `auth_type`, `shared_secret`,
`timeout_seconds`, `memory_mb`.

## Security notes

- With `NONE` auth, the endpoint is public and gated only by `shared_secret`.
  Treat the shipped secret as sensitive; it travels with the client build.
- The scratch bucket blocks all public access and encrypts at rest; the Lambda
  role is scoped to just this one bucket. Objects expire via lifecycle so audio
  doesn't accumulate.
- `transcribe:*` job actions have no resource-level scoping, so the role can
  manage Transcribe jobs account-wide. Consider a Transcribe spend budget/alarm.
