data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  # Scope Bedrock access to the configured model instead of "*".
  # Cross-region inference profile IDs (e.g. "global.anthropic.claude-...") need BOTH the
  # inference-profile ARN and the underlying foundation-model ARN (any region).
  profile_prefix_re    = "^(global|us|eu|apac|us-gov|jp|au)\\."
  is_inference_profile = can(regex(local.profile_prefix_re, var.bedrock_model_id))
  base_model_id        = replace(var.bedrock_model_id, "/${local.profile_prefix_re}/", "")

  scoped_model_arns = concat(
    local.is_inference_profile ? [
      "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.bedrock_model_id}",
    ] : [],
    ["arn:aws:bedrock:*::foundation-model/${local.base_model_id}"],
  )

  # Explicit bedrock_model_arns (including ["*"]) wins; empty means auto-scope.
  effective_model_arns = length(var.bedrock_model_arns) > 0 ? var.bedrock_model_arns : local.scoped_model_arns
}

# Chat completion backend: Lambda -> Amazon Bedrock, behind an IAM-authenticated
# Function URL, with a scoped invoker user whose key ships with the game.
# Replaces the EC2 "moot-api" OpenAI chat proxy.
module "chat_backend" {
  source = "../../../modules/bedrock-chat-backend"

  name_prefix      = local.name_prefix
  source_path      = "${path.module}/lambda/chat-backend"
  bedrock_model_id = var.bedrock_model_id

  bedrock_model_arns = local.effective_model_arns
  memory_mb          = var.lambda_memory_mb

  # Abuse limits: concurrency cap, usage alarms, and server-side request caps.
  reserved_concurrency        = var.reserved_concurrency
  alarm_email                 = var.alarm_email
  invocations_alarm_threshold = var.invocations_alarm_threshold
  max_tokens_ceiling          = var.max_tokens_ceiling
  max_messages                = var.max_messages
  max_input_chars             = var.max_input_chars
  timeout_seconds             = var.lambda_timeout_seconds

  # BUFFERED matches the game's single-reply OnMessage contract.
  invoke_mode = "BUFFERED"

  # Bedrock Guardrail: content filtering + prompt-attack detection, applied
  # server-side on every Converse call. Invisible to the game client.
  enable_guardrail = var.enable_guardrail

  # Public Function URL (NONE auth) gated by a shared secret the handler checks.
  # IAM-user SigV4 auth proved unreliable for the scoped invoker on this account, so
  # the game sends the secret in the x-chat-secret header instead of signing.
  auth_type           = "NONE"
  shared_secret       = var.chat_shared_secret
  create_invoker_user = false

  tags = var.tags
}
