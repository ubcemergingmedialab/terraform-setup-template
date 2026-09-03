output "storage_bucket_name" {
  description = "Name of the bucket holding stories, assets, markers and exhibits."
  value       = aws_s3_bucket.storage.id
}

output "storage_bucket_arn" {
  description = "ARN of the storage bucket."
  value       = aws_s3_bucket.storage.arn
}

output "storage_public_base_url" {
  description = "Base URL published content is served from. Goes into the app's VITE_ASSET_BASE_URL / VITE_STORY_BASE_URL."
  value       = "https://${aws_s3_bucket.storage.id}.s3.${var.aws_region}.amazonaws.com"
}

output "api_function_name" {
  description = "Name of the API Lambda. This is what `npm run build:lambda` uploads to."
  value       = aws_lambda_function.api.function_name
}

output "api_function_url" {
  description = "Lambda Function URL for the API. Always ends in a trailing slash."
  value       = aws_lambda_function_url.api.function_url
}

output "api_role_arn" {
  description = "ARN of the Lambda execution role. Named as a principal in the bucket policy."
  value       = aws_iam_role.lambda_exec.arn
}

# Amplify is not managed by this stack (see README.md § What this does not
# manage), but its two rewrite rules must be typed into the console by hand and
# getting them subtly wrong is a known way to break the site. These outputs
# print the exact values, so nobody has to reconstruct them.

output "amplify_rewrite_api_target" {
  description = "Paste as the TARGET of the Amplify rewrite whose source is `/api/<*>`, at status 200. Note there is no slash between the function URL and `api` — a double slash makes the router 404."
  value       = "${trimsuffix(aws_lambda_function_url.api.function_url, "/")}/api/<*>"
}

output "amplify_rewrite_markers_target" {
  description = "Paste as the TARGET of the Amplify rewrite whose source is `/image-targets/<*>`, at status 200. Marker images must be served same-origin, because the AR engine resolves imagePath relative to the page."
  value       = "https://${aws_s3_bucket.storage.id}.s3.${var.aws_region}.amazonaws.com/markers/<*>"
}
