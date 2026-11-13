// MootCourt token service (Node Lambda behind API Gateway HTTP API v2).
//
// Ports livekit-agent/token_server.py and adds the single-live-session lock:
//
//   GET  /token          (Cognito JWT required)
//        -> acquires the one-session lock, then mints a LiveKit join token.
//           Returns 409 if a session is already live.
//   POST /simli-token     (Cognito JWT required)
//        -> proxies Simli /compose/token using the server-held SIMLI_API_KEY,
//           returning only { session_token } (the key never reaches the browser).
//   POST /livekit-webhook (public, signature-verified)
//        -> LiveKit calls this on room/participant lifecycle events; releases the
//           lock when the room empties/finishes so the next user can start.
//
// Secrets (LiveKit key/secret, Simli key) are read from Secrets Manager at cold
// start via the Lambda execution role. No secret is ever in env plaintext.

import { randomUUID } from 'node:crypto'
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? ''
const LIVEKIT_SECRET_ARN = process.env.LIVEKIT_SECRET_ARN
const SIMLI_SECRET_ARN = process.env.SIMLI_SECRET_ARN
const SESSION_LOCK_TABLE = process.env.SESSION_LOCK_TABLE
const MOOT_ROOM_NAME = process.env.MOOT_ROOM_NAME ?? 'mootcourt'
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? '900')

const SIMLI_COMPOSE_TOKEN_URL = 'https://api.simli.ai/compose/token'
const SIMLI_REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_MAX_SESSION_LENGTH = 600
const DEFAULT_MAX_IDLE_TIME = 180

const secretsClient = new SecretsManagerClient({ region })
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }))

// Cached across warm invocations.
let _livekitCreds // { LIVEKIT_API_KEY, LIVEKIT_API_SECRET }
let _simliKey

async function getSecretString(arn) {
  const out = await secretsClient.send(new GetSecretValueCommand({ SecretId: arn }))
  return out.SecretString ?? ''
}

async function getLivekitCreds() {
  if (!_livekitCreds) {
    _livekitCreds = JSON.parse(await getSecretString(LIVEKIT_SECRET_ARN))
  }
  return _livekitCreds
}

async function getSimliKey() {
  if (_simliKey === undefined) {
    _simliKey = await getSecretString(SIMLI_SECRET_ARN)
  }
  return _simliKey
}

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(payload),
  }
}

// ---------------------------------------------------------------------------
// Single-session lock. One item keyed by room name, written conditionally so a
// second concurrent request cannot also acquire it. TTL is a safety net; the
// LiveKit webhook releases the lock promptly when the room empties.
// ---------------------------------------------------------------------------
async function acquireLock(room, identity) {
  const now = Math.floor(Date.now() / 1000)
  try {
    await ddb.send(
      new PutCommand({
        TableName: SESSION_LOCK_TABLE,
        Item: {
          room,
          identity,
          acquiredAt: now,
          expiresAt: now + SESSION_TTL_SECONDS,
        },
        // Acquire only if no live lock exists: either no item, or an item whose
        // TTL already passed (DynamoDB TTL deletion is best-effort/delayed, so we
        // check expiresAt explicitly rather than trust the sweep).
        ConditionExpression: 'attribute_not_exists(room) OR expiresAt < :now',
        ExpressionAttributeValues: { ':now': now },
      }),
    )
    return true
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return false
    throw err
  }
}

async function releaseLock(room) {
  await ddb.send(new DeleteCommand({ TableName: SESSION_LOCK_TABLE, Key: { room } }))
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function handleToken(event) {
  if (!LIVEKIT_URL) {
    return json(500, { detail: 'LIVEKIT_URL not configured' })
  }

  const qs = event.queryStringParameters ?? {}
  const room = qs.room || MOOT_ROOM_NAME
  const identity = qs.identity || `counsel-${randomUUID().slice(0, 8)}`

  // Enforce exactly one live session before minting a join token.
  const acquired = await acquireLock(room, identity)
  if (!acquired) {
    return json(409, {
      detail: 'A MootCourt session is already in progress. Only one live session is allowed at a time.',
    })
  }

  try {
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = await getLivekitCreds()
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: identity })
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true, // publish the mic
      canSubscribe: true, // hear the judge's TTS track
    })
    const token = await at.toJwt()
    return json(200, { token, url: LIVEKIT_URL, room, identity })
  } catch (err) {
    // Minting failed after we took the lock -> release it so the app isn't stuck.
    await releaseLock(room).catch(() => {})
    console.error('token mint failed:', err)
    return json(502, { detail: 'Failed to mint LiveKit token' })
  }
}

async function handleSimliToken(event) {
  const simliKey = await getSimliKey()
  if (!simliKey) {
    return json(500, { detail: 'SIMLI_API_KEY not configured' })
  }

  let body
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body
    body = JSON.parse(raw ?? '{}')
  } catch {
    return json(400, { detail: 'Request body must be valid JSON' })
  }

  if (!body.faceId || typeof body.faceId !== 'string') {
    return json(400, { detail: 'faceId is required' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SIMLI_REQUEST_TIMEOUT_MS)
  let resp
  try {
    resp = await fetch(SIMLI_COMPOSE_TOKEN_URL, {
      method: 'POST',
      // Simli's current API requires the x-simli-api-key header. The raw PCM16 /
      // 16 kHz / mono seam means apiVersion + audioInputFormat must be pinned, or
      // Simli misreads the bytes and lip-sync sticks (matches token_server.py).
      headers: { 'Content-Type': 'application/json', 'x-simli-api-key': simliKey },
      body: JSON.stringify({
        faceId: body.faceId,
        apiVersion: 'v2',
        audioInputFormat: 'pcm16',
        handleSilence: false, // we drive audio ourselves
        maxSessionLength: body.maxSessionLength || DEFAULT_MAX_SESSION_LENGTH,
        maxIdleTime: body.maxIdleTime || DEFAULT_MAX_IDLE_TIME,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    console.error('Simli /compose/token request failed to send:', err)
    return json(502, { detail: 'Upstream Simli token request failed' })
  } finally {
    clearTimeout(timer)
  }

  if (!resp.ok) {
    // Log status + body server-side only (the key is in the request header, never
    // the response body, so this does not leak it). Browser gets a generic 502.
    const text = await resp.text().catch(() => '')
    console.error(`Simli /compose/token returned ${resp.status} for faceId=${body.faceId}: ${text.slice(0, 500)}`)
    return json(502, { detail: 'Upstream Simli token request failed' })
  }

  let sessionToken
  try {
    const data = await resp.json()
    sessionToken = data.session_token
  } catch (err) {
    console.error('Simli returned 2xx but no session_token:', err)
    return json(502, { detail: 'Upstream Simli token request failed' })
  }
  if (!sessionToken) {
    return json(502, { detail: 'Upstream Simli token request failed' })
  }

  return json(200, { session_token: sessionToken }) // only the token
}

// LiveKit posts lifecycle events here. On room_finished (or the last participant
// leaving the moot room) we release the single-session lock. Signature is verified
// with the LiveKit API key/secret so the endpoint can stay public (no JWT).
async function handleWebhook(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : (event.body ?? '')
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? ''

  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = await getLivekitCreds()
  const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

  let webhookEvent
  try {
    webhookEvent = await receiver.receive(raw, authHeader)
  } catch (err) {
    console.error('webhook verification failed:', err)
    return json(401, { detail: 'Invalid webhook signature' })
  }

  const roomName = webhookEvent?.room?.name

  // room_finished is the authoritative end-of-session signal: LiveKit emits it
  // when the room closes (explicit close, or the last participant left and the
  // empty-timeout elapsed). Release the single-session lock then. We deliberately
  // do NOT release on participant_left — the student could briefly drop and
  // reconnect, and the agent counts as a participant, so releasing early could
  // hand the one slot away mid-session. The lock's TTL is the backstop if a
  // room_finished is ever missed.
  if (webhookEvent.event === 'room_finished' && roomName === MOOT_ROOM_NAME) {
    await releaseLock(MOOT_ROOM_NAME).catch((e) => console.error('releaseLock failed:', e))
    console.log(`lock released on room_finished for room ${roomName}`)
  }

  return json(200, { received: true })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const handler = async (event) => {
  const method = event.requestContext?.http?.method
  const path = event.requestContext?.http?.path ?? event.rawPath ?? ''

  if (method === 'OPTIONS') return json(200, {})

  try {
    if (method === 'GET' && path.endsWith('/token')) return await handleToken(event)
    if (method === 'POST' && path.endsWith('/simli-token')) return await handleSimliToken(event)
    if (method === 'POST' && path.endsWith('/livekit-webhook')) return await handleWebhook(event)
    return json(404, { detail: 'Not found' })
  } catch (err) {
    console.error('unhandled error:', err)
    return json(500, { detail: 'Internal error' })
  }
}
