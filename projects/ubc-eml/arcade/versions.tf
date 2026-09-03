terraform {
  required_version = ">= 1.6"

  cloud {
    organization = "EML"

    workspaces {
      name = "ubc-eml-arcade"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Suffix for a globally-unique bucket name on a fresh (non-imported) deploy.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    # Builds the placeholder Lambda archive. Real code ships out-of-band.
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = merge(
      {
        Client      = var.client_name
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags,
    )
  }
}
