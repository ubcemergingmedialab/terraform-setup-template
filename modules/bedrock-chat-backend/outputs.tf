output "function_name" {
  description = "Chat backend Lambda function name."
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Chat backend Lambda function ARN."
  value       = aws_lambda_function.this.arn
}

output "function_url" {
  description = "Function URL the client POSTs to. With auth_type=NONE, send the shared secret in the x-chat-secret header; with AWS_IAM, SigV4-sign."
  value       = aws_lambda_function_url.this.function_url
}

output "lambda_role_arn" {
  description = "Execution role ARN (attach extra policies here if needed)."
  value       = aws_iam_role.lambda.arn
}

output "log_group_name" {
  description = "CloudWatch log group for the Lambda."
  value       = aws_cloudwatch_log_group.lambda.name
}

output "guardrail_id" {
  description = "Bedrock Guardrail ID (empty if enable_guardrail = false)."
  value       = var.enable_guardrail ? aws_bedrock_guardrail.this[0].guardrail_id : ""
}

output "guardrail_version" {
  description = "Published Bedrock Guardrail version (empty if enable_guardrail = false)."
  value       = var.enable_guardrail ? aws_bedrock_guardrail_version.this[0].version : ""
}

output "invoker_access_key_id" {
  description = "Access key ID for the scoped invoke-only user (empty if create_invoker_user = false)."
  value       = var.create_invoker_user ? aws_iam_access_key.invoker[0].id : ""
  sensitive   = true
}

output "invoker_secret_access_key" {
  description = "Secret access key for the scoped invoke-only user (empty if create_invoker_user = false)."
  value       = var.create_invoker_user ? aws_iam_access_key.invoker[0].secret : ""
  sensitive   = true
}
