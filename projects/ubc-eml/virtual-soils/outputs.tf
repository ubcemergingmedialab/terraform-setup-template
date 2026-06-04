output "name_prefix" {
  description = "Resource name prefix for this deployment."
  value       = local.name_prefix
}

output "api_endpoint" {
  description = "Base URL for VITE_PUBLIC_API_URL and VITE_ADMIN_API_URL (no trailing slash)."
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
  description = "S3 bucket for splat/assets and DB backups (if enabled)."
  value       = var.enable_assets_bucket ? module.assets[0].bucket_name : null
}

output "assets_cdn_url" {
  description = "CloudFront base URL for splats — use in DynamoDB File/Thumbnail (e.g. {url}/splats/name.ksplat)."
  value       = var.enable_assets_bucket && var.enable_assets_cdn ? module.assets[0].cdn_url : null
}

output "assets_cloudfront_distribution_id" {
  description = "Assets CloudFront distribution ID (invalidation after bulk metadata changes)."
  value       = var.enable_assets_bucket && var.enable_assets_cdn ? module.assets[0].cloudfront_distribution_id : null
}

output "assets_cloudfront_domain" {
  description = "Assets CloudFront hostname (no https://)."
  value       = var.enable_assets_bucket && var.enable_assets_cdn ? module.assets[0].cloudfront_domain : null
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

# --- Admin static site ---

output "admin_site_url" {
  description = "Public HTTPS URL for the admin app. Use in Cognito callback/logout URLs."
  value       = var.enable_admin_site ? module.admin_site[0].site_url : null
}

output "admin_site_bucket_name" {
  description = "S3 bucket for admin deploy (aws s3 sync apps/admin/dist)."
  value       = var.enable_admin_site ? module.admin_site[0].bucket_name : null
}

output "admin_cloudfront_distribution_id" {
  description = "Admin CloudFront distribution ID for cache invalidation."
  value       = var.enable_admin_site ? module.admin_site[0].cloudfront_distribution_id : null
}

output "admin_cloudfront_domain" {
  description = "Admin CloudFront hostname (no https://)."
  value       = var.enable_admin_site ? module.admin_site[0].cloudfront_domain : null
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
