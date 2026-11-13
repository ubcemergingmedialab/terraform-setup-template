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
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}

variable "bedrock_model_arns" {
  type        = list(string)
  description = "ARNs the Lambda may invoke via bedrock:InvokeModel. Default [] auto-scopes access to bedrock_model_id (its inference profile and underlying foundation model). Set ['*'] to allow any model."
  default     = []
}

variable "reserved_concurrency" {
  type        = number
  description = "Reserved concurrent executions for the chat Lambda (caps parallel Bedrock calls). -1 = unreserved. AWS requires >= 10 unreserved concurrency in the account, so low-limit accounts may need a quota increase first."
  default     = 5
}

variable "alarm_email" {
  type        = string
  description = "Email for usage alarms (invocation spike, throttling). Empty disables alarms. Recipient must confirm the SNS subscription."
  default     = ""
}

variable "invocations_alarm_threshold" {
  type        = number
  description = "Alarm when invocations in one hour exceed this number."
  default     = 500
}

variable "max_tokens_ceiling" {
  type        = number
  description = "Server-side cap on maxTokens per request."
  default     = 1024
}

variable "max_messages" {
  type        = number
  description = "Server-side cap on messages per request."
  default     = 50
}

variable "max_input_chars" {
  type        = number
  description = "Server-side cap on total input characters per request."
  default     = 20000
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
  description = "Shared secret the game sends in the x-chat-secret header (Function URL uses NONE auth). Ships with the build; rotate by changing this and re-applying."
  sensitive   = true
}

variable "enable_guardrail" {
  type        = bool
  description = "Create a Bedrock Guardrail and apply it on every chat request (content filtering + prompt-attack detection)."
  default     = true
}

variable "guardrail_denied_topics" {
  type = list(object({
    name       = string
    definition = string
    examples   = optional(list(string), [])
  }))
  description = "Denied topics for the Bedrock Guardrail (blocked in input and output). Empty = no topic policy. Only used when enable_guardrail = true."
  default     = []
}
