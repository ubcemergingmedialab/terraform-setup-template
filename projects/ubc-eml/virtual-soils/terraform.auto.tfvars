client_name  = "ubc-eml"
project_name = "virtual-soils"
environment  = "prod"
aws_region   = "ca-central-1"

tags = {
  Owner    = "emerging-media-lab"
  Project  = "virtual-soils"
  Repo     = "25---1002-SOIL-SCIENCE"
}

# Set when importing existing AWS resources created before Terraform.
# After import, keep these values so Terraform does not rename resources.
legacy_dynamodb_table_name = "eml_fields"
# Splats / backups bucket (HCP output assets_bucket_name).
legacy_assets_bucket_name  = "ubc-eml-virtual-soils-prod-assets-078d04"

# Cognito: admin app only (add admin_site_url after first apply with enable_admin_site).
cognito_callback_urls = [
  "http://localhost:5174/",
  "https://d2npz8tam2i8fl.cloudfront.net",
]

cognito_logout_urls = [
  "http://localhost:5174/",
  "https://d2npz8tam2i8fl.cloudfront.net",
]

# Existing pool uses domain prefix derived from pool id (see auth.ts). Set only when importing.
# cognito_hosted_ui_domain_prefix = "ca-central-1vnlgrfo8k"

# API CORS + assets bucket CORS: both viewer and admin CloudFront URLs (add admin URL after apply).
cors_allow_origins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://d2npz8tam2i8fl.cloudfront.net",
]

pins_field_ids = "*"

# Prefer Cognito-only admin + public /pins without browser IAM keys when possible.
create_iam_api_invoker = false

enable_assets_bucket       = true
enable_assets_cdn          = true
assets_enable_public_read  = true
enable_viewer_site = true
enable_admin_site  = true
