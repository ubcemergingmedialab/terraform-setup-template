resource "random_id" "bucket_suffix" {
  count = var.legacy_bucket_name == "" ? 1 : 0

  byte_length = 3
}

locals {
  bucket_name = var.legacy_bucket_name != "" ? var.legacy_bucket_name : "${var.name_prefix}-${var.bucket_name_suffix}-${random_id.bucket_suffix[0].hex}"
  origin_id   = "S3-${local.bucket_name}"
}

# AWS managed policies — looked up by name to avoid stale/wrong hardcoded IDs.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# Forwards Origin (CORS) and Range (progressive .ksplat) to S3.
data "aws_cloudfront_origin_request_policy" "viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
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
  block_public_policy     = !(var.enable_public_read || var.enable_cdn)
  ignore_public_acls      = true
  restrict_public_buckets = !(var.enable_public_read || var.enable_cdn)
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"]
    max_age_seconds = 3600
  }
}

resource "aws_cloudfront_origin_access_control" "this" {
  count = var.enable_cdn ? 1 : 0

  name                              = "${var.name_prefix}-assets-oac"
  description                       = "OAC for ${var.name_prefix} assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "this" {
  count = var.enable_cdn ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  price_class     = var.price_class
  comment         = "${var.name_prefix} assets CDN (splats)"

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this[0].id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.viewer_except_host.id
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

data "aws_iam_policy_document" "bucket" {
  dynamic "statement" {
    for_each = var.enable_public_read ? [1] : []

    content {
      sid    = "PublicReadGetObject"
      effect = "Allow"

      principals {
        type        = "*"
        identifiers = ["*"]
      }

      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.this.arn}/*"]
    }
  }

  dynamic "statement" {
    for_each = var.enable_cdn ? [1] : []

    content {
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
        values   = [aws_cloudfront_distribution.this[0].arn]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  count = (var.enable_public_read || var.enable_cdn) ? 1 : 0

  bucket = aws_s3_bucket.this.id
  policy = data.aws_iam_policy_document.bucket.json

  depends_on = [aws_s3_bucket_public_access_block.this]
}
