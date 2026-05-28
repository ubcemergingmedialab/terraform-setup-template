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
  description = "Deployment environment (dev, prod, …)."
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

# --- Project-specific ---

variable "legacy_dynamodb_table_name" {
  type        = string
  description = "Import/migrate existing DynamoDB table (e.g. eml_fields). Leave empty to create a new prefixed table."
  default     = ""
}

variable "legacy_assets_bucket_name" {
  type        = string
  description = "Import existing S3 bucket for assets/exports (e.g. eml-soils-db). Leave empty to create a new bucket."
  default     = ""
}

variable "cognito_callback_urls" {
  type        = list(string)
  description = "OAuth callback URLs (local dev + CloudFront/custom domain)."
}

variable "cognito_logout_urls" {
  type        = list(string)
  description = "OAuth sign-out redirect URLs."
}

variable "cognito_hosted_ui_domain_prefix" {
  type        = string
  description = "Cognito hosted UI domain prefix. Set when importing an existing pool domain."
  default     = ""
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Origins for API Gateway CORS."
  default     = ["*"]
}

variable "pins_field_ids" {
  type        = string
  description = "Comma-separated FieldID values returned by GET /pins."
  default     = "TestA,TestB,TestC"
}

variable "create_iam_api_invoker" {
  type        = bool
  description = "Create IAM user for SigV4 access to GET /pins (legacy frontend signing)."
  default     = false
}

variable "enable_assets_bucket" {
  type        = bool
  description = "Create (or import) S3 bucket for splat/assets storage and DB backups."
  default     = true
}

variable "enable_static_site" {
  type        = bool
  description = "Create S3 + CloudFront for the Vite/React frontend (replaces Amplify hosting)."
  default     = true
}
