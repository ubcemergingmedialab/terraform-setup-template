# Episode infrastructure

Terraform infrastructure for the Episode project.

## EPISODE API and database

Set `aws_region = "ca-central-1"` and enable `enable_episode_database`.
Terraform creates the dedicated VPC, private subnets, route tables, Aurora
cluster and the consolidated EPISODE API. Aurora remains private. The Lambda
controllers use the RDS Data API, so they do not need VPC attachment or database
ingress rules.

The VPC has no Internet Gateway or NAT Gateway. This is intentional: Aurora is
accessed through the RDS Data API, and the Lambda functions remain outside the
VPC. One API Gateway HTTP API routes public operations to `public.handler` and
instructor operations to `authenticated.handler`. Each handler has its own
Lambda execution role and CloudWatch log group.

The API routes are:

- Public/auth: `POST /auth/login`, `POST /auth/forgot-password`,
	`POST /auth/confirm-password`, `GET /scenarios/{linkToken}`, and
	`POST /attempts`.
- Instructor: scenario management, scenario-link management, and analytics
	under `/instructor/*`. These routes require a Cognito JWT at API Gateway.

Apply `lambda/database-controller/schema.sql` to the Aurora database before
using the API. The migration is intentionally not run by Lambda cold starts.
The Lambda package uses `package-lock.json`; run `npm ci` in the controller
directory before a deployment package is produced.

Example public call:

```bash
curl "$EPISODE_API/scenarios/<scenario-link-token>"
```

Example authenticated call:

```bash
curl -X GET "$EPISODE_API/instructor/scenarios" \
  -H "Authorization: Bearer <cognito-access-token>" \
```

The frontend should use the `episode_api_endpoint` output as
`VITE_API_BASE_URL`. Its TypeScript service layer owns request composition and
its Cognito UI guards, while API Gateway remains the authoritative protection
for instructor routes.

## Deployment notes

1. Copy `terraform.auto.tfvars.example` to `terraform.auto.tfvars` and set the
	client-specific values.
2. Keep the HCP workspace set to `ubc-eml-episode` in `versions.tf`.
3. Confirm the VPC CIDR and two private `ca-central-1` subnet CIDRs do not
	overlap with any client network before applying.
4. The first apply also requires the HCP Terraform role to allow RDS,
	Secrets Manager, EC2 security-group, and Data API-related read operations.

## What's already wired up for you

- The variable contract (`client_name`, `project_name`, `environment`, `aws_region`, `tags`) with validation.
- `provider "aws"` with `default_tags` that propagate `Client` / `Project` / `Environment` / `ManagedBy` tags to every taggable resource.
- The `local.name_prefix` value that every module expects: `${client_name}-${project_name}-${environment}`.
- The HCP `cloud {}` block in `versions.tf`, ready for you to set the workspace name.

## What's intentionally not in the template

- Specific module instances — uncomment what you need.
- `terraform.auto.tfvars` with real values — that's per-project, you fill it in.
- Lambda source code, CloudFront response-header configs, etc. — module-level concerns, configured at the call site.
