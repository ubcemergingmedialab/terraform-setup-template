locals {
  needs_jwt = anytrue([for route in var.http_routes : route.authorization_type == "JWT"])
  route_key = { for route in var.http_routes : "${route.method} ${route.path}" => route }
  cognito_functions = {
    for name, function in var.functions : name => function
    if contains(var.cognito_function_names, name)
  }
}

data "archive_file" "lambda_zip" {
  for_each    = var.functions
  type        = "zip"
  source_dir  = each.value.source_path
  output_path = "${path.module}/.build/${var.name_prefix}-${each.key}.zip"
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = var.functions
  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = var.log_retention_days
}

resource "aws_iam_role" "lambda" {
  for_each = var.functions
  name     = "${var.name_prefix}-${each.key}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  for_each   = var.functions
  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "aurora_data_api" {
  for_each = length(var.aurora_cluster_arns) > 0 ? var.functions : {}
  name     = "${var.name_prefix}-${each.key}-aurora-data-api"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:ExecuteStatement",
          "rds-data:RollbackTransaction",
        ]
        Resource = var.aurora_cluster_arns
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.aurora_secret_arns
      },
    ]
  })
}

resource "aws_iam_role_policy" "aurora_secret_kms" {
  for_each = length(var.aurora_secret_kms_key_arns) > 0 ? var.functions : {}
  name     = "${var.name_prefix}-${each.key}-aurora-secret-kms"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = var.aurora_secret_kms_key_arns
      },
    ]
  })
}

resource "aws_lambda_function" "this" {
  for_each         = var.functions
  function_name    = "${var.name_prefix}-${each.key}"
  role             = aws_iam_role.lambda[each.key].arn
  handler          = each.value.handler
  runtime          = each.value.runtime
  memory_size      = each.value.memory_mb
  timeout          = each.value.timeout_seconds
  filename         = data.archive_file.lambda_zip[each.key].output_path
  source_code_hash = data.archive_file.lambda_zip[each.key].output_base64sha256

  environment { variables = each.value.environment_variables }
  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.name_prefix}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = var.cors_allow_headers
    allow_methods     = var.cors_allow_methods
    allow_origins     = var.cors_allow_origins
    max_age           = 300
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  count            = local.needs_jwt ? 1 : 0
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.name_prefix}-cognito"

  jwt_configuration {
    audience = var.cognito_audiences
    issuer   = var.cognito_jwt_issuer
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = var.functions
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "this" {
  for_each  = local.route_key
  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.function_name].id}"

  authorization_type = each.value.authorization_type == "NONE" ? "NONE" : (
    each.value.authorization_type == "JWT" ? "JWT" : "AWS_IAM"
  )
  authorizer_id = each.value.authorization_type == "JWT" ? aws_apigatewayv2_authorizer.cognito[0].id : null
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.throttling_burst_limit
    throttling_rate_limit  = var.throttling_rate_limit
  }
}

resource "aws_lambda_permission" "apigw" {
  for_each      = var.functions
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_iam_role_policy" "cognito" {
  for_each = length(var.cognito_user_pool_arns) > 0 ? local.cognito_functions : {}
  name     = "${var.name_prefix}-${each.key}-cognito"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:ConfirmForgotPassword",
        "cognito-idp:ForgotPassword",
        "cognito-idp:InitiateAuth",
      ]
      Resource = var.cognito_user_pool_arns
    }]
  })
}