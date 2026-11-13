# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
output "site_url" {
  description = "Public HTTPS URL of the courtroom SPA (CloudFront). Also the Cognito callback origin."
  value       = module.site.site_url
}

output "site_bucket_name" {
  description = "S3 bucket to sync the built SPA (dist/) into."
  value       = module.site.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation after deploy)."
  value       = module.site.cloudfront_distribution_id
}

# ---------------------------------------------------------------------------
# Auth (Cognito)
# ---------------------------------------------------------------------------
output "cognito_user_pool_id" {
  description = "Cognito user pool ID."
  value       = module.auth.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client ID (also the JWT audience the token API checks)."
  value       = module.auth.user_pool_client_id
}

output "cognito_hosted_ui_domain" {
  description = "Cognito hosted UI domain (login/logout). Prefix with https://."
  value       = module.auth.hosted_ui_domain
}

output "cognito_jwt_issuer" {
  description = "JWT issuer the token API's authorizer trusts."
  value       = module.auth.jwt_issuer
}

# ---------------------------------------------------------------------------
# Token service (API Gateway)
# ---------------------------------------------------------------------------
output "token_api_endpoint" {
  description = "Base URL of the token service. Frontend uses <endpoint>/token and <endpoint>/simli-token."
  value       = module.token_api.api_endpoint
}

output "livekit_webhook_url" {
  description = "Set this as the LiveKit project webhook URL so session-end releases the lock."
  value       = "${module.token_api.api_endpoint}/livekit-webhook"
}

# ---------------------------------------------------------------------------
# Agent (ECS)
# ---------------------------------------------------------------------------
output "agent_ecr_repository_url" {
  description = "ECR repository to push the agent image to (CI builds + pushes before apply)."
  value       = module.agent_repo.repository_url
}

output "agent_cluster_name" {
  description = "ECS cluster running the agent worker."
  value       = module.agent.cluster_name
}

output "agent_service_name" {
  description = "ECS service name (use for force-new-deployment on image updates)."
  value       = module.agent.service_name
}

# ---------------------------------------------------------------------------
# Single-session lock
# ---------------------------------------------------------------------------
output "session_lock_table_name" {
  description = "DynamoDB table backing the one-live-session lock."
  value       = aws_dynamodb_table.session_lock.name
}
