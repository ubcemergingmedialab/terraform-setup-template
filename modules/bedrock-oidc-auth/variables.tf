# modules/bedrock-oidc-auth/variables.tf

# ===============================================
# Required Variables
# ===============================================

variable "name_prefix" {
  description = "Prefix for all resource names (e.g., 'lab-shared-bedrock-auth')"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,63}$", var.name_prefix))
    error_message = "Name prefix must start with a letter, contain only lowercase letters, numbers, and hyphens, and be 3-64 characters long."
  }
}

variable "oidc_provider_domain" {
  description = "OIDC provider domain (e.g., 'company.okta.com', 'login.microsoftonline.com/{tenant-id}/v2.0')"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$", var.oidc_provider_domain))
    error_message = "Must be a valid fully-qualified domain name without scheme or path."
  }
}

variable "oidc_client_id" {
  description = "OIDC application client ID from your identity provider"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.oidc_client_id) > 0
    error_message = "OIDC client ID cannot be empty."
  }
}

variable "oidc_thumbprint_list" {
  description = "List of certificate thumbprints for the OIDC provider (get from your IdP's JWKS endpoint)"
  type        = list(string)

  validation {
    condition     = length(var.oidc_thumbprint_list) > 0
    error_message = "At least one thumbprint is required."
  }
}

variable "provider_type" {
  description = "Identity provider type (okta, azure, auth0, google, cognito, generic)"
  type        = string
  default     = "okta"

  validation {
    condition     = contains(["okta", "azure", "auth0", "google", "cognito", "generic"], var.provider_type)
    error_message = "Provider type must be one of: okta, azure, auth0, google, cognito, generic."
  }
}

# ===============================================
# Federation Configuration
# ===============================================

variable "federation_type" {
  description = "Federation type: 'direct' for direct STS AssumeRoleWithWebIdentity, 'cognito' for Cognito Identity Pool"
  type        = string
  default     = "direct"

  validation {
    condition     = contains(["direct", "cognito"], var.federation_type)
    error_message = "Federation type must be either 'direct' or 'cognito'."
  }
}

variable "identity_pool_name" {
  description = "Name for Cognito Identity Pool (only used when federation_type = 'cognito')"
  type        = string
  default     = "claude-code-bedrock"

  validation {
    condition     = can(regex("^[\\w\\s+=,.@-]+$", var.identity_pool_name))
    error_message = "Identity pool name must contain only alphanumeric characters, spaces, and the following: +=,.@-"
  }
}

variable "enable_principal_tags" {
  description = "Enable Cognito principal tag mapping for per-user cost attribution (only applies when federation_type = 'cognito')"
  type        = bool
  default     = true
}

# ===============================================
# Bedrock Access Configuration
# ===============================================

variable "allowed_bedrock_regions" {
  description = "List of AWS regions where Bedrock access is allowed"
  type        = list(string)
  default = [
    "us-east-1",
    "us-west-2",
    "ap-southeast-1",
    "eu-central-1"
  ]

  validation {
    condition     = length(var.allowed_bedrock_regions) > 0
    error_message = "At least one region must be specified."
  }
}

# ===============================================
# Monitoring Configuration
# ===============================================

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring for Bedrock usage"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch Logs retention value."
  }
}

# ===============================================
# Tagging
# ===============================================

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
