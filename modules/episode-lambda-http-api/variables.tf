variable "name_prefix" {
  type = string
}

variable "runtime" {
  type    = string
  default = "nodejs20.x"
}

variable "handler" {
  type    = string
  default = "handler.handler"
}

variable "source_path" {
  type = string
}

variable "memory_mb" {
  type    = number
  default = 256
}

variable "timeout_seconds" {
  type    = number
  default = 30
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}
variable "http_routes" {
  type = list(object({ method = string, path = string, authorization_type = optional(string, "NONE") }))
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