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
