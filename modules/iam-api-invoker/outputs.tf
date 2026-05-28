output "user_name" {
  description = "IAM user name."
  value       = aws_iam_user.this.name
}

output "access_key_id" {
  description = "Access key ID for SigV4 signing (prefer not to use in browser)."
  value       = aws_iam_access_key.this.id
  sensitive   = true
}

output "secret_access_key" {
  description = "Secret access key — store in HCP sensitive variables only."
  value       = aws_iam_access_key.this.secret
  sensitive   = true
}
