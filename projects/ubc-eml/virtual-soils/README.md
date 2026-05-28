# Virtual Soils — Terraform (HCP)

Infrastructure for the [Virtual Soils](https://github.com/) web app (`25---1002-SOIL-SCIENCE`): DynamoDB, Cognito, API + Lambda, CloudFront static site, optional assets bucket.

## HCP workspace

| Setting | Value |
|---------|--------|
| Organization | `EML` |
| Workspace name | `ubc-eml-virtual-soils` |
| **Working directory** | `projects/ubc-eml/virtual-soils` |
| VCS repo | **This lab-terraform monorepo** (not the app repo) |
| Auto apply | Per lab policy (many workspaces use apply on merge to `main`) |

## What it creates

| Resource | Purpose |
|----------|---------|
| DynamoDB | Field records (`FieldID`, map/viewer metadata) |
| Cognito user pool + OAuth client | `/admin` sign-in |
| API Gateway HTTP API + Lambda | `GET /pins`, `GET /fields`, admin CRUD on `/admin/api/fields` |
| **S3 + CloudFront** (`module.site`) | Frontend hosting (Vite build → `dist/`) |
| S3 assets bucket (optional) | Splats / DynamoDB backup exports |

## Frontend deploy (app repo CI, not Terraform)

After apply, use HCP outputs:

| Output | Use |
|--------|-----|
| `site_url` | Public app URL (`https://….cloudfront.net`) |
| `site_bucket_name` | `aws s3 sync dist/ s3://…` |
| `cloudfront_distribution_id` | `aws cloudfront create-invalidation …` |
| `api_endpoint` | `VITE_API_URL` at build time |
| Cognito outputs | `VITE_COGNITO_*` at build time |

After first apply, add `site_url` callback/logout paths to `cognito_callback_urls` / `cognito_logout_urls` and `cors_allow_origins`, then re-apply.

## Application repo

Frontend code: **`25---1002-SOIL-SCIENCE`**. Keep `lambda-handler.mjs` in sync with `lambda/handler.mjs` here when API behavior changes.

## Lambda package

```bash
cd projects/ubc-eml/virtual-soils/lambda && npm ci
```

## Documentation

- **[Deployment runbook (IAM, debugging, lessons)](../../docs/virtual-soils-hcp-deployment.md)**
- **[HCPTerraform IAM policy (JSON)](../../docs/iam/hcp-terraform-virtual-soils-policy.json)** — update before applying `module.site`
- [Importing existing resources](../../docs/virtual-soils-import-existing.md)
