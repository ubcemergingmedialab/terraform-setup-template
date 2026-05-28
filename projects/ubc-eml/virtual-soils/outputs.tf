output "name_prefix" {
  description = "Resource name prefix for this deployment."
  value       = local.name_prefix
}

output "api_endpoint" {
  description = "Base URL for VITE_API_URL (no trailing slash)."
  value       = trimsuffix(module.api.api_endpoint, "/")
}

output "dynamodb_table_name" {
  description = "Fields table name."
  value       = module.fields_table.table_name
}

output "cognito_user_pool_id" {
  description = "VITE_COGNITO_USER_POOL_ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "VITE_COGNITO_CLIENT_ID"
  value       = module.cognito.user_pool_client_id
}

output "cognito_hosted_ui_domain" {
  description = "VITE_COGNITO_OAUTH_DOMAIN (hostname only)"
  value       = module.cognito.hosted_ui_domain
}

output "assets_bucket_name" {
  description = "S3 bucket for splat/assets (if enabled)."
  value       = var.enable_assets_bucket ? module.assets[0].bucket_name : null
}

output "lambda_log_group" {
  description = "CloudWatch log group for the API Lambda."
  value       = module.api.log_group_name
}

output "iam_api_invoker_access_key_id" {
  description = "Legacy SigV4 key for GET /pins (sensitive)."
  value       = var.create_iam_api_invoker ? module.api_invoker[0].access_key_id : null
  sensitive   = true
}

output "iam_api_invoker_secret_access_key" {
  description = "Store in HCP only — do not commit."
  value       = var.create_iam_api_invoker ? module.api_invoker[0].secret_access_key : null
  sensitive   = true
}
