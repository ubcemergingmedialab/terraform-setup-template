locals {
  # Merge the required Bedrock model id into any caller-supplied env vars.
  # When auth_type is NONE, the handler enforces a shared secret read from CHAT_SHARED_SECRET.
  # When a guardrail is enabled, the handler reads GUARDRAIL_ID / GUARDRAIL_VERSION and
  # passes them to Bedrock on each Converse call.
  guardrail_env = var.enable_guardrail ? {
    GUARDRAIL_ID      = aws_bedrock_guardrail.this[0].guardrail_id
    GUARDRAIL_VERSION = aws_bedrock_guardrail_version.this[0].version
  } : {}

  environment_variables = merge(
    { BEDROCK_MODEL_ID = var.bedrock_model_id },
    local.guardrail_env,
    var.shared_secret != "" ? { CHAT_SHARED_SECRET = var.shared_secret } : {},
    var.environment_variables,
  )
}

# ------------------------------------------------------------------------------
# Bedrock Guardrail (optional)
#
# An AWS-managed policy layer evaluated on each Bedrock invocation (input and
# output). The handler references it via guardrailConfig on the Converse call.
# ------------------------------------------------------------------------------

resource "aws_bedrock_guardrail" "this" {
  count = var.enable_guardrail ? 1 : 0

  name                      = "${var.name_prefix}-chat-guardrail"
  description               = var.guardrail_description
  blocked_input_messaging   = var.guardrail_blocked_input_messaging
  blocked_outputs_messaging = var.guardrail_blocked_outputs_messaging

  content_policy_config {
    filters_config {
      type            = "SEXUAL"
      input_strength  = "HIGH"
      output_strength = "HIGH"
    }
    filters_config {
      type            = "VIOLENCE"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "HATE"
      input_strength  = "HIGH"
      output_strength = "HIGH"
    }
    filters_config {
      type            = "INSULTS"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "MISCONDUCT"
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE" # PROMPT_ATTACK only supports input filtering.
    }
  }

  tags = var.tags
}

# Published, immutable snapshot the handler pins at runtime.
resource "aws_bedrock_guardrail_version" "this" {
  count = var.enable_guardrail ? 1 : 0

  guardrail_arn = aws_bedrock_guardrail.this[0].guardrail_arn
  description   = "Initial published version"
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
    Statement = concat(
      [{
        Sid    = "BedrockInvokeModel"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = var.bedrock_model_arns
      }],
      var.enable_guardrail ? [{
        Sid      = "BedrockApplyGuardrail"
        Effect   = "Allow"
        Action   = "bedrock:ApplyGuardrail"
        Resource = aws_bedrock_guardrail.this[0].guardrail_arn
      }] : [],
    )
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
  authorization_type = var.auth_type
  invoke_mode        = var.invoke_mode

  cors {
    allow_credentials = false
    # Allow the shared-secret header (used when auth_type = NONE) plus content-type.
    allow_headers  = ["content-type", "x-chat-secret"]
    allow_methods  = ["POST"]
    allow_origins  = var.cors_allow_origins
    expose_headers = []
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
    }]
  })
}

resource "aws_iam_access_key" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  user = aws_iam_user.invoker[0].name
}

# Resource-based permission allowing the scoped user to invoke the URL.
# function_url_auth_type = "AWS_IAM" is REQUIRED: it marks this statement as a Function
# URL invoke grant. (It also adds a lambda:FunctionUrlAuthType = AWS_IAM condition, which
# real signed Function URL requests satisfy.)
resource "aws_lambda_permission" "invoker_url" {
  count = var.create_invoker_user ? 1 : 0

  statement_id           = "AllowScopedUserFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = aws_iam_user.invoker[0].arn
  function_url_auth_type = "AWS_IAM"
}

# Public invoke permissions for NONE auth. A Function URL invocation requires TWO
# resource-policy grants (this matches what AWS's own console setup creates):
#   1. lambda:InvokeFunctionUrl  (with FunctionUrlAuthType = NONE) — the URL front door
#   2. lambda:InvokeFunction     (with InvokedViaFunctionUrl = true) — the actual invoke
# Granting only #1 yields AccessDeniedException at invoke time. The handler enforces the
# shared secret after the request passes these checks.
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
