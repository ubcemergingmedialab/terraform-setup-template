# NursePractitioner — Chat + TTS Backend (Lambda → Bedrock → Polly)

Replaces the EC2 "MOOT-API" OpenAI websocket proxy for NursePractitioner. In the
game, chat is **always consumed as spoken audio** (the old DXL `[CSS]` flow: send
text, get audio back), so this **one Lambda does both legs**:

1. **Amazon Bedrock** (`Converse`) — generate the assistant reply text.
2. **Amazon Polly** (`SynthesizeSpeech`) — turn that text into audio.

and returns the **audio bytes** (base64-encoded). The game makes a single VaRest
HTTP POST and feeds the returned mp3 into its existing RuntimeAudioImporter →
`UAudioManager` playback queue. No chat *text* is consumed by the game.

The endpoint is a **public Function URL (`NONE` auth)** authenticated by a
**shared secret** in the `x-chat-secret` header (validated in the handler). Same
secret pattern proven in `projects/poetryhouse/chat-backend`.

> This subproject is self-contained (inline Lambda) rather than using the
> `bedrock-chat-backend` module, because the combined backend also needs
> `polly:SynthesizeSpeech`, which that module doesn't grant. The standalone
> `../polly` project is therefore **optional** — only needed if something outside
> the chat flow wants TTS on its own.

## Secret handling (VCS-driven / HCP)

`chat_shared_secret` has **no default** and is **never** committed. Set it as a
**sensitive Terraform variable** in the HCP workspace (`ubc-eml-np-chat` →
Variables → `chat_shared_secret`, mark Sensitive). The game reads the same value
from `DefaultGame.ini` (Perforce, not this repo).

## What this provisions

- `aws_lambda_function.chat_backend` — Node.js 22 (arm64). Validates
  `x-chat-secret`, calls Bedrock `Converse`, then Polly `SynthesizeSpeech`,
  returns base64 audio.
- `aws_lambda_function_url.chat_backend` — `NONE` auth, `BUFFERED`.
- Execution role with `bedrock:InvokeModel(WithResponseStream)` **and**
  `polly:SynthesizeSpeech`, plus basic logging.
- CloudWatch log group.

The handler imports only `@aws-sdk/client-bedrock-runtime` and
`@aws-sdk/client-polly`, both preinstalled in the Lambda Node.js runtime, so the
deploy zip is just `handler.mjs` — no `node_modules` shipped or committed.

## Model & voice

- `bedrock_model_id` = `global.anthropic.claude-sonnet-4-6` (global inference
  profile, enabled for this account; invokable from any region).
- `polly_voice_id` = `Tiffany` (Polly voice; the old DXL/OpenAI voice names like
  `alloy`/`nova` do **not** exist in Polly). `polly_engine` = `neural`.
- Per-request overrides: send `voiceId` / `outputFormat` in the POST body.

## Wire the game to it

After apply, read the outputs into `NursePractitioner/Config/DefaultGame.ini`
under `[NursePractitioner.Bedrock]`:

```powershell
terraform output -raw chat_function_url     # -> ChatEndpointUrl
terraform output -raw aws_region            # -> Region
terraform output -raw chat_shared_secret    # -> ChatSharedSecret (sensitive)
```

## Request / response contract

`POST`, `Content-Type: application/json`, header `x-chat-secret: <secret>`:

```json
{
  "systemPrompt": "optional role prompt",
  "messages": [ { "role": "user", "text": "..." } ],
  "maxTokens": 512,
  "temperature": 0.7,
  "voiceId": "Tiffany",
  "outputFormat": "mp3"
}
```

**Response:** the spoken reply as **base64-encoded mp3** (Function URL sets
`isBase64Encoded`), `Content-Type: audio/mpeg`. The generated stop reason is
echoed in the `x-reply-stop-reason` header for debugging. Errors return a non-200
JSON `{ "error": "..." }`.

### Game flow

```
STT transcript (from transcribe-proxy)
    -> VaRest POST here (systemPrompt = persona, messages = [{user, transcript}])
    -> base64 mp3 reply
    -> base64-decode -> RuntimeAudioImporter -> UAudioManager.EnqueueSound
```

This one call replaces the old DXL `[CSS]` send-text/get-audio round trip.

## Also used by: scoring / assessment (text mode)

The scoring path currently uses `VaRestSubsystem` to POST directly to
`https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <key>`,
the key read from `Content/Assets/Keys/OpenAI.txt` via
`UNurseUtilities::ReadAPIKeyFromFile`. It consumes the reply as **text**.

Point it at this endpoint using **text mode** so it gets JSON back instead of
audio (the handler skips Polly when `"format": "text"`):

`POST` `ChatEndpointUrl`, `Content-Type: application/json`, header
`x-chat-secret: <secret>`:

```json
{ "format": "text",
  "systemPrompt": "<the scoring/rubric system prompt>",
  "messages": [ { "role": "user", "text": "<the transcript/answer to score>" } ],
  "maxTokens": 512, "temperature": 0.2 }
```

Response: `{ "text": "<score/rubric>", "stopReason": "..." }`.

Migration from the OpenAI call:
- Drop the `Authorization: Bearer` header and the `OpenAI.txt` read
  (`ReadAPIKeyFromFile`); add `x-chat-secret`.
- Translate the body: OpenAI `{"model","messages":[{"role","content"}]}` →
  this API's `{"format":"text","systemPrompt",...,"messages":[{"role","text"}]}`
  (system role becomes `systemPrompt`; `content` becomes `text`).
- Read the reply from `text` instead of `choices[0].message.content`.
- Once verified, delete `Content/Assets/Keys/OpenAI.txt`.

## Security notes

- The shared secret ships in `DefaultGame.ini` inside the packaged build; treat
  the build as sensitive. Worst case on leak is Bedrock + Polly cost on this one
  Lambda.
- Rotate by changing `chat_shared_secret` in HCP, re-applying, and re-pasting into
  `DefaultGame.ini`.
- Consider a Bedrock/Polly spend budget alarm.
