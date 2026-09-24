// NursePractitioner combined chat + TTS backend.
//
// Replaces the EC2 "MOOT-API" OpenAI websocket proxy. In the game, chat is ALWAYS
// consumed as spoken audio (the old DXL [CSS] flow: send text, get audio back), so
// this single Lambda does both legs:
//   1. Amazon Bedrock Converse  -> assistant reply text
//   2. Amazon Polly SynthesizeSpeech(reply text) -> audio bytes
// and returns the audio, base64-encoded. The Unreal client (VaRest HTTP POST)
// decodes it and feeds it into its existing RuntimeAudioImporter -> UAudioManager
// playback queue.
//
// Invoked via a public Lambda Function URL (BUFFERED, NONE auth). Authenticates
// with a shared secret in the x-chat-secret header (validated timing-safe).
//
// Request body (application/json):
//   {
//     "systemPrompt": "optional system/role prompt",
//     "messages": [ { "role": "user" | "assistant", "text": "..." }, ... ],
//     "text": "user message",     // convenience: single-turn instead of messages[]
//     "maxTokens": 512,           // optional
//     "temperature": 0.7,         // optional
//     "voiceId": "Tiffany",       // optional, overrides POLLY_VOICE_ID
//     "outputFormat": "mp3",      // optional, overrides POLLY_OUTPUT_FORMAT
//     "format": "audio" | "text"  // optional, default "audio"
//   }
//
// Response depends on "format":
//   - "audio" (default): the spoken reply as base64-encoded audio (audio/* content
//     type). Used by the patient-chat flow (fed to RuntimeAudioImporter/UAudioManager).
//   - "text": JSON { "text": "...", "stopReason": "..." }, Polly skipped. Used by the
//     scoring / assessment path (replaces the direct OpenAI chat-completions call).
// On error: JSON { "error": "..." } with a non-200 status.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import crypto from 'node:crypto'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const modelId = process.env.BEDROCK_MODEL_ID
const sharedSecret = process.env.CHAT_SHARED_SECRET
const defaultVoiceId = process.env.POLLY_VOICE_ID ?? 'Tiffany'
const defaultEngine = process.env.POLLY_ENGINE ?? 'neural'
const defaultOutputFormat = (process.env.POLLY_OUTPUT_FORMAT ?? 'mp3').toLowerCase()

const bedrock = new BedrockRuntimeClient({ region })
const polly = new PollyClient({ region })

function jsonReply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function normalizeMessages(body) {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages
      .filter((m) => m && typeof m.text === 'string' && m.text.length > 0)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ text: m.text }],
      }))
  }
  if (typeof body.text === 'string' && body.text.length > 0) {
    return [{ role: 'user', content: [{ text: body.text }] }]
  }
  return []
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0)
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function audioContentType(outputFormat) {
  if (outputFormat === 'mp3') return 'audio/mpeg'
  if (outputFormat === 'ogg_vorbis') return 'audio/ogg'
  if (outputFormat === 'pcm') return 'audio/L16'
  return 'application/octet-stream'
}

export const handler = async (event) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return jsonReply(200, {})
    }

    if (!modelId) {
      return jsonReply(500, { error: 'BEDROCK_MODEL_ID is not configured.' })
    }

    // Shared-secret gate. Function URL lower-cases header names.
    if (sharedSecret) {
      const provided = event.headers?.['x-chat-secret'] ?? event.headers?.['X-Chat-Secret']
      if (!timingSafeEqual(provided ?? '', sharedSecret)) {
        return jsonReply(403, { error: 'Forbidden: missing or invalid chat secret.' })
      }
    }

    let rawBody = event.body ?? '{}'
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf-8')
    }

    let body
    try {
      body = JSON.parse(rawBody)
    } catch {
      return jsonReply(400, { error: 'Request body must be valid JSON.' })
    }

    const messages = normalizeMessages(body)
    if (messages.length === 0) {
      return jsonReply(400, { error: 'Provide a non-empty "messages" array or a "text" field.' })
    }

    const system = []
    if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) {
      system.push({ text: body.systemPrompt.trim() })
    }

    // --- 1. Bedrock: generate the assistant reply text ---
    const converse = await bedrock.send(
      new ConverseCommand({
        modelId,
        system: system.length > 0 ? system : undefined,
        messages,
        inferenceConfig: {
          maxTokens: Number.isFinite(body.maxTokens) ? body.maxTokens : 512,
          temperature: Number.isFinite(body.temperature) ? body.temperature : 0.7,
        },
      }),
    )

    const replyText =
      converse.output?.message?.content
        ?.map((block) => block.text ?? '')
        .join('')
        .trim() ?? ''

    if (!replyText) {
      return jsonReply(502, { error: 'Model returned an empty reply.' })
    }

    // Text mode: scoring / assessment wants the reply as text, not speech.
    // Send "format": "text" to skip Polly and get JSON { "text", "stopReason" }.
    // (The patient chat flow omits format and gets audio, below.)
    if (typeof body.format === 'string' && body.format.toLowerCase() === 'text') {
      return jsonReply(200, {
        text: replyText,
        stopReason: converse.stopReason ?? 'end_turn',
      })
    }

    // --- 2. Polly: synthesize the reply to audio ---
    const voiceId = body.voiceId || defaultVoiceId
    const outputFormat = (body.outputFormat || defaultOutputFormat).toLowerCase()

    const speech = await polly.send(
      new SynthesizeSpeechCommand({
        Text: replyText,
        VoiceId: voiceId,
        OutputFormat: outputFormat,
        Engine: body.engine || defaultEngine,
      }),
    )

    const audio = await streamToBuffer(speech.AudioStream)

    // Return the audio. The reply text is echoed in a header for debugging/logging
    // (the game ignores it and just plays the audio).
    return {
      statusCode: 200,
      headers: {
        'Content-Type': audioContentType(outputFormat),
        'x-reply-stop-reason': converse.stopReason ?? 'end_turn',
      },
      isBase64Encoded: true,
      body: audio.toString('base64'),
    }
  } catch (error) {
    console.error(error)
    return jsonReply(502, {
      error: error instanceof Error ? error.message : 'Unknown Lambda error',
    })
  }
}
