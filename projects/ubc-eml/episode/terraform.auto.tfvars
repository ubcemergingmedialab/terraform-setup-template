client_name  = "ubc-eml"
project_name = "episode"
environment  = "prod"
aws_region   = "ca-central-1"

tags = {
  Owner    = "emerging-media-lab"
  Project  = "episode"
  Repo     = "26---1001-EPISODE"
}

# Viewer site vars
enable_viewer_site = true

# API CORS + assets bucket CORS: both viewer and admin CloudFront URLs (add admin URL after apply).
cors_allow_origins = [
  "http://localhost:5173"
]