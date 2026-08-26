client_name  = "cofood"
project_name = "garden-capture"
environment  = "prod"
aws_region   = "ca-central-1"

tags = {
  Owner   = "emerging-media-lab"
  Project = "garden-capture"
  Repo    = "GardenCapture"
  Client  = "cofood"
}

# Cognito: admin app only. Add admin_site_url after first apply with enable_admin_site.
cognito_callback_urls = [
  "http://localhost:5174/",
]

cognito_logout_urls = [
  "http://localhost:5174/",
]

# API CORS + assets bucket CORS: add viewer + admin CloudFront URLs after apply.
cors_allow_origins = [
  "http://localhost:5173",
  "http://localhost:5174",
]

public_capture_ids = "*"

enable_assets_bucket      = true
enable_assets_cdn         = true
assets_enable_public_read = true
enable_viewer_site        = true
enable_admin_site         = true
