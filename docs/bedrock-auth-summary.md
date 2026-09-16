# Bedrock Authentication - Implementation Summary

## ✅ What We've Completed

### Module Created: `bedrock-oidc-auth`

A fully-featured Terraform module that implements IAM OIDC authentication for Claude Code/Cowork with Amazon Bedrock.

**Location**: `modules/bedrock-oidc-auth/`

**Features**:
- ✅ IAM OIDC Provider registration for any OIDC-compliant IdP
- ✅ Direct STS federation (AssumeRoleWithWebIdentity) - 12h sessions
- ✅ Cognito Identity Pool federation (alternative mode) - 8h sessions
- ✅ Scoped Bedrock IAM policy with regional restrictions
- ✅ CloudWatch logging for access monitoring
- ✅ Principal tag support for per-user cost attribution in CUR 2.0
- ✅ Comprehensive outputs including credential-process configuration JSON
- ✅ Extensive validation and documentation

### Project Created: `lab-shared/bedrock-auth`

A deployable project that uses the module to set up account-level authentication.

**Location**: `projects/lab-shared/bedrock-auth/`

**What it does**:
- Composes the `bedrock-oidc-auth` module
- Follows lab conventions (5 required variables, tagging, naming)
- Includes HCP Terraform cloud block configuration
- Provides detailed outputs with next-steps instructions
- Ready for HCP workspace deployment

### Documentation

- ✅ Module README with usage examples and API reference
- ✅ Project README with deployment instructions
- ✅ Implementation plan checklist (tracks progress)
- ✅ Inline code comments and variable descriptions

---

## 📋 Next Steps to Deploy

### 1. Configure Your Identity Provider (Pre-requisite)

Before you can deploy, you need to set up an OIDC application in your IdP:

**Choose your provider** and follow their setup guide:
- **Okta**: Create a new Web application, enable PKCE
- **Azure AD**: Create an App Registration, set redirect URI
- **Auth0**: Create a Regular Web Application
- **Google**: Create OAuth 2.0 Client ID
- **Cognito**: Create a User Pool and App Client

**Required values**:
- **Provider domain** (e.g., `company.okta.com`)
- **Client ID** (from your IdP application)
- **Redirect URI**: Set to `http://localhost:8400/callback`
- **Certificate thumbprint** (see module README for how to get this)

### 2. Update Configuration

Edit `projects/lab-shared/bedrock-auth/terraform.auto.tfvars`:

```hcl
# Replace these placeholder values with your actual IdP config
oidc_provider_domain = "your-company.okta.com"
oidc_client_id       = "your-actual-client-id"
oidc_thumbprint_list = ["your-provider-thumbprint"]
oidc_provider_type   = "okta"  # or azure, auth0, google, cognito

# Optionally customize these
allowed_bedrock_regions = ["us-east-1", "us-west-2"]
federation_type        = "direct"  # or "cognito"
```

### 3. Update HCP Terraform Configuration

Edit `projects/lab-shared/bedrock-auth/main.tf`:

```hcl
cloud {
  organization = "your-actual-hcp-org-name"  # Replace this
  
  workspaces {
    name = "lab-shared-bedrock-auth"
  }
}
```

### 4. Enable Bedrock in AWS Console

1. Go to AWS Console → Bedrock
2. Navigate to "Model access" in left sidebar
3. Click "Request model access"
4. Select Claude models (Opus, Sonnet, Haiku)
5. Submit request (usually approved immediately)

### 5. Deploy via HCP Terraform

```bash
# 1. Create feature branch
git checkout -b feature/bedrock-auth-initial-setup

# 2. Add all new files
git add modules/bedrock-oidc-auth/
git add projects/lab-shared/bedrock-auth/
git add docs/bedrock-auth-implementation-plan.md

# 3. Commit
git commit -m "feat: add bedrock OIDC authentication infrastructure

- Create bedrock-oidc-auth module supporting Okta/Azure/Auth0/Google
- Create lab-shared/bedrock-auth project for account-level auth
- Support direct STS and Cognito Identity Pool federation modes
- Include per-user cost attribution via principal tags
- Add comprehensive documentation and implementation plan
"

# 4. Push and create PR
git push origin feature/bedrock-auth-initial-setup
# Open PR on GitHub

# 5. Review speculative plan from HCP in PR comments

# 6. Merge to main after approval

# 7. Apply in HCP Terraform workspace
```

### 6. Export Configuration

After Terraform apply completes:

```bash
# Export the credential-process configuration
terraform output -raw credential_process_config > config.json

# View deployment summary
terraform output deployment_summary

# View next steps
terraform output next_steps
```

### 7. Get credential-process Binary

You need the credential-process binary from the AWS guidance repo:

**Option A - Download Pre-built**:
```bash
# Download from AWS guidance GitHub releases
# https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock/releases

# Get latest release for your platform:
# - credential-process-macos-arm64 (Apple Silicon)
# - credential-process-macos-intel (Intel Mac)
# - credential-process-linux-x64
# - credential-process-windows.exe
```

**Option B - Build from Source**:
```bash
# Clone AWS guidance repo
git clone https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock

cd guidance-for-claude-code-with-amazon-bedrock/source

# Install dependencies
poetry install

# Build packages
poetry run ccwb package --go --target-platform all
```

### 8. Create Distribution Package

```bash
mkdir -p dist/claude-bedrock-auth

# Copy binary (example for macOS ARM64)
cp credential-process-macos-arm64 dist/claude-bedrock-auth/credential-process
chmod +x dist/claude-bedrock-auth/credential-process

# Copy config
cp config.json dist/claude-bedrock-auth/

# Create install script
cat > dist/claude-bedrock-auth/install.sh << 'EOF'
#!/bin/bash
set -e

INSTALL_DIR="$HOME/claude-code-with-bedrock"
mkdir -p "$INSTALL_DIR"

# Copy binary and config
cp credential-process "$INSTALL_DIR/"
cp config.json "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/credential-process"

# Configure AWS CLI profile
aws configure set credential_process \
  "$INSTALL_DIR/credential-process --profile bedrock" \
  --profile bedrock

echo "✅ Installation complete!"
echo ""
echo "Test authentication:"
echo "  aws sts get-caller-identity --profile bedrock"
echo ""
echo "Configure Claude Code:"
echo "  Add to ~/.claude/settings.json:"
echo '  { "inferenceBedrockProfile": "bedrock" }'
EOF

chmod +x dist/claude-bedrock-auth/install.sh

# Zip for distribution
cd dist
zip -r claude-bedrock-auth.zip claude-bedrock-auth/
```

### 9. Distribute to Team

Upload `claude-bedrock-auth.zip` to your distribution method:
- S3 bucket with presigned URL
- Shared Google Drive / Dropbox
- Internal artifact repository
- Direct to team members

### 10. Team Member Setup

Each team member runs:

```bash
# Extract package
unzip claude-bedrock-auth.zip
cd claude-bedrock-auth

# Run installer
./install.sh

# Test authentication
aws sts get-caller-identity --profile bedrock

# Test Bedrock access
aws bedrock list-foundation-models --region us-east-1 --profile bedrock

# Configure Claude Code CLI
# Add to ~/.claude/settings.json:
{
  "inferenceBedrockProfile": "bedrock"
}

# Or configure Claude Desktop via MDM with inferenceBedrockProfile = "bedrock"
```

---

## 🎯 Success Criteria

You'll know it's working when:
- ✅ Team members can run `aws sts get-caller-identity --profile bedrock` successfully
- ✅ Team members can list Bedrock models without errors
- ✅ Claude Code CLI connects to Bedrock using the profile
- ✅ Claude Desktop (Cowork) can use Bedrock inference
- ✅ No API keys or long-lived credentials needed
- ✅ Users authenticate with their existing SSO credentials

---

## 📚 File Reference

### Module Files (Reusable)
```
modules/bedrock-oidc-auth/
├── main.tf          # 450+ lines, IAM resources
├── variables.tf     # 100+ lines, all inputs
├── outputs.tf       # 150+ lines, all outputs
├── versions.tf      # Terraform/provider requirements
└── README.md        # 500+ lines, full documentation
```

### Project Files (Deployment)
```
projects/lab-shared/bedrock-auth/
├── main.tf                  # Composes module
├── variables.tf             # Lab convention + auth vars
├── outputs.tf               # Surfaces module outputs + next steps
├── versions.tf              # HCP cloud block
├── terraform.auto.tfvars    # NEEDS YOUR VALUES
└── README.md                # Deployment guide
```

### Documentation
```
docs/
└── bedrock-auth-implementation-plan.md  # This checklist
```

---

## 🔍 What's in the Terraform Code

### IAM Resources Created

1. **aws_iam_openid_connect_provider**
   - Registers your IdP with AWS
   - Validates JWT tokens from your OIDC provider

2. **aws_iam_policy** - Bedrock Access
   - `bedrock:InvokeModel`
   - `bedrock:InvokeModelWithResponseStream`
   - `bedrock:ListFoundationModels`
   - Scoped to specific regions

3. **aws_iam_role** - Federated Role
   - Trust policy allows AssumeRoleWithWebIdentity from your OIDC provider
   - 12-hour max session duration (direct STS mode)
   - 8-hour max session duration (Cognito mode)

4. **aws_cloudwatch_log_group** (optional)
   - Logs Bedrock API access
   - 30-day retention by default

5. **Cognito Resources** (optional, if federation_type = "cognito")
   - `aws_cognito_identity_pool`
   - `aws_cognito_identity_pool_roles_attachment`
   - `aws_cognito_identity_pool_principal_tag` (for cost attribution)

---

## 💰 Cost Estimate

### Infrastructure Cost (Monthly)
- IAM OIDC Provider: **$0** (free)
- IAM Roles & Policies: **$0** (free)
- CloudWatch Logs: **~$0.50-$5** depending on usage
- **Total Infrastructure: $0-5/month**

### Bedrock Usage Cost (per 1M tokens)
- Claude Sonnet 3.5: $3 input, $15 output
- Claude Opus 3.5: $15 input, $75 output
- Claude Haiku 3.5: $0.80 input, $4 output

Example: Heavy user (10M input + 5M output tokens/month) on Sonnet:
- Input: 10M × $3/M = $30
- Output: 5M × $15/M = $75
- **Total per heavy user: ~$105/month**

---

## 🔐 Security Features

- ✅ No long-lived AWS credentials
- ✅ Temporary credentials via STS (expire after 8-12 hours)
- ✅ Authentication via corporate SSO only
- ✅ Regional restriction on Bedrock access
- ✅ Least-privilege IAM policy
- ✅ All API calls logged to CloudTrail
- ✅ Optional per-user cost tracking in AWS CUR
- ✅ Unauthenticated access denied (Cognito mode)

---

## 🚀 Future Enhancements

See `docs/bedrock-auth-implementation-plan.md` for:
- **Phase 2**: Monitoring Infrastructure (ECS + OTEL + CloudWatch Dashboards)
- **Phase 3**: Quota Enforcement (DynamoDB + Lambda + API Gateway)
- **Phase 4**: Analytics Pipeline (S3 + Athena + Glue)
- **Phase 5**: Multi-Account Deployment (per-client AWS accounts)

---

## ❓ Questions or Issues?

1. Check module README: `modules/bedrock-oidc-auth/README.md`
2. Check project README: `projects/lab-shared/bedrock-auth/README.md`
3. Check implementation plan: `docs/bedrock-auth-implementation-plan.md`
4. Review AWS guidance repo: https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock

---

## 📝 Notes

- All code follows your lab's existing conventions (variable contract, naming, tagging)
- Module is reusable across AWS accounts (same code, different tfvars)
- Infrastructure is account-level, not project-specific
- Works with any OIDC-compliant identity provider
- Compatible with both Claude Code CLI and Claude Desktop (Cowork)
- No dependency on AWS guidance's Python tooling (pure Terraform)
