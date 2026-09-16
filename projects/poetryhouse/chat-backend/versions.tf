terraform {
  required_version = ">= 1.6"

  cloud {
    organization = "EML"

    workspaces {
      # Create this workspace in HCP Terraform, then match the name here.
      name = "ubc-poetryhouse-chat-backend"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.24.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4"
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
