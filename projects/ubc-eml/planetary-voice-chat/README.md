# Unity Voice Chat — AI backend (Bedrock + Polly + Transcribe)

One HCP workspace that provisions the three serverless backends a Unity chat box
with voice needs:

| Service | What it does | Module |
|---------|--------------|--------|
| **Bedrock** | Chat completion (text in → text reply) | `bedrock-chat-backend` |
| **Polly** | Text-to-speech (text → audio) | `polly-tts-backend` |
| **Transcribe** | Speech-to-text, **record-then-transcribe** (audio clip → text) | `transcribe-batch-backend` |

Each is a Lambda behind a **public Function URL** gated by a shared secret in the
`x-chat-secret` header. The Unity client reaches all three with a plain
`UnityWebRequest` POST — **no AWS SDK in Unity, no SigV4 signing, no proxy, no
WebSocket, no streaming**. This works identically in **WebGL and native** builds.

## Why this shape (and not a proxy)

Live/streaming Transcribe would force a long-running WebSocket proxy, because the
AWS SDK for .NET can't stream Transcribe and Unity WebGL has no raw sockets —
that's exactly why the Unreal projects in this repo (`poetryhouse/transcribe-proxy`)
run ALB + Fargate. Choosing **record-then-transcribe** removes that constraint:
batch Transcribe is a request → job → result flow a Lambda owns, so the whole
stack stays serverless in one workspace.

Trade-off: batch transcription is **not instant**. Short clips typically come back
in ~5–25s. Fine for "hold to talk, release, see your words"; not for live captions.

## Deploy

1. `Copy-Item terraform.auto.tfvars.example terraform.auto.tfvars` and edit
   `client_name`, `project_name`, `environment`, `aws_region`, and the model/voice/
   language settings.
2. In `versions.tf`, set `cloud.workspaces.name` to your HCP workspace name.
3. Set **`chat_shared_secret`** as a **Sensitive** variable in the HCP workspace.
   Do **not** put it in `terraform.auto.tfvars` (that file is committed).
4. (Optional, for local dev / CI) install the Lambda SDK deps so `archive_file`
   can resolve the source:
   ```powershell
   npm --prefix lambda/chat-backend install
   npm --prefix lambda/tts-backend install
   npm --prefix lambda/transcribe-backend install
   ```
   The handlers import only runtime-provided `@aws-sdk/*` clients, so `node_modules`
   is **not** shipped in the zip (see each module README).
5. Ensure the chosen Bedrock model is enabled in the account/region (Bedrock
   console → Model access). For cross-region Anthropic models use an
   inference-profile ID, e.g. `us.anthropic.claude-3-5-sonnet-20241022-v2:0`.
6. Commit, open a PR, let HCP plan/apply (or `terraform init && terraform apply`).

## IAM for the HCP runner

Build the runner policy from `docs/iam/hcp-terraform-policy.template.json`, keeping
the statement blocks for: Lambda, IAM (roles/users/policies), CloudWatch Logs, S3
(the Transcribe scratch bucket), Bedrock, Polly, and Transcribe.

## Outputs → Unity config

After apply:

```powershell
terraform output -raw aws_region
terraform output -raw chat_function_url
terraform output -raw tts_function_url
terraform output -raw transcribe_function_url
terraform output -raw chat_shared_secret   # sensitive
```

Drop these into the Unity client config. Every request carries the secret:
`request.SetRequestHeader("x-chat-secret", sharedSecret)`.

## Request / response contracts

**Chat** — POST to `chat_function_url`:
```json
{ "systemPrompt": "optional", "messages": [ { "role": "user", "text": "..." } ] }
```
→ `{ "text": "assistant reply", "stopReason": "end_turn" }`

**TTS** — POST to `tts_function_url`:
```json
{ "text": "Hello.", "voiceId": "Ruth", "engine": "neural", "outputFormat": "mp3" }
```
→ `{ "audioBase64": "....", "contentType": "audio/mpeg" }`
On the client: base64-decode `audioBase64`, then build an `AudioClip` (decode MP3
with a runtime importer, or request `pcm` output and feed `AudioClip.Create`).

**Transcribe** — POST to `transcribe_function_url`:
```json
{ "audioBase64": "....", "mediaFormat": "wav", "languageCode": "en-US" }
```
→ `{ "text": "the transcribed speech", "jobName": "..." }`
Set the Unity request timeout generously (≥ the Lambda's `transcribe_timeout_seconds`)
and show a spinner while the batch job runs.

## Unity client notes

- **Transport**: `UnityWebRequest.Post` with a JSON body and the `x-chat-secret`
  header. Works in WebGL (via the browser fetch) and native builds.
- **Mic capture (native)**: Unity's `Microphone` class → encode the clip to WAV →
  base64 → POST to the transcribe endpoint.
- **Mic capture (WebGL)**: Unity's `Microphone` is unreliable in WebGL. Use a
  `getUserMedia`-based `.jslib` plugin (e.g. a community mic plugin) to pull PCM
  frames into C#, encode to WAV, then POST the same way.
- No Cognito, no identity pool, no AWS credentials on the client — the shared
  secret is the only thing the build carries.

## Security

- The `x-chat-secret` value ships with the build. Treat the packaged client as
  sensitive. Rotate by changing `chat_shared_secret` in HCP and re-applying.
- Add Bedrock / Polly / Transcribe spend budgets or alarms so a leaked secret
  can't run up an unbounded bill.
- The Transcribe scratch bucket blocks all public access, encrypts at rest, and
  expires objects via lifecycle (`transcribe_object_expiration_days`, default 1 day).
