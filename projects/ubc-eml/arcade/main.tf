# ==============================================================================
# ARCADE — marker-anchored AR storytelling for UBC Emerging Media Lab.
#
# This project does NOT use modules/s3-assets-bucket or modules/lambda-http-api,
# and that is deliberate:
#
#   * s3-assets-bucket grants public read across the WHOLE bucket. ARCADE grants
#     it on four prefixes only, and additionally names the Lambda role as a
#     principal. Importing the live bucket through that module would produce a
#     permanent diff against a policy that is currently correct.
#   * lambda-http-api builds an API Gateway HTTP API and zips its own source.
#     ARCADE is reached through a Lambda Function URL (no API Gateway at all),
#     and its code is deployed out-of-band. Neither half of the module applies.
#
# Everything here is written to match resources that ALREADY EXIST and serve
# production. See README.md § Importing before the first apply.
# ==============================================================================

locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  # Prefer the legacy name when one is given, so `terraform import` adopts the
  # live resource instead of planning a replacement.
  bucket_name      = var.legacy_bucket_name != "" ? var.legacy_bucket_name : "${local.name_prefix}-storage-${one(random_id.bucket_suffix[*].hex)}"
  lambda_name      = var.legacy_lambda_name != "" ? var.legacy_lambda_name : "${local.name_prefix}-api"
  lambda_role_name = var.legacy_lambda_role_name != "" ? var.legacy_lambda_role_name : "${local.name_prefix}-lambda-exec"

  # Public read is granted per prefix, never bucket-wide.
  public_read_arns = [
    for p in var.public_read_prefixes : "${aws_s3_bucket.storage.arn}/${p}/*"
  ]
}

data "aws_caller_identity" "current" {}

# S3 bucket names are globally unique, so a fresh (non-imported) deployment
# needs a suffix to avoid colliding with another account running this stack.
# Not created when importing — the legacy name is already fixed, and an unused
# random value in state only invites someone to wonder what it names.
resource "random_id" "bucket_suffix" {
  count       = var.legacy_bucket_name == "" ? 1 : 0
  byte_length = 3
}

# ------------------------------------------------------------------------------
# Storage bucket
#
# Existing: eml-arcade-storage  (ca-central-1)
# Fresh:    ${local.name_prefix}-storage-<random hex>
#
# Holds every published artefact: stories/ (story JSON), assets/ (uploaded
# images and GIFs), markers/ (printed-marker images, served same-origin through
# an Amplify rewrite), exhibits/ (room documents), and tmp/ (scratch).
# ------------------------------------------------------------------------------

resource "aws_s3_bucket" "storage" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_ownership_controls" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    # ACLs disabled outright; access comes only from the bucket policy below.
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    bucket_key_enabled = true

    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public POLICY is permitted (that is how published content is served); public
# ACLs are not. The two halves are independent, and both are load-bearing:
# flipping block_public_policy to true would make the bucket policy below
# ineffective and every poster in the app would fail to load.
resource "aws_s3_bucket_public_access_block" "storage" {
  bucket = aws_s3_bucket.storage.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "storage" {
  bucket = aws_s3_bucket.storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Anonymous GET on published prefixes only. No ListBucket anywhere, so
        # keys remain unguessable even though objects are readable.
        Sid       = "PublicReadPublishedContent"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = local.public_read_arns
      },
      {
        Sid       = "LambdaWrite"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.lambda_exec.arn }
        Action    = ["s3:PutObject", "s3:GetObject"]
        Resource  = local.public_read_arns
      },
      {
        # The publish path checks whether a content-addressed key already
        # exists before uploading, which needs ListBucket on the bucket itself.
        Sid       = "LambdaListForExistenceChecks"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.lambda_exec.arn }
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.storage.arn
      },
    ]
  })

  # A public policy is rejected until the access block above stops blocking it.
  depends_on = [aws_s3_bucket_public_access_block.storage]
}

# Browser uploads are cross-origin: the studio is served from Amplify, the PUT
# goes to S3.
resource "aws_s3_bucket_cors_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = var.cors_allowed_headers
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  # Scratch only. Published content is never expired on a timer — a story that
  # stopped loading because a rule swept it would be indistinguishable from a
  # bug, and exhibits are meant to outlive the term.
  rule {
    id     = "expire-scratch-only"
    status = "Enabled"

    filter {
      prefix = var.scratch_prefix
    }

    expiration {
      days = var.scratch_expiration_days
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  # Versioning is on so a bad publish can be rolled back, but old versions are
  # not kept forever.
  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    expiration {
      expired_object_delete_marker = true
    }

    noncurrent_version_expiration {
      noncurrent_days           = var.noncurrent_version_days
      newer_noncurrent_versions = var.noncurrent_versions_kept
    }
  }

  depends_on = [aws_s3_bucket_versioning.storage]
}

# ------------------------------------------------------------------------------
# API Lambda execution role
#
# Existing: eml-arcade-lambda-exec
#
# Object permissions are granted by the BUCKET policy above (which names this
# role as a principal) rather than by an inline role policy, so there is exactly
# one place describing who may touch the bucket.
# ------------------------------------------------------------------------------

resource "aws_iam_role" "lambda_exec" {
  name        = local.lambda_role_name
  description = var.lambda_role_description

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# CloudWatch Logs only. Nothing else is attached, deliberately.
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ------------------------------------------------------------------------------
# API Lambda
#
# Existing: eml-arcade-api
#
# THE CODE IS NOT DEPLOYED FROM HERE. It ships separately, by hand, with
# `npm run build:lambda` in the app repo followed by an upload of
# dist-lambda.zip. Terraform therefore owns the function's SHAPE (runtime,
# memory, timeout, role, environment) and ignores its CONTENTS — the stub
# archive below exists only so a first `terraform apply` on a fresh account has
# something to create the function with, and is never uploaded over live code.
# ------------------------------------------------------------------------------

data "archive_file" "lambda_stub" {
  type = "zip"
  # Written inside .terraform/ so it lands in an already-ignored directory
  # rather than appearing as an untracked build artefact at the module root.
  output_path = "${path.module}/.terraform/lambda-stub.zip"

  source {
    filename = "index.js"
    content  = <<-JS
      // Placeholder only. Real code is published out-of-band; see README.md.
      export const handler = async () => ({
        statusCode: 503,
        body: JSON.stringify({ error: 'ARCADE API placeholder — real build not yet deployed' }),
      });
    JS
  }
}

resource "aws_lambda_function" "api" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda_exec.arn

  runtime       = var.lambda_runtime
  handler       = var.lambda_handler
  memory_size   = var.lambda_memory_mb
  timeout       = var.lambda_timeout_seconds
  architectures = var.lambda_architectures

  # A real throttle, not a formality: the Function URL is unauthenticated
  # (AuthType NONE, necessarily — the Amplify rewrite cannot SigV4-sign), so
  # this cap is what stops a burst against a public endpoint from consuming the
  # account's whole concurrency pool and starving every other Lambda in it.
  # Leaving it unset means -1 (unreserved), which silently removes that ceiling.
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  filename         = data.archive_file.lambda_stub.output_path
  source_code_hash = data.archive_file.lambda_stub.output_base64sha256

  environment {
    variables = {
      S3_BUCKET             = aws_s3_bucket.storage.id
      S3_REGION             = var.aws_region
      STORY_PUBLIC_BASE_URL = var.story_public_base_url != "" ? var.story_public_base_url : "https://${aws_s3_bucket.storage.id}.s3.${var.aws_region}.amazonaws.com"
      STUDIO_PUBLISH_SECRET = var.studio_publish_secret
    }
  }

  lifecycle {
    # Code is deployed out-of-band; never let a plan roll production back to
    # the stub above.
    ignore_changes = [
      filename,
      source_code_hash,
    ]

    # Applying with an empty secret would silently break publishing, and the
    # failure would show up later as a confusing 401 from the studio. Fail the
    # plan instead, where the cause is obvious.
    precondition {
      condition     = var.studio_publish_secret != ""
      error_message = "studio_publish_secret is empty. Set it as a SENSITIVE variable on the HCP workspace — it must not go in terraform.auto.tfvars, which is committed."
    }
  }

  depends_on = [aws_iam_role_policy_attachment.lambda_basic_execution]
}

# Lambda creates this log group implicitly on first invocation, and an
# implicitly-created group NEVER EXPIRES. Production's 30 days was set by hand;
# declaring it here is what stops that from being silently lost — if the
# function were ever recreated without this, logs would start accumulating
# forever and nothing would flag it.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.lambda_name}"
  retention_in_days = var.lambda_log_retention_days
}

# The API is reached through a Function URL, not API Gateway.
#
# AuthType MUST stay NONE. The Amplify rewrite that fronts this cannot SigV4-sign
# a request, so AWS_IAM (the console default) makes every proxied call fail with
# 403 {"Message":null} from the origin.
#
# CORS is deliberately unset: browsers reach this through the Amplify rewrite on
# the site's own origin, so the request is same-origin and needs no CORS headers.
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}
