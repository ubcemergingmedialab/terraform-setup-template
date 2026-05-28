variable "name_prefix" {
  type        = string
  description = "Prefix for Lambda, API Gateway, and IAM resources."
}

variable "runtime" {
  type        = string
  description = "Lambda runtime."
  default     = "nodejs20.x"
}

variable "handler" {
  type        = string
  description = "Lambda handler (file.export)."
  default     = "handler.handler"
}

variable "source_path" {
  type        = string
  description = "Directory containing Lambda source and node_modules to zip."
}

variable "memory_mb" {
  type        = number
  description = "Lambda memory in MB."
  default     = 256
}

variable "timeout_seconds" {
  type        = number
  description = "Lambda timeout in seconds."
  default     = 30
}

variable "environment_variables" {
  type        = map(string)
  description = "Lambda environment variables."
  default     = {}
}

variable "http_routes" {
  type = list(object({
    method             = string
    path               = string
    authorization_type = optional(string, "NONE")
  }))
  description = "HTTP API routes. authorization_type: NONE, JWT, or AWS_IAM."
}

variable "cognito_jwt_issuer" {
  type        = string
  description = "Cognito JWT issuer URL (required when any route uses JWT)."
  default     = ""
}

variable "cognito_audiences" {
  type        = list(string)
  description = "JWT audiences (app client IDs) for Cognito authorizer."
  default     = []
}

variable "dynamodb_table_arns" {
  type        = list(string)
  description = "DynamoDB table ARNs the Lambda may read/write."
  default     = []
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Allowed origins for API CORS."
  default     = ["*"]
}

variable "cors_allow_methods" {
  type        = list(string)
  description = "Allowed methods for API CORS."
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allow_headers" {
  type        = list(string)
  description = "Allowed headers for API CORS."
  default     = ["authorization", "content-type"]
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention for Lambda."
  default     = 14
}
