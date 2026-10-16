# Values the game needs for DefaultGame.ini [NursePractitioner.Bedrock].
# Read the sensitive ones with: terraform output -raw <name>

output "polly_function_url" {
  description = "Public Function URL the game POSTs to for TTS. Send the shared secret in the x-tts-secret header. -> TtsEndpointUrl"
  value       = aws_lambda_function_url.polly.function_url
}

output "aws_region" {
  description = "Region the backend runs in."
  value       = var.aws_region
}

output "tts_shared_secret" {
  description = "Shared secret the game sends in the x-tts-secret header. -> TtsSharedSecret"
  value       = var.tts_shared_secret
  sensitive   = true
}

output "polly_function_name" {
  description = "Lambda function name (for logs / console)."
  value       = aws_lambda_function.polly.function_name
}
