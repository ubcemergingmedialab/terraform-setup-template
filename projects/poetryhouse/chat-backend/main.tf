locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

data "aws_caller_identity" "current" {}

# ------------------------------------------------------------------------------
# Chat Backend Lambda
#
# Replaces the EC2 "moot-api" OpenAI chat proxy. The game POSTs a chat request
# (system prompt + conversation) and the Lambda calls Amazon Bedrock (Converse)
# and returns the completion as plain text.
#
# The Function URL is IAM-authenticated (AWS_IAM). The game signs each request
# with SigV4 using the scoped IAM user created at the bottom of this file.
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
      "bedrock:InvokeModelWithResponseStream"
    ]

    # Scope to foundation models + inference profiles. Tighten to specific model
    # ARNs if you want to lock the Lambda to a single model.
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

  runtime       = "nodejs22.x"
  handler       = "handler.handler"
  timeout       = var.lambda_timeout_seconds
  memory_size   = var.lambda_memory_mb
  architectures = ["arm64"]
  package_type  = "Zip"

  environment {
    variables = {
      BEDROCK_MODEL_ID = var.bedrock_model_id
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.chat_lambda_basic_execution,
    aws_iam_role_policy_attachment.chat_lambda_bedrock
  ]
}

# BUFFERED (not RESPONSE_STREAM): the game consumes a single text reply, matching
# the old WebSocket OnMessage contract. Simpler to SigV4-sign and parse.
resource "aws_lambda_function_url" "chat_backend" {
  function_name      = aws_lambda_function.chat_backend.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "BUFFERED"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = ["*"]
    expose_headers    = []
  }
}

# ------------------------------------------------------------------------------
# Scoped IAM user shipped with the game
#
# This user can do exactly one thing: invoke the chat Function URL. Its access
# key is baked into the packaged build and used to SigV4-sign requests.
#
# If the key leaks, the blast radius is "someone can call this one Lambda" —
# rotate the key (taint aws_iam_access_key.chat_invoker) to revoke access.
# ------------------------------------------------------------------------------

resource "aws_iam_user" "chat_invoker" {
  name = "${local.name_prefix}-chat-invoker"
  path = "/app-clients/"
}

data "aws_iam_policy_document" "chat_invoker" {
  statement {
    sid       = "InvokeChatFunctionUrl"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunctionUrl"]
    resources = [aws_lambda_function.chat_backend.arn]

    condition {
      test     = "StringEquals"
      variable = "lambda:FunctionUrlAuthType"
      values   = ["AWS_IAM"]
    }
  }
}

resource "aws_iam_user_policy" "chat_invoker" {
  name   = "${local.name_prefix}-chat-invoker-policy"
  user   = aws_iam_user.chat_invoker.name
  policy = data.aws_iam_policy_document.chat_invoker.json
}

resource "aws_iam_access_key" "chat_invoker" {
  user = aws_iam_user.chat_invoker.name
}

# Grant the scoped user permission to invoke the URL (resource-based side).
resource "aws_lambda_permission" "chat_invoker_url" {
  statement_id           = "AllowScopedUserFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.chat_backend.function_name
  principal              = aws_iam_user.chat_invoker.arn
  function_url_auth_type = "AWS_IAM"
}
