locals {
  domain_prefix = var.hosted_ui_domain_prefix != "" ? var.hosted_ui_domain_prefix : replace(var.name_prefix, "-", "")
}

resource "aws_cognito_user_pool" "this" {
  name = "${var.name_prefix}-users"

  # Lock the pool down: admin-created users only unless self sign-up is explicitly
  # allowed. This is the single-tenant / approved-users posture.
  admin_create_user_config {
    allow_admin_create_user_only = !var.allow_self_signup
  }

  password_policy {
    minimum_length    = var.password_minimum_length
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  mfa_configuration = var.mfa_required ? "ON" : "OFF"

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  auto_verified_attributes = ["email"]

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = local.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = var.oauth_scopes
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.callback_urls
  logout_urls   = var.logout_urls

  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]
}

# Optional user group gating app access (e.g. a single "approved" group).
resource "aws_cognito_user_group" "this" {
  count = var.user_group_name != "" ? 1 : 0

  name         = var.user_group_name
  user_pool_id = aws_cognito_user_pool.this.id
  description  = var.user_group_description
}

# Optional single seeded user (admin-created). Cognito emails a temporary password
# via the default invite flow; the user sets a permanent one on first hosted-UI login.
resource "aws_cognito_user" "seed" {
  count = var.seed_user_email != "" ? 1 : 0

  user_pool_id = aws_cognito_user_pool.this.id
  username     = var.seed_user_email

  attributes = {
    email          = var.seed_user_email
    email_verified = "true"
  }

  # Let Terraform create the user but never fight Cognito over the password or
  # the account's post-first-login state.
  lifecycle {
    ignore_changes = [temporary_password, password, attributes]
  }
}

resource "aws_cognito_user_in_group" "seed" {
  count = var.seed_user_email != "" && var.user_group_name != "" ? 1 : 0

  user_pool_id = aws_cognito_user_pool.this.id
  group_name   = aws_cognito_user_group.this[0].name
  username     = aws_cognito_user.seed[0].username
}
