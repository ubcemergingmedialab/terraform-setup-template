locals {
  name_prefix                 = "${var.client_name}-${var.project_name}-${var.environment}"
  knowledgebase_source_bucket = "${local.name_prefix}-knowledgebase-${random_id.knowledgebase_source_bucket_suffix.hex}"
}

data "aws_caller_identity" "current" {}

module "cognito" {
  source = "../../../modules/episode-cognito-user-pool"

  name_prefix             = local.name_prefix
  callback_urls           = var.cognito_callback_urls
  logout_urls             = var.cognito_logout_urls
  hosted_ui_domain_prefix = var.cognito_hosted_ui_domain_prefix
  password_minimum_length = var.cognito_password_minimum_length
}

module "episode_network" {
  count  = var.enable_episode_database ? 1 : 0
  source = "../../../modules/private-database-vpc"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.database_vpc_cidr
  availability_zones   = var.database_availability_zones
  private_subnet_cidrs = var.database_private_subnet_cidrs
}

# ------------------------------------------------------------------------------
# S3 source bucket
#
# Existing: episode-knowledgebase
# Current:  ${local.name_prefix}-knowledgebase-<random hex>
# ------------------------------------------------------------------------------

resource "random_id" "knowledgebase_source_bucket_suffix" {
  byte_length = 3
}

resource "aws_s3_bucket" "knowledgebase_source" {
  bucket = local.knowledgebase_source_bucket
}

resource "aws_s3_bucket_ownership_controls" "knowledgebase_source" {
  bucket = aws_s3_bucket.knowledgebase_source.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "knowledgebase_source" {
  bucket = aws_s3_bucket.knowledgebase_source.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "knowledgebase_source" {
  bucket = aws_s3_bucket.knowledgebase_source.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# S3 Vector bucket + index
#
# Existing vector bucket: bedrock-knowledge-base-dd87wu
# Existing index:         bedrock-knowledge-base-default-index
# Dev vector bucket:      ${local.name_prefix}-knowledge-base
# ------------------------------------------------------------------------------

resource "aws_s3vectors_vector_bucket" "knowledge_base" {
  vector_bucket_name = "${local.name_prefix}-knowledge-base"
}

resource "aws_s3vectors_index" "knowledge_base_default" {
  vector_bucket_name = aws_s3vectors_vector_bucket.knowledge_base.vector_bucket_name

  index_name      = "bedrock-knowledge-base-default-index"
  data_type       = "float32"
  dimension       = 1024
  distance_metric = "euclidean"

  metadata_configuration {
    non_filterable_metadata_keys = [
      "AMAZON_BEDROCK_TEXT",
      "AMAZON_BEDROCK_METADATA"
    ]
  }
}

# ------------------------------------------------------------------------------
# Bedrock Knowledge Base IAM role
#
# Existing role: service-role/AmazonBedrockExecutionRoleForKnowledgeBase_jyju8
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "bedrock_kb_assume_role" {
  statement {
    sid     = "AmazonBedrockKnowledgeBaseTrustPolicy"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values = [
        "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:knowledge-base/*"
      ]
    }
  }
}

resource "aws_iam_role" "bedrock_kb" {
  name               = "${local.name_prefix}-bedrock-kb-role"
  path               = "/service-role/"
  description        = "Bedrock Knowledge Base access role"
  assume_role_policy = data.aws_iam_policy_document.bedrock_kb_assume_role.json
}

data "aws_iam_policy_document" "bedrock_model" {
  statement {
    sid    = "BedrockInvokeModelStatement"
    effect = "Allow"

    actions = [
      "bedrock:InvokeModel"
    ]

    resources = [
      "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
    ]
  }

  statement {
    sid    = "MarketplaceOperationsFromBedrockFor3pModels"
    effect = "Allow"

    actions = [
      "aws-marketplace:Subscribe",
      "aws-marketplace:ViewSubscriptions",
      "aws-marketplace:Unsubscribe"
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:CalledViaLast"
      values   = ["bedrock.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "bedrock_model" {
  name   = "${local.name_prefix}-bedrock-foundation-model-policy"
  path   = "/service-role/"
  policy = data.aws_iam_policy_document.bedrock_model.json
}

resource "aws_iam_role_policy_attachment" "bedrock_model" {
  role       = aws_iam_role.bedrock_kb.name
  policy_arn = aws_iam_policy.bedrock_model.arn
}

data "aws_iam_policy_document" "bedrock_s3_source" {
  statement {
    sid    = "S3ListBucketStatement"
    effect = "Allow"

    actions = [
      "s3:ListBucket"
    ]

    resources = [
      aws_s3_bucket.knowledgebase_source.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }

  statement {
    sid    = "S3GetObjectStatement"
    effect = "Allow"

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.knowledgebase_source.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_policy" "bedrock_s3_source" {
  name   = "${local.name_prefix}-bedrock-s3-source-policy"
  path   = "/service-role/"
  policy = data.aws_iam_policy_document.bedrock_s3_source.json
}

resource "aws_iam_role_policy_attachment" "bedrock_s3_source" {
  role       = aws_iam_role.bedrock_kb.name
  policy_arn = aws_iam_policy.bedrock_s3_source.arn
}

data "aws_iam_policy_document" "bedrock_s3_vectors" {
  statement {
    sid    = "S3VectorsPermissions"
    effect = "Allow"

    actions = [
      "s3vectors:GetIndex",
      "s3vectors:QueryVectors",
      "s3vectors:PutVectors",
      "s3vectors:GetVectors",
      "s3vectors:DeleteVectors"
    ]

    resources = [
      aws_s3vectors_index.knowledge_base_default.index_arn
    ]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_policy" "bedrock_s3_vectors" {
  name   = "${local.name_prefix}-bedrock-s3-vector-store-policy"
  path   = "/service-role/"
  policy = data.aws_iam_policy_document.bedrock_s3_vectors.json
}

resource "aws_iam_role_policy_attachment" "bedrock_s3_vectors" {
  role       = aws_iam_role.bedrock_kb.name
  policy_arn = aws_iam_policy.bedrock_s3_vectors.arn
}

# ------------------------------------------------------------------------------
# Bedrock Knowledge Base + Data Source
#
# Existing KB:          episode-knowledge-base
# Existing data source: knowledge-base-quick-start-y4gyt-data-source
# ------------------------------------------------------------------------------

resource "aws_bedrockagent_knowledge_base" "episode" {
  name     = "${local.name_prefix}-knowledge-base"
  role_arn = aws_iam_role.bedrock_kb.arn

  knowledge_base_configuration {
    type = "VECTOR"

    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"

      embedding_model_configuration {
        bedrock_embedding_model_configuration {
          embedding_data_type = "FLOAT32"
        }
      }
    }
  }

  storage_configuration {
    type = "S3_VECTORS"

    s3_vectors_configuration {
      index_arn = aws_s3vectors_index.knowledge_base_default.index_arn
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.bedrock_model,
    aws_iam_role_policy_attachment.bedrock_s3_source,
    aws_iam_role_policy_attachment.bedrock_s3_vectors
  ]
}

resource "aws_bedrockagent_data_source" "episode_s3" {
  knowledge_base_id    = aws_bedrockagent_knowledge_base.episode.id
  name                 = "${local.name_prefix}-s3-data-source"
  data_deletion_policy = "DELETE"

  data_source_configuration {
    type = "S3"

    s3_configuration {
      bucket_arn = aws_s3_bucket.knowledgebase_source.arn
    }
  }
}

# ------------------------------------------------------------------------------
# Bedrock Guardrail
#
# Existing: EPISODE-guardrail
# Existing Lambda env uses BEDROCK_GUARDRAIL_VERSION = DRAFT
# ------------------------------------------------------------------------------

resource "aws_bedrock_guardrail" "episode" {
  name                      = "${local.name_prefix}-guardrail"
  blocked_input_messaging   = "Sorry, the model cannot answer this question."
  blocked_outputs_messaging = "Sorry, the model cannot answer this question."

  content_policy_config {
    filters_config {
      type            = "VIOLENCE"
      input_strength  = "HIGH"
      output_strength = "HIGH"
      input_action    = "NONE"
      output_action   = "NONE"
      input_enabled   = true
      output_enabled  = true
    }

    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
      input_action    = "NONE"
      input_enabled   = true
    }

    filters_config {
      type            = "MISCONDUCT"
      input_strength  = "HIGH"
      output_strength = "HIGH"
      input_action    = "NONE"
      output_action   = "NONE"
      input_enabled   = true
      output_enabled  = true
    }

    filters_config {
      type            = "HATE"
      input_strength  = "HIGH"
      output_strength = "HIGH"
      input_action    = "NONE"
      output_action   = "NONE"
      input_enabled   = true
      output_enabled  = true
    }

    filters_config {
      type            = "SEXUAL"
      input_strength  = "HIGH"
      output_strength = "HIGH"
      input_action    = "NONE"
      output_action   = "NONE"
      input_enabled   = true
      output_enabled  = true
    }

    filters_config {
      type            = "INSULTS"
      input_strength  = "HIGH"
      output_strength = "HIGH"
      input_action    = "NONE"
      output_action   = "NONE"
      input_enabled   = true
      output_enabled  = true
    }
  }
}

# Optional: create an immutable guardrail version later.
# The existing Lambda uses DRAFT, so this is intentionally not wired into env vars.
#
# resource "aws_bedrock_guardrail_version" "episode" {
#   guardrail_arn = aws_bedrock_guardrail.episode.guardrail_arn
#   description   = "Initial dev guardrail version"
# }

# ------------------------------------------------------------------------------
# Chat Backend Lambda
#
# Existing function: episode-chat-backend
# Runtime:           nodejs24.x
# Handler:           index.handler
# Timeout:           30
# Memory:            128
# Architecture:      x86_64
# Function URL:      Auth NONE, POST, content-type, RESPONSE_STREAM
# ------------------------------------------------------------------------------

data "archive_file" "chat_backend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/${var.chat_lambda_source_dir}"
  output_path = "${path.module}/build/chat-backend.zip"
}

data "aws_iam_policy_document" "chat_lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "chat_lambda" {
  name               = "${local.name_prefix}-chat-backend-role"
  path               = "/service-role/"
  assume_role_policy = data.aws_iam_policy_document.chat_lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "chat_lambda_basic_execution" {
  role       = aws_iam_role.chat_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "chat_lambda_bedrock" {
  statement {
    sid    = "BedrockModelAccess"
    effect = "Allow"

    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:ApplyGuardrail"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "BedrockKnowledgeBaseAccess"
    effect = "Allow"

    actions = [
      "bedrock:Retrieve",
      "bedrock:RetrieveAndGenerate"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "chat_lambda_bedrock" {
  name   = "${local.name_prefix}-chat-backend-bedrock-policy"
  policy = data.aws_iam_policy_document.chat_lambda_bedrock.json
}

resource "aws_iam_role_policy_attachment" "chat_lambda_bedrock" {
  role       = aws_iam_role.chat_lambda.name
  policy_arn = aws_iam_policy.chat_lambda_bedrock.arn
}

resource "aws_lambda_function" "chat_backend" {
  function_name = "${local.name_prefix}-chat-backend"
  role          = aws_iam_role.chat_lambda.arn

  filename         = data.archive_file.chat_backend_zip.output_path
  source_code_hash = data.archive_file.chat_backend_zip.output_base64sha256

  runtime       = "nodejs24.x"
  handler       = "handler.handler"
  timeout       = 30
  memory_size   = 128
  architectures = ["x86_64"]
  package_type  = "Zip"

  environment {
    variables = {
      BEDROCK_GUARDRAIL_VERSION = "DRAFT"
      BEDROCK_KB_ID             = aws_bedrockagent_knowledge_base.episode.id
      BEDROCK_GUARDRAIL_ID      = aws_bedrock_guardrail.episode.guardrail_id
      BEDROCK_MODEL_ID          = var.bedrock_model_id
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.chat_lambda_basic_execution,
    aws_iam_role_policy_attachment.chat_lambda_bedrock
  ]
}

resource "aws_lambda_function_url" "chat_backend" {
  function_name      = aws_lambda_function.chat_backend.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = ["*"]
    expose_headers    = []
  }
}

resource "aws_lambda_permission" "chat_backend_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.chat_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# ------------------------------------------------------------------------------
# Polly Lambda
#
# Existing function: episode-polly
# Runtime:           nodejs24.x
# Handler:           index.handler
# Timeout:           3
# Memory:            128
# Architecture:      x86_64
# Function URL:      Auth NONE, POST, content-type, BUFFERED
# ------------------------------------------------------------------------------

data "archive_file" "polly_zip" {
  type        = "zip"
  source_dir  = "${path.module}/${var.polly_lambda_source_dir}"
  output_path = "${path.module}/build/polly.zip"
}

data "aws_iam_policy_document" "polly_lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "polly_lambda" {
  name               = "${local.name_prefix}-polly-role"
  assume_role_policy = data.aws_iam_policy_document.polly_lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "polly_lambda_basic_execution" {
  role       = aws_iam_role.polly_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "polly_lambda_synthesize" {
  statement {
    effect = "Allow"

    actions = [
      "polly:SynthesizeSpeech"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "polly_lambda_synthesize" {
  name   = "${local.name_prefix}-polly-synthesize-policy"
  policy = data.aws_iam_policy_document.polly_lambda_synthesize.json
}

resource "aws_iam_role_policy_attachment" "polly_lambda_synthesize" {
  role       = aws_iam_role.polly_lambda.name
  policy_arn = aws_iam_policy.polly_lambda_synthesize.arn
}

resource "aws_lambda_function" "polly" {
  function_name = "${local.name_prefix}-polly"
  role          = aws_iam_role.polly_lambda.arn

  filename         = data.archive_file.polly_zip.output_path
  source_code_hash = data.archive_file.polly_zip.output_base64sha256

  runtime       = "nodejs24.x"
  handler       = "index.handler"
  timeout       = 3
  memory_size   = 128
  architectures = ["x86_64"]
  package_type  = "Zip"

  depends_on = [
    aws_iam_role_policy_attachment.polly_lambda_basic_execution,
    aws_iam_role_policy_attachment.polly_lambda_synthesize
  ]
}

resource "aws_lambda_function_url" "polly" {
  function_name      = aws_lambda_function.polly.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = ["*"]
    expose_headers    = []
  }
}

resource "aws_lambda_permission" "polly_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.polly.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# ------------------------------------------------------------------------------
# Cognito Identity Pool for Transcribe Streaming
#
# Existing: episode-transcribe-identity-pool
# Allows unauthenticated identities
# Existing unauth role policy allows:
#   transcribe:StartStreamTranscription
#   transcribe:StartStreamTranscriptionWebSocket
# ------------------------------------------------------------------------------

resource "aws_cognito_identity_pool" "transcribe" {
  identity_pool_name               = "${local.name_prefix}-transcribe-identity-pool"
  allow_unauthenticated_identities = true
  allow_classic_flow               = false
}

data "aws_iam_policy_document" "cognito_unauth_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.transcribe.id]
    }

    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["unauthenticated"]
    }
  }
}

resource "aws_iam_role" "cognito_unauth" {
  name               = "${local.name_prefix}-transcribe-unauth-role"
  path               = "/service-role/"
  assume_role_policy = data.aws_iam_policy_document.cognito_unauth_assume_role.json
}

data "aws_iam_policy_document" "cognito_transcribe_streaming" {
  statement {
    sid    = "AllowTranscribeStreaming"
    effect = "Allow"

    actions = [
      "transcribe:StartStreamTranscription",
      "transcribe:StartStreamTranscriptionWebSocket"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_policy" "cognito_transcribe_streaming" {
  name   = "${local.name_prefix}-transcribe-streaming-policy"
  policy = data.aws_iam_policy_document.cognito_transcribe_streaming.json
}

resource "aws_iam_role_policy_attachment" "cognito_transcribe_streaming" {
  role       = aws_iam_role.cognito_unauth.name
  policy_arn = aws_iam_policy.cognito_transcribe_streaming.arn
}

resource "aws_cognito_identity_pool_roles_attachment" "transcribe" {
  identity_pool_id = aws_cognito_identity_pool.transcribe.id

  roles = {
    unauthenticated = aws_iam_role.cognito_unauth.arn
  }
}

# Viewer app (apps/viewer/dist). Keeps bucket suffix "site" for existing prod bucket/state.
module "viewer_site" {
  count  = var.enable_viewer_site ? 1 : 0
  source = "../../../modules/s3-static-site"

  name_prefix          = local.name_prefix
  bucket_name_suffix   = "site"
  spa_routing          = true
  cors_allowed_origins = var.cors_allow_origins
}

module "episode_database" {
  count  = var.enable_episode_database ? 1 : 0
  source = "../../../modules/aurora-serverless-postgres"

  name_prefix         = local.name_prefix
  vpc_id              = module.episode_network[0].vpc_id
  private_subnet_ids  = module.episode_network[0].private_subnet_id_list
  database_name       = var.database_name
  engine_version      = var.database_engine_version
  min_capacity        = var.database_min_capacity
  max_capacity        = var.database_max_capacity
  deletion_protection = var.database_deletion_protection
}

# The public and instructor handlers share one API Gateway surface. Route-level
# authorization keeps learner endpoints open while Cognito protects instructor
# endpoints.
module "episode_api" {
  count  = var.enable_episode_database ? 1 : 0
  source = "../../../modules/episode-lambda-http-api"

  name_prefix = "${local.name_prefix}-episode"

  functions = {
    public = {
      source_path     = "${path.module}/${var.database_api_source_dir}"
      handler         = "public.handler"
      runtime         = "nodejs24.x"
      memory_mb       = 256
      timeout_seconds = 30
      environment_variables = {
        DATABASE_CLUSTER_ARN = module.episode_database[0].cluster_arn
        DATABASE_SECRET_ARN  = module.episode_database[0].secret_arn
        DATABASE_NAME        = module.episode_database[0].database_name
        COGNITO_CLIENT_ID    = module.cognito.user_pool_client_id
        APP_BASE_URL         = trimsuffix(var.app_base_url, "/")
      }
    }
    authenticated = {
      source_path     = "${path.module}/${var.database_api_source_dir}"
      handler         = "authenticated.handler"
      runtime         = "nodejs24.x"
      memory_mb       = 256
      timeout_seconds = 30
      environment_variables = {
        DATABASE_CLUSTER_ARN = module.episode_database[0].cluster_arn
        DATABASE_SECRET_ARN  = module.episode_database[0].secret_arn
        DATABASE_NAME        = module.episode_database[0].database_name
        APP_BASE_URL         = trimsuffix(var.app_base_url, "/")
      }
    }
  }

  aurora_cluster_arns        = [module.episode_database[0].cluster_arn]
  aurora_secret_arns         = [module.episode_database[0].secret_arn]
  aurora_secret_kms_key_arns = [module.episode_database[0].secret_kms_key_arn]
  cognito_user_pool_arns     = [module.cognito.user_pool_arn]
  cognito_function_names     = ["public"]
  cognito_jwt_issuer         = module.cognito.jwt_issuer
  cognito_audiences          = [module.cognito.user_pool_client_id]
  cors_allow_origins         = var.cors_allow_origins
  throttling_rate_limit      = var.api_throttling_rate_limit
  throttling_burst_limit     = var.api_throttling_burst_limit

  http_routes = [
    { method = "POST", path = "/auth/login", function_name = "public", authorization_type = "NONE" },
    { method = "POST", path = "/auth/forgot-password", function_name = "public", authorization_type = "NONE" },
    { method = "POST", path = "/auth/confirm-password", function_name = "public", authorization_type = "NONE" },
    { method = "GET", path = "/scenarios/{linkToken}", function_name = "public", authorization_type = "NONE" },
    { method = "POST", path = "/attempts", function_name = "public", authorization_type = "NONE" },
    { method = "GET", path = "/instructor/scenarios", function_name = "authenticated", authorization_type = "JWT" },
    { method = "POST", path = "/instructor/scenarios", function_name = "authenticated", authorization_type = "JWT" },
    { method = "PATCH", path = "/instructor/scenarios/{id}", function_name = "authenticated", authorization_type = "JWT" },
    { method = "POST", path = "/instructor/scenario-links", function_name = "authenticated", authorization_type = "JWT" },
    { method = "POST", path = "/instructor/scenario-links/{id}/revoke", function_name = "authenticated", authorization_type = "JWT" },
    { method = "GET", path = "/instructor/scenario-links/{id}/analytics", function_name = "authenticated", authorization_type = "JWT" },
    { method = "GET", path = "/instructor/scenarios/{id}/analytics", function_name = "authenticated", authorization_type = "JWT" },
  ]
}