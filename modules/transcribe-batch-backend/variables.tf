variable "name_prefix" {
  type        = string
  description = "Prefix for Lambda, IAM, S3, and log resources (e.g. client-project-env)."
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
  description = "Lambda memory in MB. The handler mostly waits (polls) on the Transcribe job, so this can stay small."
  default     = 256
}

variable "timeout_seconds" {
  type        = number
  description = "Lambda timeout. Must cover upload + batch job latency + polling. Batch jobs for short clips typically finish in ~5-25s, so give generous headroom."
  default     = 120
}

variable "language_code" {
  type        = string
  description = "Default Transcribe language code when the request omits it. Passed to the handler as TRANSCRIBE_LANGUAGE_CODE."
  default     = "en-US"
}

variable "poll_interval_ms" {
  type        = number
  description = "How often the handler polls the Transcribe job for completion. Passed as TRANSCRIBE_POLL_INTERVAL_MS."
  default     = 1500
}

variable "object_expiration_days" {
  type        = number
  description = "Lifecycle expiration (in days) for uploaded audio and transcript JSON in the scratch bucket. Keep short; this is transient working data."
  default     = 1
}

variable "environment_variables" {
  type        = map(string)
  description = "Extra environment variables merged onto the Transcribe defaults."
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
