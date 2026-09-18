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

  # Ship a scoped IAM key with the game for SigV4 signing.
  create_invoker_user = true

  tags = var.tags
}
