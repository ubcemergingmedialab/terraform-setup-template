# NursePractitioner — Bedrock / Transcribe / Polly backend

Replaces NursePractitioner's dependency on the EC2 WebSocket proxy
(`wss://MOOT-API.UBC-DXL.CA:8911`, which relayed to OpenAI) with managed AWS
services. Structure and auth mirror the proven `projects/poetryhouse` projects
and reuse the permission shapes already used in `projects/ubc-eml/episode`.

## Subprojects (one HCP workspace each)

| Folder | Replaces | Service | Endpoint | Auth | HCP workspace |
|---|---|---|---|---|---|
| `chat-backend/` | DXL `[CHT]`/`[CHS]`/`[CSS]` chat **and** the direct OpenAI scoring call | Lambda → Amazon Bedrock (`Converse`) | Lambda Function URL (HTTPS POST) | `x-chat-secret` shared secret | `ubc-eml-np-chat` |
| `transcribe-proxy/` | DXL `[STT]` speech-to-text | Fargate WebSocket proxy → Amazon Transcribe Streaming | ALB WebSocket (`ws://`/`wss://`) | optional `?secret=` / `x-transcribe-secret` | `ubc-eml-np-transcribe` |
| `polly/` | DXL `[TTS]`/`[CSS]` audio-back | Lambda → Amazon Polly (`SynthesizeSpeech`) | Lambda Function URL (HTTPS POST) | `x-tts-secret` shared secret | `ubc-eml-np-polly` |

Each subproject has its own README with deploy steps. Deploy independently.

## Conventions

- `client_name = "ubc-eml"`, `project_name = "np-chat" | "np-transcribe" | "np-polly"`,
  region `ca-central-1`. Resource names follow `${client}-${project}-${env}-*`.
- Bedrock model: `global.anthropic.claude-sonnet-4-6` (global cross-region
  inference profile, enabled for this account; invokable from any region).
- **Secrets never go in `terraform.auto.tfvars`** (committed). Set
  `chat_shared_secret`, `tts_shared_secret`, and the optional
  `transcribe_shared_secret` as **sensitive HCP workspace variables**.

## Secret management

Generate one secret per backend and set it both in the HCP workspace and in the
game's `DefaultGame.ini`. Rotate by changing the HCP value, re-applying, and
re-pasting into `DefaultGame.ini`. The transcribe secret is optional; if you skip
it, restrict `allowed_cidr_blocks` on the proxy instead.

---

## Game-side wiring (Unreal / NursePractitioner)

The DXL plugin (`Plugins/DXL`) is Blueprint-driven; today the endpoint
`wss://MOOT-API.UBC-DXL.CA:8911` is hardcoded in a Blueprint and `Authenticate`
is a no-op. The migration touches Blueprints + `Config/DefaultGame.ini` and needs
no C++ changes to the DXL plugin itself (Option A: reuse the DXL STT socket +
VaRest for HTTP).

### 1. Config indirection — `Config/DefaultGame.ini`

Add a section and read these at runtime instead of hardcoding in Blueprints:

```ini
[NursePractitioner.Bedrock]
Region=ca-central-1
ChatEndpointUrl=https://<chat-fn-url>/
ChatSharedSecret=<chat secret>
TranscribeWebSocketUrl=ws://<alb-dns>        ; append ?secret=<value> if the proxy secret is enabled
TtsEndpointUrl=https://<polly-fn-url>/
TtsSharedSecret=<tts secret>
```

Populate from Terraform outputs:

```powershell
# chat-backend workspace
terraform output -raw chat_function_url      # -> ChatEndpointUrl
terraform output -raw chat_shared_secret     # -> ChatSharedSecret
# transcribe-proxy workspace
terraform output -raw websocket_url          # -> TranscribeWebSocketUrl
# polly workspace
terraform output -raw polly_function_url     # -> TtsEndpointUrl
terraform output -raw tts_shared_secret      # -> TtsSharedSecret
```

`DefaultGame.ini` lives in Perforce (not this repo). The packaged build contains
these secrets — treat the build as sensitive.

### 2. Speech-to-text — reuse the DXL WebSocket (`transcribe-proxy`)

- Repoint the STT `UDXLWebsocket::Connect` call (in `BP_NetworkManager` / the
  socket BP) from the MOOT endpoint to `TranscribeWebSocketUrl`. If the proxy
  secret is enabled, connect to `…?secret=<value>` (Unreal's `IWebSocket` can't
  set custom headers, so the query param is used).
- Change the audio send path. The proxy expects **`[4-byte little-endian sample
  rate][PCM16 mono]`** frames, ideally **16 kHz**. Today the game records 48 kHz
  and sends a whole WAV blob via `SendBytes`. Options:
  - **A1 (simplest):** keep record-then-send; resample the bounced WAV to 16 kHz
    PCM16, strip the WAV header, prepend the 4-byte rate, and `SendBytes` once.
  - **A2 (streaming):** tap the mic submix and stream 16 kHz PCM frames live.
    Better latency, more work. Defer unless needed.
- Responses now arrive on `OnDataReceived` as **JSON** `{"transcript","isPartial"}`
  instead of raw text. Parse with JsonBlueprintUtilities; treat `isPartial=false`
  as the finalized utterance (replaces the old `END[MessageCompleted]` signal).

### 3. Chat / agent — VaRest HTTP POST (`chat-backend`)

Replace the DXL `[CHT]`/`[CHS]`/`[CSS]` chat interactions with an HTTPS POST to
`ChatEndpointUrl` (the project already uses VaRest for HTTP):

- Method `POST`, `Content-Type: application/json`, header `x-chat-secret: <ChatSharedSecret>`.
- Body: `{ "systemPrompt": "...", "messages": [ {"role":"user","text":"..."} ], "maxTokens":512, "temperature":0.7 }`.
- Response: `{ "text": "...", "stopReason": "..." }`.
- Streaming: the backend is `BUFFERED` (single reply), matching the game's
  single-message consumption. Streaming (`RESPONSE_STREAM` + NDJSON) can be
  enabled later in the module if partial-token UI is wanted.

### 4. Scoring / assessment — repoint the existing OpenAI call

The scoring path currently POSTs directly to
`https://api.openai.com/v1/chat/completions` using `Content/Assets/Keys/OpenAI.txt`.
Point that same VaRest request at `ChatEndpointUrl`, drop the OpenAI bearer key,
and send `x-chat-secret` + the body shape above. Once done, `OpenAI.txt` and the
OpenAI dependency can be removed.

### 5. Text-to-speech — VaRest HTTP POST (`polly`)

Replace the DXL audio-back path with a POST to `TtsEndpointUrl`:

- Method `POST`, `Content-Type: application/json`, header `x-tts-secret: <TtsSharedSecret>`.
- Body: `{ "text": "words to speak", "voiceId": "Tiffany", "outputFormat": "mp3" }`.
- Response: base64-encoded mp3. Base64-decode the body, then feed the bytes into
  the existing `RuntimeAudioImporter` → `UAudioManager` queue — the playback path
  is unchanged from today's CSS audio-chunk handling.
- **Voice mapping**: the DXL `EDXLVoices` (alloy/echo/fable/onyx/nova/shimmer) are
  OpenAI-specific and don't exist in Polly. Use Polly voices (e.g. `Tiffany`,
  `Joanna`, `Matthew`, `Ruth`); optionally add `engine: "neural"`.

---

## Verification checklist

- [ ] `chat-backend` applied; POST with the secret returns a completion; wrong/no
      secret returns 403.
- [ ] `transcribe-proxy` image pushed and service healthy; DXL STT socket connects;
      16 kHz PCM frames round-trip to a `{"transcript"}` reply.
- [ ] `polly` applied; POST returns base64 mp3 that imports and plays via
      `UAudioManager`.
- [ ] Scoring call repointed off `api.openai.com`; `OpenAI.txt` retired.
- [ ] `NursePractitionerEditor Win64 Development` still compiles (no DXL C++
      changes required for Option A).
- [ ] EC2 MOOT-API dependency decommissioned.

## Not included by default

- Live streaming STT (A2) — the scaffold assumes A1 (resample + single send).
- Bedrock Knowledge Base / guardrails — episode has these; add later if the
  patient chat needs retrieval or content filtering (the chat handler already
  supports a KB retrieve path in the episode variant).
- A Bedrock/Polly spend budget alarm — recommended so a leaked secret can't run
  up an unbounded bill.
