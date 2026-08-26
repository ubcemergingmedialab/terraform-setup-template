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

variable "cognito_callback_urls" {
  type        = list(string)
  description = "OAuth callback URLs (local admin + CloudFront admin URL after apply)."
}

variable "cognito_logout_urls" {
  type        = list(string)
  description = "OAuth sign-out redirect URLs."
}

variable "cognito_hosted_ui_domain_prefix" {
  type        = string
  description = "Cognito hosted UI domain prefix. Leave empty to let Cognito assign one."
  default     = ""
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Origins for API Gateway CORS and assets bucket CORS."
  default     = ["*"]
}

variable "public_capture_ids" {
  type        = string
  description = "Capture IDs returned by GET /captures. Use \"*\" (default) for all rows, or comma-separated IDs."
  default     = "*"
}

variable "enable_assets_bucket" {
  type        = bool
  description = "Create S3 bucket for splat/media storage and DB backups."
  default     = true
}

variable "enable_assets_cdn" {
  type        = bool
  description = "CloudFront CDN in front of the assets bucket (recommended for splat caching and Range requests)."
  default     = true
}

variable "assets_enable_public_read" {
  type        = bool
  description = "Allow direct S3 object URLs (public GetObject). Prefer assets_cdn_url in stored records."
  default     = true
}

variable "enable_viewer_site" {
  type        = bool
  description = "S3 + CloudFront for the public viewer app (apps/viewer). Bucket suffix: site."
  default     = true
}

variable "enable_admin_site" {
  type        = bool
  description = "S3 + CloudFront for the admin app (apps/admin). Bucket suffix: admin."
  default     = true
}
