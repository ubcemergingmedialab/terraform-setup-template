// NursePractitioner chat backend.
//
// Replaces the EC2 "MOOT-API" OpenAI websocket proxy for the chat / agent path.
// Invoked via a public Lambda Function URL (BUFFERED, NONE auth). The Unreal
// client (VaRest HTTP POST) authenticates with a shared secret in the
// x-chat-secret header; this handler validates it (timing-safe).
//
// Request body (application/json):
//   {
//     "systemPrompt": "optional system/role prompt",
//     "messages": [ { "role": "user" | "assistant", "text": "..." }, ... ],
//     // convenience: a single-turn call may send "text" instead of "messages"
//     "text": "user message",
//     "maxTokens": 512,      // optional
//     "temperature": 0.7     // optional
//   }
//
// Response body (application/json):
//   { "text": "the assistant reply", "stopReason": "end_turn" }
// On error:
//   { "error": "message" }   (with a non-200 status code)

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import crypto from 'node:crypto'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const modelId = process.env.BEDROCK_MODEL_ID
// When the Function URL uses NONE auth, the endpoint is public, so the handler
// enforces a shared secret sent in the x-chat-secret header. If unset, the check
// is skipped (only appropriate when the URL uses AWS_IAM auth instead).
const sharedSecret = process.env.CHAT_SHARED_SECRET

const bedrock = new BedrockRuntimeClient({ region })

const jsonHeaders = { 'Content-Type': 'application/json' }

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }
}

// Accept either a full messages[] array or a single "text" field.
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
  // Avoid leaking length/content via early-exit comparison.
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export const handler = async (event) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return reply(200, {})
    }

    if (!modelId) {
      return reply(500, { error: 'BEDROCK_MODEL_ID is not configured.' })
    }

    // Shared-secret gate for NONE-auth Function URLs. Headers are lower-cased by the
    // Function URL. Skip the check only if no secret is configured.
    if (sharedSecret) {
      const provided = event.headers?.['x-chat-secret'] ?? event.headers?.['X-Chat-Secret']
      if (!timingSafeEqual(provided ?? '', sharedSecret)) {
        return reply(403, { error: 'Forbidden: missing or invalid chat secret.' })
      }
    }

    // Function URL delivers the body as a (possibly base64-encoded) string.
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

    const messages = normalizeMessages(body)
    if (messages.length === 0) {
      return reply(400, { error: 'Provide a non-empty "messages" array or a "text" field.' })
    }

    const system = []
    if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) {
      system.push({ text: body.systemPrompt.trim() })
    }

    const response = await bedrock.send(
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

    const text =
      response.output?.message?.content
        ?.map((block) => block.text ?? '')
        .join('')
        .trim() ?? ''

    return reply(200, {
      text,
      stopReason: response.stopReason ?? 'end_turn',
    })
  } catch (error) {
    console.error(error)
    return reply(502, {
      error: error instanceof Error ? error.message : 'Unknown Lambda error',
    })
  }
}
