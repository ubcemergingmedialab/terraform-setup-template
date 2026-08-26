variable "repository_name" {
  type        = string
  description = "ECR repository name (use name_prefix pattern from project)."
}

variable "image_tag_mutability" {
  type        = string
  description = "Image tag mutability: MUTABLE or IMMUTABLE."
  default     = "MUTABLE"
}

variable "scan_on_push" {
  type        = bool
  description = "Enable image scanning on push."
  default     = true
}

variable "enable_lifecycle_policy" {
  type        = bool
  description = "Enable lifecycle policy to clean old images."
  default     = true
}

variable "lifecycle_keep_count" {
  type        = number
  description = "Number of images to keep when lifecycle policy is enabled."
  default     = 10
}
