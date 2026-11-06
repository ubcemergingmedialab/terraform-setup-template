// Speech-to-text backend (record-then-transcribe): Lambda -> S3 + Amazon Transcribe batch.
//
// Invoked via a public Lambda Function URL (NONE auth, BUFFERED). The handler
// enforces a shared secret sent in the x-chat-secret header. The Unity client
// records a clip, base64-encodes it, POSTs it, and gets back the transcript text.
// Synchronous: one request in, { text } out. No streaming, no proxy.
//
// Flow: write audio to the scratch bucket -> StartTranscriptionJob -> poll
// GetTranscriptionJob until done -> fetch transcript JSON from S3 -> return text ->
// best-effort cleanup (the bucket lifecycle rule is the backstop).
//
// Request body (application/json):
//   {
//     "audioBase64": "....",     // required: base64-encoded audio
//     "mediaFormat": "wav",       // optional: wav | flac | mp3 | ogg | amr | webm
//     "languageCode": "en-US"     // optional, defaults to TRANSCRIBE_LANGUAGE_CODE
//   }
//
// Response body (application/json):
//   { "text": "the transcribed speech", "jobName": "..." }
// On error:
//   { "error": "message" }   (with a non-2xx status code)

import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  DeleteTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'

const region = process.env.AWS_REGION ?? 'ca-central-1'
const scratchBucket = process.env.SCRATCH_BUCKET
const defaultLanguageCode = process.env.TRANSCRIBE_LANGUAGE_CODE ?? 'en-US'
const pollIntervalMs = Number(process.env.TRANSCRIBE_POLL_INTERVAL_MS ?? '1500')
const sharedSecret = process.env.CHAT_SHARED_SECRET

const transcribe = new TranscribeClient({ region })
const s3 = new S3Client({ region })

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamToString(stream) {
  if (typeof stream.transformToString === 'function') {
    return stream.transformToString()
  }
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export const handler = async (event) => {
  // Keys are tracked so we can clean them up in finally regardless of outcome.
  let audioKey
  let transcriptKey
  let jobName

  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return reply(200, {})
    }

    if (!scratchBucket) {
      return reply(500, { error: 'SCRATCH_BUCKET is not configured.' })
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

    if (typeof body.audioBase64 !== 'string' || !body.audioBase64) {
      return reply(400, { error: 'Provide a base64-encoded "audioBase64" field.' })
    }

    const audioBytes = Buffer.from(body.audioBase64, 'base64')
    if (audioBytes.length === 0) {
      return reply(400, { error: '"audioBase64" decoded to zero bytes.' })
    }

    const mediaFormat = body.mediaFormat ?? 'wav'
    const languageCode = body.languageCode ?? defaultLanguageCode

    const id = crypto.randomUUID()
    jobName = `transcribe-${id}`
    audioKey = `audio/${id}.${mediaFormat}`
    transcriptKey = `transcripts/${id}.json`

    // 1. Upload the audio to S3 (Transcribe batch reads media from S3).
    await s3.send(
      new PutObjectCommand({
        Bucket: scratchBucket,
        Key: audioKey,
        Body: audioBytes,
      }),
    )

    // 2. Start the batch transcription job, writing output to our bucket.
    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: languageCode,
        MediaFormat: mediaFormat,
        Media: { MediaFileUri: `s3://${scratchBucket}/${audioKey}` },
        OutputBucketName: scratchBucket,
        OutputKey: transcriptKey,
      }),
    )

    // 3. Poll until the job completes. The Lambda timeout is the overall ceiling.
    let status = 'IN_PROGRESS'
    let failureReason
    while (status === 'IN_PROGRESS' || status === 'QUEUED') {
      await sleep(pollIntervalMs)
      const { TranscriptionJob } = await transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
      )
      status = TranscriptionJob?.TranscriptionJobStatus ?? 'FAILED'
      failureReason = TranscriptionJob?.FailureReason
    }

    if (status !== 'COMPLETED') {
      return reply(502, { error: `Transcription job did not complete: ${failureReason ?? status}` })
    }

    // 4. Read the transcript JSON written to S3 and extract the text.
    const transcriptObject = await s3.send(
      new GetObjectCommand({ Bucket: scratchBucket, Key: transcriptKey }),
    )
    const transcriptJson = JSON.parse(await streamToString(transcriptObject.Body))
    const text = transcriptJson.results?.transcripts?.map((t) => t.transcript).join(' ').trim() ?? ''

    return reply(200, { text, jobName })
  } catch (error) {
    console.error(error)
    return reply(502, {
      error: error instanceof Error ? error.message : 'Unknown Lambda error',
    })
  } finally {
    // Best-effort cleanup. The bucket lifecycle rule guarantees expiry regardless.
    const cleanup = []
    if (audioKey) {
      cleanup.push(s3.send(new DeleteObjectCommand({ Bucket: scratchBucket, Key: audioKey })))
    }
    if (transcriptKey) {
      cleanup.push(s3.send(new DeleteObjectCommand({ Bucket: scratchBucket, Key: transcriptKey })))
    }
    if (jobName) {
      cleanup.push(
        transcribe.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName })),
      )
    }
    await Promise.allSettled(cleanup)
  }
}
