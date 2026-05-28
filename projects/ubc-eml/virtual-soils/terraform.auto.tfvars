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
legacy_assets_bucket_name  = "eml-soils-db"

# Match Cognito app client settings (add Amplify preview URLs as needed).
cognito_callback_urls = [
  "http://localhost:5173/admin",
  "https://main.d18omgvnlk8eo.amplifyapp.com/admin",
]

cognito_logout_urls = [
  "http://localhost:5173/",
  "https://main.d18omgvnlk8eo.amplifyapp.com/",
]

# Existing pool uses domain prefix derived from pool id (see auth.ts). Set only when importing.
# cognito_hosted_ui_domain_prefix = "ca-central-1vnlgrfo8k"

cors_allow_origins = [
  "http://localhost:5173",
  "https://main.d18omgvnlk8eo.amplifyapp.com",
]

pins_field_ids = "TestA,TestB,TestC"

# Prefer Cognito-only admin + public /pins without browser IAM keys when possible.
create_iam_api_invoker = false

enable_assets_bucket = true
enable_static_site   = true
