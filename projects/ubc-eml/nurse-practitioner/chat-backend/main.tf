locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  lambda_environment = merge(
    {
      BEDROCK_MODEL_ID    = var.bedrock_model_id
      POLLY_VOICE_ID      = var.polly_voice_id
      POLLY_ENGINE        = var.polly_engine
      POLLY_OUTPUT_FORMAT = var.polly_output_format
    },
    var.chat_shared_secret != "" ? { CHAT_SHARED_SECRET = var.chat_shared_secret } : {},
  )
}
import {
  to = aws_cloudwatch_log_group.chat_lambda
  id = "/aws/lambda/ubc-eml-np-chat-dev-chat-backend"
}

# ------------------------------------------------------------------------------
# Combined chat + TTS backend.
#
# Replaces the EC2 "MOOT-API" OpenAI websocket proxy for NursePractitioner. In
# the game, chat is ALWAYS consumed as streamed audio (the old DXL [CSS]
# interaction: send text, get spoken audio back). So this single Lambda does both
# legs server-side: Bedrock Converse (LLM text) -> Polly SynthesizeSpeech (audio),
# and returns the audio bytes. The game makes one HTTP POST (VaRest) and feeds the
# returned mp3 into its existing RuntimeAudioImporter -> UAudioManager queue.
#
# Public Function URL (NONE auth), gated by a shared secret in the x-chat-secret
# header (same proven pattern as poetryhouse; scoped-IAM SigV4 was unreliable on
# this org's account).
# ------------------------------------------------------------------------------

data "archive_file" "chat_backend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/chat-backend"
  output_path = "${path.module}/build/chat-backend.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
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
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "chat_lambda_basic" {
  role       = aws_iam_role.chat_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Bedrock (chat) + Polly (speech) in one policy — this is the whole point of the
# combined backend.
data "aws_iam_policy_document" "chat_lambda" {
  statement {
    sid    = "BedrockInvokeModel"
    effect = "Allow"

    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]

    resources = var.bedrock_model_arns
  }

  statement {
    sid    = "PollySynthesizeSpeech"
    effect = "Allow"

    actions = [
      "polly:SynthesizeSpeech",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "chat_lambda" {
  name   = "${local.name_prefix}-chat-backend-bedrock-polly"
  role   = aws_iam_role.chat_lambda.id
  policy = data.aws_iam_policy_document.chat_lambda.json
}

resource "aws_cloudwatch_log_group" "chat_lambda" {
  name              = "/aws/lambda/${local.name_prefix}-chat-backend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
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
    variables = local.lambda_environment
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.chat_lambda,
    aws_iam_role_policy_attachment.chat_lambda_basic,
    aws_iam_role_policy.chat_lambda,
  ]
}

resource "aws_lambda_function_url" "chat_backend" {
  function_name      = aws_lambda_function.chat_backend.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type", "x-chat-secret"]
    allow_methods     = ["POST"]
    allow_origins     = var.cors_allow_origins
    expose_headers    = []
  }
}

# A NONE-auth Function URL invocation needs two resource-policy grants (matches
# the bedrock-chat-backend module and AWS's own console setup):
#   1. lambda:InvokeFunctionUrl (FunctionUrlAuthType = NONE) — the URL front door
#   2. lambda:InvokeFunction    — the actual invoke
resource "aws_lambda_permission" "chat_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.chat_backend.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "chat_url_invoke" {
  statement_id  = "FunctionURLAllowInvokeAction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_backend.function_name
  principal     = "*"
}
