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

variable "polly_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the Polly Lambda source."
  default     = "lambda/polly"
}

variable "lambda_memory_mb" {
  type        = number
  description = "Lambda memory in MB."
  default     = 128
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda timeout in seconds. Synthesis of a sentence is fast; give headroom for longer text."
  default     = 15
}

variable "default_voice_id" {
  type        = string
  description = "Default Polly VoiceId when the request omits voiceId (e.g. Tiffany, Joanna, Matthew)."
  default     = "Tiffany"
}

variable "default_output_format" {
  type        = string
  description = "Default Polly output format (mp3, ogg_vorbis, pcm). mp3 is decoded by RuntimeAudioImporter on the Unreal side."
  default     = "mp3"
}

variable "tts_shared_secret" {
  type        = string
  description = "Shared secret the game sends in the x-tts-secret header (Function URL uses NONE auth). Set as a sensitive HCP workspace variable, never in tfvars. Leave empty to disable the check (not recommended for NONE)."
  default     = ""
  sensitive   = true
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Allowed origins for the Function URL CORS config."
  default     = ["*"]
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention for the Lambda."
  default     = 14
}
