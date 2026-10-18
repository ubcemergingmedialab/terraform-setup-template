variable "name_prefix" {
  type = string
}

variable "functions" {
  type = map(object({
    source_path           = string
    handler               = string
    runtime               = string
    memory_mb             = number
    timeout_seconds       = number
    environment_variables = map(string)
  }))
}
variable "http_routes" {
  type = list(object({
    method             = string
    path               = string
    function_name      = string
    authorization_type = optional(string, "NONE")
  }))
}
variable "cognito_jwt_issuer" {
  type    = string
  default = ""
}

variable "cognito_audiences" {
  type    = list(string)
  default = []
}

variable "aurora_cluster_arns" {
  type    = list(string)
  default = []
}

variable "aurora_secret_arns" {
  type    = list(string)
  default = []
}

variable "aurora_secret_kms_key_arns" {
  type        = list(string)
  description = "KMS key ARNs encrypting aurora_secret_arns. Required when the secret uses a customer-managed key, since such keys delegate entirely to IAM and grant no implicit decrypt access the way AWS-managed keys do."
  default     = []
}

variable "cors_allow_origins" {
  type    = list(string)
  default = ["*"]
}

variable "cors_allow_methods" {
  type    = list(string)
  default = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allow_headers" {
  type    = list(string)
  default = ["authorization", "content-type"]
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "cognito_user_pool_arns" {
  type    = list(string)
  default = []
}

variable "cognito_function_names" {
  type    = set(string)
  default = ["public"]
}

variable "throttling_rate_limit" {
  type    = number
  default = 50
}

variable "throttling_burst_limit" {
  type    = number
  default = 100
}