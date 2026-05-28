variable "name_prefix" {
  type        = string
  description = "Prefix for IAM user and policy."
}

variable "api_execution_arn" {
  type        = string
  description = "API Gateway execution ARN from lambda-http-api."
}

variable "allowed_route_arns" {
  type        = list(string)
  description = "execute-api ARNs for routes this user may invoke (e.g. GET /pins)."
}
