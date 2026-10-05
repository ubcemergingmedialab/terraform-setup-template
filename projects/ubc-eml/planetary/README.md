# `ubc-eml-planetary`

Hosts a **Unity WebGL build** as a static site: private S3 bucket fronted by
CloudFront with Origin Access Control (OAC), HTTPS via the default CloudFront
certificate.

- **Client:** `ubc-eml`
- **Project:** `planetary`
- **Environment:** `prod`
- **Region:** `ca-central-1`
- **HCP workspace:** `ubc-eml-planetary`
- **HCP working directory:** `projects/ubc-eml/planetary`
- **Name prefix:** `ubc-eml-planetary-prod`

## What this stack provisions

| Resource | Purpose |
|----------|---------|
| S3 bucket (`ubc-eml-planetary-prod-site-<hex>`) | Private origin holding the Unity WebGL build |
| CloudFront distribution + OAC | Public HTTPS CDN in front of the bucket |

That's the whole architecture. No Lambda, DynamoDB, Cognito, or API Gateway —
hosting a WebGL build needs none of them, which keeps cost minimal.

### Why `spa_routing = false`

Unity WebGL is a single page with no client-side router. Routing 403/404 to
`index.html` (the module's SPA default) would mask broken `Build/` asset paths
and return HTML where a `.wasm`/`.data` file is expected. We want real 404s, so
`spa_routing` is set to `false` in `main.tf`.

## Cost

- CloudFront uses `PriceClass_100` (module default) — the cheapest edge set
  (US/CA/EU). Egress for a lab viewer sits inside the free tier.
- S3 holds a few MB–hundreds of MB of static files: pennies/month.
- Default `*.cloudfront.net` certificate, so no ACM / custom-domain cost.

## HCP setup (VCS-driven, no local CLI)

1. Merge this directory on a branch via PR (CI runs fmt/validate/tflint).
2. Create HCP workspace **`ubc-eml-planetary`** in org `EML`, VCS-connected,
   working directory `projects/ubc-eml/planetary`.
3. Wire dynamic credentials to the shared `HCPTerraform` OIDC role
   (`TFC_AWS_PROVIDER_AUTH=true`, `TFC_AWS_RUN_ROLE_ARN=...:role/HCPTerraform`).
4. Attach the scoped IAM policy
   [`docs/iam/hcp-terraform-ubc-eml-planetary-policy.json`](../../../docs/iam/hcp-terraform-ubc-eml-planetary-policy.json)
   to the `HCPTerraform` role (inline policy name `ubc-eml-planetary`).
5. Add the OIDC trust row for this workspace (see below).
6. Merge to `main` → HCP plan/apply.

### OIDC trust row to add on `HCPTerraform`

Add this value to the `app.terraform.io:sub` condition in the role's trust
policy (match the HCP project name and `run_phase` style used by the existing
`ubc-eml-virtual-soils` row):

```
organization:EML:project:<HCP_PROJECT>:workspace:ubc-eml-planetary:run_phase:*
```

## Deploying the build (not Terraform)

After the first apply, read the outputs and sync the build:

```bash
# Uncompressed Unity build (simplest — recommended for S3):
aws s3 sync <build_dir>/ s3://$(terraform output -raw site_bucket_name)/ --delete
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

If the Unity build has **gzip/brotli compression enabled**, the compressed
`Build/*.gz` (or `*.br`) objects must be uploaded with the matching
`Content-Encoding` metadata or the browser cannot decode them. Easiest path:
disable compression in Unity Player Settings. Otherwise upload the compressed
files in a second pass with `--content-encoding` and the correct
`--content-type` per extension (`application/wasm`, `application/javascript`,
`application/octet-stream` for `.data`).

Use a narrow GitHub Actions deploy role for the sync/invalidation — not
`HCPTerraform`. See `docs/iam/github-deploy-virtual-soils-policy.json` for the
pattern.
