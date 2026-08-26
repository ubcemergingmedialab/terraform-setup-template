const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
const WebSocket = require('ws');
const { PassThrough } = require('stream');
const http = require('http');

const PORT = process.env.PORT || 8080;
const HEALTH_PORT = 8081;
const AWS_REGION = process.env.AWS_REGION || 'ca-central-1';
const LANGUAGE_CODE = process.env.LANGUAGE_CODE || 'en-US';

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`[${new Date().toISOString()}] Transcribe proxy starting`);
console.log(`  WebSocket port: ${PORT}`);
console.log(`  Health check port: ${HEALTH_PORT}`);
console.log(`  AWS region: ${AWS_REGION}`);
console.log(`  Language: ${LANGUAGE_CODE}`);

let activeConnections = 0;

wss.on('connection', async (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const connectionId = Math.random().toString(36).substring(7);
    activeConnections++;
    
    console.log(`[${connectionId}] New client connected from ${clientIp} (active: ${activeConnections})`);
    
    let transcribeStream = null;
    let audioStream = null;
    let lastSampleRate = 48000;
    let transcribeClient = null;
    let isClosing = false;

    try {
        // Create AWS Transcribe client
        transcribeClient = new TranscribeStreamingClient({ 
            region: AWS_REGION 
        });

        // Audio stream that will feed Transcribe
        audioStream = new PassThrough();

        // Generator function to create async iterable for Transcribe
        async function* audioGenerator() {
            try {
                for await (const chunk of audioStream) {
                    if (isClosing) break;
                    yield { AudioEvent: { AudioChunk: chunk } };
                }
            } catch (error) {
                if (!isClosing) {
                    console.error(`[${connectionId}] Audio generator error:`, error.message);
                }
            }
        }

        // Handle incoming binary messages from Unreal
        ws.on('message', async (data) => {
            try {
                if (!Buffer.isBuffer(data) || data.length < 4) {
                    console.warn(`[${connectionId}] Received invalid message (not binary or too short)`);
                    return;
                }

                // Binary frame format: 4-byte little-endian sample rate + PCM data
                const sampleRate = data.readUInt32LE(0);
                const audioData = data.subarray(4);

                if (audioData.length === 0) {
                    console.warn(`[${connectionId}] Received empty audio chunk`);
                    return;
                }

                // If sample rate changed, restart Transcribe session
                if (sampleRate !== lastSampleRate) {
                    console.log(`[${connectionId}] Sample rate changed: ${lastSampleRate} → ${sampleRate} Hz`);
                    lastSampleRate = sampleRate;
                    
                    // End current stream
                    if (audioStream && !audioStream.destroyed) {
                        audioStream.end();
                    }
                    
                    // Wait a bit for cleanup
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Start new stream
                    audioStream = new PassThrough();
                    await startTranscribeSession(sampleRate);
                }

                // Send audio to Transcribe
                if (audioStream && !audioStream.destroyed && !isClosing) {
                    audioStream.write(audioData);
                }
            } catch (error) {
                console.error(`[${connectionId}] Error processing message:`, error.message);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ 
                        error: 'Processing error', 
                        message: error.message 
                    }));
                }
            }
        });

        async function startTranscribeSession(sampleRate) {
            if (isClosing) return;

            console.log(`[${connectionId}] Starting Transcribe session (${sampleRate} Hz, ${LANGUAGE_CODE})`);

            const command = new StartStreamTranscriptionCommand({
                LanguageCode: LANGUAGE_CODE,
                MediaSampleRateHertz: sampleRate,
                MediaEncoding: 'pcm',
                AudioStream: audioGenerator()
            });

            try {
                transcribeStream = transcribeClient.send(command);

                // Process transcription results
                transcribeStream.then(async (response) => {
                    try {
                        for await (const event of response.TranscriptResultStream) {
                            if (isClosing) break;

                            if (event.TranscriptEvent) {
                                const results = event.TranscriptEvent.Transcript?.Results || [];
                                
                                for (const result of results) {
                                    if (result.Alternatives && result.Alternatives.length > 0) {
                                        const transcript = result.Alternatives[0].Transcript;
                                        const isPartial = result.IsPartial;

                                        if (transcript && ws.readyState === WebSocket.OPEN) {
                                            // Send JSON response to Unreal
                                            ws.send(JSON.stringify({
                                                transcript: transcript,
                                                isPartial: isPartial
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        if (!isClosing) {
                            console.error(`[${connectionId}] Transcribe stream error:`, error.message);
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ 
                                    error: 'Transcribe stream error', 
                                    message: error.message 
                                }));
                            }
                        }
                    }
                }).catch((error) => {
                    if (!isClosing) {
                        console.error(`[${connectionId}] Transcribe error:`, error.message);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ 
                                error: 'Transcribe error', 
                                message: error.message 
                            }));
                        }
                    }
                });
            } catch (error) {
                console.error(`[${connectionId}] Failed to start Transcribe:`, error.message);
                throw error;
            }
        }

        // Start initial session
        await startTranscribeSession(lastSampleRate);

    } catch (error) {
        console.error(`[${connectionId}] Connection error:`, error.message);
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
                error: 'Connection error', 
                message: error.message 
            }));
            ws.close();
        }
    }

    ws.on('close', () => {
        isClosing = true;
        activeConnections--;
        console.log(`[${connectionId}] Client disconnected (active: ${activeConnections})`);
        
        // Cleanup
        if (audioStream && !audioStream.destroyed) {
            audioStream.end();
        }
    });

    ws.on('error', (error) => {
        isClosing = true;
        console.error(`[${connectionId}] WebSocket error:`, error.message);
        
        // Cleanup
        if (audioStream && !audioStream.destroyed) {
            audioStream.end();
        }
    });
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Health check endpoint for ALB target group
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'healthy',
            activeConnections: activeConnections,
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(HEALTH_PORT, () => {
    console.log(`Health check endpoint listening on port ${HEALTH_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    wss.close(() => {
        console.log('WebSocket server closed');
        healthServer.close(() => {
            console.log('Health server closed');
            process.exit(0);
        });
    });
    
    // Force exit after 30 seconds
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
});

console.log(`Server ready and listening`);
