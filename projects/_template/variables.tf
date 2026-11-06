# The five contract variables every project root must declare.
# See docs/conventions.md for the required shape and naming rules.

variable "client_name" {
  type        = string
  description = "Client slug (lowercase, hyphen-separated, no spaces, max 24 chars). Used in resource names and tags."
}

variable "project_name" {
  type        = string
  description = "Project slug. Same rules as client_name."
}

variable "environment" {
  type        = string
  description = "Deployment environment within the project (e.g. dev, prod)."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region this project deploys into."
}

variable "tags" {
  type        = map(string)
  description = "Extra tags merged onto default_tags."
  default     = {}
}
