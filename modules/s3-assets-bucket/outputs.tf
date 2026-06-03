output "bucket_name" {
  description = "S3 bucket name."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name for the bucket."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}

output "cloudfront_distribution_id" {
  description = "Assets CloudFront distribution ID (invalidation after metadata changes). Null when enable_cdn is false."
  value       = var.enable_cdn ? aws_cloudfront_distribution.this[0].id : null
}

output "cloudfront_domain" {
  description = "Assets CloudFront hostname (no https://). Use in DynamoDB File URLs: https://{this}/splats/...."
  value       = var.enable_cdn ? aws_cloudfront_distribution.this[0].domain_name : null
}

output "cloudfront_arn" {
  description = "Assets CloudFront distribution ARN."
  value       = var.enable_cdn ? aws_cloudfront_distribution.this[0].arn : null
}

output "cdn_url" {
  description = "Base HTTPS URL for splat/assets via CloudFront (no trailing slash)."
  value       = var.enable_cdn ? "https://${aws_cloudfront_distribution.this[0].domain_name}" : null
}
