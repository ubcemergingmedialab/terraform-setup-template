# Values the game needs for DefaultGame.ini [PoetryHouse.Bedrock].
# Read the sensitive ones with: terraform output -raw <name>

output "chat_function_url" {
  description = "Public Function URL the game POSTs to. Send the shared secret in the x-chat-secret header. -> EndpointUrl"
  value       = module.chat_backend.function_url
}

output "aws_region" {
  description = "Region the backend runs in."
  value       = var.aws_region
}

output "chat_shared_secret" {
  description = "Shared secret the game sends in the x-chat-secret header. -> SharedSecret"
  value       = var.chat_shared_secret
  sensitive   = true
}

output "chat_function_name" {
  description = "Lambda function name (for logs / console)."
  value       = module.chat_backend.function_name
}

output "guardrail_id" {
  description = "Bedrock Guardrail ID (empty if enable_guardrail = false)."
  value       = module.chat_backend.guardrail_id
}

output "guardrail_version" {
  description = "Published Bedrock Guardrail version (empty if enable_guardrail = false)."
  value       = module.chat_backend.guardrail_version
}
