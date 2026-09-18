# Values the game needs for DefaultGame.ini [PoetryHouse.Bedrock].
# Read the sensitive ones with: terraform output -raw <name>

output "chat_function_url" {
  description = "IAM-authenticated Function URL the game POSTs to (SigV4-signed). -> EndpointUrl"
  value       = module.chat_backend.function_url
}

output "aws_region" {
  description = "Region used for SigV4 signing (service = lambda). -> Region"
  value       = var.aws_region
}

output "chat_invoker_access_key_id" {
  description = "Access key ID for the scoped invoke-only user. -> AccessKeyId"
  value       = module.chat_backend.invoker_access_key_id
  sensitive   = true
}

output "chat_invoker_secret_access_key" {
  description = "Secret access key for the scoped invoke-only user. -> SecretAccessKey"
  value       = module.chat_backend.invoker_secret_access_key
  sensitive   = true
}

output "chat_function_name" {
  description = "Lambda function name (for logs / console)."
  value       = module.chat_backend.function_name
}
