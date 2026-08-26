# Garden Capture (coFood) — Terraform (HCP)

Infrastructure for the [GardenCapture](https://github.com/) web app: DynamoDB (single table), Cognito, API + Lambda, CloudFront static sites, assets bucket for splats and media.

Greenfield stack mirrored from Virtual Soils (`projects/ubc-eml/virtual-soils`), with garden-oriented API routes. Designed to be copied for other gardens later (change `client_name` / `project_name` / workspace).

## HCP workspace

| Setting | Value |
|---------|--------|
| Organization | `EML` |
| Workspace name | `cofood-garden-capture` |
| **Working directory** | `projects/cofood/garden-capture` |
| VCS repo | **This lab-terraform monorepo** (not the app repo) |
| Auto apply | Per lab policy |

Create the HCP workspace before the first apply, and attach IAM permissions for the `cofood-garden-capture-*` name prefix (see [IAM policy](../../../docs/iam/hcp-terraform-garden-capture-policy.json)).

## What it creates

| Resource | Purpose |
|----------|---------|
| DynamoDB | Single table (`…-garden`) — capture + hotspot items (`Id` PK, `EntityType`) |
| Cognito user pool + OAuth client | `/admin` steward sign-in |
| API Gateway HTTP API + Lambda | Public captures/hotspots + JWT admin CRUD |
| **S3 + CloudFront** (`module.viewer_site`, suffix `site`) | Public viewer (`apps/viewer/dist`) |
| **S3 + CloudFront** (`module.admin_site`, suffix `admin`) | Admin + editor (`apps/admin/dist`) |
| S3 assets bucket + CDN (`module.assets`) | Splats + media; use **`assets_cdn_url`** in stored URLs |

Not included (by design for cost/simplicity): IAM API invoker, ECS Fargate, EC2 GPU worker.

## API routes

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/captures` | none | Public captures (`visibility=public`; optional allowlist via `public_capture_ids`) |
| GET | `/captures/{id}` | none | Single public capture |
| GET | `/hotspots` | none | Public hotspots; optional `?captureId=` |
| GET/POST/PUT/DELETE | `/admin/api/captures` | JWT | Steward CRUD |
| GET/POST/PUT/DELETE | `/admin/api/hotspots` | JWT | Steward CRUD; POST requires `captureId`; GET supports `?captureId=` |

### Item shape (DynamoDB)

Shared hash key `Id`. Always set `EntityType` to `capture` or `hotspot` (the Lambda sets this on write).

**Capture (example):** `Id`, `EntityType=capture`, `siteId`, `label`, `capturedAt`, `splatUrl`, `thumbnailUrl`, `notes`, `visibility`

**Hotspot (example):** `Id`, `EntityType=hotspot`, `captureId`, `position`, `icon`, `scale`, `title`, `summary`, `contentType`, `tags`, `visibility`, `media`

## Frontend deploy (app repo CI, not Terraform)

After apply, use HCP outputs:

| Output | Use |
|--------|-----|
| `viewer_site_url` | Viewer app URL |
| `viewer_site_bucket_name` | `aws s3 sync apps/viewer/dist` |
| `viewer_cloudfront_distribution_id` | Viewer invalidation |
| `admin_site_url` | Admin app URL; **Cognito** callback/logout |
| `admin_site_bucket_name` | `aws s3 sync apps/admin/dist` |
| `admin_cloudfront_distribution_id` | Admin invalidation |
| `assets_cdn_url` | Base for splat/media HTTPS URLs |
| `api_endpoint` | `VITE_PUBLIC_API_URL` / `VITE_ADMIN_API_URL` at build time |
| Cognito outputs | `VITE_COGNITO_*` (admin build only) |

### After first apply

1. Copy `admin_site_url` into `cognito_callback_urls` / `cognito_logout_urls`.
2. Add both viewer and admin CloudFront URLs to `cors_allow_origins`.
3. Re-apply.

## Application repo

Frontend code: **`GardenCapture`**. Keep a copy of this Lambda in sync with the app repo when API behavior changes (same pattern as Virtual Soils ↔ `lambda-handler.mjs`).

## Lambda package

```bash
cd projects/cofood/garden-capture/lambda && npm ci
```

HCP builds the zip from this folder (including `node_modules`); run `npm ci` before committing lockfile changes.

## Transplant / other gardens

Name prefix is `${client_name}-${project_name}-${environment}` (e.g. `cofood-garden-capture-prod`). To stand up another garden:

1. Copy this project folder under `projects/<client>/<project>/`.
2. Update `versions.tf` workspace name, `terraform.auto.tfvars`, and tags.
3. Create a matching HCP workspace + scoped IAM policy for the new prefix.
4. Apply fresh (no shared state with this stack).

## Documentation

- Virtual Soils sibling stack: [`../ubc-eml/virtual-soils/README.md`](../../ubc-eml/virtual-soils/README.md)
- [HCP Terraform IAM policy (JSON)](../../../docs/iam/hcp-terraform-garden-capture-policy.json)
- [GitHub deploy IAM (site sync + invalidation)](../../../docs/iam/github-deploy-garden-capture-policy.json)
