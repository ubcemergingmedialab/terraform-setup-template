# Claude Code with Bedrock - Terraform Implementation Plan

**Goal**: Enable team access to Claude Code/Cowork via Amazon Bedrock with enterprise SSO authentication, all managed through Terraform.

**Decision**: Create new `lab-shared` client for account-level infrastructure instead of nesting under `poetryhouse/`.

---

## Phase 1: Authentication Infrastructure ✅ IN PROGRESS

### Module Development ✅ COMPLETE

- [x] Create `modules/bedrock-oidc-auth/` directory structure
  - [x] `main.tf` - Core IAM resources
  - [x] `variables.tf` - Input parameters
  - [x] `outputs.tf` - ARNs and configuration
  - [x] `versions.tf` - Provider requirements
  - [x] `README.md` - Module documentation

#### Core Resources to Implement ✅ COMPLETE
- [x] `aws_iam_openid_connect_provider` - OIDC provider registration
- [x] `aws_iam_policy` - Bedrock access permissions
- [x] `aws_iam_role` - Federated role for authenticated users
- [x] `aws_iam_role_policy_attachment` - Attach Bedrock policy to role

#### Optional Resources (choose based on auth mode) ✅ COMPLETE
- [x] Cognito Identity Pool path (if not using direct STS)
- [x] CloudWatch logging (if monitoring enabled)

### Project Deployment ✅ COMPLETE

- [x] Create `projects/lab-shared/` client directory
- [x] Create `projects/lab-shared/bedrock-auth/` project
  - [x] `main.tf` - Compose bedrock-oidc-auth module
  - [x] `variables.tf` - The 5 required variables + auth-specific
  - [x] `outputs.tf` - OIDC provider ARN, role ARN, config JSON
  - [x] `versions.tf` - HCP cloud block configuration
  - [x] `terraform.auto.tfvars` - Actual values (OIDC domain, client ID)
  - [x] `README.md` - Project purpose and setup instructions

### Identity Provider Setup (Pre-requisite)

- [ ] Choose identity provider (Okta / Azure AD / Auth0 / Google / Cognito)
- [ ] Create OIDC application in IdP
  - [ ] Configure redirect URI: `http://localhost:8400/callback`
  - [ ] Enable PKCE
  - [ ] Note OIDC domain/issuer URL
  - [ ] Note Client ID
  - [ ] (Azure only) Get thumbprint list or client secret/certificate

### HCP Terraform Configuration

- [ ] Create new HCP Terraform workspace: `lab-shared-bedrock-auth`
- [ ] Connect workspace to GitHub repo
- [ ] Set working directory: `projects/lab-shared/bedrock-auth`
- [ ] Configure AWS credentials in HCP workspace
- [ ] Enable VCS-driven workflow

### Testing & Validation

- [ ] Deploy auth stack via HCP Terraform
- [ ] Verify OIDC provider created in AWS IAM console
- [ ] Verify federated role created with correct trust policy
- [ ] Verify Bedrock policy attached to role
- [ ] Test authentication with AWS guidance's credential-process binary
  - [ ] Download credential-process from AWS guidance repo
  - [ ] Configure with deployed role ARN
  - [ ] Run `credential-process --profile bedrock-auth`
  - [ ] Verify temporary credentials issued
  - [ ] Test Bedrock API call with credentials

### Documentation

- [ ] Update `deliverable.md` with bedrock-auth project
- [ ] Document credential-process installation for team
- [ ] Document how to configure Claude Code CLI
- [ ] Document how to configure Claude Desktop (Cowork)

---

## Phase 2: Monitoring Infrastructure (Optional) 🔲

### Module Development

- [ ] Create `modules/bedrock-monitoring/` directory structure
  - [ ] `main.tf` - ECS, ALB, CloudWatch resources
  - [ ] `variables.tf` - VPC config, monitoring settings
  - [ ] `outputs.tf` - OTEL endpoint, dashboard URLs
  - [ ] `versions.tf` - Provider requirements
  - [ ] `README.md` - Module documentation

#### Core Resources to Implement
- [ ] VPC resources (or data sources for existing VPC)
  - [ ] `aws_vpc` or `data.aws_vpc`
  - [ ] `aws_subnet` (public + private)
  - [ ] `aws_internet_gateway`
  - [ ] `aws_route_table`
- [ ] ECS infrastructure
  - [ ] `aws_ecs_cluster`
  - [ ] `aws_ecs_task_definition` (OTEL collector container)
  - [ ] `aws_ecs_service`
- [ ] Load balancer
  - [ ] `aws_lb` (Application Load Balancer)
  - [ ] `aws_lb_target_group`
  - [ ] `aws_lb_listener`
  - [ ] `aws_security_group` (ALB + ECS)
- [ ] CloudWatch
  - [ ] `aws_cloudwatch_log_group`
  - [ ] `aws_cloudwatch_dashboard` (per-user usage metrics)
- [ ] Optional: Kinesis Data Firehose for analytics pipeline

### Project Integration

- [ ] Update `projects/lab-shared/bedrock-auth/main.tf` to include monitoring module
- [ ] Configure OTEL collector endpoint in outputs
- [ ] Test telemetry flow from Claude Code CLI

---

## Phase 3: Quota Enforcement (Optional) 🔲

### Module Development

- [ ] Create `modules/bedrock-quota-enforcement/` directory structure

#### Core Resources to Implement
- [ ] DynamoDB tables
  - [ ] `aws_dynamodb_table.quota_policies`
  - [ ] `aws_dynamodb_table.user_quota_metrics`
- [ ] Lambda functions
  - [ ] `aws_lambda_function.quota_monitor` (scheduled)
  - [ ] `aws_lambda_function.quota_check` (real-time API)
  - [ ] IAM roles for Lambda execution
  - [ ] Lambda function code (port from AWS guidance)
- [ ] API Gateway
  - [ ] `aws_apigatewayv2_api` (HTTP API)
  - [ ] `aws_apigatewayv2_authorizer` (JWT validation)
  - [ ] `aws_apigatewayv2_route`
  - [ ] `aws_apigatewayv2_stage`
  - [ ] `aws_apigatewayv2_integration`
- [ ] SNS topic for quota alerts
  - [ ] `aws_sns_topic`
  - [ ] `aws_sns_topic_subscription`
- [ ] EventBridge scheduled rules
  - [ ] `aws_cloudwatch_event_rule`
  - [ ] `aws_cloudwatch_event_target`

### Project Integration

- [ ] Update bedrock-auth project to include quota module
- [ ] Configure quota policies via DynamoDB
- [ ] Test quota enforcement workflow

---

## Phase 4: Analytics Pipeline (Optional) 🔲

### Module Development

- [ ] Create `modules/bedrock-analytics/` directory structure

#### Core Resources to Implement
- [ ] S3 bucket for data lake
  - [ ] `aws_s3_bucket`
  - [ ] `aws_s3_bucket_lifecycle_configuration` (Glacier archival)
- [ ] AWS Glue data catalog
  - [ ] `aws_glue_catalog_database`
  - [ ] `aws_glue_catalog_table`
- [ ] Athena configuration
  - [ ] `aws_athena_workgroup`
  - [ ] `aws_athena_named_query` (pre-built SQL queries)
- [ ] Kinesis Data Firehose
  - [ ] `aws_kinesis_firehose_delivery_stream`
  - [ ] IAM role for Firehose

### Project Integration

- [ ] Connect analytics module to monitoring stack
- [ ] Configure Firehose to S3 pipeline
- [ ] Test Athena queries on usage data

---

## Phase 5: Multi-Account Deployment (Future) 🔲

### Per-Client Account Setup

- [ ] Deploy to Poetry House AWS account
  - [ ] Create HCP workspace: `poetryhouse-bedrock-auth`
  - [ ] Use same modules, different tfvars
  - [ ] Document client-specific OIDC config
- [ ] Deploy to UBC EML AWS account
  - [ ] Create HCP workspace: `ubc-eml-bedrock-auth`
  - [ ] Use same modules, different tfvars
- [ ] Document transplant process in `docs/transplant.md`

---

## Open Questions / Decisions Needed

- [ ] **Identity Provider**: Which IdP? (Okta / Azure AD / Auth0 / Google / Cognito)
- [ ] **Federation Mode**: Direct STS or Cognito Identity Pool?
- [ ] **Monitoring Mode**: Central collector (ECS) or sidecar (per-machine)?
- [ ] **VPC Strategy**: Create new VPC or use existing?
- [ ] **Quota Enforcement**: Token-based or cost-based limits?
- [ ] **AWS Regions**: Which regions to allow Bedrock access? (us-east-1, us-west-2, etc.)
- [ ] **Cross-Region Inference**: Which profile? (US / EU / APAC / Global)

---

## Key Terraform Resources Reference

Based on CloudFormation analysis:

### Authentication Stack
```
aws_iam_openid_connect_provider
aws_iam_role (with AssumeRoleWithWebIdentity)
aws_iam_policy (Bedrock permissions)
aws_iam_role_policy_attachment
aws_cognito_identity_pool (optional)
aws_cognito_identity_pool_roles_attachment (optional)
```

### Monitoring Stack
```
aws_ecs_cluster
aws_ecs_task_definition
aws_ecs_service
aws_lb
aws_lb_target_group
aws_lb_listener
aws_cloudwatch_dashboard
aws_cloudwatch_log_group
aws_kinesis_firehose_delivery_stream (optional)
```

### Quota Stack
```
aws_dynamodb_table (x2)
aws_lambda_function (x2)
aws_apigatewayv2_api
aws_apigatewayv2_authorizer
aws_apigatewayv2_route
aws_apigatewayv2_stage
aws_sns_topic
aws_cloudwatch_event_rule
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Team members can authenticate to Bedrock via SSO
- [ ] Claude Code CLI works with credential-process
- [ ] Claude Desktop (Cowork) works with Bedrock inference
- [ ] All infrastructure defined in Terraform
- [ ] Deployed via HCP Terraform
- [ ] Documentation complete

### Future Phases Complete When:
- [ ] Per-user usage visible in CloudWatch dashboards
- [ ] Quota alerts trigger before limits exceeded
- [ ] Historical analytics available in Athena
- [ ] Pattern documented for client transplant

---

## Timeline Estimate

- **Phase 1** (Authentication): 1-2 days
- **Phase 2** (Monitoring): 1-2 days
- **Phase 3** (Quotas): 1 day
- **Phase 4** (Analytics): 0.5 day
- **Total**: 3.5-5.5 days of focused work

---

## Notes

- This implementation uses Terraform exclusively (no dependency on AWS guidance's `ccwb` Python CLI)
- The modules are reusable across AWS accounts (Poetry House, UBC EML, future clients)
- Follows existing lab conventions (variable contract, tagging, naming)
- Authentication is account-level, not project-specific
- Client credential-process binary can come from AWS guidance repo (MIT-0 licensed)

---

## Related Documentation

- [AWS Guidance Repository](https://github.com/aws-solutions-library-samples/guidance-for-claude-code-with-amazon-bedrock)
- [Lab Conventions](../docs/conventions.md)
- [Transplant Guide](../docs/transplant.md)
- [Lab Deliverable Handbook](../deliverable.md)
