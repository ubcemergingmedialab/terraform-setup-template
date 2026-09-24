# Transcribe Proxy Container (NursePractitioner)

Node.js WebSocket server that proxies binary audio from Unreal Engine to AWS
Transcribe Streaming. Replaces the STT leg of the EC2 "MOOT-API" proxy.

## How It Works

```
Unreal (DXL UDXLWebsocket, STT interaction)
    ↓ Binary WebSocket: [4-byte sample rate][PCM16 audio]
This Container (server.js)
    ↓ AWS SDK: StartStreamTranscription
Amazon Transcribe
    ↓ Transcript events
This Container
    ↓ JSON: {"transcript": "...", "isPartial": true/false}
Unreal (OnDataReceived)
```

## Protocol

### Incoming (from Unreal)

Binary WebSocket frames:

```
[0-3]:  uint32 (little-endian) = sample rate in Hz (e.g., 16000)
[4-N]:  PCM16 audio data (signed 16-bit little-endian, mono)
```

Prefer **16000 Hz** mono PCM16. The current NursePractitioner mic path captures
48 kHz; resample to 16 kHz before framing (see the project README).

### Outgoing (to Unreal)

JSON text frames — arrive on the DXL `OnDataReceived` delegate:

```json
{ "transcript": "the spoken text", "isPartial": true }
```

`isPartial: false` marks a finalized utterance (replaces the old
`END[MessageCompleted]` stream-end signal).

Error messages:

```json
{ "error": "error type", "message": "error description" }
```

## Authentication (optional shared secret)

If `TRANSCRIBE_SHARED_SECRET` is set, the client must present it at connect time,
either as the `x-transcribe-secret` header or a `?secret=<value>` query param on
the WebSocket URL. The check runs during the upgrade handshake, so unauthorized
clients never open a Transcribe stream. If unset, access is controlled only by
the ALB's `allowed_cidr_blocks`.

> Unreal's `IWebSocket` (via the DXL plugin) does not expose custom connect
> headers, so the game will typically use the `?secret=` query-param form.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | WebSocket port |
| `AWS_REGION` | `ca-central-1` | AWS region for Transcribe |
| `LANGUAGE_CODE` | `en-US` | Transcribe language code |
| `TRANSCRIBE_SHARED_SECRET` | (unset) | Optional connect secret |

## Local Development

```bash
npm install
export AWS_REGION=ca-central-1
export LANGUAGE_CODE=en-US
npm start   # point Unreal to ws://localhost:8080
```

## Ports

- **8080**: WebSocket server (Unreal connections)
- **8081**: HTTP health check (ALB target group)

## Supported Audio Formats

- Sample rate: any Transcribe-supported rate (8000/16000 recommended)
- Encoding: PCM16 (signed 16-bit little-endian)
- Channels: mono only

If the sample rate changes mid-session, the server restarts the Transcribe
session automatically.
