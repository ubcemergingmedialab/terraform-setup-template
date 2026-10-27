output "name_prefix" {
  description = "Resource name prefix for this deployment."
  value       = local.name_prefix
}

output "site_url" {
  description = "Public HTTPS URL for the deployed Unity WebGL build."
  value       = module.site.site_url
}

output "site_bucket_name" {
  description = "S3 bucket for the build (aws s3 sync <build_dir>/ here)."
  value       = module.site.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation after deploy."
  value       = module.site.cloudfront_distribution_id
}

output "cloudfront_domain" {
  description = "CloudFront hostname (no https://)."
  value       = module.site.cloudfront_domain
}
