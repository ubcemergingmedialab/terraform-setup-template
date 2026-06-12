const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly')

const REGION = process.env.AWS_REGION || 'ca-central-1'
const polly = new PollyClient({ region: REGION })

exports.handler = async (event) => {
  try {
    const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {}
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
    const audioStream = resp.AudioStream

    const buffer = await streamToBuffer(audioStream)

    const contentType = outputFormat === 'mp3' ? 'audio/mpeg' : outputFormat === 'ogg_vorbis' ? 'audio/ogg' : 'audio/wav'

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
