variable "name_prefix" {
  type        = string
  description = "Prefix for Lambda, IAM, and log resources (e.g. client-project-env)."
}

variable "source_path" {
  type        = string
  description = "Directory containing the Lambda source (handler + node_modules) to zip."
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
  description = "Lambda memory in MB. Chat mostly waits on Bedrock, so this can stay small."
  default     = 256
}

variable "timeout_seconds" {
  type        = number
  description = "Lambda timeout. Needs headroom for a full (buffered) completion."
  default     = 30
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model (or inference-profile) ID the Lambda calls. Passed to the handler as BEDROCK_MODEL_ID."
}

variable "bedrock_model_arns" {
  type        = list(string)
  description = "ARNs the Lambda may invoke via bedrock:InvokeModel. Default ['*'] allows any model/profile in the account."
  default     = ["*"]
}

variable "environment_variables" {
  type        = map(string)
  description = "Extra environment variables merged onto BEDROCK_MODEL_ID."
  default     = {}
}

variable "invoke_mode" {
  type        = string
  description = "Function URL invoke mode: BUFFERED (single reply) or RESPONSE_STREAM (NDJSON stream)."
  default     = "BUFFERED"

  validation {
    condition     = contains(["BUFFERED", "RESPONSE_STREAM"], var.invoke_mode)
    error_message = "invoke_mode must be BUFFERED or RESPONSE_STREAM."
  }
}

variable "create_invoker_user" {
  type        = bool
  description = "Create a scoped IAM user (invoke-only) whose access key ships with the client app."
  default     = true
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
