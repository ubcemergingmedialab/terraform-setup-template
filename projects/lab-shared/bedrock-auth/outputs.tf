# projects/lab-shared/bedrock-auth/outputs.tf

# ===============================================
# Authentication Configuration Outputs
# ===============================================

output "oidc_provider_arn" {
  description = "ARN of the IAM OIDC provider - use this to verify the provider was created"
  value       = module.bedrock_auth.oidc_provider_arn
}

output "oidc_provider_url" {
  description = "URL of the OIDC provider"
  value       = module.bedrock_auth.oidc_provider_url
}

output "federated_role_arn" {
  description = "ARN of the federated IAM role - configure this in credential-process"
  value       = module.bedrock_auth.federated_role_arn
}

output "federated_role_name" {
  description = "Name of the federated IAM role"
  value       = module.bedrock_auth.federated_role_name
}

# ===============================================
# Cognito Outputs (when applicable)
# ===============================================

output "identity_pool_id" {
  description = "Cognito Identity Pool ID (only populated when using Cognito federation)"
  value       = module.bedrock_auth.identity_pool_id
}

output "identity_pool_arn" {
  description = "Cognito Identity Pool ARN (only populated when using Cognito federation)"
  value       = module.bedrock_auth.identity_pool_arn
}

# ===============================================
# Policy Outputs
# ===============================================

output "bedrock_policy_arn" {
  description = "ARN of the Bedrock access IAM policy"
  value       = module.bedrock_auth.bedrock_policy_arn
}

# ===============================================
# Monitoring Outputs
# ===============================================

output "log_group_name" {
  description = "CloudWatch log group name for Bedrock access logs"
  value       = module.bedrock_auth.log_group_name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = module.bedrock_auth.log_group_arn
}

# ===============================================
# Configuration for credential-process
# ===============================================

output "credential_process_config" {
  description = <<-EOT
    Configuration JSON for the credential-process binary.
    
    Usage:
      terraform output -raw credential_process_config > config.json
    
    Then distribute config.json with the credential-process binary to your team.
  EOT
  value     = module.bedrock_auth.credential_process_config
  sensitive = true
}

# ===============================================
# Deployment Summary
# ===============================================

output "deployment_summary" {
  description = "Human-readable summary of the deployment"
  value       = module.bedrock_auth.deployment_summary
}

# ===============================================
# Next Steps Output
# ===============================================

output "next_steps" {
  description = "Instructions for next steps after deployment"
  value = <<-EOT
    ✅ Bedrock authentication infrastructure deployed successfully!
    
    📋 Next Steps:
    
    1. Verify OIDC Provider:
       aws iam get-open-id-connect-provider --open-id-connect-provider-arn ${module.bedrock_auth.oidc_provider_arn}
    
    2. Verify IAM Role:
       aws iam get-role --role-name ${module.bedrock_auth.federated_role_name}
    
    3. Export credential-process config:
       terraform output -raw credential_process_config > config.json
    
    4. Download credential-process binary:
       - Option A: Build from AWS guidance repo (Go or Python)
       - Option B: Download pre-built binary from GitHub releases
    
    5. Distribute to team:
       - config.json
       - credential-process binary (macOS/Linux/Windows)
       - install.sh / install.bat script
    
    6. Team members configure AWS CLI:
       aws configure set credential_process \
         "~/claude-code-with-bedrock/credential-process --profile bedrock" \
         --profile bedrock
    
    7. Test authentication:
       aws sts get-caller-identity --profile bedrock
       aws bedrock list-foundation-models --region ${var.allowed_bedrock_regions[0]} --profile bedrock
    
    8. Configure Claude Code CLI:
       Add to ~/.claude/settings.json:
       {
         "inferenceBedrockProfile": "bedrock"
       }
    
    9. Configure Claude Desktop (Cowork):
       Deploy MDM configuration with inferenceBedrockProfile = "bedrock"
    
    📚 Documentation:
       - Module README: modules/bedrock-oidc-auth/README.md
       - Implementation Plan: docs/bedrock-auth-implementation-plan.md
       - AWS Guidance: https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock
  EOT
}

# ===============================================
# AWS Account Info
# ===============================================

output "aws_account_id" {
  description = "AWS account ID where infrastructure is deployed"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region where infrastructure is deployed"
  value       = data.aws_region.current.name
}
