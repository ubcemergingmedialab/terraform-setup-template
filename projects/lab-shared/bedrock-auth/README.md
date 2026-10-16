# Lab Bedrock Authentication

Account-level authentication infrastructure for enabling Claude Code and Claude Cowork (Desktop) access to Amazon Bedrock via enterprise SSO.

## What This Is

This project deploys IAM OIDC federation that allows lab members to authenticate with Bedrock using their existing identity provider (Okta, Azure AD, Auth0, Google, or Cognito) instead of managing AWS IAM users and access keys.

**This is account-level infrastructure** — one deployment per AWS account, not per client project.

## What Gets Deployed

1. **IAM OIDC Provider** - Registers your identity provider with AWS
2. **IAM Federated Role** - Role that authenticated users assume to access Bedrock
3. **IAM Policy** - Scoped permissions for Bedrock model invocation
4. **CloudWatch Log Group** - Access logging (optional)

Depending on configuration:
- **Direct STS mode** (default): Users authenticate via OIDC → STS → IAM role
- **Cognito mode** (optional): Users authenticate via OIDC → Cognito Identity Pool → IAM role

## Prerequisites

Before deploying this project, you must:

1. **Create an OIDC application in your identity provider**
   - See `docs/bedrock-auth-implementation-plan.md` for IdP-specific guides
   - Configure redirect URI: `http://localhost:8400/callback`
   - Enable PKCE (required for public clients)
   - Note your provider domain and client ID

2. **Enable Bedrock in your AWS account**
   - Go to AWS Console → Bedrock
   - Request model access for Claude models (Opus, Sonnet, Haiku)
   - Wait for approval (usually immediate)

3. **Have HCP Terraform access**
   - Organization admin should create workspace: `lab-shared-bedrock-auth`
   - Connect workspace to this GitHub repo
   - Set working directory: `projects/lab-shared/bedrock-auth`
   - Configure AWS credentials as environment variables in workspace

## Configuration

Edit `terraform.auto.tfvars` and replace the placeholder values:

```hcl
# Your OIDC provider domain (no https://)
oidc_provider_domain = "company.okta.com"

# Your OIDC client ID from IdP
oidc_client_id = "0oa1a2b3c4d5e6f7g8h9"

# Your provider's certificate thumbprint
oidc_thumbprint_list = ["9e99a48a9960b14926bb7f3b02e22da2b0ab7280"]

# Your provider type
oidc_provider_type = "okta"  # or "azure", "auth0", "google", "cognito"
```

See the file comments for provider-specific examples.

## Deployment

### Initial Deployment

1. **Update configuration**
   ```bash
   # Edit terraform.auto.tfvars with your OIDC provider details
   code terraform.auto.tfvars
   ```

2. **Commit and push**
   ```bash
   git checkout -b feature/bedrock-auth-setup
   git add .
   git commit -m "feat: configure bedrock auth for lab OIDC provider"
   git push origin feature/bedrock-auth-setup
   ```

3. **Create pull request**
   - Open PR on GitHub
   - GitHub Actions will run `terraform fmt`, `terraform validate`, `tflint`
   - HCP Terraform will post a speculative plan to the PR

4. **Review and merge**
   - Review the plan in the PR comment
   - Get approval from another lab member
   - Merge to `main`

5. **Apply in HCP**
   - Go to HCP Terraform workspace: `lab-shared-bedrock-auth`
   - Review the plan
   - Click **Confirm & Apply**

6. **Export configuration**
   ```bash
   # After apply completes, export the credential-process config
   terraform output -raw credential_process_config > config.json
   ```

### Updating Configuration

To change OIDC provider, add regions, or modify settings:

1. Edit `terraform.auto.tfvars`
2. Commit, push, create PR
3. Review plan
4. Merge and apply in HCP

## Testing

After deployment:

```bash
# 1. Verify OIDC provider was created
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn $(terraform output -raw oidc_provider_arn)

# 2. Verify IAM role was created
aws iam get-role \
  --role-name $(terraform output -raw federated_role_name)

# 3. Check role's trust policy allows your OIDC provider
aws iam get-role \
  --role-name $(terraform output -raw federated_role_name) \
  --query 'Role.AssumeRolePolicyDocument'

# 4. Verify Bedrock policy is attached
aws iam list-attached-role-policies \
  --role-name $(terraform output -raw federated_role_name)
```

## Next Steps

After deploying this infrastructure:

1. **Download or build credential-process binary**
   - From AWS guidance repo: https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock
   - Pre-built binaries available in their GitHub releases
   - Or build yourself using Go or Python

2. **Create distribution package**
   ```bash
   # Export config
   terraform output -raw credential_process_config > config.json
   
   # Package for distribution
   mkdir -p dist/claude-bedrock-auth
   cp config.json dist/claude-bedrock-auth/
   cp /path/to/credential-process dist/claude-bedrock-auth/
   # Add install.sh, install.bat scripts
   ```

3. **Distribute to team members**
   - Share the package via your preferred method (S3, shared drive, etc.)
   - Team members run install script
   - Configure AWS CLI profile to use credential-process

4. **Configure Claude Code/Cowork**
   - CLI: Set `inferenceBedrockProfile` in `~/.claude/settings.json`
   - Desktop: Deploy MDM configuration with `inferenceBedrockProfile`

See `docs/bedrock-auth-implementation-plan.md` for detailed next steps.

## Architecture

### Direct STS Mode (Default)
```
Developer → OIDC IdP → JWT Token → credential-process →
  STS AssumeRoleWithWebIdentity → IAM Role → Bedrock API
```

### Cognito Mode
```
Developer → OIDC IdP → JWT Token → credential-process →
  Cognito Identity Pool → IAM Role → Bedrock API
```

## Security

- **No long-lived credentials**: Temporary credentials issued via STS, expire after 12 hours (direct) or 8 hours (Cognito)
- **No IAM users**: Authentication via corporate SSO only
- **Region restriction**: Bedrock access limited to specified regions
- **Least privilege**: IAM policy grants only Bedrock model invocation, no other AWS permissions
- **Audit trail**: All Bedrock API calls logged to CloudTrail automatically

## Cost Estimation

This infrastructure has minimal cost:

- **IAM OIDC Provider**: Free
- **IAM roles and policies**: Free
- **CloudWatch Log Group**: ~$0.50/GB ingested, ~$0.03/GB stored per month
  - Estimated: $0-5/month depending on team size and logging verbosity
- **Cognito Identity Pool** (if used): Free for basic auth, $0.0055 per MAU for advanced features

The primary cost will be **Bedrock API usage** (charged per 1,000 tokens):
- Claude Sonnet 3.5: ~$3 per million input tokens, ~$15 per million output tokens
- Claude Opus 3.5: ~$15 per million input tokens, ~$75 per million output tokens
- Claude Haiku 3.5: ~$0.80 per million input tokens, ~$4 per million output tokens

## Outputs

Key outputs after deployment:

| Output | Description |
|--------|-------------|
| `federated_role_arn` | ARN to configure in credential-process |
| `oidc_provider_arn` | OIDC provider ARN (for verification) |
| `credential_process_config` | JSON config for credential-process binary |
| `next_steps` | Human-readable instructions for setup |

View all outputs:
```bash
terraform output
terraform output -raw credential_process_config > config.json
terraform output next_steps
```

## Troubleshooting

### "OIDC provider already exists"
If you previously created an OIDC provider manually, import it:
```bash
terraform import module.bedrock_auth.aws_iam_openid_connect_provider.bedrock \
  arn:aws:iam::ACCOUNT_ID:oidc-provider/DOMAIN
```

### "Role trust policy validation failed"
Double-check:
- OIDC provider domain matches exactly (no `https://`, no trailing `/`)
- Client ID matches your IdP application exactly
- Provider was created successfully in IAM

### "Access denied to Bedrock"
Verify:
- Bedrock model access enabled in AWS Console → Bedrock → Model access
- Region specified is in `allowed_bedrock_regions`
- User authenticated successfully (check `aws sts get-caller-identity`)

## Module Source

This project uses the `bedrock-oidc-auth` module defined in `modules/bedrock-oidc-auth/`.

See module README for detailed documentation: `modules/bedrock-oidc-auth/README.md`

## Compliance & Audit

- All infrastructure defined as code and version-controlled
- Changes reviewed via pull request process
- Deployment history tracked in HCP Terraform
- All API calls logged to CloudTrail (automatic)
- Optional: Enable AWS Config for compliance monitoring

## Related Documentation

- **Implementation Plan**: `docs/bedrock-auth-implementation-plan.md`
- **Lab Conventions**: `docs/conventions.md`
- **Lab Handbook**: `deliverable.md`
- **Module README**: `modules/bedrock-oidc-auth/README.md`
- **AWS Guidance Repo**: https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock

## License

Same as parent repository (check root LICENSE file).
