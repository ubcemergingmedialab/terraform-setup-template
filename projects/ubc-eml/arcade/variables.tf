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

# --- Legacy names -------------------------------------------------------------
#
# ARCADE was built by hand before Terraform and is SERVING PRODUCTION at
# https://arcade.ubc-dxl.ca. These three names are what exists in the account
# today. They deliberately break the `${client}-${project}-${environment}-*`
# convention, because renaming them is not a rename: an S3 bucket cannot be
# renamed at all, so changing the name here would make Terraform destroy the
# live bucket and create an empty one, taking every published story, marker and
# asset with it.
#
# Import against these. Do not "fix" them to match the convention.
# See README.md § Importing.

variable "legacy_bucket_name" {
  type        = string
  description = "Exact name of the existing storage bucket, for import. Empty creates a conventionally-named bucket instead."
  default     = ""
}

variable "legacy_lambda_name" {
  type        = string
  description = "Exact name of the existing API Lambda, for import. Empty uses the conventional name."
  default     = ""
}

variable "legacy_lambda_role_name" {
  type        = string
  description = "Exact name of the existing Lambda execution role, for import. Empty uses the conventional name."
  default     = ""
}

# --- Storage ------------------------------------------------------------------

variable "public_read_prefixes" {
  type        = list(string)
  description = <<-EOT
    Key prefixes served anonymously over plain S3 URLs.

    Read is public ON THESE PREFIXES ONLY, which is deliberate: the app hands an
    S3 URL straight to a texture loader and to the story fetcher, so the bytes
    must be gettable without a signature. Nothing grants listing, so keys are
    unguessable rather than secret.

    Anything not listed here — scratch_prefix in particular — stays private.
  EOT
  default     = ["assets", "stories", "markers", "exhibits"]
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = <<-EOT
    Origins allowed to issue the browser's direct PUT and GET against the bucket.

    Must list every origin the studio is actually loaded from. Each Amplify
    branch preview gets its own subdomain, and an origin missing here surfaces
    as a generic network error that never mentions CORS — which is why images
    look blank on branch-preview URLs.
  EOT
  default     = []
}

variable "cors_allowed_headers" {
  type        = list(string)
  description = "Request headers the browser may send when uploading. `x-amz-checksum-sha256` is required by the content-addressed publish path."
  default     = ["content-type", "if-none-match", "x-amz-checksum-sha256"]
}

variable "enable_versioning" {
  type        = bool
  description = "Keep noncurrent object versions, so a bad publish can be rolled back."
  default     = true
}

variable "scratch_prefix" {
  type        = string
  description = "Prefix holding disposable objects, expired on a timer. Kept out of public_read_prefixes on purpose."
  default     = "tmp/"
}

variable "scratch_expiration_days" {
  type        = number
  description = "Days before an object under scratch_prefix expires."
  default     = 90
}

variable "noncurrent_version_days" {
  type        = number
  description = "Days a noncurrent version is retained before deletion."
  default     = 30
}

variable "noncurrent_versions_kept" {
  type        = number
  description = "How many newer noncurrent versions to keep regardless of age."
  default     = 3
}

# --- API Lambda ---------------------------------------------------------------

variable "lambda_runtime" {
  type        = string
  description = "Node runtime for the API Lambda."
  default     = "nodejs22.x"
}

variable "lambda_handler" {
  type        = string
  description = "Handler entrypoint, as `file.export`."
  default     = "index.handler"
}

variable "lambda_memory_mb" {
  type        = number
  description = "Lambda memory in MB."
  default     = 128
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda timeout in seconds."
  default     = 30
}

variable "lambda_architectures" {
  type        = list(string)
  description = "Lambda CPU architecture. x86_64 in production; the bundled build has not been verified on arm64."
  default     = ["x86_64"]
}

variable "lambda_reserved_concurrency" {
  type        = number
  description = <<-EOT
    Concurrent executions reserved for the API, capping how many run at once.

    Matters more than usual here because the Function URL is unauthenticated:
    the cap is what keeps a burst against a public endpoint from draining the
    account's shared concurrency pool. `-1` means unreserved — setting that
    removes the ceiling rather than raising it.
  EOT
  default     = 10
}

variable "lambda_log_retention_days" {
  type        = number
  description = "Days of CloudWatch logs kept for the API. Production is 30; a log group Lambda creates for itself never expires, so leaving this unmanaged quietly accumulates cost."
  default     = 30
}

variable "lambda_role_description" {
  type        = string
  description = "Description on the execution role. Set to match the live role so a plan does not blank it."
  default     = "EML ARCADE Backend"
}

variable "story_public_base_url" {
  type        = string
  description = "Public base URL the API stamps into published documents so viewers can fetch story JSON and assets."
  default     = ""
}

variable "studio_publish_secret" {
  type        = string
  sensitive   = true
  description = <<-EOT
    Shared secret the studio presents when publishing.

    NEVER put this in terraform.auto.tfvars — that file is committed. Set it as
    a sensitive variable on the HCP workspace instead. Left empty, Terraform
    keeps whatever the live function already has (see the lifecycle
    ignore_changes in main.tf), so a plan will not blank it out.
  EOT
  default     = ""
}
