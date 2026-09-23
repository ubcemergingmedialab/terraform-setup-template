locals {
  # Merge the required Bedrock model id into any caller-supplied env vars.
  environment_variables = merge(
    { BEDROCK_MODEL_ID = var.bedrock_model_id },
    var.environment_variables,
  )
}

# ------------------------------------------------------------------------------
# Packaging
# ------------------------------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.source_path
  output_path = "${path.module}/.build/${var.name_prefix}-chat-backend.zip"
}

# ------------------------------------------------------------------------------
# Lambda execution role
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-chat-backend"

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

resource "aws_iam_role_policy" "bedrock" {
  name = "${var.name_prefix}-chat-backend-bedrock"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "BedrockInvokeModel"
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ]
      Resource = var.bedrock_model_arns
    }]
  })
}

# ------------------------------------------------------------------------------
# Lambda + Function URL (IAM-authenticated)
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-chat-backend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name    = "${var.name_prefix}-chat-backend"
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
    aws_iam_role_policy.bedrock,
  ]
}

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = var.invoke_mode

  cors {
    allow_credentials = false
    allow_headers     = ["content-type"]
    allow_methods     = ["POST"]
    allow_origins     = var.cors_allow_origins
    expose_headers    = []
  }
}

# ------------------------------------------------------------------------------
# Scoped invoker user (optional)
#
# One capability only: invoke this Function URL. Its access key ships with the
# client app and is used to SigV4-sign requests. Rotate by tainting the access key.
# ------------------------------------------------------------------------------

resource "aws_iam_user" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  name = "${var.name_prefix}-chat-invoker"
  path = "/app-clients/"
  tags = var.tags
}

resource "aws_iam_user_policy" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  name = "${var.name_prefix}-chat-invoker"
  user = aws_iam_user.invoker[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokeChatFunctionUrl"
      Effect   = "Allow"
      Action   = "lambda:InvokeFunctionUrl"
      Resource = aws_lambda_function.this.arn
      # NOTE: no lambda:FunctionUrlAuthType condition. That context key is not reliably
      # populated for the scoped invoker's signed requests, which made both this identity
      # policy and the resource permission fail their condition -> 403 Forbidden. The
      # Function URL's authorization_type = AWS_IAM already guarantees IAM-only access,
      # so the condition is redundant.
    }]
  })
}

resource "aws_iam_access_key" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  user = aws_iam_user.invoker[0].name
}

# Resource-based permission allowing the scoped user to invoke the URL.
# function_url_auth_type is intentionally omitted: setting it injects a
# lambda:FunctionUrlAuthType = AWS_IAM condition that was not being satisfied for the
# scoped invoker's signed requests, causing 403 Forbidden. The Function URL's own
# authorization_type = AWS_IAM already enforces IAM auth, so the condition is redundant.
resource "aws_lambda_permission" "invoker_url" {
  count = var.create_invoker_user ? 1 : 0

  statement_id  = "AllowScopedUserFunctionUrlInvoke"
  action        = "lambda:InvokeFunctionUrl"
  function_name = aws_lambda_function.this.function_name
  principal     = aws_iam_user.invoker[0].arn
}
