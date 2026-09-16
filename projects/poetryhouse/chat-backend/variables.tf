variable "client_name" {
  type        = string
  description = "Client slug (lowercase, hyphen-separated)."
  default     = "ubc"
}

variable "project_name" {
  type        = string
  description = "Project slug."
  default     = "poetryhouse"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, …)."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region for all resources."
  default     = "ca-central-1"
}

variable "tags" {
  type        = map(string)
  description = "Extra tags merged onto default_tags."
  default     = {}
}

# --- Project-specific ---

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model ID (or inference-profile ID) used by the chat backend Lambda. Cross-region profiles use a us./eu./apac. prefix."
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}

variable "chat_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the chat backend Lambda source."
  default     = "lambda/chat-backend"
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda timeout. Non-streaming chat completion needs headroom for the full response."
  default     = 30
}

variable "lambda_memory_mb" {
  type        = number
  description = "Lambda memory. Most time is spent waiting on Bedrock, so this can stay small."
  default     = 256
}
