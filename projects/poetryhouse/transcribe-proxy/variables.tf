# ========================================
# Contract Variables (required for all projects)
# ========================================

variable "client_name" {
  type        = string
  description = "Client slug (lowercase, hyphen-separated)."
}

variable "project_name" {
  type        = string
  description = "Project slug."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, ...)."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region for all resources."
}

variable "tags" {
  type        = map(string)
  description = "Extra tags merged onto default_tags."
  default     = {}
}

# ========================================
# Project-Specific Variables
# ========================================

variable "container_image_tag" {
  type        = string
  description = "Container image tag to deploy (e.g., 'latest', 'v1.0.0')."
  default     = "latest"
}

variable "fargate_cpu" {
  type        = number
  description = "Fargate CPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU)."
  default     = 512
}

variable "fargate_memory_mb" {
  type        = number
  description = "Fargate memory in MB (must be compatible with CPU)."
  default     = 1024
}

variable "desired_task_count" {
  type        = number
  description = "Number of tasks to run (ignored if autoscaling is enabled)."
  default     = 1
}

variable "transcribe_language_code" {
  type        = string
  description = "AWS Transcribe language code (e.g., 'en-US', 'fr-CA')."
  default     = "en-US"
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "CIDR blocks allowed to connect to the ALB. Use ['0.0.0.0/0'] for public access."
  default     = ["0.0.0.0/0"]
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days."
  default     = 7
}

variable "enable_container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights (adds cost)."
  default     = false
}

variable "enable_autoscaling" {
  type        = bool
  description = "Enable auto-scaling based on CPU utilization."
  default     = false
}

variable "autoscaling_min_capacity" {
  type        = number
  description = "Minimum number of tasks (set to 0 to scale to zero when idle)."
  default     = 0
}

variable "autoscaling_max_capacity" {
  type        = number
  description = "Maximum number of tasks."
  default     = 3
}

variable "autoscaling_cpu_target" {
  type        = number
  description = "Target CPU utilization percentage for auto-scaling."
  default     = 70
}

variable "enable_https" {
  type        = bool
  description = "Enable HTTPS (requires certificate_arn)."
  default     = false
}

variable "certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS (required if enable_https is true)."
  default     = ""
}
