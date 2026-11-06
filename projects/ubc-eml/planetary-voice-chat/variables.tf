# ========================================
# Contract Variables (required for all projects)
# ========================================

variable "client_name" {
  type        = string
  description = "Client slug (lowercase, hyphen-separated, max 24 chars)."
}

variable "project_name" {
  type        = string
  description = "Project slug (lowercase, hyphen-separated)."
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
# Shared across all three backends
# ========================================

variable "chat_shared_secret" {
  type        = string
  description = "Shared secret the Unity client sends in the x-chat-secret header on every request (all three Function URLs use NONE auth). Ships with the build; rotate by changing this and re-applying. Set as a SENSITIVE variable in HCP; do not commit."
  sensitive   = true
}

# ========================================
# Bedrock (chat) backend
# ========================================

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model (or inference-profile) ID the chat Lambda calls. Claude Haiku 5.5 is served via a cross-Region inference profile; in ca-central-1 use the global profile (global.anthropic.claude-haiku-5-5) if the bare base ID returns a validation error on Converse."
  default     = "anthropic.claude-haiku-5-5"
}

variable "bedrock_model_arns" {
  type        = list(string)
  description = "ARNs the chat Lambda may invoke via bedrock:InvokeModel. Default ['*'] allows any model in the account."
  default     = ["*"]
}

# ========================================
# Polly (text-to-speech) backend
# ========================================

variable "polly_default_voice_id" {
  type        = string
  description = "Default Polly voice when a TTS request omits voiceId."
  default     = "Ruth"
}

variable "polly_default_engine" {
  type        = string
  description = "Default Polly engine (standard | neural | generative | long-form)."
  default     = "neural"
}

variable "polly_default_output_format" {
  type        = string
  description = "Default Polly output format (mp3 | ogg_vorbis | pcm)."
  default     = "mp3"
}

# ========================================
# Transcribe (record-then-transcribe) backend
# ========================================

variable "transcribe_language_code" {
  type        = string
  description = "Default Transcribe language code when a request omits it."
  default     = "en-US"
}

variable "transcribe_timeout_seconds" {
  type        = number
  description = "Transcribe Lambda timeout. Must cover upload + batch job latency + polling."
  default     = 120
}

variable "transcribe_object_expiration_days" {
  type        = number
  description = "Days before uploaded audio / transcript JSON expire from the scratch bucket."
  default     = 1
}
