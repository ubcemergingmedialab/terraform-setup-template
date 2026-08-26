output "repository_url" {
  value       = aws_ecr_repository.this.repository_url
  description = "Full URL of the ECR repository (for docker push)."
}

output "repository_arn" {
  value       = aws_ecr_repository.this.arn
  description = "ARN of the ECR repository."
}

output "repository_name" {
  value       = aws_ecr_repository.this.name
  description = "Name of the ECR repository."
}

output "registry_id" {
  value       = aws_ecr_repository.this.registry_id
  description = "Registry ID where the repository was created."
}
