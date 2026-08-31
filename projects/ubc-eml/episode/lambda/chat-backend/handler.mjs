//plz remember to config CORS and set invoke mode to RESPONSE_STREAM before deploying!

import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'

const region = process.env.AWS_REGION ?? 'ca-central-1'

const bedrock = new BedrockRuntimeClient({ region })
const bedrockAgent = new BedrockAgentRuntimeClient({ region })

const corsHeaders = {
  'Content-Type': 'application/x-ndjson',
}

function writeEvent(stream, event) {
  stream.write(`${JSON.stringify(event)}\n`)
}

function formatChunksForPrompt(results = []) {
  if (results.length === 0) return ''

  const chunks = results
    .map((result, index) => {
      const text = result.content?.text ?? ''
      const source =
        result.location?.s3Location?.uri ??
        result.location?.webLocation?.url ??
        'unknown source'

      return `[Chunk ${index + 1}, source: ${source}]\n${text}`
    })
    .join('\n\n')

  return `
<reference_material>
Use these excerpts as background knowledge only when relevant.
Stay in character and follow the system prompt.

${chunks}
</reference_material>
`.trim()
}

async function retrieveKnowledgeBaseContext(userText) {
  const knowledgeBaseId = process.env.BEDROCK_KB_ID

  if (!knowledgeBaseId) return ''

  const response = await bedrockAgent.send(
    new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: {
        text: userText,
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 5,
        },
      },
    }),
  )

  return formatChunksForPrompt(response.retrievalResults ?? [])
}

async function streamBedrock({ messages, systemPrompt, knowledgeContext }, responseStream) {
  const system = []

  if (systemPrompt?.trim()) {
    system.push({ text: systemPrompt.trim() })
  }

  if (knowledgeContext?.trim()) {
    system.push({ text: knowledgeContext.trim() })
  }

  const response = await bedrock.send(
    new ConverseStreamCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      system,
      messages: messages.map((message) => ({
        role: message.role,
        content: [{ text: message.text }],
      })),
      guardrailConfig:
        process.env.BEDROCK_GUARDRAIL_ID && process.env.BEDROCK_GUARDRAIL_VERSION
          ? {
              guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
              guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION,
            }
          : undefined,
    }),
  )

  let blocked = false

  for await (const event of response.stream) {
    if (event.contentBlockDelta?.delta?.text) {
      writeEvent(responseStream, {
        type: 'chunk',
        text: event.contentBlockDelta.delta.text,
      })
    }

    if (event.messageStop?.stopReason === 'guardrail_intervened') {
      blocked = true
    }
  }

  writeEvent(responseStream, {
    type: 'done',
    blocked,
  })
}

export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: corsHeaders,
  })

  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      stream.end()
      return
    }

    const body = JSON.parse(event.body ?? '{}')
    const messages = body.messages ?? []
    const systemPrompt = body.systemPrompt ?? ''
    const useKnowledgeBase = body.useKnowledgeBase ?? false

    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')

    if (!latestUserMessage?.text) {
      writeEvent(stream, {
        type: 'error',
        error: 'Missing user message.',
      })
      stream.end()
      return
    }

    const knowledgeContext = useKnowledgeBase
      ? await retrieveKnowledgeBaseContext(latestUserMessage.text)
      : ''

    await streamBedrock(
      {
        messages,
        systemPrompt,
        knowledgeContext,
      },
      stream,
    )
  } catch (error) {
    console.error(error)

    writeEvent(stream, {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown Lambda error',
    })
  } finally {
    stream.end()
  }
})