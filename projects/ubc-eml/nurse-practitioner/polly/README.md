# NursePractitioner — Polly TTS Backend (Lambda → Amazon Polly)

Replaces the audio/voice leg of the EC2 "MOOT-API" proxy (the old DXL `[TTS]` /
`[CSS]` audio-back interactions) with a Lambda that calls Amazon Polly. The game
POSTs text to a **public Function URL (`NONE` auth)** and authenticates with a
**shared secret** in the `x-tts-secret` header; the handler validates it.

Same permission shape as `projects/ubc-eml/episode`'s polly Lambda, with the
shared-secret gate added for parity with the chat backend.

## Secret handling (VCS-driven / HCP)

`tts_shared_secret` has **no default** and is **never** committed. Provide it as
a **sensitive Terraform variable in the HCP workspace** (`ubc-eml-np-polly` →
Variables → add `tts_shared_secret`, mark Sensitive). The game reads the same
value from `DefaultGame.ini`.

## What this provisions

- `aws_lambda_function.polly` — Node.js 22 (arm64) function that calls Polly
  `SynthesizeSpeech`, validates the `x-tts-secret` header, and returns
  base64-encoded audio.
- `aws_lambda_function_url.polly` — `NONE` auth, `BUFFERED` invoke mode.
- Lambda execution role with `polly:SynthesizeSpeech` + basic execution logging.
- CloudWatch log group.

The handler imports only `@aws-sdk/client-polly`, which is preinstalled in the
Lambda Node.js runtime, so the deploy zip is just `index.js` — no `node_modules`
is shipped or committed.

## Deploy

1. Create the HCP workspace `ubc-eml-np-polly`, working directory
   `projects/ubc-eml/nurse-practitioner/polly`, and add `tts_shared_secret` as a
   sensitive workspace variable.
2. Commit + PR → review the HCP plan → merge → Confirm & Apply.

## Wire the game to it

After apply, read the outputs into `NursePractitioner/Config/DefaultGame.ini`
under `[NursePractitioner.Bedrock]`:

```powershell
terraform output -raw polly_function_url    # -> TtsEndpointUrl
terraform output -raw aws_region            # -> Region
terraform output -raw tts_shared_secret     # -> TtsSharedSecret (sensitive)
```

## Request / response contract

`POST`, `Content-Type: application/json`, header `x-tts-secret: <secret>`:

```json
{ "text": "words to speak", "voiceId": "Tiffany", "outputFormat": "mp3" }
```

Response: audio bytes, base64-encoded, with an `audio/mpeg` (mp3) content type.
On the Unreal side, decode the base64 and feed the bytes into the existing
`RuntimeAudioImporter` → `UAudioManager` playback queue (unchanged from today's
CSS audio-chunk path).

## Voice mapping note

The old DXL voices (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) are
OpenAI-specific and do **not** exist in Polly. Pick Polly voices instead (e.g.
`Tiffany`, `Joanna`, `Matthew`, `Ruth`); set the project default via
`default_voice_id`, or send `voiceId` per request. Use `engine: "neural"` (or
`generative`) for higher-quality voices where supported.

## Security notes

- The shared secret ships in `DefaultGame.ini` inside the packaged build; treat
  the build as sensitive. Worst case on leak is Polly synthesis cost on this one
  Lambda.
- Rotate by changing `tts_shared_secret` in HCP and re-applying, then re-paste
  into `DefaultGame.ini` and repackage.
