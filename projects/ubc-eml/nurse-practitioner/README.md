# NursePractitioner — Bedrock / Transcribe / Polly backend

Replaces NursePractitioner's dependency on the EC2 WebSocket proxy
(`wss://MOOT-API.UBC-DXL.CA:8911`, which relayed to OpenAI) with managed AWS
services. Structure and auth mirror the proven `projects/poetryhouse` projects
and reuse the permission shapes already used in `projects/ubc-eml/episode`.

## Key design point: chat is consumed as audio

In the game, the chat / agent path is **always** consumed as **streamed spoken
audio** (the old DXL `[CSS]` flow: send text, get audio back) — the game never
reads chat *text*. So the chat backend does **both** legs server-side:
**Bedrock (text) → Polly (speech)**, and returns audio. The game makes **one**
HTTP call and plays the result. Only speech-to-text stays a WebSocket.

## Subprojects (one HCP workspace each)

| Folder | Replaces | Service | Endpoint | Auth | HCP workspace |
|---|---|---|---|---|---|
| `chat-backend/` | DXL `[CSS]` chat+audio (and the OpenAI scoring call) | Lambda → Bedrock `Converse` → Polly `SynthesizeSpeech` | Lambda Function URL (HTTPS POST, returns audio) | `x-chat-secret` shared secret | `ubc-eml-np-chat` |
| `transcribe-proxy/` | DXL `[STT]` speech-to-text | Fargate WebSocket proxy → Amazon Transcribe Streaming | ALB WebSocket (`ws://`/`wss://`) | optional `?secret=` / `x-transcribe-secret` | `ubc-eml-np-transcribe` |
| `polly/` *(optional)* | standalone TTS, if anything outside the chat flow needs it | Lambda → Amazon Polly | Lambda Function URL (HTTPS POST) | `x-tts-secret` shared secret | `ubc-eml-np-polly` |

**`polly/` is optional.** The chat backend already synthesizes speech internally,
so the main game flow does not need the standalone Polly project. Deploy it only
if some other feature needs text-to-speech on its own.

## Conventions

- `client_name = "ubc-eml"`, `project_name = "np-chat" | "np-transcribe" | "np-polly"`,
  region `ca-central-1`. Resource names follow `${client}-${project}-${env}-*`.
- Bedrock model: `global.anthropic.claude-sonnet-4-6` (global cross-region
  inference profile, enabled for this account; invokable from any region).
- Polly voice: `Tiffany`, engine `neural` (the old DXL/OpenAI voice names like
  `alloy`/`nova` do **not** exist in Polly).
- **Secrets never go in `terraform.auto.tfvars`** (committed). Set
  `chat_shared_secret` (and, if used, `tts_shared_secret` /
  `transcribe_shared_secret`) as **sensitive HCP workspace variables**.

---

## Game-side wiring (Unreal / NursePractitioner)

The DXL plugin (`Plugins/DXL`) is Blueprint-driven. Today the endpoint
`wss://MOOT-API.UBC-DXL.CA:8911` is hardcoded in a Blueprint. This migration
touches Blueprints + `Config/DefaultGame.ini`; it needs no DXL C++ changes.

**Current flow:** mic → STT DXL socket → transcript text → `SendString` on the
CSS DXL socket → CSS socket streams audio back → `UAudioManager` plays it.

**New flow:** mic → STT DXL socket (→ transcribe-proxy) → transcript text →
**one VaRest POST** to the chat backend → audio (mp3) back → `UAudioManager`
plays it. The CSS socket goes away; the STT socket stays.

### 1. Config — `Config/DefaultGame.ini`

```ini
[NursePractitioner.Bedrock]
Region=ca-central-1
ChatEndpointUrl=https://<chat-fn-url>/
ChatSharedSecret=<chat secret>
TranscribeWebSocketUrl=ws://<alb-dns>        ; append ?secret=<value> if the proxy secret is enabled
```

`TtsEndpointUrl` / `TtsSharedSecret` are **only** needed if you deploy the
optional standalone `polly/` project. They are not part of the main flow.

Read these in Blueprints with **Get Config String** (the `UNurseUtilities`
helper added for this), e.g. Section `NursePractitioner.Bedrock`, Key
`ChatEndpointUrl`.

Populate from Terraform outputs:

```powershell
# chat-backend workspace
terraform output -raw chat_function_url      # -> ChatEndpointUrl
terraform output -raw chat_shared_secret     # -> ChatSharedSecret
# transcribe-proxy workspace
terraform output -raw websocket_url          # -> TranscribeWebSocketUrl
```

### 2. Speech-to-text — reuse the DXL WebSocket (`transcribe-proxy`)

- Repoint the STT `UDXLWebsocket::Connect` from the MOOT endpoint to the ALB:
  `ServerURL` = ALB DNS (host only), `Port` = `80`, `Protocol` = `WS`
  (plain `ws://` today — no ACM cert). If the transcribe secret is enabled it
  must ride on the URL as `?secret=<value>`; note `Connect` builds `ws://host:port`
  with no query support, so either drop the transcribe secret (rely on
  `allowed_cidr_blocks`) or add a `ConnectUrl(FullUrl)` overload to the plugin
  (ask and I'll add it).
- Send audio as raw **`[4-byte little-endian sample rate][PCM16 mono]`** frames,
  16 kHz preferred. The proxy reads the 4-byte header and does **not** expect
  DXL's `[STT]…~!~` framing — so send with `SendData(Data, true)` (raw bytes),
  **not** `SendBytes` (which adds the prefix/delimiter). Resample the 48 kHz
  bounced WAV to 16 kHz PCM16 first (A1), or stream live frames (A2, deferred).
- Transcripts arrive on `OnDataReceived` as JSON `{"transcript","isPartial"}`.
  Parse with JsonBlueprintUtilities; `isPartial=false` = finalized utterance
  (replaces the old `END[MessageCompleted]`).

### 3. Chat + voice — ONE VaRest POST (`chat-backend`)

Replace the DXL `[CSS]` send-text/get-audio round trip with a single VaRest
request:

- **URL:** `ChatEndpointUrl`, **Verb:** POST — this is HTTPS, **not** the DXL
  `Connect`/`SendString` path.
- **Headers:** `Content-Type: application/json`, `x-chat-secret: <ChatSharedSecret>`.
- **Body:**
  ```json
  { "systemPrompt": "<persona prompt>",
    "messages": [ {"role":"user","text":"<transcript>"} ],
    "maxTokens": 512, "temperature": 0.7,
    "voiceId": "Tiffany", "outputFormat": "mp3" }
  ```
  (The old `SetPrompt`/`[RSP]` persona becomes `systemPrompt`; the old
  `SetVoice`/`[RSV]` becomes `voiceId` — using a **Polly** voice name.)
- **Response:** base64-encoded **mp3** (the spoken reply). Base64-decode the body,
  hand the bytes to RuntimeAudioImporter, and `EnqueueSound` on the existing
  `UAudioManager`. Playback is unchanged from today's CSS audio-chunk path.
- Keep your `messages` history array for multi-turn if the game does that today.

### 4. Scoring / assessment (text mode)

Scoring currently uses `VaRestSubsystem` to POST directly to
`https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <key>`
(key from `Content/Assets/Keys/OpenAI.txt`), and consumes the reply as **text**.

Repoint it at `ChatEndpointUrl` in **text mode** — the handler returns JSON and
skips Polly when the body includes `"format": "text"`:

- **URL:** `ChatEndpointUrl`, **Verb:** POST
- **Headers:** `Content-Type: application/json`, `x-chat-secret: <ChatSharedSecret>`
  (remove the `Authorization: Bearer` header)
- **Body:** `{ "format":"text", "systemPrompt":"<rubric prompt>",
  "messages":[{"role":"user","text":"<answer to score>"}], "maxTokens":512,
  "temperature":0.2 }`
- **Response:** `{ "text":"<score>", "stopReason":"..." }` — read `text`
  (instead of `choices[0].message.content`).

Translate the body from OpenAI's shape (system role → `systemPrompt`, `content` →
`text`), drop the `ReadAPIKeyFromFile("OpenAI.txt")` call, and delete
`Content/Assets/Keys/OpenAI.txt` once verified.

---

## Verification checklist

- [ ] `chat-backend` applied; POST with the secret returns base64 mp3 that plays
      via `UAudioManager`; wrong/no secret returns 403.
- [ ] `transcribe-proxy` image pushed and service healthy; DXL STT socket connects;
      16 kHz PCM frames round-trip to a `{"transcript"}` reply.
- [ ] Scoring repointed off `api.openai.com` to `ChatEndpointUrl` with
      `"format":"text"`; returns the score as text; `OpenAI.txt` retired.
- [ ] `NursePractitionerEditor Win64 Development` compiles.
- [ ] EC2 MOOT-API dependency decommissioned.

## Not included by default

- Live streaming STT (A2) — the scaffold assumes A1 (resample + single send).
- Streaming chat audio — the backend returns one buffered mp3 per reply, which
  matches how `UAudioManager` queues whole sound waves.
- A `ConnectUrl(FullUrl)` DXL overload — needed only if you keep the transcribe
  secret (so the `?secret=` query can be passed).
- Bedrock/Polly spend budget alarm — recommended.

The chat handler's `"format":"text"` branch (for scoring) **is** included.
