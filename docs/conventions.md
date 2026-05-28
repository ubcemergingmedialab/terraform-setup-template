# Conventions

These rules are deliberately short and strict. Following them is what makes the repo readable for new lab members and cheap to transplant to clients.

## The variable contract

Every project root (`projects/<client>/<project>/variables.tf`) must declare these five inputs. No exceptions:

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `client_name` | string | `"ubc-arts"` | Slug for the client. Used in resource names and tags. Lowercase, hyphen-separated, no spaces, max 24 chars. |
| `project_name` | string | `"splat-museum"` | Slug for the project. Same rules. |
| `environment` | string | `"dev"` or `"prod"` | Environment within the project. Default `"dev"` for single-env projects. |
| `aws_region` | string | `"us-west-2"` | The AWS region this project deploys into. |
| `tags` | map(string) | `{ Owner = "media-lab" }` | Extra tags to add on top of the defaults. |

Modules under `modules/` take whatever they need, but they *must* accept the relevant subset of these as inputs — never embed defaults like `"ubc"` inside a module.

## Naming

All resource names follow:

```
${var.client_name}-${var.project_name}-${var.environment}-<descriptor>
```

Examples:

| Resource | Name |
|----------|------|
| S3 bucket for site | `ubc-arts-splat-museum-prod-site` |
| CloudFront distribution (logically named in TF) | `ubc-arts-splat-museum-prod-cdn` |
| Lambda function | `ubc-arts-splat-museum-prod-api` |
| Cognito user pool | `ubc-arts-splat-museum-prod-users` |

S3 bucket names must be globally unique. If the simple name collides, append a short random suffix (use `random_id` resource), never a hardcoded one.

## Tagging

Every taggable AWS resource gets, at minimum:

```hcl
tags = merge(
  {
    Client      = var.client_name
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  },
  var.tags,
)
```

The cleanest pattern is to use the provider's `default_tags` block once at the project root, so individual resources don't repeat themselves:

```hcl
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
```

`default_tags` propagates to every resource the provider creates. Modules don't need to plumb tags through unless they create resources that don't inherit default tags (some IAM resources, for example).

## Folder shape

```
projects/<client>/<project>/
├── main.tf                       # composes modules, defines resources
├── variables.tf                  # the five contract variables (and any project-specific extras)
├── outputs.tf                    # exposes URLs / IDs the team needs
├── versions.tf                   # provider + Terraform + HCP cloud block
├── terraform.auto.tfvars         # filled-in values for this project (committed)
└── README.md                     # what this project is, who it's for
```

```
modules/<module-name>/
├── main.tf                       # resources
├── variables.tf                  # inputs
├── outputs.tf                    # outputs
├── versions.tf                   # required_providers + required_version
└── README.md                     # what it does, every input, every output
```

## What modules may and may not do

| Allowed | Not allowed |
|---------|-------------|
| Take any input as a variable | Reference anything under `projects/` |
| Provide sensible defaults for optional inputs | Hardcode account IDs, ARNs, bucket names, DNS zones |
| Create AWS resources | Read other modules' state (use outputs, plumbed at project level) |
| Output any value a consumer might need | Assume a specific AWS region, account, or HCP workspace |

## HCP `cloud` block

In every project's `versions.tf`:

```hcl
terraform {
  required_version = ">= 1.6"

  cloud {
    organization = "EML"                         # ← changes on transplant
    workspaces {
      name = "ubc-arts-splat-museum"           # ← matches HCP workspace name
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

When transplanting, the client's transplant checklist (`docs/transplant.md`) edits `organization` and (optionally) `workspaces.name`. Do not move this block into a module — it must live at the project root so transplant has exactly one place to edit per project.

## Sensitive values

Never commit secrets to git. If a project needs a third-party API key, an OAuth secret, etc.:

- Mark the variable `sensitive = true` in `variables.tf`.
- Leave it unset in `terraform.auto.tfvars`.
- Set the value as a **sensitive environment variable** in the HCP workspace UI.

Examples of values that go in HCP, not git: AWS access keys (use HCP dynamic credentials or AWS-OIDC if possible), third-party API tokens, Cognito identity provider client secrets.

## File hygiene

- All `.tf` files must pass `terraform fmt -check`. CI enforces this.
- Run `terraform validate` per module + per project root. CI enforces this.
- `tflint` warnings are reviewed in PR; warnings ≠ blockers but should be justified.
