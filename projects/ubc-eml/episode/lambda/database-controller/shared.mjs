import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  RDSDataClient,
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RollbackTransactionCommand,
} from '@aws-sdk/client-rds-data'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const dataApi = new RDSDataClient({ region })

export const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

export const ok = (body, statusCode = 200) => json(statusCode, body)

export function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {}
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.')
  }
}

export function pathParameter(event, name) {
  return event.pathParameters?.[name] ?? ''
}

export function requireString(value, field, { min = 1, max = 10000 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `"${field}" is invalid.`)
  }
  return value.trim()
}

export function requireUuid(value, field) {
  const uuid = requireString(value, field)
  const matchesUuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
  if (!matchesUuidShape) {
    throw new ApiError(400, 'VALIDATION_ERROR', `"${field}" must be a UUID.`)
  }
  return uuid
}

export function requireNumber(value, field, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `"${field}" is invalid.`)
  }
  return value
}

export function requireInteger(value, field, min = Number.MIN_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < min) {
    throw new ApiError(400, 'VALIDATION_ERROR', `"${field}" must be an integer.`)
  }
  return value
}

export function requireEmail(value) {
  const email = requireString(value, 'email', { max: 256 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '"email" must be a valid email address.')
  }
  return email.toLowerCase()
}

export function parseDateTime(value, field) {
  const date = new Date(requireString(value, field))
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'VALIDATION_ERROR', `"${field}" is invalid.`)
  return date.toISOString()
}

export function hashToken(token) {
  return createHash('sha256').update(requireString(token, 'linkToken')).digest('hex')
}

export function createLinkToken() {
  return randomBytes(32).toString('hex')
}

export function getClaims(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {}
  if (!claims.sub) throw new ApiError(401, 'UNAUTHORIZED', 'Missing or invalid authorization token.')
  return claims
}

export function requireInstructorRole(claims) {
  const rawGroups = claims['cognito:groups']
  let groups = []
  if (Array.isArray(rawGroups)) {
    groups = rawGroups
  } else if (typeof rawGroups === 'string') {
    const normalizedGroups = rawGroups.trim().replace(/^\[|\]$/g, '')
    groups = normalizedGroups.split(/[\s,]+/).map((group) => group.replace(/^['"]|['"]$/g, '')).filter(Boolean)
  }
  const isAdmin = groups.includes('admin')
  const isInstructor = isAdmin || groups.includes('instructor')
  if (!isInstructor) throw new ApiError(403, 'FORBIDDEN', 'Instructor access is required.')
  return { isAdmin }
}

export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export function handleError(error) {
  if (error instanceof ApiError) return json(error.statusCode, { code: error.code, message: error.message })
  console.error('API request failed', { name: error?.name, message: error?.message })
  return json(500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' })
}

function parameter(name, value) {
  if (value === null || value === undefined) return { name, value: { isNull: true } }
  if (typeof value === 'boolean') return { name, value: { booleanValue: value } }
  if (typeof value === 'number') return { name, value: Number.isInteger(value) ? { longValue: value } : { doubleValue: value } }
  if (typeof value === 'object') return { name, value: { stringValue: JSON.stringify(value) }, typeHint: 'JSON' }
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return { name, value: { stringValue: value }, typeHint: 'UUID' }
  }
  return { name, value: { stringValue: String(value) } }
}

export async function execute(sql, parameters = [], transactionId) {
  const command = new ExecuteStatementCommand({
    resourceArn: process.env.DATABASE_CLUSTER_ARN,
    secretArn: process.env.DATABASE_SECRET_ARN,
    database: process.env.DATABASE_NAME,
    sql,
    parameters: parameters.map(([name, value]) => parameter(name, value)),
    transactionId,
    includeResultMetadata: true,
  })
  return dataApi.send(command)
}

export function records(response) {
  const columns = response.columnMetadata?.map((column) => column.name) ?? []
  return (response.records ?? []).map((record) => Object.fromEntries(record.map((field, index) => [columns[index], decodeField(field)])))
}

function decodeField(field) {
  if ('isNull' in field) return null
  if ('longValue' in field) return field.longValue
  if ('doubleValue' in field) return field.doubleValue
  if ('booleanValue' in field) return field.booleanValue
  if ('blobValue' in field) return Buffer.from(field.blobValue).toString('base64')
  return field.stringValue
}

export async function transaction(work) {
  const started = await dataApi.send(new BeginTransactionCommand({
    resourceArn: process.env.DATABASE_CLUSTER_ARN,
    secretArn: process.env.DATABASE_SECRET_ARN,
    database: process.env.DATABASE_NAME,
  }))
  const transactionId = started.transactionId
  try {
    const result = await work(transactionId)
    await dataApi.send(new CommitTransactionCommand({
      resourceArn: process.env.DATABASE_CLUSTER_ARN,
      secretArn: process.env.DATABASE_SECRET_ARN,
      transactionId,
    }))
    return result
  } catch (error) {
    await dataApi.send(new RollbackTransactionCommand({
      resourceArn: process.env.DATABASE_CLUSTER_ARN,
      secretArn: process.env.DATABASE_SECRET_ARN,
      transactionId,
    })).catch(() => {})
    throw error
  }
}

export function uuid() {
  return randomUUID()
}

export function methodOf(event) {
  return event.requestContext?.http?.method ?? event.httpMethod ?? ''
}