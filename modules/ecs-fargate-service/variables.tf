variable "name_prefix" {
  type        = string
  description = "Name prefix for all resources (use client_name-project_name-environment pattern)."
}

variable "container_image" {
  type        = string
  description = "Full container image URL (e.g., from ECR module output)."
}

variable "container_port" {
  type        = number
  description = "Port the container listens on."
  default     = 8080
}

variable "health_check_port" {
  type        = number
  description = "Port for health checks. Set to null to use container_port."
  default     = null
}

variable "health_check_path" {
  type        = string
  description = "Health check path."
  default     = "/health"
}

variable "cpu" {
  type        = number
  description = "Fargate CPU units (256, 512, 1024, 2048, 4096)."
  default     = 512
}

variable "memory_mb" {
  type        = number
  description = "Fargate memory in MB (512, 1024, 2048, ...)."
  default     = 1024
}

variable "desired_count" {
  type        = number
  description = "Number of tasks to run."
  default     = 1
}

variable "environment_variables" {
  type        = map(string)
  description = "Environment variables passed to the container."
  default     = {}
}

variable "task_policy_json" {
  type        = string
  description = "IAM policy JSON for task role (application permissions). Leave empty for no custom permissions."
  default     = ""
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where resources will be created."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs for the Application Load Balancer."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for ECS tasks."
}

variable "alb_ingress_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks allowed to access the ALB."
  default     = ["0.0.0.0/0"]
}

variable "alb_internal" {
  type        = bool
  description = "Make the ALB internal (not internet-facing)."
  default     = false
}

variable "alb_deletion_protection" {
  type        = bool
  description = "Enable deletion protection on the ALB."
  default     = false
}

variable "enable_https" {
  type        = bool
  description = "Enable HTTPS listener. Requires certificate_arn."
  default     = false
}

variable "certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS. Required if enable_https is true."
  default     = ""
}

variable "enable_sticky_sessions" {
  type        = bool
  description = "Enable sticky sessions (recommended for WebSocket connections)."
  default     = true
}

variable "target_group_deregistration_delay" {
  type        = number
  description = "Time in seconds to wait before deregistering a target."
  default     = 30
}

variable "enable_container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights."
  default     = false
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days."
  default     = 7
}

variable "enable_autoscaling" {
  type        = bool
  description = "Enable auto-scaling based on CPU."
  default     = false
}

variable "autoscaling_min_capacity" {
  type        = number
  description = "Minimum number of tasks when auto-scaling is enabled."
  default     = 0
}

variable "autoscaling_max_capacity" {
  type        = number
  description = "Maximum number of tasks when auto-scaling is enabled."
  default     = 3
}

variable "autoscaling_cpu_target" {
  type        = number
  description = "Target CPU utilization percentage for auto-scaling."
  default     = 70
}
