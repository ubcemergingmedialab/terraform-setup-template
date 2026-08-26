output "ecr_repository_url" {
  value       = module.container_repo.repository_url
  description = "ECR repository URL for pushing container images."
}

output "websocket_url" {
  value       = module.transcribe_proxy.websocket_url
  description = "WebSocket URL for Unreal Engine to connect to (ws:// or wss://)."
}

output "alb_dns_name" {
  value       = module.transcribe_proxy.alb_dns_name
  description = "DNS name of the Application Load Balancer."
}

output "cluster_name" {
  value       = module.transcribe_proxy.cluster_name
  description = "ECS cluster name."
}

output "service_name" {
  value       = module.transcribe_proxy.service_name
  description = "ECS service name."
}

output "log_group_name" {
  value       = module.transcribe_proxy.log_group_name
  description = "CloudWatch log group name (for viewing container logs)."
}

output "task_role_arn" {
  value       = module.transcribe_proxy.task_role_arn
  description = "IAM role ARN for the ECS task (has Transcribe permissions)."
}
