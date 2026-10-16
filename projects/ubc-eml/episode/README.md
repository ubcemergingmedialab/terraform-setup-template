# Episode infrastructure

Terraform infrastructure for the Episode project.

## Database boilerplate

Set `aws_region = "ca-central-1"` and enable `enable_episode_database`.
Terraform creates the dedicated VPC, private subnets, route tables, Aurora
cluster, and both database APIs. Aurora remains private. The Lambda controllers
use the RDS Data API, so they do not need VPC attachment or database ingress
rules.

The VPC has no Internet Gateway or NAT Gateway. This is intentional: Aurora is
accessed through the RDS Data API, and the Lambda functions remain outside the
VPC. The two API modules create separate Lambda execution roles and attach
CloudWatch logging plus Aurora Data API and Secrets Manager runtime policies.

There are two deliberately separate APIs:

	- `database_public_api_endpoint`: unauthenticated `GET /records` and
		`GET /records/{id}`. This controller is read-only by route and handler.
	- `database_authenticated_api_endpoint`: Cognito JWT-protected
		`POST /admin/api/records`, `PUT /admin/api/records/{id}`, and
		`DELETE /admin/api/records/{id}`. The handler receives the
		verified subject at `requestContext.authorizer.jwt.claims.sub`.

The handlers currently return `501 database_schema_pending`. They are wiring
boilerplate only; SQL, tables, filtering, validation, and record-level access
rules must wait for the approved schema specification.

Example public call:

```bash
curl "$PUBLIC_DATABASE_API/records"
curl "$PUBLIC_DATABASE_API/records/example-id"
```

Example authenticated calls:

```bash
curl -X POST "$AUTH_DATABASE_API/admin/api/records" \
  -H "Authorization: Bearer <cognito-access-token>" \
  -H "content-type: application/json" \
  -d '{"replace-with":"approved-payload"}'

curl -X PUT "$AUTH_DATABASE_API/admin/api/records/example-id" \
  -H "Authorization: Bearer <cognito-access-token>" \
  -H "content-type: application/json" \
  -d '{"replace-with":"approved-payload"}'
```

Equivalent browser calls use `fetch()` with the same URL and bearer header.

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
