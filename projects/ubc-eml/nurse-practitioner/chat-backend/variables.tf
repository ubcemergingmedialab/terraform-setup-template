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

variable "polly_voice_id" {
  type        = string
  description = "Default Amazon Polly VoiceId used to synthesize the chat reply (e.g. Tiffany, Joanna, Matthew, Ruth). Old DXL/OpenAI voice names do not exist in Polly."
  default     = "Tiffany"
}

variable "polly_engine" {
  type        = string
  description = "Polly engine: standard, neural, long-form, or generative. Neural gives higher quality where the voice supports it."
  default     = "neural"
}

variable "polly_output_format" {
  type        = string
  description = "Polly audio output format returned to the game (mp3, ogg_vorbis, pcm). mp3 is decoded by RuntimeAudioImporter on the Unreal side."
  default     = "mp3"
}

variable "lambda_memory_mb" {
  type        = number
  description = "Lambda memory in MB. The function waits on Bedrock then Polly, so this can stay modest."
  default     = 256
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda timeout in seconds. Needs headroom for a full completion plus speech synthesis."
  default     = 60
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention for the Lambda."
  default     = 14
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Allowed origins for the Function URL CORS config."
  default     = ["*"]
}

variable "chat_shared_secret" {
  type        = string
  description = "Shared secret the game sends in the x-chat-secret header (Function URL uses NONE auth). Ships with the build; rotate by changing this and re-applying. Set as a sensitive HCP workspace variable, never in tfvars."
  sensitive   = true
}
