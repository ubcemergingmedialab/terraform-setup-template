# Bedrock Authentication - Terraform Variable Values
#
# IMPORTANT: Update these values with your actual OIDC provider configuration
# before running terraform apply

# ===============================================
# Lab Convention Variables
# ===============================================

client_name  = "lab-shared"
project_name = "bedrock-auth"
environment  = "prod"
aws_region   = "us-west-2"  # Change to your preferred region

# ===============================================
# OIDC Provider Configuration
# ===============================================

# TODO: Replace with your actual OIDC provider domain
# Examples:
#   - Okta: "company.okta.com"
#   - Azure AD: "login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0"
#   - Auth0: "company.auth0.com"
#   - Google: "accounts.google.com"
oidc_provider_domain = "REPLACE_WITH_YOUR_OIDC_DOMAIN"

# TODO: Replace with your actual OIDC client ID from your IdP
oidc_client_id = "REPLACE_WITH_YOUR_CLIENT_ID"

# TODO: Replace with your provider's certificate thumbprint
# Common thumbprints:
#   - Okta: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
#   - Azure AD: ["626d44e704d1ceabe3bf0d53397464ac8080142c"]
#   - Auth0: ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
#   - Google: ["4348a0e9444c78cb265e058d5e8944b4d84f9662"]
oidc_thumbprint_list = ["REPLACE_WITH_THUMBPRINT"]

# TODO: Set your provider type
# Options: "okta", "azure", "auth0", "google", "cognito", "generic"
oidc_provider_type = "okta"

# ===============================================
# Federation Configuration
# ===============================================

# Recommended: "direct" for simpler setup and 12-hour sessions
# Use "cognito" if you need Cognito Identity Pool features or principal tags
federation_type = "direct"

# Only used when federation_type = "cognito"
cognito_identity_pool_name = "claude-code-bedrock"

# Enable per-user cost attribution in AWS CUR 2.0 (Cognito mode only)
enable_principal_tags = true

# ===============================================
# Bedrock Access Configuration
# ===============================================

# List of AWS regions where team can invoke Bedrock models
# Add/remove regions based on your compliance and latency requirements
allowed_bedrock_regions = [
  "us-east-1",
  "us-west-2"
]

# ===============================================
# Monitoring Configuration
# ===============================================

enable_monitoring  = true
log_retention_days = 30

# ===============================================
# Additional Tags
# ===============================================

tags = {
  Team       = "media-lab"
  CostCenter = "engineering"
  Owner      = "devops-team"
  Compliance = "internal"
}
