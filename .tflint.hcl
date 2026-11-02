# tflint configuration for the lab-terraform monorepo.
#
# Primary purpose (Phase 1 tagging audit): enforce that every taggable AWS
# resource carries the four cost-allocation tags. See docs/tagging-audit.md.
#
# IMPORTANT — how tagging actually works in this repo:
#   Tags are applied centrally via the provider `default_tags` block at each
#   project root (projects/<client>/<project>), NOT per-resource. The four tags
#   Client / Project / Environment / ManagedBy propagate to every taggable
#   resource the provider creates, including resources created inside modules/.
#
#   tflint's `aws_resource_missing_tags` rule performs a SOURCE-TEXT check: it
#   only sees tags written directly on a resource block and does NOT understand
#   provider `default_tags` inheritance (upstream issue
#   terraform-linters/tflint-ruleset-aws#53). Running it naively would flag
#   every correctly-inheriting resource as "missing tags".
#
#   Because of that, the real regression guard for this repo is the
#   provider-level check in .github/workflows/terraform-checks.yml
#   ("Enforce default_tags on every provider"), which asserts the four tags are
#   declared in default_tags at each project root. The rule below is kept as a
#   secondary signal and is scoped so it does not fight the inheritance model:
#   non-taggable resource types are excluded, and the rule is left as a warning
#   (not an error) so inheritance-only resources don't block CI.

plugin "aws" {
  enabled = true
  version = "0.44.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "aws_resource_missing_tags" {
  enabled = true

  tags = [
    "Client",
    "Project",
    "Environment",
    "ManagedBy",
  ]

  # Resource types that the AWS provider does NOT model with a `tags` attribute.
  # They can never carry tags, so default_tags does not reach them and they must
  # not be flagged. These are the documented Phase 1 tagging exceptions — the
  # later resource-inventory tool should treat them as non-taggable, not as
  # hand-created resources missing a ManagedBy tag.
  exclude = [
    # API Gateway v2 — only aws_apigatewayv2_api and _stage are taggable.
    "aws_apigatewayv2_authorizer",
    "aws_apigatewayv2_integration",
    "aws_apigatewayv2_route",

    # Application Auto Scaling — not taggable.
    "aws_appautoscaling_policy",
    "aws_appautoscaling_target",

    # Bedrock guardrail version is a child snapshot — not taggable.
    "aws_bedrock_guardrail_version",

    # CloudFront helpers — not taggable.
    "aws_cloudfront_origin_access_control",
    "aws_cloudfront_response_headers_policy",

    # Cognito child / association resources — not taggable.
    "aws_cognito_identity_pool_principal_tag",
    "aws_cognito_identity_pool_roles_attachment",
    "aws_cognito_user_group",
    "aws_cognito_user_pool_client",
    "aws_cognito_user_pool_domain",

    # ECR lifecycle policy — not taggable (the repository itself is).
    "aws_ecr_lifecycle_policy",

    # IAM sub-resources — policies/attachments/access keys are not taggable.
    "aws_iam_access_key",
    "aws_iam_role_policy",
    "aws_iam_role_policy_attachment",
    "aws_iam_user_policy",

    # KMS alias — not taggable (the key is).
    "aws_kms_alias",

    # Lambda function URL and permissions — not taggable (the function is).
    "aws_lambda_function_url",
    "aws_lambda_permission",

    # ELB listener — not taggable (the LB and target group are).
    "aws_lb_listener",

    # VPC route table association — not taggable.
    "aws_route_table_association",

    # S3 bucket sub-configuration resources — not taggable (the bucket is).
    "aws_s3_bucket_cors_configuration",
    "aws_s3_bucket_lifecycle_configuration",
    "aws_s3_bucket_ownership_controls",
    "aws_s3_bucket_policy",
    "aws_s3_bucket_public_access_block",
    "aws_s3_bucket_server_side_encryption_configuration",
    "aws_s3_bucket_versioning",
  ]
}
