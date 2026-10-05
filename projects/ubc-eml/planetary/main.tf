locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

# Unity WebGL build hosted as static files on a private S3 bucket fronted by
# CloudFront (Origin Access Control). A Unity WebGL build is index.html plus a
# Build/ and TemplateData/ folder, so the s3-static-site module serves it as-is.
#
# spa_routing = false: Unity is NOT a client-side-routed SPA. A missing asset
# should return a real 404 instead of being rewritten to index.html (which would
# mask broken Build/ paths and serve HTML where a .wasm/.data is expected).
#
# price_class defaults to PriceClass_100 (US/CA/EU edges) — the cheapest option.
module "site" {
  source = "../../../modules/s3-static-site"

  name_prefix        = local.name_prefix
  bucket_name_suffix = "site"
  spa_routing        = false
}
