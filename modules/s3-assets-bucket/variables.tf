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
