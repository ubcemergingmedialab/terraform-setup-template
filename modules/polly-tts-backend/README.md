# `polly-tts-backend`

A Lambda that calls Amazon Polly to synthesize speech, exposed via a Lambda
**Function URL**. Same shape as `bedrock-chat-backend`: the client POSTs JSON,
the Lambda holds the AWS credentials and does the work, and (for `NONE` auth) a
shared secret in the `x-chat-secret` header gates the endpoint.

This is the reusable pattern for "a game/app needs text-to-speech without
embedding AWS credentials or signing requests from the engine". A Unity client
reaches it with a single `UnityWebRequest` POST (works in WebGL and native).

## What it creates

- `aws_lambda_function` — your handler, with Polly defaults injected as env vars.
- Execution role with basic logging + `polly:SynthesizeSpeech`.
- `aws_lambda_function_url` — `NONE` auth by default (shared-secret gated), `BUFFERED`.
- CloudWatch log group.
- Optional (`create_invoker_user = true`): a scoped IAM user + access key for `AWS_IAM` auth.

## Usage

```hcl
module "tts_backend" {
  source = "../../../modules/polly-tts-backend"

  name_prefix   = local.name_prefix
  source_path   = "${path.module}/lambda/tts-backend"
  auth_type     = "NONE"
  shared_secret = var.chat_shared_secret

  default_voice_id      = "Ruth"
  default_engine        = "neural"
  default_output_format = "mp3"

  tags = var.tags
}
```

## Dependencies — do NOT need to be packaged (for the default handler)

The reference handler imports only `@aws-sdk/client-polly`, which is
**preinstalled in the AWS Lambda Node.js runtime**. The deploy zip only needs
`handler.mjs`; there is no `node_modules` to build or commit. `package.json` /
`package-lock.json` pin the SDK version for local dev and let CI resolve the
source for `archive_file`. See `bedrock-chat-backend/README.md` for the full
explanation of when you *would* need to bundle `node_modules`.

## Request / response contract (reference handler)

`POST`, `Content-Type: application/json`:

```json
{
  "text": "Hello there.",
  "voiceId": "Ruth",            // optional, defaults to POLLY_DEFAULT_VOICE_ID
  "engine": "neural",           // optional: standard | neural | generative | long-form
  "outputFormat": "mp3",        // optional: mp3 | ogg_vorbis | pcm
  "textType": "text"            // optional: text | ssml
}
```

Returns JSON with the audio base64-encoded so it survives the Function URL
(binary-safe):

```json
{ "audioBase64": "....", "contentType": "audio/mpeg" }
```

On error: a non-2xx status with `{ "error": "..." }`.

### Why base64 JSON instead of raw audio bytes?

Lambda Function URLs return binary cleanly only with specific base64 handling.
Returning base64 inside JSON is the simplest contract that works identically in
WebGL and native Unity. On the client, base64-decode `audioBase64` into bytes
and build an `AudioClip` (e.g. decode MP3 with a runtime audio importer, or use
`pcm` output + `AudioClip.Create` for raw PCM).

## Inputs / outputs

See `variables.tf` and `outputs.tf`. Key knobs: `default_voice_id`,
`default_engine`, `default_output_format`, `auth_type`, `shared_secret`,
`create_invoker_user`, `architecture`, `memory_mb`, `timeout_seconds`.

## Security notes

- With `NONE` auth, the endpoint is public and gated only by `shared_secret`.
  Treat the shipped secret as sensitive; it travels with the client build.
- `polly:SynthesizeSpeech` has no resource-level scoping, so the role can
  synthesize with any voice/engine. Consider a Polly spend budget/alarm.
- Generative voices are slower and more expensive; `neural` is a good default.
