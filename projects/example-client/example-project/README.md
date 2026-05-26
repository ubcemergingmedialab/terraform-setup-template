# example-client / example-project

A worked example project. Use it as a reference for what a finished project root looks like:

- The five contract variables declared in `variables.tf`.
- Filled-in values in `terraform.auto.tfvars`.
- HCP cloud block + AWS provider with `default_tags` in `versions.tf`.
- `main.tf` composes one module (`s3-static-site`) and nothing else.
- `outputs.tf` exposes the public URL.

This project is intentionally minimal — it provisions one static site bucket + CloudFront. Real lab projects usually compose 2-4 modules together. Read [`projects/_template/main.tf`](../../_template/main.tf) to see all the commented-out module blocks you can uncomment.
