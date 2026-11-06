// Text-to-speech backend: Lambda -> Amazon Polly (SynthesizeSpeech).
//
// Invoked via a public Lambda Function URL (NONE auth, BUFFERED). The handler
// enforces a shared secret sent in the x-chat-secret header. The Unity client
// POSTs text and gets back base64-encoded audio (binary-safe over the Function URL).
//
// Request body (application/json):
//   {
//     "text": "Hello there.",   // required
//     "voiceId": "Ruth",         // optional, defaults to POLLY_DEFAULT_VOICE_ID
//     "engine": "neural",        // optional: standard | neural | generative | long-form
//     "outputFormat": "mp3",     // optional: mp3 | ogg_vorbis | pcm
//     "textType": "text"         // optional: text | ssml
//   }
//
// Response body (application/json):
//   { "audioBase64": "....", "contentType": "audio/mpeg" }
// On error:
//   { "error": "message" }   (with a non-2xx status code)

import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import crypto from 'node:crypto'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const defaultVoiceId = process.env.POLLY_DEFAULT_VOICE_ID ?? 'Ruth'
const defaultEngine = process.env.POLLY_DEFAULT_ENGINE ?? 'neural'
const defaultOutputFormat = process.env.POLLY_DEFAULT_OUTPUT_FORMAT ?? 'mp3'
const sharedSecret = process.env.CHAT_SHARED_SECRET

const polly = new PollyClient({ region })

const CONTENT_TYPE_BY_FORMAT = {
  mp3: 'audio/mpeg',
  ogg_vorbis: 'audio/ogg',
  pcm: 'audio/pcm',
}

const jsonHeaders = { 'Content-Type': 'application/json' }

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Collect the Polly AudioStream (a web ReadableStream / Node stream) into a Buffer.
async function streamToBuffer(stream) {
  if (typeof stream.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray())
  }
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export const handler = async (event) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return reply(200, {})
    }

    if (sharedSecret) {
      const provided = event.headers?.['x-chat-secret'] ?? event.headers?.['X-Chat-Secret']
      if (!timingSafeEqual(provided ?? '', sharedSecret)) {
        return reply(403, { error: 'Forbidden: missing or invalid chat secret.' })
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
      return reply(400, { error: 'Request body must be valid JSON.' })
    }

    if (typeof body.text !== 'string' || !body.text.trim()) {
      return reply(400, { error: 'Provide a non-empty "text" field.' })
    }

    const outputFormat = body.outputFormat ?? defaultOutputFormat
    const contentType = CONTENT_TYPE_BY_FORMAT[outputFormat] ?? 'audio/mpeg'

    const response = await polly.send(
      new SynthesizeSpeechCommand({
        Text: body.text,
        TextType: body.textType === 'ssml' ? 'ssml' : 'text',
        VoiceId: body.voiceId ?? defaultVoiceId,
        Engine: body.engine ?? defaultEngine,
        OutputFormat: outputFormat,
      }),
    )

    if (!response.AudioStream) {
      return reply(502, { error: 'Polly returned no audio stream.' })
    }

    const audio = await streamToBuffer(response.AudioStream)

    return reply(200, {
      audioBase64: audio.toString('base64'),
      contentType,
    })
  } catch (error) {
    console.error(error)
    return reply(502, {
      error: error instanceof Error ? error.message : 'Unknown Lambda error',
    })
  }
}
