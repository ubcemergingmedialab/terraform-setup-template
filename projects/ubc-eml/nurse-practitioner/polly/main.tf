locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  lambda_environment = merge(
    {
      VOICE_ID      = var.default_voice_id
      OUTPUT_FORMAT = var.default_output_format
    },
    var.tts_shared_secret != "" ? { TTS_SHARED_SECRET = var.tts_shared_secret } : {},
  )
}

# ------------------------------------------------------------------------------
# Text-to-speech backend: Lambda -> Amazon Polly, behind a public Function URL
# gated by a shared secret the game sends in the x-tts-secret header.
# Replaces the audio/voice leg of the EC2 "MOOT-API" proxy (old DXL [TTS]/[CSS]).
# Same permission/auth shape as episode's polly Lambda + the chat-backend secret gate.
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
  tags               = var.tags
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

resource "aws_cloudwatch_log_group" "polly" {
  name              = "/aws/lambda/${local.name_prefix}-polly"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "polly" {
  function_name = "${local.name_prefix}-polly"
  role          = aws_iam_role.polly_lambda.arn

  filename         = data.archive_file.polly_zip.output_path
  source_code_hash = data.archive_file.polly_zip.output_base64sha256

  runtime       = "nodejs22.x"
  handler       = "index.handler"
  timeout       = var.lambda_timeout_seconds
  memory_size   = var.lambda_memory_mb
  architectures = ["arm64"]
  package_type  = "Zip"

  environment {
    variables = local.lambda_environment
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.polly,
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
    allow_headers     = ["content-type", "x-tts-secret"]
    allow_methods     = ["POST"]
    allow_origins     = var.cors_allow_origins
    expose_headers    = []
  }
}

# A Function URL invocation with NONE auth requires two resource-policy grants
# (matches the bedrock-chat-backend module and AWS's own console setup):
#   1. lambda:InvokeFunctionUrl (FunctionUrlAuthType = NONE) — the URL front door
#   2. lambda:InvokeFunction    — the actual invoke
resource "aws_lambda_permission" "polly_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.polly.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "polly_url_invoke" {
  statement_id  = "FunctionURLAllowInvokeAction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.polly.function_name
  principal     = "*"
}
