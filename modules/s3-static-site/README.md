# `s3-static-site`

Private S3 bucket fronted by CloudFront with Origin Access Control. The S3 bucket is **not** public — only CloudFront can read it, and only for this distribution. Good default for serving built web apps and 3D assets (Gaussian splat files, glTF, textures, HDR environment maps) globally with edge caching and HTTPS.

## Usage

```hcl
module "site" {
  source = "../../../modules/s3-static-site"

  name_prefix = local.name_prefix
}

output "site_url" {
  value = "https://${module.site.cloudfront_domain}"
}
```

## What it creates

- `aws_s3_bucket` — private, versioned, encrypted (SSE-S3), `BucketOwnerEnforced`. CORS configured for GET/HEAD.
- `aws_s3_bucket_public_access_block` — fully blocks public access.
- `aws_cloudfront_origin_access_control` — modern OAC (replaces the deprecated OAI).
- `aws_cloudfront_distribution` — HTTPS-only (redirect-to-https), HTTP/2 + IPv6 enabled, compressed, uses AWS managed `CachingOptimized` cache policy.
- `aws_s3_bucket_policy` — allows only this CloudFront distribution to GET objects from the bucket.

## Inputs

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name_prefix` | `string` | (required) | Name prefix shared by every resource. Typically `${client_name}-${project_name}-${environment}` from the caller. |
| `spa_routing` | `bool` | `true` | If true, route 403/404 → `/index.html` with status 200. Set false for static sites with real per-page files. |
| `price_class` | `string` | `"PriceClass_100"` | CloudFront price class. `PriceClass_100` = US/CA/EU only (cheapest). Use `PriceClass_All` for global. |
| `default_root_object` | `string` | `"index.html"` | File served when a request hits `/`. |
| `cors_allowed_origins` | `list(string)` | `["*"]` | Origins allowed to load assets via CORS. |

## Outputs

| Name | Description |
|------|-------------|
| `bucket_name` | Name of the S3 bucket. |
| `bucket_arn` | ARN of the S3 bucket. |
| `bucket_regional_domain_name` | Regional domain name (used as the CloudFront origin). |
| `cloudfront_distribution_id` | Distribution ID — use this for cache invalidations after deploying new content. |
| `cloudfront_domain` | The `*.cloudfront.net` domain serving the site. |
| `cloudfront_arn` | Distribution ARN. |

## How a project deploys content to this site

This module provisions the *infrastructure*. Deploying actual files (the built web app, the `.splat` files, etc.) is a separate concern — it's done from CI in the application repo, not from Terraform. The typical flow:

1. App build produces a `dist/` directory.
2. CI uses `aws s3 sync dist/ s3://<bucket_name>/ --delete` to upload.
3. CI runs `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"` to flush caches.

Outputs from this module (`bucket_name`, `cloudfront_distribution_id`) feed those CI steps.

## Notes for VR / 3D content

For workloads that need `SharedArrayBuffer` (some WebXR, some WebAssembly + threads use cases), browsers require COOP/COEP headers. This module does **not** add them — adding them is a future enhancement (a `response_headers_policy` on the distribution). Until then, host such content on a path that doesn't need cross-origin isolation, or call out the gap to whoever's adding it.
