import {
  ApiError,
  createLinkToken,
  execute,
  getClaims,
  handleError,
  hashToken,
  methodOf,
  ok,
  parseBody,
  parseDateTime,
  pathParameter,
  records,
  requireInteger,
  requireInstructorRole,
  requireString,
  requireUuid,
  transaction,
  uuid,
} from './shared.mjs'

export async function handler(event) {
  try {
    const claims = getClaims(event)
    const roles = requireInstructorRole(claims)
    const instructorId = await ensureInstructor(claims)
    const method = methodOf(event)
    const path = event.rawPath ?? event.requestContext?.http?.path ?? ''
    const id = pathParameter(event, 'id')

    if (method === 'GET' && path.endsWith('/instructor/scenarios')) return await listScenarios(instructorId)
    if (method === 'POST' && path.endsWith('/instructor/scenarios')) return await createScenario(instructorId, parseBody(event))
    if (method === 'PATCH' && id && path.includes('/instructor/scenarios/')) return await updateScenario(instructorId, id, parseBody(event))
    if (method === 'POST' && path.endsWith('/instructor/scenario-links')) return await createScenarioLink(instructorId, parseBody(event))
    if (method === 'POST' && id && path.endsWith('/revoke')) return await revokeLink(instructorId, id)
    if (method === 'GET' && id && path.endsWith('/analytics') && path.includes('/scenario-links/')) return await linkAnalytics(instructorId, id, roles.isAdmin)
    if (method === 'GET' && id && path.endsWith('/analytics') && path.includes('/scenarios/')) return await scenarioAnalytics(instructorId, id, roles.isAdmin)
    throw new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.')
  } catch (error) {
    return handleError(error)
  }
}

async function ensureInstructor(claims) {
  const id = requireUuid(claims.sub, 'subject')
  const email = claims.email ?? `${id}@cognito.invalid`
  const firstName = claims.given_name ?? ''
  const lastName = claims.family_name ?? ''
  await execute(`
    INSERT INTO instructor (id, first_name, last_name, email)
    VALUES (:id, :first_name, :last_name, :email)
    ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email
  `, [['id', id], ['first_name', firstName], ['last_name', lastName], ['email', email]])
  return id
}

async function listScenarios(instructorId) {
  const rows = records(await execute(`
    SELECT id, title, private, patient_id, created_at, updated_at
    FROM scenario WHERE created_by = :instructor_id ORDER BY updated_at DESC
  `, [['instructor_id', instructorId]]))
  return ok({ scenarios: rows.map(formatScenarioSummary) })
}

async function createScenario(instructorId, body) {
  const title = requireString(body.title, 'title', { max: 256 })
  const systemPrompt = requireString(body.systemPrompt, 'systemPrompt')
  const patientId = requireUuid(body.patientId, 'patientId')
  if (typeof body.private !== 'boolean') throw new ApiError(400, 'VALIDATION_ERROR', '"private" must be a boolean.')
  if (!Array.isArray(body.medicationOrders) || body.medicationOrders.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', '"medicationOrders" must contain at least one order.')
  }
  const scenarioId = uuid()
  const created = await transaction(async (transactionId) => {
    const patient = records(await execute('SELECT id FROM patient WHERE id = :id', [['id', patientId]], transactionId))[0]
    if (!patient) throw new ApiError(404, 'NOT_FOUND', 'Patient not found.')
    await execute(`INSERT INTO scenario (id, created_by, title, private, system_prompt, emotive_state, patient_id) VALUES (:id, :created_by, :title, :private, :system_prompt, :emotive_state, :patient_id)`, [
      ['id', scenarioId], ['created_by', instructorId], ['title', title], ['private', body.private], ['system_prompt', systemPrompt], ['emotive_state', body.emotiveState ?? null], ['patient_id', patientId],
    ], transactionId)
    for (const order of body.medicationOrders) {
      await insertMedicationOrder(transactionId, scenarioId, order)
    }
    for (const mar of body.marRecords ?? []) {
      await insertMarRecord(transactionId, scenarioId, mar)
    }
    return scenarioId
  })
  const row = records(await execute('SELECT id, created_by, title, private, system_prompt, emotive_state, patient_id, created_at, updated_at FROM scenario WHERE id = :id', [['id', created]]))[0]
  return ok(formatScenario(row), 201)
}

async function updateScenario(instructorId, rawId, body) {
  const id = requireUuid(rawId, 'id')
  const allowed = ['title', 'private', 'systemPrompt', 'emotiveState', 'patientId']
  if (!Object.keys(body).some((key) => allowed.includes(key))) throw new ApiError(400, 'VALIDATION_ERROR', 'At least one update field is required.')
  const owner = records(await execute('SELECT created_by FROM scenario WHERE id = :id', [['id', id]]))[0]
  if (!owner) throw new ApiError(404, 'NOT_FOUND', 'Scenario not found.')
  if (owner.created_by !== instructorId) throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource.')
  const values = [['id', id], ['instructor_id', instructorId]]
  const sets = []
  if ('title' in body) { sets.push('title = :title'); values.push(['title', requireString(body.title, 'title', { max: 256 })]) }
  if ('private' in body) { if (typeof body.private !== 'boolean') throw new ApiError(400, 'VALIDATION_ERROR', '"private" must be a boolean.'); sets.push('private = :private'); values.push(['private', body.private]) }
  if ('systemPrompt' in body) { sets.push('system_prompt = :system_prompt'); values.push(['system_prompt', requireString(body.systemPrompt, 'systemPrompt')]) }
  if ('emotiveState' in body) { sets.push('emotive_state = :emotive_state'); values.push(['emotive_state', body.emotiveState ?? null]) }
  if ('patientId' in body) { sets.push('patient_id = :patient_id'); values.push(['patient_id', requireUuid(body.patientId, 'patientId')]) }
  sets.push('updated_at = now()')
  await execute(`UPDATE scenario SET ${sets.join(', ')} WHERE id = :id AND created_by = :instructor_id`, values)
  return ok(formatScenario(records(await execute('SELECT id, created_by, title, private, system_prompt, emotive_state, patient_id, created_at, updated_at FROM scenario WHERE id = :id', [['id', id]]))[0]))
}

async function createScenarioLink(instructorId, body) {
  const scenarioId = requireUuid(body.scenarioId, 'scenarioId')
  const audienceName = requireString(body.audienceName, 'audienceName', { max: 256 })
  const scenario = records(await execute('SELECT id, created_by, private FROM scenario WHERE id = :id', [['id', scenarioId]]))[0]
  if (!scenario) throw new ApiError(404, 'NOT_FOUND', 'Scenario not found.')
  if (scenario.private && scenario.created_by !== instructorId) throw new ApiError(403, 'FORBIDDEN', 'Only the scenario author can create links for a private scenario.')
  const token = createLinkToken()
  const expiresAt = body.expiresAt === null || body.expiresAt === undefined ? null : parseDateTime(body.expiresAt, 'expiresAt')
  const id = uuid()
  const row = records(await execute(`
    INSERT INTO scenario_link (id, scenario_id, instructor_id, audience_name, token_hash, expires_at)
    VALUES (:id, :scenario_id, :instructor_id, :audience_name, :token_hash, :expires_at)
    RETURNING id, scenario_id, instructor_id, audience_name, created_at, expires_at, revoked_at, completion_count
  `, [['id', id], ['scenario_id', scenarioId], ['instructor_id', instructorId], ['audience_name', audienceName], ['token_hash', hashToken(token)], ['expires_at', expiresAt]]))[0]
  return ok({ ...formatLink(row), token, linkUrl: `${process.env.APP_BASE_URL}/s/${token}` }, 201)
}

async function revokeLink(instructorId, rawId) {
  const id = requireUuid(rawId, 'id')
  const row = records(await execute('SELECT id, scenario_id, instructor_id, audience_name, created_at, expires_at, revoked_at, completion_count FROM scenario_link WHERE id = :id', [['id', id]]))[0]
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Scenario link not found.')
  if (row.instructor_id !== instructorId) throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource.')
  if (row.revoked_at) throw new ApiError(400, 'ALREADY_REVOKED', 'This scenario link has already been revoked.')
  const revoked = records(await execute('UPDATE scenario_link SET revoked_at = now() WHERE id = :id RETURNING id, scenario_id, instructor_id, audience_name, created_at, expires_at, revoked_at, completion_count', [['id', id]]))[0]
  return ok(formatLink(revoked))
}

async function linkAnalytics(instructorId, rawId, isAdmin) {
  const id = requireUuid(rawId, 'id')
  const link = records(await execute('SELECT id, audience_name, instructor_id FROM scenario_link WHERE id = :id', [['id', id]]))[0]
  if (!link) throw new ApiError(404, 'NOT_FOUND', 'Scenario link not found.')
  if (link.instructor_id !== instructorId && !isAdmin) throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource.')
  const metrics = records(await execute('SELECT COUNT(*) AS attempt_count, AVG(score) AS avg_score, STDDEV(score) AS stddev_score, AVG(time_spent_seconds) AS avg_time_seconds FROM attempt WHERE scenario_link_id = :id', [['id', id]]))[0]
  return ok({ scenarioLinkId: id, audienceName: link.audience_name, ...formatAnalytics(metrics) })
}

async function scenarioAnalytics(instructorId, rawId, isAdmin) {
  const id = requireUuid(rawId, 'id')
  const scenario = records(await execute('SELECT id, created_by FROM scenario WHERE id = :id', [['id', id]]))[0]
  if (!scenario) throw new ApiError(404, 'NOT_FOUND', 'Scenario not found.')
  if (scenario.created_by !== instructorId && !isAdmin) throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to access this resource.')
  const rows = records(await execute(`
    SELECT sl.id AS scenario_link_id, sl.audience_name, COUNT(a.id) AS attempt_count,
      AVG(a.score) AS avg_score, STDDEV(a.score) AS stddev_score, AVG(a.time_spent_seconds) AS avg_time_seconds
    FROM scenario_link sl LEFT JOIN attempt a ON a.scenario_link_id = sl.id
    WHERE sl.scenario_id = :id GROUP BY sl.id, sl.audience_name ORDER BY sl.created_at
  `, [['id', id]]))
  const byLink = rows.map((row) => ({ scenarioLinkId: row.scenario_link_id, audienceName: row.audience_name, ...formatAnalytics(row) }))
  const overall = formatAnalytics(records(await execute(`SELECT COUNT(a.id) AS attempt_count, AVG(a.score) AS avg_score, STDDEV(a.score) AS stddev_score, AVG(a.time_spent_seconds) AS avg_time_seconds FROM scenario_link sl LEFT JOIN attempt a ON a.scenario_link_id = sl.id WHERE sl.scenario_id = :id`, [['id', id]]))[0])
  return ok({ scenarioId: id, overall, byLink })
}

async function insertMedicationOrder(transactionId, scenarioId, order) {
  await execute(`INSERT INTO medication_order (scenario_id, medication_type_id, dose, route, form, frequency, indication, ordered_at_days_offset, status, is_expected) VALUES (:scenario_id, :medication_type_id, :dose, :route, :form, :frequency, :indication, :offset, :status, :expected)`, [
    ['scenario_id', scenarioId], ['medication_type_id', requireUuid(order.medicationTypeId, 'medicationTypeId')], ['dose', requireString(order.dose, 'dose', { max: 256 })], ['route', requireString(order.route, 'route', { max: 100 })], ['form', requireString(order.form, 'form', { max: 100 })], ['frequency', requireString(order.frequency, 'frequency', { max: 100 })], ['indication', requireString(order.indication, 'indication')], ['offset', requireInteger(order.orderedAtDaysOffset, 'orderedAtDaysOffset')], ['status', requireString(order.status, 'status', { max: 20 })], ['expected', Boolean(order.isExpected)],
  ], transactionId)
}

async function insertMarRecord(transactionId, scenarioId, mar) {
  await execute(`INSERT INTO mar_record (scenario_id, medication_name, dose, route, time_offset_minutes, site, initials, notes) VALUES (:scenario_id, :medication_name, :dose, :route, :offset, :site, :initials, :notes)`, [
    ['scenario_id', scenarioId], ['medication_name', requireString(mar.medicationName, 'medicationName', { max: 256 })], ['dose', requireString(mar.dose, 'dose', { max: 256 })], ['route', requireString(mar.route, 'route', { max: 100 })], ['offset', requireInteger(mar.timeOffsetMinutes, 'timeOffsetMinutes')], ['site', requireString(mar.site, 'site', { max: 256 })], ['initials', requireString(mar.initials, 'initials', { max: 20 })], ['notes', mar.notes ?? null],
  ], transactionId)
}

function formatScenarioSummary(row) {
  return { id: row.id, title: row.title, private: row.private, patientId: row.patient_id, createdAt: row.created_at, updatedAt: row.updated_at }
}

function formatScenario(row) {
  return { id: row.id, createdBy: row.created_by, title: row.title, private: row.private, systemPrompt: row.system_prompt, emotiveState: row.emotive_state, patientId: row.patient_id, createdAt: row.created_at, updatedAt: row.updated_at }
}

function formatLink(row) {
  return { id: row.id, scenarioId: row.scenario_id, instructorId: row.instructor_id, audienceName: row.audience_name, createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at, completionCount: Number(row.completion_count) }
}

function formatAnalytics(row) {
  const count = Number(row?.attempt_count ?? 0)
  return { attemptCount: count, avgScore: row?.avg_score == null ? null : Number(row.avg_score), stddevScore: count < 2 || row?.stddev_score == null ? null : Number(row.stddev_score), avgTimeSeconds: count === 0 || row?.avg_time_seconds == null ? null : Number(row.avg_time_seconds) }
}