locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

# Single-table design: capture and hotspot items share hash key "Id"; EntityType discriminates.
module "garden_table" {
  source = "../../../modules/dynamodb-table"

  name_prefix       = local.name_prefix
  table_name_suffix = "garden"
  hash_key          = "Id"
}

module "cognito" {
  source = "../../../modules/cognito-user-pool"

  name_prefix             = local.name_prefix
  callback_urls           = var.cognito_callback_urls
  logout_urls             = var.cognito_logout_urls
  hosted_ui_domain_prefix = var.cognito_hosted_ui_domain_prefix
}

module "api" {
  source = "../../../modules/lambda-http-api"

  name_prefix     = local.name_prefix
  source_path     = "${path.module}/lambda"
  handler         = "handler.handler"
  runtime         = "nodejs20.x"
  memory_mb       = 256
  timeout_seconds = 30

  environment_variables = {
    GARDEN_TABLE_NAME   = module.garden_table.table_name
    PUBLIC_CAPTURE_IDS  = var.public_capture_ids
    CORS_ALLOW_ORIGINS  = join(",", var.cors_allow_origins)
  }

  dynamodb_table_arns = [module.garden_table.table_arn]

  cognito_jwt_issuer = module.cognito.jwt_issuer
  cognito_audiences  = [module.cognito.user_pool_client_id]

  cors_allow_origins = var.cors_allow_origins

  http_routes = [
    { method = "GET", path = "/captures", authorization_type = "NONE" },
    { method = "GET", path = "/captures/{id}", authorization_type = "NONE" },
    { method = "GET", path = "/hotspots", authorization_type = "NONE" },

    { method = "GET", path = "/admin/api/captures", authorization_type = "JWT" },
    { method = "POST", path = "/admin/api/captures", authorization_type = "JWT" },
    { method = "PUT", path = "/admin/api/captures", authorization_type = "JWT" },
    { method = "DELETE", path = "/admin/api/captures", authorization_type = "JWT" },

    { method = "GET", path = "/admin/api/hotspots", authorization_type = "JWT" },
    { method = "POST", path = "/admin/api/hotspots", authorization_type = "JWT" },
    { method = "PUT", path = "/admin/api/hotspots", authorization_type = "JWT" },
    { method = "DELETE", path = "/admin/api/hotspots", authorization_type = "JWT" },
  ]
}

module "assets" {
  count  = var.enable_assets_bucket ? 1 : 0
  source = "../../../modules/s3-assets-bucket"

  name_prefix          = local.name_prefix
  cors_allowed_origins = var.cors_allow_origins
  enable_cdn           = var.enable_assets_cdn
  enable_public_read   = var.assets_enable_public_read
}

# Viewer app (apps/viewer/dist).
module "viewer_site" {
  count  = var.enable_viewer_site ? 1 : 0
  source = "../../../modules/s3-static-site"

  name_prefix          = local.name_prefix
  bucket_name_suffix   = "site"
  spa_routing          = true
  cors_allowed_origins = var.cors_allow_origins
}

# Admin app (apps/admin/dist). Cognito callback/logout URLs should use admin_site_url.
module "admin_site" {
  count  = var.enable_admin_site ? 1 : 0
  source = "../../../modules/s3-static-site"

  name_prefix          = local.name_prefix
  bucket_name_suffix   = "admin"
  spa_routing          = true
  cors_allowed_origins = var.cors_allow_origins
}
