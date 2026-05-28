output "bucket_name" {
  description = "Private S3 bucket for site assets (deploy dist/ here)."
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name (CloudFront origin)."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}

output "cloudfront_distribution_id" {
  description = "Use for cache invalidation after deploy."
  value       = aws_cloudfront_distribution.this.id
}

output "cloudfront_domain" {
  description = "Public site hostname (no https://)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_arn" {
  description = "CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.this.arn
}

output "site_url" {
  description = "Full HTTPS URL for the deployed app."
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}
