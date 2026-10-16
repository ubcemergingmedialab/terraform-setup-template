# bedrock-oidc-auth

Terraform module for IAM OIDC authentication to enable Claude Code and Claude Cowork (Desktop) access to Amazon Bedrock with enterprise single sign-on.

## Features

- **OIDC Federation**: Integrates with Okta, Azure AD, Auth0, Google, Cognito, or any OIDC-compliant provider
- **Two Auth Modes**: Direct STS federation or Cognito Identity Pool
- **Bedrock Permissions**: Scoped IAM policy for model invocation and listing
- **Region Control**: Restrict Bedrock access to specific AWS regions
- **Per-User Attribution**: Supports principal tags for cost tracking in AWS Cost Explorer
- **Optional Monitoring**: CloudWatch log group for access logging

## Architecture

### Direct STS Mode (Recommended)
```
User → IdP (OIDC) → STS AssumeRoleWithWebIdentity → IAM Role → Bedrock
```
- Simpler trust chain
- 12-hour sessions
- Direct IAM role assumption

### Cognito Identity Pool Mode
```
User → IdP (OIDC) → Cognito Identity Pool → IAM Role → Bedrock
```
- Additional Cognito layer for advanced features
- 8-hour sessions
- Supports principal tag mapping for cost attribution

## Usage

### Basic Example (Okta, Direct STS)

```hcl
module "bedrock_auth" {
  source = "../../modules/bedrock-oidc-auth"

  name_prefix          = "lab-shared-bedrock"
  oidc_provider_domain = "company.okta.com"
  oidc_client_id       = "0oa1a2b3c4d5e6f7g8h9"
  oidc_thumbprint_list = [
    "9e99a48a9960b14926bb7f3b02e22da2b0ab7280"  # Okta thumbprint
  ]
  
  provider_type   = "okta"
  federation_type = "direct"
  
  allowed_bedrock_regions = [
    "us-east-1",
    "us-west-2"
  ]
  
  enable_monitoring = true
  
  tags = {
    Environment = "production"
    Team        = "media-lab"
    CostCenter  = "engineering"
  }
}
```

### Azure AD Example

```hcl
module "bedrock_auth" {
  source = "../../modules/bedrock-oidc-auth"

  name_prefix          = "lab-shared-bedrock"
  oidc_provider_domain = "login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0"
  oidc_client_id       = "abcdef01-2345-6789-abcd-ef0123456789"
  oidc_thumbprint_list = [
    "626d44e704d1ceabe3bf0d53397464ac8080142c"  # Microsoft thumbprint
  ]
  
  provider_type   = "azure"
  federation_type = "direct"
  
  allowed_bedrock_regions = ["us-east-1", "eu-central-1"]
  
  tags = {
    Environment = "production"
  }
}
```

### Cognito Identity Pool Mode

```hcl
module "bedrock_auth" {
  source = "../../modules/bedrock-oidc-auth"

  name_prefix          = "lab-shared-bedrock"
  oidc_provider_domain = "company.okta.com"
  oidc_client_id       = "0oa1a2b3c4d5e6f7g8h9"
  oidc_thumbprint_list = ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]
  
  provider_type   = "okta"
  federation_type = "cognito"
  
  identity_pool_name      = "claude-code-auth"
  enable_principal_tags   = true  # Enables per-user cost attribution
  
  allowed_bedrock_regions = ["us-east-1", "us-west-2"]
  
  tags = {
    Environment = "production"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name_prefix | Prefix for all resource names | `string` | n/a | yes |
| oidc_provider_domain | OIDC provider domain (e.g., 'company.okta.com') | `string` | n/a | yes |
| oidc_client_id | OIDC application client ID | `string` | n/a | yes |
| oidc_thumbprint_list | List of OIDC provider certificate thumbprints | `list(string)` | n/a | yes |
| provider_type | Identity provider type | `string` | `"okta"` | no |
| federation_type | Federation mode: 'direct' or 'cognito' | `string` | `"direct"` | no |
| identity_pool_name | Cognito Identity Pool name | `string` | `"claude-code-bedrock"` | no |
| enable_principal_tags | Enable principal tag mapping (Cognito only) | `bool` | `true` | no |
| allowed_bedrock_regions | AWS regions where Bedrock access is allowed | `list(string)` | `["us-east-1", "us-west-2", ...]` | no |
| enable_monitoring | Enable CloudWatch monitoring | `bool` | `true` | no |
| log_retention_days | CloudWatch log retention period | `number` | `30` | no |
| tags | Additional resource tags | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| oidc_provider_arn | ARN of the IAM OIDC provider |
| oidc_provider_url | URL of the OIDC provider |
| federation_type | The federation type in use |
| federated_role_arn | ARN of the federated IAM role |
| federated_role_name | Name of the federated IAM role |
| identity_pool_id | Cognito Identity Pool ID (Cognito mode only) |
| bedrock_policy_arn | ARN of the Bedrock access policy |
| log_group_name | CloudWatch log group name (if monitoring enabled) |
| credential_process_config | JSON config for credential-process binary |
| deployment_summary | Human-readable deployment summary |

## OIDC Provider Thumbprints

### Okta
```
9e99a48a9960b14926bb7f3b02e22da2b0ab7280
```

### Azure AD / Microsoft Entra ID
```
626d44e704d1ceabe3bf0d53397464ac8080142c
```

### Auth0
```
9e99a48a9960b14926bb7f3b02e22da2b0ab7280
```

### Google
```
4348a0e9444c78cb265e058d5e8944b4d84f9662
6c9c8d13bc3e2a72b7d9f36ae3e6d31f5c7f4e1e
```

### AWS Cognito User Pools
Use the region-specific thumbprint. For most regions:
```
9e99a48a9960b14926bb7f3b02e22da2b0ab7280
```

### How to Get Thumbprints

For any OIDC provider, you can retrieve the thumbprint:

```bash
# Replace with your provider's domain
PROVIDER_DOMAIN="company.okta.com"

# Get the thumbprint
echo | openssl s_client -servername $PROVIDER_DOMAIN \
  -connect $PROVIDER_DOMAIN:443 2>/dev/null | \
  openssl x509 -fingerprint -noout -sha1 | \
  sed 's/SHA1 Fingerprint=//g' | \
  sed 's/://g' | \
  tr '[:upper:]' '[:lower:]'
```

## Bedrock Permissions

The module grants the following Bedrock permissions:

- `bedrock:InvokeModel` - Invoke foundation models
- `bedrock:InvokeModelWithResponseStream` - Streaming responses
- `bedrock:CallWithBearerToken` - Bearer token authentication (required for some features)
- `bedrock:ListFoundationModels` - List available models
- `bedrock:GetFoundationModel` - Get model details
- `bedrock:ListInferenceProfiles` - List cross-region inference profiles
- `bedrock:GetInferenceProfile` - Get inference profile details

Permissions are scoped to:
- Specified AWS regions only (via `allowed_bedrock_regions`)
- Foundation models and inference profiles only (no access to Bedrock Agents, Knowledge Bases, or other services)

## Security Considerations

1. **Least Privilege**: The IAM policy grants only Bedrock model invocation permissions
2. **Region Restriction**: Bedrock access is limited to specified regions
3. **No Wildcard Resources**: All permissions scope to specific resource types
4. **Audit Trail**: All API calls are logged to CloudTrail automatically
5. **Session Tags**: Direct STS mode supports `sts:TagSession` for per-user cost attribution in AWS Cost Explorer
6. **Unauthenticated Role**: In Cognito mode, unauthenticated role denies all access

## Integration with credential-process

This module's `credential_process_config` output provides a JSON configuration that the AWS guidance's `credential-process` binary can use:

```bash
# In your project root after applying Terraform:
terraform output -raw credential_process_config > config.json

# Distribute config.json with the credential-process binary
# Users configure their AWS CLI profile:
aws configure set credential_process \
  "/path/to/credential-process --profile bedrock-auth" \
  --profile bedrock-auth
```

## Cost Attribution

### Direct STS Mode
- Session tags are automatically applied via `sts:TagSession`
- Tags appear in AWS Cost Explorer and Cost & Usage Reports (CUR 2.0)
- No additional configuration needed

### Cognito Mode
- Enable `enable_principal_tags = true`
- Principal tags map OIDC JWT claims to session tags
- Default mappings: `email`, `sub` (user ID), `name`
- Requires Cognito Identity Pool with enhanced authflow

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5.0 |
| aws | >= 5.0 |

## Compatibility

- **AWS Partition**: AWS Commercial and AWS GovCloud (US)
- **Supported IdPs**: Okta, Azure AD, Auth0, Google, Cognito User Pools, any OIDC-compliant provider
- **Claude Code**: All versions that support credential_process
- **Claude Desktop**: All versions that support inferenceBedrockProfile

## Examples

See the `projects/lab-shared/bedrock-auth/` directory for a complete working example.

## Related Documentation

- [AWS IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [Amazon Bedrock Permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
- [AWS Cognito Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools.html)
- [AWS Guidance for Claude Code](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock)

## License

MIT-0 (same as parent repository)
