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

const region = process.env.AWS_REGION ?? 'ca-central-1'
const modelId = process.env.BEDROCK_MODEL_ID

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

export const handler = async (event) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return reply(200, {})
    }

    if (!modelId) {
      return reply(500, { error: 'BEDROCK_MODEL_ID is not configured.' })
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
