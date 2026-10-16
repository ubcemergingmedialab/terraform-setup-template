# modules/bedrock-oidc-auth/main.tf
# 
# IAM OIDC authentication for Claude Code/Cowork with Amazon Bedrock
# Supports direct STS federation or Cognito Identity Pool modes

terraform {
  required_version = ">= 1.5.0"
}

# ===============================================
# IAM OIDC Provider
# ===============================================

resource "aws_iam_openid_connect_provider" "bedrock" {
  url = "https://${var.oidc_provider_domain}"

  client_id_list = [var.oidc_client_id]

  # Thumbprint list - provider-specific
  # Okta, Auth0, Google: use their certificate thumbprints
  # Azure AD: uses Microsoft's thumbprints
  # Cognito: uses AWS Certificate Manager thumbprints
  thumbprint_list = var.oidc_thumbprint_list

  tags = merge(
    var.tags,
    {
      Name      = "${var.name_prefix}-bedrock-oidc"
      Purpose   = "Claude Code Authentication"
      Provider  = var.provider_type
      ManagedBy = "terraform"
    }
  )
}

# ===============================================
# Bedrock Access IAM Policy
# ===============================================

data "aws_partition" "current" {}

resource "aws_iam_policy" "bedrock_access" {
  name        = "${var.name_prefix}-bedrock-access"
  description = "Policy for accessing Amazon Bedrock services"
  path        = "/"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        # Allow Bedrock model invocation in allowed regions
        {
          Sid    = "AllowBedrockInvokeRegional"
          Effect = "Allow"
          Action = [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:CallWithBearerToken",
            "bedrock:ListFoundationModels",
            "bedrock:ListInferenceProfiles"
          ]
          Resource = [
            "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/*",
            "arn:${data.aws_partition.current.partition}:bedrock:*:*:inference-profile/*",
            "arn:${data.aws_partition.current.partition}:bedrock:*:*:application-inference-profile/*"
          ]
          Condition = {
            StringEquals = {
              "aws:RequestedRegion" = var.allowed_bedrock_regions
            }
          }
        },
        # Allow global Bedrock resources (cross-region inference profiles)
        {
          Sid    = "AllowBedrockInvokeGlobal"
          Effect = "Allow"
          Action = [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
            "bedrock:CallWithBearerToken",
            "bedrock:ListFoundationModels",
            "bedrock:ListInferenceProfiles"
          ]
          Resource = [
            "arn:${data.aws_partition.current.partition}:bedrock:::foundation-model/*"
          ]
        },
        # Allow listing and describing Bedrock models (read-only)
        {
          Sid    = "AllowBedrockListRegional"
          Effect = "Allow"
          Action = [
            "bedrock:ListFoundationModels",
            "bedrock:GetFoundationModel",
            "bedrock:GetFoundationModelAvailability",
            "bedrock:ListInferenceProfiles",
            "bedrock:GetInferenceProfile"
          ]
          Resource = "*"
          Condition = {
            StringEquals = {
              "aws:RequestedRegion" = var.allowed_bedrock_regions
            }
          }
        },
        {
          Sid    = "AllowBedrockListGlobal"
          Effect = "Allow"
          Action = [
            "bedrock:ListFoundationModels",
            "bedrock:GetFoundationModel",
            "bedrock:GetFoundationModelAvailability",
            "bedrock:ListInferenceProfiles",
            "bedrock:GetInferenceProfile"
          ]
          Resource = "*"
        }
      ],
      # Conditionally add CloudWatch metrics permission if monitoring enabled
      var.enable_monitoring ? [
        {
          Sid    = "AllowCloudWatchMetrics"
          Effect = "Allow"
          Action = [
            "cloudwatch:PutMetricData"
          ]
          Resource = "*"
          Condition = {
            StringEquals = {
              "cloudwatch:namespace" = "ClaudeCode/Usage"
            }
          }
        }
      ] : []
    )
  })

  tags = merge(
    var.tags,
    {
      Name      = "${var.name_prefix}-bedrock-policy"
      Purpose   = "Bedrock Access Permissions"
      ManagedBy = "terraform"
    }
  )
}

# ===============================================
# Direct IAM Federation Resources
# ===============================================

resource "aws_iam_role" "bedrock_federated" {
  count = var.federation_type == "direct" ? 1 : 0

  name                 = "${var.name_prefix}-bedrock-federated"
  description          = "Federated role for Claude Code users accessing Bedrock via ${var.provider_type}"
  max_session_duration = 43200 # 12 hours (maximum for federated role)

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.bedrock.arn
        }
        Action = [
          "sts:AssumeRoleWithWebIdentity",
          "sts:TagSession"
        ]
        Condition = {
          StringEquals = {
            "${var.oidc_provider_domain}:aud" = var.oidc_client_id
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name           = "${var.name_prefix}-bedrock-federated-role"
      Purpose        = "Claude Code Bedrock Access"
      FederationType = "direct"
      Provider       = var.provider_type
      ManagedBy      = "terraform"
    }
  )
}

resource "aws_iam_role_policy_attachment" "bedrock_access_direct" {
  count = var.federation_type == "direct" ? 1 : 0

  role       = aws_iam_role.bedrock_federated[0].name
  policy_arn = aws_iam_policy.bedrock_access.arn
}

# ===============================================
# Cognito Identity Pool Resources
# ===============================================

resource "aws_cognito_identity_pool" "bedrock" {
  count = var.federation_type == "cognito" ? 1 : 0

  identity_pool_name               = var.identity_pool_name
  allow_unauthenticated_identities = false
  allow_classic_flow               = false

  openid_connect_provider_arns = [
    aws_iam_openid_connect_provider.bedrock.arn
  ]

  tags = merge(
    var.tags,
    {
      Name           = "${var.name_prefix}-identity-pool"
      Purpose        = "Claude Code Authentication"
      FederationType = "cognito"
      Provider       = var.provider_type
      ManagedBy      = "terraform"
    }
  )
}

# Cognito authenticated role
resource "aws_iam_role" "cognito_authenticated" {
  count = var.federation_type == "cognito" ? 1 : 0

  name        = "${var.name_prefix}-cognito-authenticated"
  description = "Role for authenticated Cognito Identity Pool users"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.bedrock[0].id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name           = "${var.name_prefix}-cognito-authenticated-role"
      Purpose        = "Claude Code Cognito Authentication"
      FederationType = "cognito"
      Provider       = var.provider_type
      ManagedBy      = "terraform"
    }
  )
}

resource "aws_iam_role_policy_attachment" "bedrock_access_cognito" {
  count = var.federation_type == "cognito" ? 1 : 0

  role       = aws_iam_role.cognito_authenticated[0].name
  policy_arn = aws_iam_policy.bedrock_access.arn
}

# Cognito unauthenticated role (deny all - security best practice)
resource "aws_iam_role" "cognito_unauthenticated" {
  count = var.federation_type == "cognito" ? 1 : 0

  name        = "${var.name_prefix}-cognito-unauthenticated"
  description = "Role for unauthenticated Cognito Identity Pool users (restricted)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.bedrock[0].id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  inline_policy {
    name = "DenyAll"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect   = "Deny"
          Action   = "*"
          Resource = "*"
        }
      ]
    })
  }

  tags = merge(
    var.tags,
    {
      Name           = "${var.name_prefix}-cognito-unauthenticated-role"
      Purpose        = "Claude Code Cognito Deny Role"
      FederationType = "cognito"
      ManagedBy      = "terraform"
    }
  )
}

# Attach roles to Cognito Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "bedrock" {
  count = var.federation_type == "cognito" ? 1 : 0

  identity_pool_id = aws_cognito_identity_pool.bedrock[0].id

  roles = {
    authenticated   = aws_iam_role.cognito_authenticated[0].arn
    unauthenticated = aws_iam_role.cognito_unauthenticated[0].arn
  }
}

# Principal tag mapping for session tags (enables per-user cost attribution in CUR)
resource "aws_cognito_identity_pool_principal_tag" "bedrock" {
  count = var.federation_type == "cognito" && var.enable_principal_tags ? 1 : 0

  identity_pool_id       = aws_cognito_identity_pool.bedrock[0].id
  identity_provider_name = var.oidc_provider_domain
  use_defaults           = false

  principal_tags = {
    UserEmail = "email"
    UserId    = "sub"
    UserName  = "name"
  }
}

# ===============================================
# Optional Monitoring Resources
# ===============================================

resource "aws_cloudwatch_log_group" "bedrock_access" {
  count = var.enable_monitoring ? 1 : 0

  name              = "/aws/bedrock/claude-code-${var.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name      = "${var.name_prefix}-bedrock-logs"
      Purpose   = "Claude Code Access Logs"
      ManagedBy = "terraform"
    }
  )
}
