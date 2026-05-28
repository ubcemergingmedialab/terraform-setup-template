# Virtual Soils — Terraform (HCP)

Infrastructure for the [Virtual Soils](https://github.com/) web app (`25---1002-SOIL-SCIENCE`): DynamoDB fields table, Cognito admin auth, HTTP API + Lambda, optional S3 assets bucket.

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
| S3 bucket (optional) | Large splat/assets storage |

## Application repo

Frontend and 3D viewer code live in **`25---1002-SOIL-SCIENCE`**. After apply, set Amplify / `.env` from HCP outputs (`api_endpoint`, Cognito IDs). Keep `lambda-handler.mjs` in the app repo in sync with `lambda/handler.mjs` here when you change API behavior.

## Lambda package

HCP remote runs need `node_modules` under `lambda/` before plan:

```bash
cd projects/ubc-eml/virtual-soils/lambda && npm ci
```

GitHub Actions in this repo runs the same step on PRs.

## Importing existing AWS resources

See [`docs/virtual-soils-import-existing.md`](../../docs/virtual-soils-import-existing.md).
