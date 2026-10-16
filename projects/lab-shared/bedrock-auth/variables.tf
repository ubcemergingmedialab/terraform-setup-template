# projects/lab-shared/bedrock-auth/variables.tf

# ===============================================
# Required Lab Convention Variables
# ===============================================

variable "client_name" {
  description = "Client slug (lab-shared for account-level infrastructure)"
  type        = string
  default     = "lab-shared"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,23}$", var.client_name))
    error_message = "Client name must be lowercase, hyphen-separated, start with a letter, max 24 chars."
  }
}

variable "project_name" {
  description = "Project slug"
  type        = string
  default     = "bedrock-auth"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,23}$", var.project_name))
    error_message = "Project name must be lowercase, hyphen-separated, start with a letter, max 24 chars."
  }
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "us-west-2"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ===============================================
# OIDC Provider Configuration
# ===============================================

variable "oidc_provider_domain" {
  description = <<-EOT
    OIDC provider domain without https:// scheme.
    Examples:
      - Okta: company.okta.com
      - Azure AD: login.microsoftonline.com/{tenant-id}/v2.0
      - Auth0: company.auth0.com
      - Google: accounts.google.com
      - Cognito: cognito-idp.{region}.amazonaws.com/{user-pool-id}
  EOT
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$", var.oidc_provider_domain))
    error_message = "Must be a valid domain without scheme or path."
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
  description = <<-EOT
    List of certificate thumbprints for the OIDC provider.
    
    Common thumbprints:
      - Okta: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
      - Azure AD: ["626d44e704d1ceabe3bf0d53397464ac8080142c"]
      - Auth0: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
      - Google: ["4348a0e9444c78cb265e058d5e8944b4d84f9662"]
    
    To get thumbprint for any provider:
      echo | openssl s_client -servername DOMAIN -connect DOMAIN:443 2>/dev/null | \
        openssl x509 -fingerprint -noout -sha1 | \
        sed 's/SHA1 Fingerprint=//g' | sed 's/://g' | tr '[:upper:]' '[:lower:]'
  EOT
  type        = list(string)

  validation {
    condition     = length(var.oidc_thumbprint_list) > 0
    error_message = "At least one thumbprint is required."
  }
}

variable "oidc_provider_type" {
  description = "Identity provider type (okta, azure, auth0, google, cognito, generic)"
  type        = string
  default     = "okta"

  validation {
    condition     = contains(["okta", "azure", "auth0", "google", "cognito", "generic"], var.oidc_provider_type)
    error_message = "Provider type must be one of: okta, azure, auth0, google, cognito, generic."
  }
}

# ===============================================
# Federation Configuration
# ===============================================

variable "federation_type" {
  description = <<-EOT
    Federation type:
      - 'direct': Direct STS AssumeRoleWithWebIdentity (recommended, simpler, 12h sessions)
      - 'cognito': Cognito Identity Pool (advanced features, 8h sessions, principal tags)
  EOT
  type        = string
  default     = "direct"

  validation {
    condition     = contains(["direct", "cognito"], var.federation_type)
    error_message = "Federation type must be 'direct' or 'cognito'."
  }
}

variable "cognito_identity_pool_name" {
  description = "Name for Cognito Identity Pool (only used when federation_type = cognito)"
  type        = string
  default     = "claude-code-bedrock"
}

variable "enable_principal_tags" {
  description = "Enable Cognito principal tag mapping for per-user cost attribution in CUR 2.0 (only applies when federation_type = cognito)"
  type        = bool
  default     = true
}

# ===============================================
# Bedrock Access Configuration
# ===============================================

variable "allowed_bedrock_regions" {
  description = <<-EOT
    List of AWS regions where Bedrock access is allowed.
    Restricts which regions developers can invoke Bedrock models in.
    
    Common Bedrock regions:
      - US: us-east-1, us-west-2
      - Europe: eu-central-1, eu-west-1
      - Asia: ap-southeast-1, ap-northeast-1
  EOT
  type        = list(string)
  default = [
    "us-east-1",
    "us-west-2"
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
  description = "Enable CloudWatch log group for Bedrock access logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs (1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653)"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be a valid CloudWatch Logs retention value."
  }
}
