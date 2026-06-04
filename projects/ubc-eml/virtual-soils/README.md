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
| **S3 + CloudFront** (`module.viewer_site`, suffix `site`) | Public viewer app (`apps/viewer/dist`) |
| **S3 + CloudFront** (`module.admin_site`, suffix `admin`) | Admin + editor app (`apps/admin/dist`) |
| S3 assets bucket + optional CDN (`module.assets`) | Splats / DynamoDB backup exports; **`assets_cdn_url`** for public splat URLs |

## Frontend deploy (app repo CI, not Terraform)

After apply, use HCP outputs:

| Output | Use |
|--------|-----|
| `viewer_site_url` / `site_url` | Viewer app URL |
| `viewer_site_bucket_name` / `site_bucket_name` | `aws s3 sync apps/viewer/dist` |
| `viewer_cloudfront_distribution_id` / `cloudfront_distribution_id` | Viewer invalidation |
| `admin_site_url` | Admin app URL; **Cognito** callback/logout |
| `admin_site_bucket_name` | `aws s3 sync apps/admin/dist` |
| `admin_cloudfront_distribution_id` | Admin invalidation |
| `assets_cdn_url` | DynamoDB `File` / `Thumbnail` base URL (`{url}/splats/…`) |
| `api_endpoint` | `VITE_PUBLIC_API_URL` / `VITE_ADMIN_API_URL` at build time |
| Cognito outputs | `VITE_COGNITO_*` (admin build only) |

After admin site apply, add `admin_site_url` to `cognito_callback_urls` / `cognito_logout_urls`, and both viewer + admin URLs to `cors_allow_origins`, then re-apply.

### State migration (HCP, no CLI)

HCP Terraform does **not** offer a console button for `terraform state mv`. You have two options:

**Option A — Recommended (no CLI): `moved` block**

The repo includes `state-migration.tf`:

```hcl
moved {
  from = module.site[0]
  to   = module.viewer_site[0]
}
```

Merge to `main` and run a normal **Plan → Apply** in HCP. The plan should show **moved** (or no destroy/recreate for the viewer bucket/CloudFront). Only **new** admin site resources should be **created**.

If the plan still wants to **destroy** `module.site` and **create** `module.viewer_site`, the workspace never had `module.site` (fresh stack) — remove `state-migration.tf` or ignore the moved block.

**Option B — Local CLI (only if Option A fails)**

Requires Terraform CLI on your machine, `terraform login`, and the same `cloud { organization = "EML" workspaces { name = "ubc-eml-virtual-soils" } }` block in `versions.tf`. Then:

```bash
cd projects/ubc-eml/virtual-soils
terraform init
terraform state mv 'module.site[0]' 'module.viewer_site[0]'
```

Some workspaces use **remote execution only**, which blocks local `state mv` until an admin sets **Execution mode → Local** temporarily (Workspace → Settings → General).

**Option C — Avoid migration entirely**

Keep the viewer module named `module.site` in code and only add `module.admin_site`. That was not used here so outputs could be named `viewer_*` clearly.

## Application repo

Frontend code: **`25---1002-SOIL-SCIENCE`**. Keep `lambda-handler.mjs` in sync with `lambda/handler.mjs` here when API behavior changes.

## Lambda package

```bash
cd projects/ubc-eml/virtual-soils/lambda && npm ci
```

## Documentation

- **[Deployment runbook (IAM, debugging, lessons)](../../docs/virtual-soils-hcp-deployment.md)**
- **[HCPTerraform IAM policy (JSON)](../../docs/iam/hcp-terraform-virtual-soils-policy.json)** — update before applying `module.site`
- [Importing existing resources + DynamoDB backup zip workflow](../../docs/virtual-soils-import-existing.md)
- [Portable DynamoDB export/import scripts](../scripts/dynamodb-backup/)
