// PoetryHouse chat backend.
//
// Replaces the EC2 "moot-api" OpenAI chat proxy. Invoked via an IAM-authenticated
// Lambda Function URL (BUFFERED). The Unreal client SigV4-signs each request.
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
// Optional Bedrock Guardrail. When set, it's applied to both the input and the
// model output on every Converse call. Enforced server-side; invisible to the client.
const guardrailId = process.env.GUARDRAIL_ID
const guardrailVersion = process.env.GUARDRAIL_VERSION ?? 'DRAFT'
// When the Function URL uses NONE auth, the endpoint is public, so the handler
// enforces a shared secret sent in the x-chat-secret header. If unset, the check
// is skipped (only appropriate when the URL uses AWS_IAM auth instead).
const sharedSecret = process.env.CHAT_SHARED_SECRET

// Server-side request limits (set from Terraform). They bound what a client can ask
// for, so a leaked shared secret can't be used to run up large Bedrock bills.
function intFromEnv(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
const maxTokensCeiling = intFromEnv('MAX_TOKENS_CEILING', 1024)
const maxMessages = intFromEnv('MAX_MESSAGES', 50)
const maxInputChars = intFromEnv('MAX_INPUT_CHARS', 20000)

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

    // Enforce request-size limits before spending anything on Bedrock.
    if (messages.length > maxMessages) {
      return reply(413, { error: `Too many messages (max ${maxMessages}).` })
    }
    const totalChars =
      system.reduce((n, s) => n + s.text.length, 0) +
      messages.reduce((n, m) => n + m.content[0].text.length, 0)
    if (totalChars > maxInputChars) {
      return reply(413, { error: `Input too long (max ${maxInputChars} characters).` })
    }

    const response = await bedrock.send(
      new ConverseCommand({
        modelId,
        system: system.length > 0 ? system : undefined,
        messages,
        inferenceConfig: {
          // Client value is clamped to [1, ceiling]; the client can't raise the cap.
          maxTokens: Math.min(
            Math.max(Number.isFinite(body.maxTokens) ? Math.floor(body.maxTokens) : 512, 1),
            maxTokensCeiling,
          ),
          temperature: Number.isFinite(body.temperature) ? body.temperature : 0.7,
        },
        // Converse takes the guardrail via guardrailConfig (not top-level params).
        ...(guardrailId && {
          guardrailConfig: {
            guardrailIdentifier: guardrailId,
            guardrailVersion,
          },
        }),
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
