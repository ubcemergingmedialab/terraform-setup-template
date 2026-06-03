variable "name_prefix" {
  type        = string
  description = "Prefix for the S3 bucket name."
}

variable "bucket_name_suffix" {
  type        = string
  description = "Suffix for bucket name when not using legacy name."
  default     = "assets"
}

variable "legacy_bucket_name" {
  type        = string
  description = "Exact bucket name for import (e.g. eml-soils-db)."
  default     = ""
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins allowed for CORS GET/HEAD."
  default     = ["*"]
}

variable "enable_versioning" {
  type        = bool
  description = "Enable S3 versioning."
  default     = true
}

variable "enable_public_read" {
  type        = bool
  description = "Allow anonymous s3:GetObject via bucket policy (direct S3 URLs). Set false when using CDN only."
  default     = true
}

variable "enable_cdn" {
  type        = bool
  description = "CloudFront distribution + OAC in front of the assets bucket (recommended for splats)."
  default     = false
}

variable "price_class" {
  type        = string
  description = "CloudFront price class when enable_cdn is true (PriceClass_100 = US/CA/EU)."
  default     = "PriceClass_100"
}
