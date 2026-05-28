variable "name_prefix" {
  type        = string
  description = "Name prefix shared by every resource (client-project-environment)."
}

variable "bucket_name_suffix" {
  type        = string
  description = "Suffix before random hex for the site bucket name."
  default     = "site"
}

variable "spa_routing" {
  type        = bool
  description = "Route 403/404 to index.html with status 200 for client-side routing."
  default     = true
}

variable "price_class" {
  type        = string
  description = "CloudFront price class (PriceClass_100 = US/CA/EU)."
  default     = "PriceClass_100"
}

variable "default_root_object" {
  type        = string
  description = "Default object for / requests."
  default     = "index.html"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Origins for S3 CORS (direct bucket access; CloudFront is the normal entry)."
  default     = ["*"]
}

variable "enable_versioning" {
  type        = bool
  description = "Enable S3 versioning on the site bucket."
  default     = true
}
