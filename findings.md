# Findings

Research notes, discoveries, and external context gathered while building the lab-terraform repo.

## Lab profile (from brainstorming session 2026-05-26)

- Emerging media lab.
- Builds VR / AR / web apps / Gaussian-splat-based 3D web apps.
- Clients are universities and educational institutions.
- Lab does development in its own shared AWS account, then transplants the terraform files to the client's AWS account at product delivery.
- Workflow: GitHub stores .tf, HCP Terraform pulls from the repo (VCS-driven workspaces) and runs plan/apply. No local CLI is available to lab members.

## Why monorepo modules/ + projects/

User asked: "why we put infra separate, I thought everything is in one terraform." Answer in repo docs:

- Modules are reusable definitions (function-like). Projects are deployments (call-like).
- Without separation: copy-paste of S3+CF code across N projects; transplanting one client means leaking others; one HCP workspace tracks everything (huge blast radius).
- With separation: each project = one HCP workspace = one deployment unit = one transplant unit.

## HCP Terraform VCS-driven workflow notes

- Workspace is configured with `Working Directory` = `projects/<client>/<project>`.
- Workspace `VCS branch` typically `main`.
- Plans run on PRs (speculative); applies run on merge.
- A workspace also points at any path *outside* its working directory it depends on (used so modules under `modules/` trigger a plan when changed). Configure via "Trigger patterns" / "VCS triggers" in the workspace settings.
- HCP `cloud { organization, workspaces { name } }` block in versions.tf — values must be parameterizable for transplant. Recommend leaving the org/name in versions.tf but documenting clearly that on transplant the client edits these to their org/workspace name.

## Variable contract rationale

Every project root takes `client_name`, `project_name`, `environment`, `aws_region`, `tags`. Reasons:

- Consistent naming `${client_name}-${project_name}-${environment}-<resource>` — easy to find resources, no clashes in shared accounts.
- A single `tags` map merged with `Project`, `Client`, `Environment`, `ManagedBy = "terraform"` at the root and passed down — supports billing reports, cost allocation, lifecycle ownership.
- When transplanted, the client only changes `client_name` (or replaces with their own slug) and AWS provider creds — no module internals.

## Module catalog (v1 scope)

| Module | Purpose | Key AWS resources |
|--------|---------|-------------------|
| s3-static-site | Host built web app + 3D assets behind CDN | S3 (private), CloudFront, OAC, CloudFront response headers policy for COOP/COEP if needed for SharedArrayBuffer |
| cognito-user-pool | User auth for gated content | aws_cognito_user_pool, aws_cognito_user_pool_client, (optional) aws_cognito_identity_pool |
| lambda-http-api | Backend API endpoints | aws_lambda_function, aws_apigatewayv2_api, aws_apigatewayv2_route, aws_apigatewayv2_integration, aws_cloudwatch_log_group |
| ecs-fargate-service | Longer-running containerized services | aws_ecs_cluster, aws_ecs_service, aws_ecs_task_definition, aws_lb, aws_lb_listener, aws_lb_target_group |
| ec2-gpu-worker | GPU compute for splat training | aws_instance (g4dn/g5), optional spot, aws_iam_role, aws_security_group |

## Things deliberately OUT of v1 scope

- Route53 + ACM: user did not select these. Sites will use default `*.cloudfront.net` domain. If a project later needs a custom domain, we add a `cloudfront-custom-domain` module then.
- Multi-environment (dev/prod) per project: YAGNI. Added when a project earns it.
- Composite/opinionated modules ("media-site" bundling S3+CF+Cognito+Lambda): YAGNI. Compose at project level for now.
- A new-project scaffolding script: future enhancement once usage patterns stabilize.

## Useful references

- HCP Terraform VCS-driven workflow: https://developer.hashicorp.com/terraform/cloud-docs/run/ui
- CloudFront + S3 + OAC (modern replacement for OAI): https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- COOP/COEP for SharedArrayBuffer (relevant for some WebXR / WebGL workloads): https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy
