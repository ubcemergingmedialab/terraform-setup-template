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
  description = <<-EOT
    Default Amazon Polly VoiceId used to synthesize the chat reply. The voice MUST
    support `polly_engine` or synthesis fails with "This voice does not support the
    selected engine". Old DXL/OpenAI voice names (alloy, nova, ...) do NOT exist in Polly.

    Available en-US voices in ca-central-1 (verified via `aws polly describe-voices`):

      generative (default engine here):
        Joanna (F), Ruth (F), Salli (F), Stephen (M), Tiffany (F)

      neural (faster, lower cost, steadier inflection):
        Joanna (F), Ruth (F), Salli (F), Stephen (M), Danielle (F), Kimberly (F),
        Kendra (F), Ivy (F), Gregory (M), Kevin (M), Matthew (M), Justin (M), Joey (M)

    en-GB generative (for a British accent): Amy (F), Brian (M).

    Note: Joanna, Ruth, Salli, and Stephen support BOTH generative and neural, so you
    can switch `polly_engine` without changing the voice for those four.
  EOT
  default     = "Tiffany"
}

variable "polly_engine" {
  type        = string
  description = <<-EOT
    Polly engine. `generative` = most natural/expressive (default); `neural` = faster
    synthesis, lower cost, steadier inflection on short/number-heavy lines. Must be
    compatible with `polly_voice_id` (see that variable for the per-engine voice lists).
    Tiffany is generative-only, which is why the default is generative.
  EOT
  default     = "generative"

  validation {
    condition     = contains(["standard", "neural", "long-form", "generative"], var.polly_engine)
    error_message = "polly_engine must be one of: standard, neural, long-form, generative."
  }
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
