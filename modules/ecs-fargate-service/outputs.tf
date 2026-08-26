output "cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "ECS cluster name."
}

output "cluster_arn" {
  value       = aws_ecs_cluster.this.arn
  description = "ECS cluster ARN."
}

output "service_name" {
  value       = aws_ecs_service.this.name
  description = "ECS service name."
}

output "service_arn" {
  value       = aws_ecs_service.this.id
  description = "ECS service ARN."
}

output "task_definition_arn" {
  value       = aws_ecs_task_definition.this.arn
  description = "Task definition ARN."
}

output "task_role_arn" {
  value       = aws_iam_role.task.arn
  description = "Task role ARN (for adding additional permissions)."
}

output "task_role_name" {
  value       = aws_iam_role.task.name
  description = "Task role name."
}

output "alb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "DNS name of the Application Load Balancer."
}

output "alb_zone_id" {
  value       = aws_lb.this.zone_id
  description = "Hosted zone ID of the ALB (for Route53 alias records)."
}

output "alb_arn" {
  value       = aws_lb.this.arn
  description = "ARN of the Application Load Balancer."
}

output "target_group_arn" {
  value       = aws_lb_target_group.this.arn
  description = "ARN of the target group."
}

output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "Security group ID of the ALB."
}

output "ecs_security_group_id" {
  value       = aws_security_group.ecs_tasks.id
  description = "Security group ID of the ECS tasks."
}

output "log_group_name" {
  value       = aws_cloudwatch_log_group.this.name
  description = "CloudWatch log group name."
}

output "websocket_url" {
  value       = var.enable_https ? "wss://${aws_lb.this.dns_name}" : "ws://${aws_lb.this.dns_name}"
  description = "WebSocket URL for connecting to the service."
}
