# Lab Shared Infrastructure

This directory contains Terraform projects for **account-level infrastructure** that is shared across the entire lab, not specific to any client project.

## What Goes Here

Infrastructure that applies to the entire AWS account, not tied to a specific client or project:

- **Authentication systems** (IAM OIDC, SSO)
- **Cost tracking and governance** (AWS Budgets, Cost Anomaly Detection)
- **Security baseline** (AWS Config, GuardDuty, Security Hub)
- **Shared networking** (Transit Gateway, VPN)
- **Centralized logging** (CloudTrail aggregation, S3 access logs)

## What Does NOT Go Here

Client-specific projects belong in `projects/<client>/`:
- S3 buckets for client sites
- CloudFront distributions for client apps
- Cognito user pools for client authentication
- Lambda functions for client APIs
- EC2/ECS for client workloads

## Current Projects

### bedrock-auth

IAM OIDC authentication for Claude Code and Claude Cowork access to Amazon Bedrock.

**What it does**: Enables team members to use Claude Code/Desktop with Bedrock via enterprise SSO (Okta, Azure AD, etc.) instead of managing AWS IAM users.

**Status**: Ready to deploy (requires OIDC provider configuration)

See: `projects/lab-shared/bedrock-auth/README.md`

---

## Naming Convention

Projects in this directory follow the standard lab convention but use `lab-shared` as the client name:

```
lab-shared-{project-name}-{environment}
```

Examples:
- `lab-shared-bedrock-auth-prod`
- `lab-shared-cost-monitoring-prod`
- `lab-shared-security-baseline-prod`

## Environment Strategy

Most lab-shared projects use **only production** (`environment = "prod"`):
- Authentication infrastructure
- Security baseline
- Cost monitoring
- Shared networking

Some may have dev/staging for testing major changes:
- Complex security policies
- Custom Lambda@Edge functions
- Experimental governance rules

## HCP Terraform Workspaces

Each project gets one HCP workspace per environment:
- `lab-shared-bedrock-auth` (prod only)
- `lab-shared-cost-monitoring` (prod only)
- `lab-shared-security-baseline` (prod only)

## Deployment

Lab-shared projects deploy to **the lab's primary AWS account**, not client accounts.

For projects that need to replicate to client accounts during transplant (rare), document the process in the project's README.

## Adding a New Lab-Shared Project

1. Create `projects/lab-shared/{project-name}/`
2. Follow standard project structure (main.tf, variables.tf, outputs.tf, versions.tf, terraform.auto.tfvars, README.md)
3. Set `client_name = "lab-shared"` in terraform.auto.tfvars
4. Create HCP workspace: `lab-shared-{project-name}`
5. Document in this README
6. Submit PR for review

---

**Rule of thumb**: If every client would need their own copy, it belongs in `projects/{client}/`. If it's one deployment for the whole lab AWS account, it belongs here.
