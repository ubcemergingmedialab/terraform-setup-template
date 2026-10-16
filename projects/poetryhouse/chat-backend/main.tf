locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

# Chat completion backend: Lambda -> Amazon Bedrock, behind an IAM-authenticated
# Function URL, with a scoped invoker user whose key ships with the game.
# Replaces the EC2 "moot-api" OpenAI chat proxy.
module "chat_backend" {
  source = "../../../modules/bedrock-chat-backend"

  name_prefix      = local.name_prefix
  source_path      = "${path.module}/lambda/chat-backend"
  bedrock_model_id = var.bedrock_model_id

  bedrock_model_arns = var.bedrock_model_arns
  memory_mb          = var.lambda_memory_mb
  timeout_seconds    = var.lambda_timeout_seconds

  # BUFFERED matches the game's single-reply OnMessage contract.
  invoke_mode = "BUFFERED"

  # Public Function URL (NONE auth) gated by a shared secret the handler checks.
  # IAM-user SigV4 auth proved unreliable for the scoped invoker on this account, so
  # the game sends the secret in the x-chat-secret header instead of signing.
  auth_type           = "NONE"
  shared_secret       = var.chat_shared_secret
  create_invoker_user = false

  tags = var.tags
}
