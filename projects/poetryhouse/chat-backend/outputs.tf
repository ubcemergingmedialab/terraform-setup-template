# ------------------------------------------------------------------------------
# Outputs
#
# The three values the game needs to ship: the Function URL, the region, and the
# scoped IAM user's access key. The secret is sensitive — read it with:
#   terraform output -raw chat_invoker_secret_access_key
# ------------------------------------------------------------------------------

output "chat_backend_lambda_url" {
  description = "IAM-authenticated Function URL the game POSTs to (SigV4-signed)."
  value       = aws_lambda_function_url.chat_backend.function_url
}

output "aws_region" {
  description = "Region used for SigV4 signing (service = lambda)."
  value       = var.aws_region
}

output "chat_invoker_access_key_id" {
  description = "Access key ID for the scoped invoke-only IAM user. Ships with the game."
  value       = aws_iam_access_key.chat_invoker.id
}

output "chat_invoker_secret_access_key" {
  description = "Secret access key for the scoped invoke-only IAM user. Ships with the game. Handle carefully."
  value       = aws_iam_access_key.chat_invoker.secret
  sensitive   = true
}
