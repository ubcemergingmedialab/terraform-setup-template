# Values the game needs for DefaultGame.ini [NursePractitioner.Bedrock].
# Read the sensitive ones with: terraform output -raw <name>

output "chat_function_url" {
  description = "Public Function URL the game POSTs to. Send the shared secret in the x-chat-secret header. Returns base64-encoded audio (mp3) of the spoken reply. -> ChatEndpointUrl"
  value       = aws_lambda_function_url.chat_backend.function_url
}

output "aws_region" {
  description = "Region the backend runs in."
  value       = var.aws_region
}

output "chat_shared_secret" {
  description = "Shared secret the game sends in the x-chat-secret header. -> ChatSharedSecret"
  value       = var.chat_shared_secret
  sensitive   = true
}

output "chat_function_name" {
  description = "Lambda function name (for logs / console)."
  value       = aws_lambda_function.chat_backend.function_name
}
