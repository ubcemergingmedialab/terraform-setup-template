import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  ApiError,
  execute,
  handleError,
  hashToken,
  methodOf,
  ok,
  parseBody,
  parseDateTime,
  pathParameter,
  records,
  requireEmail,
  requireInteger,
  requireNumber,
  requireString,
  requireUuid,
  transaction,
} from './shared.mjs'

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? 'ca-central-1' })

export async function handler(event) {
  try {
    const method = methodOf(event)
    const path = event.rawPath ?? event.requestContext?.http?.path ?? ''

    if (method === 'POST' && path.endsWith('/auth/login')) return await login(parseBody(event))
    if (method === 'POST' && path.endsWith('/auth/forgot-password')) return await forgotPassword(parseBody(event))
    if (method === 'POST' && path.endsWith('/auth/confirm-password')) return await confirmPassword(parseBody(event))
    if (method === 'GET' && pathParameter(event, 'linkToken')) return await loadScenario(pathParameter(event, 'linkToken'))
    if (method === 'POST' && path.endsWith('/attempts')) return await submitAttempt(parseBody(event))
    throw new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.')
  } catch (error) {
    return handleError(error)
  }
}

async function login(body) {
  const email = requireEmail(body.email)
  const password = requireString(body.password, 'password', { min: 8, max: 256 })
  try {
    const response = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))
    return ok({
      accessToken: response.AuthenticationResult?.AccessToken,
      idToken: response.AuthenticationResult?.IdToken,
      refreshToken: response.AuthenticationResult?.RefreshToken,
      expiresIn: response.AuthenticationResult?.ExpiresIn,
    })
  } catch (error) {
    if (['NotAuthorizedException', 'UserNotFoundException'].includes(error.name)) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
    }
    throw error
  }
}

async function forgotPassword(body) {
  const email = requireEmail(body.email)
  try {
    await cognito.send(new ForgotPasswordCommand({ ClientId: process.env.COGNITO_CLIENT_ID, Username: email }))
  } catch (error) {
    if (!['UserNotFoundException', 'InvalidParameterException'].includes(error.name)) throw error
  }
  return ok({ message: 'If an account with that email exists, a reset code has been sent.' })
}

async function confirmPassword(body) {
  const email = requireEmail(body.email)
  const confirmationCode = requireString(body.confirmationCode, 'confirmationCode', { min: 6, max: 6 })
  const newPassword = requireString(body.newPassword, 'newPassword', { min: 8, max: 256 })
  try {
    await cognito.send(new ConfirmForgotPasswordCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    }))
  } catch (error) {
    if (['CodeMismatchException', 'ExpiredCodeException', 'InvalidPasswordException'].includes(error.name)) {
      throw new ApiError(400, 'INVALID_CODE', 'The confirmation code is invalid or has expired.')
    }
    throw error
  }
  return ok({ message: 'Password has been reset successfully. Please log in with your new password.' })
}

async function loadScenario(token) {
  const result = records(await execute(`
    SELECT s.id, s.title, s.system_prompt, s.emotive_state
    FROM scenario_link sl JOIN scenario s ON s.id = sl.scenario_id
    WHERE sl.token_hash = :token_hash AND sl.revoked_at IS NULL
      AND (sl.expires_at IS NULL OR sl.expires_at >= now())
  `, [['token_hash', hashToken(token)]]))
  if (result.length === 0) {
    const link = records(await execute('SELECT revoked_at, expires_at FROM scenario_link WHERE token_hash = :token_hash', [['token_hash', hashToken(token)]]))
    if (link[0]?.revoked_at) throw new ApiError(403, 'LINK_REVOKED', 'This scenario link has been revoked.')
    if (link[0]?.expires_at) throw new ApiError(403, 'LINK_EXPIRED', 'This scenario link has expired.')
    throw new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.')
  }

  const scenario = result[0]
  const patient = records(await execute(`SELECT p.* FROM patient p JOIN scenario s ON s.patient_id = p.id WHERE s.id = :id`, [['id', scenario.id]]))[0]
  if (!patient) throw new ApiError(404, 'NOT_FOUND', 'The requested resource was not found.')
  const medicationTypes = records(await execute('SELECT id, scenario_id, name, qr_code FROM medication_type WHERE scenario_id = :id ORDER BY name', [['id', scenario.id]]))
  const medicationOrders = records(await execute('SELECT id, scenario_id, medication_type_id, dose, route, form, frequency, indication, ordered_at_days_offset, status, is_expected FROM medication_order WHERE scenario_id = :id ORDER BY id', [['id', scenario.id]]))
  const marRecords = records(await execute('SELECT id, scenario_id, medication_name, dose, route, time_offset_minutes, site, initials, notes FROM mar_record WHERE scenario_id = :id ORDER BY time_offset_minutes', [['id', scenario.id]]))

  return ok({
    id: scenario.id,
    title: scenario.title,
    systemPrompt: scenario.system_prompt,
    emotiveState: scenario.emotive_state,
    patient: {
      id: patient.id,
      qrCode: patient.qr_code,
      name: patient.name,
      dateOfBirth: patient.date_of_birth,
      gender: patient.gender,
      allergies: patient.allergies,
      relevantHistory: patient.relevant_history,
      currentIssue: patient.current_issue,
      extraDetails: patient.extra_details,
    },
    medicationTypes: medicationTypes.map((item) => ({ id: item.id, scenarioId: item.scenario_id, name: item.name, qrCode: item.qr_code })),
    medicationOrders: medicationOrders.map((item) => ({
      id: item.id, scenarioId: item.scenario_id, medicationTypeId: item.medication_type_id,
      dose: item.dose, route: item.route, form: item.form, frequency: item.frequency,
      indication: item.indication, orderedAtDaysOffset: item.ordered_at_days_offset,
      status: item.status, isExpected: item.is_expected,
    })),
    marRecords: marRecords.map((item) => ({
      id: item.id, scenarioId: item.scenario_id, medicationName: item.medication_name,
      dose: item.dose, route: item.route, timeOffsetMinutes: item.time_offset_minutes,
      site: item.site, initials: item.initials, notes: item.notes,
    })),
  })
}

async function submitAttempt(body) {
  const id = requireUuid(body.id, 'id')
  const scenarioLinkId = requireUuid(body.scenarioLinkId, 'scenarioLinkId')
  const score = requireNumber(body.score, 'score', 0, 100)
  const timeSpentSeconds = requireInteger(body.timeSpentSeconds, 'timeSpentSeconds', 0)
  const submittedAt = parseDateTime(body.submittedAt, 'submittedAt')

  const result = await transaction(async (transactionId) => {
    const link = records(await execute(`SELECT id FROM scenario_link WHERE id = :id AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at >= now())`, [['id', scenarioLinkId]], transactionId))[0]
    if (!link) throw new ApiError(403, 'LINK_REVOKED', 'Cannot submit an attempt against a revoked or expired scenario link.')
    const inserted = records(await execute('INSERT INTO attempt (id, scenario_link_id, score, time_spent_seconds, submitted_at) VALUES (:id, :link_id, :score, :time_spent, :submitted_at) ON CONFLICT (id) DO NOTHING RETURNING id, scenario_link_id, score, time_spent_seconds, submitted_at', [
      ['id', id], ['link_id', scenarioLinkId], ['score', score], ['time_spent', timeSpentSeconds], ['submitted_at', submittedAt],
    ], transactionId))[0]
    if (!inserted) {
      const existing = records(await execute('SELECT id, scenario_link_id, score, time_spent_seconds, submitted_at FROM attempt WHERE id = :id', [['id', id]], transactionId))[0]
      return { attempt: existing, created: false }
    }
    await execute('UPDATE scenario_link SET completion_count = completion_count + 1 WHERE id = :id', [['id', scenarioLinkId]], transactionId)
    return { attempt: inserted, created: true }
  })
  return ok(formatAttempt(result.attempt), result.created ? 201 : 200)
}

function formatAttempt(item) {
  return { id: item.id, scenarioLinkId: item.scenario_link_id, score: Number(item.score), timeSpentSeconds: item.time_spent_seconds, submittedAt: item.submitted_at }
}