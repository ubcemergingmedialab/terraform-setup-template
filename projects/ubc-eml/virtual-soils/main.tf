locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

module "fields_table" {
  source = "../../../modules/dynamodb-table"

  name_prefix         = local.name_prefix
  legacy_table_name   = var.legacy_dynamodb_table_name
  table_name_suffix   = "fields"
  hash_key            = "FieldID"
}

module "cognito" {
  source = "../../../modules/cognito-user-pool"

  name_prefix               = local.name_prefix
  callback_urls             = var.cognito_callback_urls
  logout_urls               = var.cognito_logout_urls
  hosted_ui_domain_prefix   = var.cognito_hosted_ui_domain_prefix
}

module "api" {
  source = "../../../modules/lambda-http-api"

  name_prefix    = local.name_prefix
  source_path    = "${path.module}/lambda"
  handler        = "handler.handler"
  runtime        = "nodejs20.x"
  memory_mb      = 256
  timeout_seconds = 30

  environment_variables = {
    FIELDS_TABLE_NAME = module.fields_table.table_name
    PINS_FIELD_IDS    = var.pins_field_ids
  }

  dynamodb_table_arns = [module.fields_table.table_arn]

  cognito_jwt_issuer  = module.cognito.jwt_issuer
  cognito_audiences   = [module.cognito.user_pool_client_id]

  cors_allow_origins = var.cors_allow_origins

  http_routes = [
    # Public for now — frontend uses unsigned fetch (see UBCMap.tsx). Use AWS_IAM with iam-api-invoker if signing.
    { method = "GET", path = "/pins", authorization_type = "NONE" },
    { method = "GET", path = "/fields", authorization_type = "NONE" },
    { method = "GET", path = "/fields/{id}", authorization_type = "NONE" },
    { method = "GET", path = "/admin/api/fields", authorization_type = "JWT" },
    { method = "POST", path = "/admin/api/fields", authorization_type = "JWT" },
    { method = "PUT", path = "/admin/api/fields", authorization_type = "JWT" },
    { method = "DELETE", path = "/admin/api/fields", authorization_type = "JWT" },
  ]
}

module "assets" {
  count  = var.enable_assets_bucket ? 1 : 0
  source = "../../../modules/s3-assets-bucket"

  name_prefix          = local.name_prefix
  legacy_bucket_name   = var.legacy_assets_bucket_name
  cors_allowed_origins = var.cors_allow_origins
}

data "aws_caller_identity" "current" {}

locals {
  api_id = module.api.api_id
  pins_invoke_arn = "arn:aws:execute-api:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${local.api_id}/$default/GET/pins"
}

module "api_invoker" {
  count  = var.create_iam_api_invoker ? 1 : 0
  source = "../../../modules/iam-api-invoker"

  name_prefix        = local.name_prefix
  api_execution_arn  = module.api.api_execution_arn
  allowed_route_arns = [local.pins_invoke_arn]
}

module "site" {
  count  = var.enable_static_site ? 1 : 0
  source = "../../../modules/s3-static-site"

  name_prefix          = local.name_prefix
  spa_routing          = true
  cors_allowed_origins = var.cors_allow_origins
}
