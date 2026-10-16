client_name  = "ubc-eml"
project_name = "episode"
environment  = "prod"
aws_region   = "ca-central-1"

tags = {
  Owner   = "emerging-media-lab"
  Project = "episode"
  Repo    = "26---1001-EPISODE"
}

# Viewer site vars
enable_viewer_site = true

# Terraform-managed private VPC for Aurora.
enable_episode_database     = true
database_vpc_cidr           = "10.42.0.0/16"
database_availability_zones = ["ca-central-1a", "ca-central-1b"]
database_private_subnet_cidrs = [
  "10.42.1.0/24",
  "10.42.2.0/24",
]

# Cognito instructor login. The public site handles the callback and reveals
# the instructor-only panel after the user is authenticated.
cognito_callback_urls = [
  "http://localhost:5173/auth/callback",
  "https://oauth.pstmn.io/v1/browser-callback"
]

cognito_logout_urls = [
  "http://localhost:5173/"
]

# API CORS + assets bucket CORS: both viewer and admin CloudFront URLs (add admin URL after apply).
cors_allow_origins = [
  "http://localhost:5173"
]