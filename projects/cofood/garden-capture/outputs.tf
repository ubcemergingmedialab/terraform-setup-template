output "name_prefix" {
  description = "Resource name prefix for this deployment."
  value       = local.name_prefix
}

output "api_endpoint" {
  description = "Base URL for VITE_PUBLIC_API_URL and VITE_ADMIN_API_URL (no trailing slash)."
  value       = trimsuffix(module.api.api_endpoint, "/")
}

output "dynamodb_table_name" {
  description = "Garden single-table name (captures + hotspots)."
  value       = module.garden_table.table_name
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
  description = "S3 bucket for splats, media, and DB backups (if enabled)."
  value       = var.enable_assets_bucket ? module.assets[0].bucket_name : null
}

output "assets_cdn_url" {
  description = "CloudFront base URL for assets — use in DynamoDB splatUrl / media urls (e.g. {url}/captures/…)."
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

# --- Viewer static site ---

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
