resource "random_id" "bucket_suffix" {
  byte_length = 3
}

locals {
  bucket_name = "${var.name_prefix}-${var.bucket_name_suffix}-${random_id.bucket_suffix.hex}"
  origin_id   = "S3-${local.bucket_name}"
  # AWS managed CachingOptimized policy
  cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
}

resource "aws_s3_bucket" "this" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_ownership_controls" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.name_prefix}-site-oac"
  description                       = "OAC for ${var.name_prefix} static site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = var.default_root_object
  price_class         = var.price_class
  comment             = "${var.name_prefix} static site"

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = local.cache_policy_id
  }

  dynamic "custom_error_response" {
    for_each = var.spa_routing ? toset(["403", "404"]) : toset([])

    content {
      error_code         = tonumber(custom_error_response.value)
      response_code      = 200
      response_page_path = "/${var.default_root_object}"
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "cloudfront_oac" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.this.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "cloudfront" {
  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.cloudfront_oac.json

  depends_on = [aws_s3_bucket_public_access_block.this]
}
