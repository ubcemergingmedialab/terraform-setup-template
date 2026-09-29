terraform {
  required_version = ">= 1.6"

  cloud {
    organization = "EML"

    workspaces {
      name = "ubc-eml-np-chat"
    }
  }

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # >= 5.72 required for the `invoked_via_function_url` argument on
      # aws_lambda_permission (added Nov 2024). Sibling projects resolve 5.100.
      version = ">= 5.72, < 6.0"
    }
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
