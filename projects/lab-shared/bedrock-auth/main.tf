# projects/lab-shared/bedrock-auth/main.tf
#
# Lab-wide authentication infrastructure for Claude Code/Cowork with Amazon Bedrock
# This is account-level infrastructure, not client-specific

terraform {
  required_version = ">= 1.5.0"

  # HCP Terraform configuration - update organization and workspace names
  cloud {
    organization = "your-lab-organization"  # TODO: Replace with your HCP org name

    workspaces {
      name = "lab-shared-bedrock-auth"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ===============================================
# Provider Configuration
# ===============================================

provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
  default_tags {
    tags = merge(
      {
        Client      = var.client_name
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
        Purpose     = "Claude Code Authentication"
      },
      var.tags,
    )
  }
}

# ===============================================
# Data Sources
# ===============================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ===============================================
# Bedrock OIDC Authentication Module
# ===============================================

module "bedrock_auth" {
  source = "../../../modules/bedrock-oidc-auth"

  # Naming follows lab convention: client-project-environment
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"

  # OIDC Provider Configuration
  # These values come from your IdP setup (Okta, Azure AD, Auth0, etc.)
  oidc_provider_domain = var.oidc_provider_domain
  oidc_client_id       = var.oidc_client_id
  oidc_thumbprint_list = var.oidc_thumbprint_list
  provider_type        = var.oidc_provider_type

  # Federation Configuration
  federation_type       = var.federation_type
  identity_pool_name    = var.cognito_identity_pool_name
  enable_principal_tags = var.enable_principal_tags

  # Bedrock Access Control
  allowed_bedrock_regions = var.allowed_bedrock_regions

  # Monitoring
  enable_monitoring   = var.enable_monitoring
  log_retention_days  = var.log_retention_days

  # Pass through default tags
  tags = merge(
    var.tags,
    {
      Component = "authentication"
    }
  )
}
