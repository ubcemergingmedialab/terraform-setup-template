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

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model (or inference-profile) ID the chat Lambda calls."
  default     = "global.anthropic.claude-sonnet-4-6"
}

variable "bedrock_model_arns" {
  type        = list(string)
  description = "ARNs the Lambda may invoke via bedrock:InvokeModel. Default ['*'] allows any model in the account."
  default     = ["*"]
}

variable "lambda_memory_mb" {
  type        = number
  description = "Lambda memory in MB."
  default     = 256
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda timeout in seconds."
  default     = 30
}

variable "chat_shared_secret" {
  type        = string
  description = "Shared secret the game sends in the x-chat-secret header (Function URL uses NONE auth). Ships with the build; rotate by changing this and re-applying. Set as a sensitive HCP workspace variable, never in tfvars."
  sensitive   = true
}
