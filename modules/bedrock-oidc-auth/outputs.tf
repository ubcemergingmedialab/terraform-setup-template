# modules/bedrock-oidc-auth/outputs.tf

# ===============================================
# OIDC Provider Outputs
# ===============================================

output "oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider"
  value       = aws_iam_openid_connect_provider.bedrock.arn
}

output "oidc_provider_url" {
  description = "URL of the OIDC provider"
  value       = aws_iam_openid_connect_provider.bedrock.url
}

# ===============================================
# Federation Outputs
# ===============================================

output "federation_type" {
  description = "The federation type in use (direct or cognito)"
  value       = var.federation_type
}

output "federated_role_arn" {
  description = "ARN of the federated IAM role (either direct STS or Cognito authenticated role)"
  value = var.federation_type == "direct" ? (
    aws_iam_role.bedrock_federated[0].arn
    ) : (
    aws_iam_role.cognito_authenticated[0].arn
  )
}

output "federated_role_name" {
  description = "Name of the federated IAM role"
  value = var.federation_type == "direct" ? (
    aws_iam_role.bedrock_federated[0].name
    ) : (
    aws_iam_role.cognito_authenticated[0].name
  )
}

# ===============================================
# Cognito Outputs (when using Cognito mode)
# ===============================================

output "identity_pool_id" {
  description = "Cognito Identity Pool ID (only populated when federation_type = cognito)"
  value       = var.federation_type == "cognito" ? aws_cognito_identity_pool.bedrock[0].id : null
}

output "identity_pool_arn" {
  description = "Cognito Identity Pool ARN (only populated when federation_type = cognito)"
  value       = var.federation_type == "cognito" ? aws_cognito_identity_pool.bedrock[0].arn : null
}

# ===============================================
# Policy Outputs
# ===============================================

output "bedrock_policy_arn" {
  description = "ARN of the Bedrock access IAM policy"
  value       = aws_iam_policy.bedrock_access.arn
}

output "bedrock_policy_name" {
  description = "Name of the Bedrock access IAM policy"
  value       = aws_iam_policy.bedrock_access.name
}

# ===============================================
# Monitoring Outputs
# ===============================================

output "log_group_name" {
  description = "CloudWatch log group name for Bedrock access logs (if monitoring enabled)"
  value       = var.enable_monitoring ? aws_cloudwatch_log_group.bedrock_access[0].name : null
}

output "log_group_arn" {
  description = "CloudWatch log group ARN (if monitoring enabled)"
  value       = var.enable_monitoring ? aws_cloudwatch_log_group.bedrock_access[0].arn : null
}

# ===============================================
# Configuration Output for credential-process
# ===============================================

output "credential_process_config" {
  description = "Configuration JSON for the credential-process binary"
  value = jsonencode({
    federation_type      = var.federation_type
    provider_type        = var.provider_type
    provider_domain      = var.oidc_provider_domain
    client_id            = var.oidc_client_id
    federated_role_arn   = var.federation_type == "direct" ? aws_iam_role.bedrock_federated[0].arn : aws_iam_role.cognito_authenticated[0].arn
    identity_pool_id     = var.federation_type == "cognito" ? aws_cognito_identity_pool.bedrock[0].id : null
    max_session_duration = var.federation_type == "direct" ? 43200 : 28800 # 12h for direct, 8h for Cognito
    allowed_regions      = var.allowed_bedrock_regions
  })
  sensitive = true
}

# ===============================================
# Summary Output
# ===============================================

output "deployment_summary" {
  description = "Human-readable summary of the deployment"
  value = {
    oidc_provider       = var.oidc_provider_domain
    provider_type       = var.provider_type
    federation_type     = var.federation_type
    federated_role_name = var.federation_type == "direct" ? aws_iam_role.bedrock_federated[0].name : aws_iam_role.cognito_authenticated[0].name
    bedrock_regions     = var.allowed_bedrock_regions
    monitoring_enabled  = var.enable_monitoring
  }
}
