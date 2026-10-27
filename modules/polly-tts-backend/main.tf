locals {
  # Polly defaults the handler falls back to, merged with any caller-supplied env vars.
  # When auth_type is NONE, the handler enforces a shared secret read from CHAT_SHARED_SECRET.
  environment_variables = merge(
    {
      POLLY_DEFAULT_VOICE_ID      = var.default_voice_id
      POLLY_DEFAULT_ENGINE        = var.default_engine
      POLLY_DEFAULT_OUTPUT_FORMAT = var.default_output_format
    },
    var.shared_secret != "" ? { CHAT_SHARED_SECRET = var.shared_secret } : {},
    var.environment_variables,
  )
}

# ------------------------------------------------------------------------------
# Packaging
# ------------------------------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.source_path
  output_path = "${path.module}/.build/${var.name_prefix}-tts-backend.zip"
}

# ------------------------------------------------------------------------------
# Lambda execution role
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-tts-backend"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "polly" {
  name = "${var.name_prefix}-tts-backend-polly"
  role = aws_iam_role.lambda.id

  # Polly SynthesizeSpeech does not support resource-level permissions, so Resource is "*".
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "PollySynthesizeSpeech"
      Effect   = "Allow"
      Action   = ["polly:SynthesizeSpeech"]
      Resource = "*"
    }]
  })
}

# ------------------------------------------------------------------------------
# Lambda + Function URL
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-tts-backend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name    = "${var.name_prefix}-tts-backend"
  role             = aws_iam_role.lambda.arn
  handler          = var.handler
  runtime          = var.runtime
  architectures    = [var.architecture]
  memory_size      = var.memory_mb
  timeout          = var.timeout_seconds
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = local.environment_variables
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.polly,
  ]
}

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = var.auth_type
  # TTS returns a single buffered audio payload; no streaming mode needed.
  invoke_mode = "BUFFERED"

  cors {
    allow_credentials = false
    allow_headers     = ["content-type", "x-chat-secret"]
    allow_methods     = ["POST"]
    allow_origins     = var.cors_allow_origins
    expose_headers    = []
  }
}

# ------------------------------------------------------------------------------
# Scoped invoker user (optional, for AWS_IAM auth)
# ------------------------------------------------------------------------------

resource "aws_iam_user" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  name = "${var.name_prefix}-tts-invoker"
  path = "/app-clients/"
  tags = var.tags
}

resource "aws_iam_user_policy" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  name = "${var.name_prefix}-tts-invoker"
  user = aws_iam_user.invoker[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokeTtsFunctionUrl"
      Effect   = "Allow"
      Action   = "lambda:InvokeFunctionUrl"
      Resource = aws_lambda_function.this.arn
    }]
  })
}

resource "aws_iam_access_key" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  user = aws_iam_user.invoker[0].name
}

resource "aws_lambda_permission" "invoker_url" {
  count = var.create_invoker_user ? 1 : 0

  statement_id           = "AllowScopedUserFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = aws_iam_user.invoker[0].arn
  function_url_auth_type = "AWS_IAM"
}

# Public invoke permissions for NONE auth (both grants are required; see
# bedrock-chat-backend for the full explanation). The handler enforces the shared secret.
resource "aws_lambda_permission" "public_url" {
  count = var.auth_type == "NONE" ? 1 : 0

  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "public_url_invoke" {
  count = var.auth_type == "NONE" ? 1 : 0

  statement_id  = "FunctionURLAllowInvokeAction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "*"
}
