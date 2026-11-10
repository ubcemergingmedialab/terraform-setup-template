locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  # The deployed SPA origin. Cognito callback/logout URLs and the token API CORS
  # all key off this. The site module computes it without referencing Cognito, so
  # there is no dependency cycle.
  site_url = module.site.site_url

  callback_urls = concat([local.site_url], var.extra_callback_urls)
  logout_urls   = concat([local.site_url], var.extra_logout_urls)
}

# ---------------------------------------------------------------------------
# Secrets Manager: external SaaS credentials. Values are set in the HCP workspace
# as sensitive variables and written here; they never land in git or in the ECS
# task definition (ECS resolves them at task start via the execution role).
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "livekit" {
  name        = "${local.name_prefix}-livekit"
  description = "LiveKit API key/secret for the MootCourt agent and token service."
}

resource "aws_secretsmanager_secret_version" "livekit" {
  secret_id = aws_secretsmanager_secret.livekit.id
  secret_string = jsonencode({
    LIVEKIT_API_KEY    = var.livekit_api_key
    LIVEKIT_API_SECRET = var.livekit_api_secret
  })
}

resource "aws_secretsmanager_secret" "simli" {
  name        = "${local.name_prefix}-simli"
  description = "Simli API key for the MootCourt token service (/simli-token proxy)."
}

resource "aws_secretsmanager_secret_version" "simli" {
  secret_id     = aws_secretsmanager_secret.simli.id
  secret_string = var.simli_api_key
}

# ---------------------------------------------------------------------------
# Cognito: locked-down pool (admin-created users only), one approved group, one
# seeded user. This is the login gate for the whole app.
# ---------------------------------------------------------------------------
module "auth" {
  source = "../../../modules/cognito-user-pool"

  name_prefix = local.name_prefix

  callback_urls = local.callback_urls
  logout_urls   = local.logout_urls

  allow_self_signup      = false
  user_group_name        = "approved"
  user_group_description = "The single approved MootCourt user."
  seed_user_email        = var.admin_email
}

# ---------------------------------------------------------------------------
# Static site: the courtroom React SPA, private S3 + CloudFront (OAC).
# Build/sync of dist/ is a post-apply step (see README), not Terraform.
# ---------------------------------------------------------------------------
module "site" {
  source = "../../../modules/s3-static-site"

  name_prefix = local.name_prefix
  spa_routing = true
}

# ---------------------------------------------------------------------------
# Single-session lock. One DynamoDB item (pk = room name) written conditionally
# so only one live moot session can hold the lock at a time. TTL is a safety net;
# the LiveKit webhook (room_finished / participant left) releases it promptly.
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "session_lock" {
  name         = "${local.name_prefix}-session-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "room"

  attribute {
    name = "room"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ---------------------------------------------------------------------------
# Token service (Node Lambda behind API Gateway HTTP API).
#   GET  /token         (JWT-authorized) -> mint LiveKit join token, but only if
#                        the single-session lock can be acquired; else 409.
#   POST /simli-token   (JWT-authorized) -> proxy Simli /compose/token.
#   POST /livekit-webhook (public)       -> LiveKit calls this on room/participant
#                        lifecycle events; releases the lock. Verified via the
#                        LiveKit webhook signature, so it needs no JWT.
# ---------------------------------------------------------------------------
module "token_api" {
  source = "../../../modules/lambda-http-api"

  name_prefix = local.name_prefix
  # Zip the committed esbuild bundle (dist/handler.mjs), not the source dir. HCP
  # plans from a git checkout with no node_modules, so livekit-server-sdk has to
  # be bundled in. Rebuild with `npm run build` in lambda/token-service after any
  # change to handler.mjs, and commit dist/.
  source_path = "${path.module}/lambda/token-service/dist"

  runtime = "nodejs20.x"
  handler = "handler.handler"

  memory_mb       = 256
  timeout_seconds = 15

  http_routes = [
    { method = "GET", path = "/token", authorization_type = "JWT" },
    { method = "POST", path = "/simli-token", authorization_type = "JWT" },
    { method = "POST", path = "/livekit-webhook", authorization_type = "NONE" },
  ]

  cognito_jwt_issuer = module.auth.jwt_issuer
  cognito_audiences  = [module.auth.user_pool_client_id]

  # The browser sends the Cognito access token as a bearer; allow its origin.
  cors_allow_origins = local.callback_urls
  cors_allow_headers = ["authorization", "content-type"]
  cors_allow_methods = ["GET", "POST", "OPTIONS"]

  environment_variables = {
    LIVEKIT_URL         = var.livekit_url
    LIVEKIT_SECRET_ARN  = aws_secretsmanager_secret.livekit.arn
    SIMLI_SECRET_ARN    = aws_secretsmanager_secret.simli.arn
    SESSION_LOCK_TABLE  = aws_dynamodb_table.session_lock.name
    MOOT_ROOM_NAME      = var.moot_room_name
    SESSION_TTL_SECONDS = "900" # 15 min safety-net TTL on the lock
  }
}

# Grant the token Lambda read access to the two secrets and read/write on the
# lock table. The lambda-http-api module manages the role; we attach here.
resource "aws_iam_role_policy" "token_api_permissions" {
  name = "${local.name_prefix}-token-api-permissions"
  role = module.token_api.function_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.livekit.arn, aws_secretsmanager_secret.simli.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = [aws_dynamodb_table.session_lock.arn]
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# Agent worker (ECS Fargate). Long-lived; holds WebRTC media and runs the full
# AWS pipeline (Transcribe STT -> Bedrock LLM -> Polly TTS) via the task role.
# LiveKit creds come from Secrets Manager; no Azure, no static AWS keys.
# ---------------------------------------------------------------------------
module "agent_repo" {
  source = "../../../modules/ecr-repository"

  repository_name      = "${local.name_prefix}-agent"
  scan_on_push         = true
  lifecycle_keep_count = 10
}

# Default VPC + subnets (same approach as nurse-practitioner/transcribe-proxy).
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "map-public-ip-on-launch"
    values = ["false"]
  }
}

locals {
  private_subnet_ids = length(data.aws_subnets.private.ids) > 0 ? data.aws_subnets.private.ids : data.aws_subnets.public.ids
}

module "agent" {
  source = "../../../modules/ecs-fargate-service"

  name_prefix     = local.name_prefix
  container_image = "${module.agent_repo.repository_url}:${var.agent_image_tag}"

  # The agent is a LiveKit worker, not an HTTP server. It exposes a lightweight
  # health endpoint so the ALB target can report healthy; the real work is the
  # outbound WebRTC worker connection to LiveKit Cloud. The health server listens
  # on the container port itself, so health_check_port stays null (the module then
  # uses traffic-port). Setting both to the same value maps the port twice, which
  # ECS rejects.
  container_port    = 8081
  health_check_path = "/health"

  cpu       = var.agent_cpu
  memory_mb = var.agent_memory_mb

  # Exactly one always-on worker. The app allows only one live session, so there
  # is no need to scale out, but the worker must stay warm to accept dispatch.
  desired_count = 1

  environment_variables = {
    AWS_REGION           = var.aws_region
    LIVEKIT_URL          = var.livekit_url
    BEDROCK_MODEL_ID     = var.bedrock_model_id
    POLLY_VOICE          = var.polly_voice
    POLLY_ENGINE         = var.polly_engine
    MOOT_PLAYER_POSITION = var.moot_player_position
    HEALTH_PORT          = "8081"
  }

  # LiveKit key/secret injected from Secrets Manager (JSON keys map to env vars).
  secrets = {
    LIVEKIT_API_KEY    = "${aws_secretsmanager_secret.livekit.arn}:LIVEKIT_API_KEY::"
    LIVEKIT_API_SECRET = "${aws_secretsmanager_secret.livekit.arn}:LIVEKIT_API_SECRET::"
  }

  # Task-role permissions for the all-AWS pipeline.
  task_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "transcribe:StartStreamTranscription",
          "transcribe:StartStreamTranscriptionWebSocket",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = var.bedrock_model_arns
      },
      {
        Effect   = "Allow"
        Action   = ["polly:SynthesizeSpeech"]
        Resource = "*"
      },
    ]
  })

  vpc_id             = data.aws_vpc.default.id
  public_subnet_ids  = data.aws_subnets.public.ids
  private_subnet_ids = local.private_subnet_ids
  assign_public_ip   = true # Required to pull from ECR without a NAT gateway.

  enable_sticky_sessions = false # No browser traffic hits the ALB; only health checks.
  log_retention_days     = var.agent_log_retention_days
}
