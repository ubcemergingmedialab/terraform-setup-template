# Unity Voice Chat — AI backend (Bedrock + Polly + Transcribe)

One HCP workspace that provisions the three serverless backends a Unity chat box
with voice needs:

| Service | What it does | Module |
|---------|--------------|--------|
| **Bedrock** | Chat completion (text in → text reply) | `bedrock-chat-backend` |
| **Polly** | Text-to-speech (text → audio) | `polly-tts-backend` |
| **Transcribe** | Speech-to-text, **record-then-transcribe** (audio clip → text) | `transcribe-batch-backend` |

Each is a Lambda behind a **public Function URL** gated by a shared secret in the
`x-chat-secret` header. The Unity client reaches all three with a plain
`UnityWebRequest` POST — **no AWS SDK in Unity, no SigV4 signing, no proxy, no
WebSocket, no streaming**. This works identically in **WebGL and native** builds.

## Why this shape (and not a proxy)

Live/streaming Transcribe would force a long-running WebSocket proxy, because the
AWS SDK for .NET can't stream Transcribe and Unity WebGL has no raw sockets —
that's exactly why the Unreal projects in this repo (`poetryhouse/transcribe-proxy`)
run ALB + Fargate. Choosing **record-then-transcribe** removes that constraint:
batch Transcribe is a request → job → result flow a Lambda owns, so the whole
stack stays serverless in one workspace.

Trade-off: batch transcription is **not instant**. Short clips typically come back
in ~5–25s. Fine for "hold to talk, release, see your words"; not for live captions.

## Deploy

1. `Copy-Item terraform.auto.tfvars.example terraform.auto.tfvars` and edit
   `client_name`, `project_name`, `environment`, `aws_region`, and the model/voice/
   language settings.
2. In `versions.tf`, set `cloud.workspaces.name` to your HCP workspace name.
3. Set **`chat_shared_secret`** as a **Sensitive** variable in the HCP workspace.
   Do **not** put it in `terraform.auto.tfvars` (that file is committed).
4. (Optional, for local dev / CI) install the Lambda SDK deps so `archive_file`
   can resolve the source:
   ```powershell
   npm --prefix lambda/chat-backend install
   npm --prefix lambda/tts-backend install
   npm --prefix lambda/transcribe-backend install
   ```
   The handlers import only runtime-provided `@aws-sdk/*` clients, so `node_modules`
   is **not** shipped in the zip (see each module README).
5. Ensure the chosen Bedrock model is enabled in the account/region (Bedrock
   console → Model access). For cross-region Anthropic models use an
   inference-profile ID, e.g. `us.anthropic.claude-3-5-sonnet-20241022-v2:0`.
6. Commit, open a PR, let HCP plan/apply (or `terraform init && terraform apply`).

## IAM for the HCP runner

Build the runner policy from `docs/iam/hcp-terraform-policy.template.json`, keeping
the statement blocks for: Lambda, IAM (roles/users/policies), CloudWatch Logs, S3
(the Transcribe scratch bucket), Bedrock, Polly, and Transcribe.

## Outputs → Unity config

After apply:

```powershell
terraform output -raw aws_region
terraform output -raw chat_function_url
terraform output -raw tts_function_url
terraform output -raw transcribe_function_url
terraform output -raw chat_shared_secret   # sensitive
```

Drop these into the Unity client config. Every request carries the secret:
`request.SetRequestHeader("x-chat-secret", sharedSecret)`.

## Request / response contracts

**Chat** — POST to `chat_function_url`:
```json
{ "systemPrompt": "optional", "messages": [ { "role": "user", "text": "..." } ] }
```
→ `{ "text": "assistant reply", "stopReason": "end_turn" }`

**TTS** — POST to `tts_function_url`:
```json
{ "text": "Hello.", "voiceId": "Ruth", "engine": "neural", "outputFormat": "mp3" }
```
→ `{ "audioBase64": "....", "contentType": "audio/mpeg" }`
On the client: base64-decode `audioBase64`, then build an `AudioClip` (decode MP3
with a runtime importer, or request `pcm` output and feed `AudioClip.Create`).

**Transcribe** — POST to `transcribe_function_url`:
```json
{ "audioBase64": "....", "mediaFormat": "wav", "languageCode": "en-US" }
```
→ `{ "text": "the transcribed speech", "jobName": "..." }`
Set the Unity request timeout generously (≥ the Lambda's `transcribe_timeout_seconds`)
and show a spinner while the batch job runs.

## Unity client notes

- **Transport**: `UnityWebRequest.Post` with a JSON body and the `x-chat-secret`
  header. Works in WebGL (via the browser fetch) and native builds.
- **Mic capture (native)**: Unity's `Microphone` class → encode the clip to WAV →
  base64 → POST to the transcribe endpoint.
- **Mic capture (WebGL)**: Unity's `Microphone` is unreliable in WebGL. Use a
  `getUserMedia`-based `.jslib` plugin (e.g. a community mic plugin) to pull PCM
  frames into C#, encode to WAV, then POST the same way.
- No Cognito, no identity pool, no AWS credentials on the client — the shared
  secret is the only thing the build carries.

## Security

- The `x-chat-secret` value ships with the build. Treat the packaged client as
  sensitive. Rotate by changing `chat_shared_secret` in HCP and re-applying.
- Add Bedrock / Polly / Transcribe spend budgets or alarms so a leaked secret
  can't run up an unbounded bill.
- The Transcribe scratch bucket blocks all public access, encrypts at rest, and
  expires objects via lifecycle (`transcribe_object_expiration_days`, default 1 day).

---

## Unity client code snippets (examples)

> **⚠️ AI-generated — validate before use.** The C# snippets in this section were
> generated by an AI assistant as a starting point. They have **not** been compiled
> or run against a live deployment. Review them, compile them in your Unity version,
> and test against the deployed endpoints before relying on them. Treat them as a
> reference for the request/response contracts, not production-ready code.

These show how a Unity client connects to the **chat (Bedrock)**, **transcribe**,
and **TTS (Polly)** Function URLs. They use `UnityWebRequest` (works in WebGL and
native), send the `x-chat-secret` header on every call, and mirror the exact
request/response contracts documented above.

### Shared config

Fill these from `terraform output` (see "Outputs → Unity config").

```csharp
// VoiceChatConfig.cs
using UnityEngine;

[CreateAssetMenu(fileName = "VoiceChatConfig", menuName = "VoiceChat/Config")]
public class VoiceChatConfig : ScriptableObject
{
    [Header("From `terraform output`")]
    public string chatFunctionUrl;        // chat_function_url
    public string transcribeFunctionUrl;  // transcribe_function_url
    public string ttsFunctionUrl;         // tts_function_url

    [Header("Shared secret (ships with the build)")]
    public string sharedSecret;           // chat_shared_secret
}
```

### Chat (Bedrock)

Handler accepts `{ systemPrompt, messages[] }` and returns `{ text, stopReason }`.
`JsonUtility` can't serialize top-level `List<T>`, so requests are wrapped in
container classes.

```csharp
// ChatClient.cs
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class ChatClient : MonoBehaviour
{
    [SerializeField] private VoiceChatConfig config;

    [Serializable]
    public class ChatMessage
    {
        public string role; // "user" | "assistant"
        public string text;
    }

    [Serializable]
    private class ChatRequest
    {
        public string systemPrompt;
        public ChatMessage[] messages;
        public int maxTokens;
        public float temperature;
    }

    [Serializable]
    private class ChatResponse
    {
        public string text;
        public string stopReason;
        public string error; // present only on failure
    }

    // Keeps the running conversation so Bedrock has context turn to turn.
    private readonly List<ChatMessage> _history = new List<ChatMessage>();

    /// <summary>Send a user turn; onReply gets the assistant text (or onError).</summary>
    public void Send(string userText, string systemPrompt, Action<string> onReply, Action<string> onError)
    {
        _history.Add(new ChatMessage { role = "user", text = userText });
        StartCoroutine(SendRoutine(systemPrompt, onReply, onError));
    }

    private IEnumerator SendRoutine(string systemPrompt, Action<string> onReply, Action<string> onError)
    {
        var payload = new ChatRequest
        {
            systemPrompt = systemPrompt,
            messages = _history.ToArray(),
            maxTokens = 512,
            temperature = 0.7f,
        };

        byte[] body = Encoding.UTF8.GetBytes(JsonUtility.ToJson(payload));

        using var req = new UnityWebRequest(config.chatFunctionUrl, UnityWebRequest.kHttpVerbPOST);
        req.uploadHandler = new UploadHandlerRaw(body);
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("x-chat-secret", config.sharedSecret);
        req.timeout = 30; // the chat Lambda's timeout

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            onError?.Invoke($"HTTP {(int)req.responseCode}: {req.error} :: {req.downloadHandler.text}");
            yield break;
        }

        ChatResponse res;
        try { res = JsonUtility.FromJson<ChatResponse>(req.downloadHandler.text); }
        catch (Exception e) { onError?.Invoke($"Bad JSON: {e.Message}"); yield break; }

        if (!string.IsNullOrEmpty(res.error)) { onError?.Invoke(res.error); yield break; }

        _history.Add(new ChatMessage { role = "assistant", text = res.text });
        onReply?.Invoke(res.text);
    }
}
```

Usage:

```csharp
chatClient.Send(
    "What medications is the patient currently taking?",
    systemPrompt: "You are a patient in a clinical training sim. Answer in first person.",
    onReply: reply => Debug.Log($"Patient: {reply}"),
    onError: err  => Debug.LogError($"Chat failed: {err}"));
```

### WAV encoder (shared by transcribe)

```csharp
// WavEncoder.cs
using System.IO;
using UnityEngine;

public static class WavEncoder
{
    /// <summary>Encode an AudioClip to a 16-bit PCM WAV byte array.</summary>
    public static byte[] Encode(AudioClip clip)
    {
        var samples = new float[clip.samples * clip.channels];
        clip.GetData(samples, 0);

        short channels = (short)clip.channels;
        int sampleRate = clip.frequency;

        using var mem = new MemoryStream();
        using var w = new BinaryWriter(mem);

        int byteRate = sampleRate * channels * 2;
        int dataSize = samples.Length * 2;

        w.Write(Ascii("RIFF"));
        w.Write(36 + dataSize);
        w.Write(Ascii("WAVE"));
        w.Write(Ascii("fmt "));
        w.Write(16);                    // PCM chunk size
        w.Write((short)1);              // PCM format
        w.Write(channels);
        w.Write(sampleRate);
        w.Write(byteRate);
        w.Write((short)(channels * 2)); // block align
        w.Write((short)16);             // bits per sample
        w.Write(Ascii("data"));
        w.Write(dataSize);

        foreach (float s in samples)
            w.Write((short)(Mathf.Clamp(s, -1f, 1f) * short.MaxValue));

        w.Flush();
        return mem.ToArray();
    }

    private static byte[] Ascii(string s) => System.Text.Encoding.ASCII.GetBytes(s);
}
```

### Transcribe (record-then-transcribe)

Handler accepts `{ audioBase64, mediaFormat, languageCode }` and returns
`{ text, jobName }`. Capture on native builds uses `Microphone`; see the WebGL note.

```csharp
// TranscribeClient.cs
using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class TranscribeClient : MonoBehaviour
{
    [SerializeField] private VoiceChatConfig config;
    [SerializeField] private int sampleRate = 16000; // 16 kHz is plenty for speech
    [SerializeField] private int maxSeconds = 30;

    [Serializable]
    private class TranscribeRequest
    {
        public string audioBase64;
        public string mediaFormat;  // "wav"
        public string languageCode; // "en-US"
    }

    [Serializable]
    private class TranscribeResponse
    {
        public string text;
        public string jobName;
        public string error;
    }

    private AudioClip _recording;
    private string _micDevice;

    public void StartRecording()
    {
        if (Microphone.devices.Length == 0) { Debug.LogError("No microphone."); return; }
        _micDevice = Microphone.devices[0];
        _recording = Microphone.Start(_micDevice, loop: false, maxSeconds, sampleRate);
    }

    /// <summary>Stop recording and send for transcription.</summary>
    public void StopAndTranscribe(Action<string> onText, Action<string> onError)
    {
        if (_recording == null) { onError?.Invoke("Not recording."); return; }

        int position = Microphone.GetPosition(_micDevice);
        Microphone.End(_micDevice);

        AudioClip trimmed = _recording;
        if (position > 0 && position < _recording.samples)
        {
            var data = new float[position * _recording.channels];
            _recording.GetData(data, 0);
            trimmed = AudioClip.Create("trimmed", position, _recording.channels, sampleRate, false);
            trimmed.SetData(data, 0);
        }

        byte[] wav = WavEncoder.Encode(trimmed);
        StartCoroutine(TranscribeRoutine(wav, onText, onError));
    }

    private IEnumerator TranscribeRoutine(byte[] wavBytes, Action<string> onText, Action<string> onError)
    {
        var payload = new TranscribeRequest
        {
            audioBase64 = Convert.ToBase64String(wavBytes),
            mediaFormat = "wav",
            languageCode = "en-US",
        };

        byte[] body = Encoding.UTF8.GetBytes(JsonUtility.ToJson(payload));

        using var req = new UnityWebRequest(config.transcribeFunctionUrl, UnityWebRequest.kHttpVerbPOST);
        req.uploadHandler = new UploadHandlerRaw(body);
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("x-chat-secret", config.sharedSecret);
        // Batch Transcribe takes seconds; keep this above the Lambda's 120s ceiling.
        req.timeout = 130;

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            onError?.Invoke($"HTTP {(int)req.responseCode}: {req.error} :: {req.downloadHandler.text}");
            yield break;
        }

        TranscribeResponse res;
        try { res = JsonUtility.FromJson<TranscribeResponse>(req.downloadHandler.text); }
        catch (Exception e) { onError?.Invoke($"Bad JSON: {e.Message}"); yield break; }

        if (!string.IsNullOrEmpty(res.error)) { onError?.Invoke(res.error); yield break; }
        onText?.Invoke(res.text);
    }
}
```

### TTS (Polly)

Handler accepts `{ text, voiceId?, engine?, outputFormat? }` and returns
`{ audioBase64, contentType }`. Request **PCM** output so the client can build an
`AudioClip` with no third-party decoder. (MP3 — the default — needs a runtime MP3
decoder; PCM is the dependency-free path shown here.)

> Polly PCM is **16-bit signed, little-endian, mono, 16 kHz** (8 kHz for some
> engines). The decoder below assumes 16 kHz mono; adjust if you change the engine.

```csharp
// TtsClient.cs
using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class TtsClient : MonoBehaviour
{
    [SerializeField] private VoiceChatConfig config;
    [SerializeField] private int pcmSampleRate = 16000; // Polly PCM default
    [SerializeField] private AudioSource audioSource;

    [Serializable]
    private class TtsRequest
    {
        public string text;
        public string voiceId;
        public string engine;
        public string outputFormat; // "pcm" for the decoder below
    }

    [Serializable]
    private class TtsResponse
    {
        public string audioBase64;
        public string contentType;
        public string error;
    }

    /// <summary>Synthesize text and play it; onClip also returns the clip if you want it.</summary>
    public void Speak(string text, Action<AudioClip> onClip, Action<string> onError)
    {
        StartCoroutine(SpeakRoutine(text, onClip, onError));
    }

    private IEnumerator SpeakRoutine(string text, Action<AudioClip> onClip, Action<string> onError)
    {
        var payload = new TtsRequest
        {
            text = text,
            voiceId = "Ruth",
            engine = "neural",
            outputFormat = "pcm",
        };

        byte[] body = Encoding.UTF8.GetBytes(JsonUtility.ToJson(payload));

        using var req = new UnityWebRequest(config.ttsFunctionUrl, UnityWebRequest.kHttpVerbPOST);
        req.uploadHandler = new UploadHandlerRaw(body);
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.SetRequestHeader("x-chat-secret", config.sharedSecret);
        req.timeout = 30;

        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            onError?.Invoke($"HTTP {(int)req.responseCode}: {req.error} :: {req.downloadHandler.text}");
            yield break;
        }

        TtsResponse res;
        try { res = JsonUtility.FromJson<TtsResponse>(req.downloadHandler.text); }
        catch (Exception e) { onError?.Invoke($"Bad JSON: {e.Message}"); yield break; }

        if (!string.IsNullOrEmpty(res.error)) { onError?.Invoke(res.error); yield break; }

        byte[] pcm = Convert.FromBase64String(res.audioBase64);
        AudioClip clip = PcmToClip(pcm, pcmSampleRate, channels: 1);

        if (audioSource != null) { audioSource.clip = clip; audioSource.Play(); }
        onClip?.Invoke(clip);
    }

    /// <summary>Decode 16-bit signed little-endian PCM bytes into an AudioClip.</summary>
    private static AudioClip PcmToClip(byte[] pcm, int sampleRate, int channels)
    {
        int sampleCount = pcm.Length / 2; // 2 bytes per 16-bit sample
        var floats = new float[sampleCount];
        for (int i = 0; i < sampleCount; i++)
        {
            short sample = (short)(pcm[i * 2] | (pcm[i * 2 + 1] << 8));
            floats[i] = sample / 32768f;
        }

        AudioClip clip = AudioClip.Create("tts", sampleCount / channels, channels, sampleRate, false);
        clip.SetData(floats, 0);
        return clip;
    }
}
```

### Full voice loop (mic → transcribe → chat → speak)

```csharp
// push-to-talk: StartRecording() on key down, this block on key up
transcribeClient.StopAndTranscribe(
    onText: transcript =>
    {
        Debug.Log($"You said: {transcript}");
        chatClient.Send(transcript, systemPrompt,
            onReply: reply =>
            {
                Debug.Log($"Patient: {reply}");
                ttsClient.Speak(reply, onClip: _ => { }, onError: Debug.LogError);
            },
            onError: Debug.LogError);
    },
    onError: err => Debug.LogError($"Transcribe failed: {err}"));
```

### Important notes

- **AI-generated — validate.** See the warning at the top of this section. Nothing
  here has been compiled or run against a live deployment.
- **WebGL mic capture.** The `Microphone`-based capture works on desktop/mobile but
  is unreliable in WebGL (a known Unity limitation). For WebGL, replace only the
  *capture* half with a `getUserMedia`-based `.jslib` plugin that hands PCM frames
  to C#; feed those into `WavEncoder` and reuse `TranscribeRoutine` unchanged. The
  networking half is identical across targets.
- **`JsonUtility` limits.** It won't deserialize top-level arrays and ignores
  `null`-vs-missing distinctions; the container-class pattern above sidesteps that.
  `Newtonsoft.Json` (`com.unity.nuget.newtonsoft-json`) is a drop-in alternative.
- **Timeouts.** Chat and TTS use `timeout = 30` (matches the Lambdas). Transcribe
  uses `timeout = 130`, above the Lambda's 120s ceiling, so the client doesn't give
  up before the batch job returns — show a spinner during that wait.
- **TTS format trade-off.** The snippet requests **PCM** so playback needs no
  third-party decoder. If you prefer **MP3** (smaller payloads), add a runtime MP3
  decoder and change `outputFormat` to `"mp3"`.
- **Polly PCM assumptions.** The decoder assumes 16-bit signed LE, mono, 16 kHz.
  Confirm the sample rate for your chosen engine/voice and adjust `pcmSampleRate`.
- **Threading/perf.** `AudioClip.GetData` + WAV/PCM encode on a long clip can hitch
  the main thread. Fine for short clips; for longer audio move the encode to a
  `Task.Run` (native) before starting the coroutine.
- **Secret handling.** `sharedSecret` ships inside the build, so treat the packaged
  client as sensitive and rotate via the HCP variable if it leaks.
