locals {
  # Transcribe defaults the handler falls back to, merged with any caller-supplied env vars.
  # When auth_type is NONE, the handler enforces a shared secret read from CHAT_SHARED_SECRET.
  environment_variables = merge(
    {
      TRANSCRIBE_LANGUAGE_CODE    = var.language_code
      TRANSCRIBE_POLL_INTERVAL_MS = tostring(var.poll_interval_ms)
      SCRATCH_BUCKET              = aws_s3_bucket.scratch.bucket
    },
    var.shared_secret != "" ? { CHAT_SHARED_SECRET = var.shared_secret } : {},
    var.environment_variables,
  )
}

# ------------------------------------------------------------------------------
# Scratch bucket for audio uploads + transcript output
#
# Transcribe batch (StartTranscriptionJob) reads media from S3 and writes the
# transcript JSON back to S3; it cannot take an inline blob. This bucket holds
# that transient working data. A lifecycle rule expires objects quickly.
# ------------------------------------------------------------------------------

resource "random_id" "bucket_suffix" {
  byte_length = 3
}

resource "aws_s3_bucket" "scratch" {
  bucket = "${var.name_prefix}-transcribe-scratch-${random_id.bucket_suffix.hex}"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "scratch" {
  bucket = aws_s3_bucket.scratch.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "scratch" {
  bucket = aws_s3_bucket.scratch.id

  rule {
    id     = "expire-transient-objects"
    status = "Enabled"

    filter {}

    expiration {
      days = var.object_expiration_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "scratch" {
  bucket = aws_s3_bucket.scratch.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ------------------------------------------------------------------------------
# Packaging
# ------------------------------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.source_path
  output_path = "${path.module}/.build/${var.name_prefix}-transcribe-backend.zip"
}

# ------------------------------------------------------------------------------
# Lambda execution role
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-transcribe-backend"

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

resource "aws_iam_role_policy" "transcribe" {
  name = "${var.name_prefix}-transcribe-backend-transcribe"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TranscribeBatchJobs"
        Effect = "Allow"
        Action = [
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob",
          "transcribe:DeleteTranscriptionJob",
        ]
        Resource = "*"
      },
      {
        Sid    = "ScratchBucketObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.scratch.arn}/*"
      },
      {
        Sid      = "ScratchBucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.scratch.arn
      },
    ]
  })
}

# ------------------------------------------------------------------------------
# Lambda + Function URL
# ------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-transcribe-backend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name    = "${var.name_prefix}-transcribe-backend"
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
    aws_iam_role_policy.transcribe,
  ]
}

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = var.auth_type
  invoke_mode        = "BUFFERED"

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

  name = "${var.name_prefix}-transcribe-invoker"
  path = "/app-clients/"
  tags = var.tags
}

resource "aws_iam_user_policy" "invoker" {
  count = var.create_invoker_user ? 1 : 0

  name = "${var.name_prefix}-transcribe-invoker"
  user = aws_iam_user.invoker[0].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokeTranscribeFunctionUrl"
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
