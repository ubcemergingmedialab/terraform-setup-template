# Values the Unity client needs. Read sensitive ones with:
#   terraform output -raw <name>

output "aws_region" {
  description = "Region the backends run in."
  value       = var.aws_region
}

# --- Chat (Bedrock) ---
output "chat_function_url" {
  description = "POST { messages, systemPrompt } here. Send the shared secret in the x-chat-secret header."
  value       = module.chat_backend.function_url
}

# --- TTS (Polly) ---
output "tts_function_url" {
  description = "POST { text, voiceId? } here. Returns { audioBase64, contentType }. Send the shared secret in the x-chat-secret header."
  value       = module.tts_backend.function_url
}

# --- Transcribe (record-then-transcribe) ---
output "transcribe_function_url" {
  description = "POST { audioBase64, mediaFormat } here. Returns { text }. Send the shared secret in the x-chat-secret header."
  value       = module.transcribe_backend.function_url
}

output "transcribe_scratch_bucket" {
  description = "S3 scratch bucket used internally for audio + transcript (not called directly by the client)."
  value       = module.transcribe_backend.scratch_bucket
}

# --- Shared secret ---
output "chat_shared_secret" {
  description = "Shared secret the Unity client sends in the x-chat-secret header on all three endpoints."
  value       = var.chat_shared_secret
  sensitive   = true
}
