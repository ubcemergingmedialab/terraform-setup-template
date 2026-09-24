// NursePractitioner text-to-speech backend.
//
// Replaces the audio/voice leg of the EC2 "MOOT-API" proxy (old DXL [TTS]/[CSS]).
// Invoked via a public Lambda Function URL (BUFFERED, NONE auth). The Unreal
// client (VaRest HTTP POST) authenticates with a shared secret in the
// x-tts-secret header; this handler validates it (timing-safe).
//
// Request body (application/json):
//   {
//     "text": "words to speak",       // required
//     "voiceId": "Tiffany",           // optional, defaults to env VOICE_ID
//     "outputFormat": "mp3",          // optional, defaults to env OUTPUT_FORMAT
//     "engine": "neural"              // optional Polly engine
//   }
//
// Response: audio bytes, base64-encoded, with the matching audio/* content type.
// On error: { "error": "..." } with a non-200 status.

const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly')
const crypto = require('node:crypto')

const REGION = process.env.AWS_REGION || 'ca-central-1'
const SHARED_SECRET = process.env.TTS_SHARED_SECRET
const polly = new PollyClient({ region: REGION })

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

exports.handler = async (event) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{}' }
    }

    // Shared-secret gate for the NONE-auth Function URL. Function URL lower-cases headers.
    if (SHARED_SECRET) {
      const provided = event.headers?.['x-tts-secret'] ?? event.headers?.['X-Tts-Secret']
      if (!timingSafeEqual(provided ?? '', SHARED_SECRET)) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Forbidden: missing or invalid tts secret.' }),
        }
      }
    }

    let rawBody = event.body ?? '{}'
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf-8')
    }

    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    const text = (body.text || '').trim()

    if (!text) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing text' }),
      }
    }

    const voiceId = body.voiceId || process.env.VOICE_ID || 'Tiffany'
    const outputFormat = (body.outputFormat || process.env.OUTPUT_FORMAT || 'mp3').toLowerCase()

    const cmd = new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voiceId,
      OutputFormat: outputFormat,
      Engine: body.engine || undefined,
    })

    const resp = await polly.send(cmd)
    const buffer = await streamToBuffer(resp.AudioStream)

    const contentType =
      outputFormat === 'mp3' ? 'audio/mpeg' : outputFormat === 'ogg_vorbis' ? 'audio/ogg' : 'audio/wav'

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType },
      isBase64Encoded: true,
      body: buffer.toString('base64'),
    }
  } catch (err) {
    console.error('Polly handler error', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0)
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
