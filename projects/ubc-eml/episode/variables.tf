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
  description = "Deployment environment (dev, prod, …)."
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

# --- Project-specific ---

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model ID used by the chat backend Lambda."
  default     = "us.anthropic.claude-sonnet-4-6"
}

variable "chat_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the chat backend Lambda source."
  default     = "lambda/chat-backend"
}

variable "polly_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the Polly Lambda source."
  default     = "lambda/polly"
}
