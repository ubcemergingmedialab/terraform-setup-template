# `s3-static-site`

Private S3 bucket fronted by CloudFront with Origin Access Control (OAC). Intended for built SPAs (Vite/React, etc.).

## Usage

```hcl
module "site" {
  source = "../../../modules/s3-static-site"

  name_prefix = local.name_prefix
  spa_routing = true
}
```

## Deploy content (not Terraform)

1. `npm run build` → `dist/`
2. `aws s3 sync dist/ s3://<bucket_name>/ --delete`
3. `aws cloudfront create-invalidation --distribution-id <cloudfront_distribution_id> --paths "/*"`

## Inputs

See `variables.tf`. Key: `name_prefix`, `spa_routing` (default `true`).

## Outputs

`bucket_name`, `cloudfront_distribution_id`, `cloudfront_domain`, `site_url`.
