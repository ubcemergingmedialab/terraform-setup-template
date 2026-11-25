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
    const engine = body.engine || undefined  

    
    const audioResp = await polly.send(new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voiceId,
      OutputFormat: outputFormat,
      Engine: engine,
    }))
    const audioBuffer = await streamToBuffer(audioResp.AudioStream)

    // Added Viseme timing sheet
    const marksResp = await polly.send(new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: voiceId,
      OutputFormat: 'json',
      SpeechMarkTypes: ['viseme'],
      Engine: engine,
    }))
    const marksText = (await streamToBuffer(marksResp.AudioStream)).toString('utf8')
    const visemes = parseVisemeMarks(marksText)

    const contentType = outputFormat === 'mp3' ? 'audio/mpeg' : outputFormat === 'ogg_vorbis' ? 'audio/ogg' : 'audio/wav'

    // Returned a JSON
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: audioBuffer.toString('base64'),
        contentType,
        visemes,
      }),
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

function parseVisemeMarks(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((mark) => mark.type === 'viseme')
    .map((mark) => ({ time: mark.time, value: mark.value }))
}