variable "name_prefix" {
  type        = string
  description = "Prefix for Lambda, IAM, and log resources (e.g. client-project-env)."
}

variable "source_path" {
  type        = string
  description = "Directory containing the Lambda source (handler + optional node_modules) to zip."
}

variable "handler" {
  type        = string
  description = "Lambda handler (file.export)."
  default     = "handler.handler"
}

variable "runtime" {
  type        = string
  description = "Lambda runtime."
  default     = "nodejs22.x"
}

variable "architecture" {
  type        = string
  description = "Lambda CPU architecture."
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.architecture)
    error_message = "architecture must be arm64 or x86_64."
  }
}

variable "memory_mb" {
  type        = number
  description = "Lambda memory in MB. TTS mostly waits on Polly, so this can stay small."
  default     = 256
}

variable "timeout_seconds" {
  type        = number
  description = "Lambda timeout. Needs headroom for a full synthesis (generative voices are slower)."
  default     = 30
}

variable "default_voice_id" {
  type        = string
  description = "Default Polly voice when the request omits voiceId. Passed to the handler as POLLY_DEFAULT_VOICE_ID."
  default     = "Ruth"
}

variable "default_engine" {
  type        = string
  description = "Default Polly engine when the request omits engine. Passed to the handler as POLLY_DEFAULT_ENGINE."
  default     = "neural"

  validation {
    condition     = contains(["standard", "neural", "generative", "long-form"], var.default_engine)
    error_message = "default_engine must be standard, neural, generative, or long-form."
  }
}

variable "default_output_format" {
  type        = string
  description = "Default Polly output format when the request omits outputFormat. Passed to the handler as POLLY_DEFAULT_OUTPUT_FORMAT."
  default     = "mp3"

  validation {
    condition     = contains(["mp3", "ogg_vorbis", "pcm"], var.default_output_format)
    error_message = "default_output_format must be mp3, ogg_vorbis, or pcm."
  }
}

variable "environment_variables" {
  type        = map(string)
  description = "Extra environment variables merged onto the Polly defaults."
  default     = {}
}

variable "create_invoker_user" {
  type        = bool
  description = "Create a scoped IAM user (invoke-only) whose access key ships with the client app. Only relevant when auth_type = AWS_IAM."
  default     = false
}

variable "auth_type" {
  type        = string
  description = "Function URL auth: AWS_IAM (SigV4) or NONE (public; handler enforces a shared secret)."
  default     = "NONE"

  validation {
    condition     = contains(["AWS_IAM", "NONE"], var.auth_type)
    error_message = "auth_type must be AWS_IAM or NONE."
  }
}

variable "shared_secret" {
  type        = string
  description = "Shared secret the handler requires in the x-chat-secret header when auth_type = NONE. Passed to the Lambda as CHAT_SHARED_SECRET. Leave empty to disable the check (not recommended for NONE)."
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

variable "tags" {
  type        = map(string)
  description = "Extra tags applied to resources that support tagging."
  default     = {}
}
