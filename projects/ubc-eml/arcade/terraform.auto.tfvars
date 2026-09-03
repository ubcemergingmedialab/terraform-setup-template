client_name  = "ubc-eml"
project_name = "arcade"
environment  = "prod"
aws_region   = "ca-central-1"

tags = {
  Owner   = "emerging-media-lab"
  Project = "ARcade"
  Repo    = "26--1001-ARcade"
}

# --- Legacy names -------------------------------------------------------------
#
# ARCADE predates Terraform and is serving production. These are the resources
# that exist in account 940309384764 today; the config imports them rather than
# creating anything. Do not "correct" these toward the
# ${client}-${project}-${environment}-* convention — an S3 bucket cannot be
# renamed, so a changed name here destroys the live bucket and everything in it.

legacy_bucket_name      = "eml-arcade-storage"
legacy_lambda_name      = "eml-arcade-api"
legacy_lambda_role_name = "eml-arcade-lambda-exec"

# --- Storage ------------------------------------------------------------------

# Every origin the studio is loaded from. A branch preview gets its own Amplify
# subdomain and must be added here before uploads work from it — otherwise
# images silently come back blank, with no error mentioning CORS.
cors_allowed_origins = [
  "https://arcade.ubc-dxl.ca",
  "https://main.d114nr20m4npww.amplifyapp.com",
  "https://feat-arcade-storage-b.d114nr20m4npww.amplifyapp.com",
]

# public_read_prefixes, cors_allowed_headers, versioning and the lifecycle
# windows all match production at their defaults — see variables.tf.

# --- API ----------------------------------------------------------------------

story_public_base_url = "https://eml-arcade-storage.s3.ca-central-1.amazonaws.com"

# studio_publish_secret is INTENTIONALLY ABSENT.
#
# This file is committed. The secret lives as a sensitive variable on the HCP
# workspace `ubc-eml-arcade`. A plan run without it set fails fast with an
# explicit message rather than quietly blanking the live value.
