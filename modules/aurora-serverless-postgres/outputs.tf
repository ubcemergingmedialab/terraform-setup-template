output "cluster_arn" {
  description = "Aurora cluster ARN for the RDS Data API."
  value       = aws_rds_cluster.this.arn
}

output "cluster_identifier" {
  description = "Aurora cluster identifier."
  value       = aws_rds_cluster.this.cluster_identifier
}

output "secret_arn" {
  description = "Secrets Manager ARN containing the generated master credentials."
  value       = aws_rds_cluster.this.master_user_secret[0].secret_arn
}

output "secret_kms_key_arn" {
  description = "KMS key ARN encrypting the master credentials secret. Callers reading the secret need kms:Decrypt on this key."
  value       = aws_rds_cluster.this.master_user_secret[0].kms_key_id
}

output "database_name" {
  description = "Initial database name."
  value       = aws_rds_cluster.this.database_name
}

output "endpoint" {
  description = "Aurora writer endpoint."
  value       = aws_rds_cluster.this.endpoint
}

output "security_group_id" {
  description = "Aurora security group ID."
  value       = aws_security_group.this.id
}