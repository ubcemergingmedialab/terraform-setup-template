# TODO: declare outputs (site_url, api_endpoint, etc.) for the modules this project uses.
# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "knowledgebase_source_bucket" {
  value = aws_s3_bucket.knowledgebase_source.bucket
}

output "s3_vector_bucket_name" {
  value = aws_s3vectors_vector_bucket.knowledge_base.vector_bucket_name
}

output "s3_vector_index_arn" {
  value = aws_s3vectors_index.knowledge_base_default.index_arn
}

output "bedrock_knowledge_base_id" {
  value = aws_bedrockagent_knowledge_base.episode.id
}

output "bedrock_data_source_id" {
  value = aws_bedrockagent_data_source.episode_s3.data_source_id
}

output "bedrock_guardrail_id" {
  value = aws_bedrock_guardrail.episode.guardrail_id
}

output "bedrock_guardrail_version" {
  value = "DRAFT"
}

output "chat_backend_lambda_url" {
  value = aws_lambda_function_url.chat_backend.function_url
}

output "polly_lambda_url" {
  value = aws_lambda_function_url.polly.function_url
}

output "cognito_identity_pool_id" {
  value = aws_cognito_identity_pool.transcribe.id
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID for admin authentication."
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client ID for the admin app."
  value       = module.cognito.user_pool_client_id
}

output "cognito_hosted_ui_domain" {
  description = "Cognito hosted UI domain for the admin app."
  value       = module.cognito.hosted_ui_domain
}

output "database_cluster_identifier" {
  description = "Aurora cluster identifier."
  value       = var.enable_episode_database ? module.episode_database[0].cluster_identifier : null
}

output "database_vpc_id" {
  description = "Terraform-managed private database VPC ID."
  value       = var.enable_episode_database ? module.episode_network[0].vpc_id : null
}

output "database_private_subnet_ids" {
  description = "Terraform-managed private database subnet IDs keyed by Availability Zone."
  value       = var.enable_episode_database ? module.episode_network[0].private_subnet_ids : null
}

output "database_secret_arn" {
  description = "Secrets Manager ARN used by the RDS Data API."
  value       = var.enable_episode_database ? module.episode_database[0].secret_arn : null
}

output "episode_api_endpoint" {
  description = "Consolidated EPISODE API Gateway endpoint."
  value       = var.enable_episode_database ? trimsuffix(module.episode_api[0].api_endpoint, "/") : null
}

output "episode_api_function_names" {
  description = "Consolidated API Lambda function names keyed by public/authenticated handler."
  value       = var.enable_episode_database ? module.episode_api[0].function_names : null
}

output "episode_api_function_arns" {
  description = "Consolidated API Lambda ARNs keyed by public/authenticated handler."
  value       = var.enable_episode_database ? module.episode_api[0].function_arns : null
}

output "episode_api_log_groups" {
  description = "Consolidated API Lambda log groups keyed by public/authenticated handler."
  value       = var.enable_episode_database ? module.episode_api[0].log_group_names : null
}

output "episode_api_execution_role_arns" {
  description = "Consolidated API Lambda execution roles keyed by public/authenticated handler."
  value       = var.enable_episode_database ? module.episode_api[0].execution_role_arns : null
}

# --- Viewer static site (legacy output names kept for CI/scripts) ---

output "viewer_site_url" {
  description = "Public HTTPS URL for the viewer app."
  value       = var.enable_viewer_site ? module.viewer_site[0].site_url : null
}

output "viewer_site_bucket_name" {
  description = "S3 bucket for viewer deploy (aws s3 sync apps/viewer/dist)."
  value       = var.enable_viewer_site ? module.viewer_site[0].bucket_name : null
}

output "viewer_cloudfront_distribution_id" {
  description = "Viewer CloudFront distribution ID for cache invalidation."
  value       = var.enable_viewer_site ? module.viewer_site[0].cloudfront_distribution_id : null
}

output "viewer_cloudfront_domain" {
  description = "Viewer CloudFront hostname (no https://)."
  value       = var.enable_viewer_site ? module.viewer_site[0].cloudfront_domain : null
}

output "site_url" {
  description = "Alias for viewer_site_url (backward compatible)."
  value       = var.enable_viewer_site ? module.viewer_site[0].site_url : null
}

output "site_bucket_name" {
  description = "Alias for viewer_site_bucket_name (backward compatible)."
  value       = var.enable_viewer_site ? module.viewer_site[0].bucket_name : null
}

output "cloudfront_distribution_id" {
  description = "Alias for viewer_cloudfront_distribution_id (backward compatible)."
  value       = var.enable_viewer_site ? module.viewer_site[0].cloudfront_distribution_id : null
}

output "cloudfront_domain" {
  description = "Alias for viewer_cloudfront_domain (backward compatible)."
  value       = var.enable_viewer_site ? module.viewer_site[0].cloudfront_domain : null
}
