# Importing existing AWS resources

See also **[`virtual-soils-hcp-deployment.md`](./virtual-soils-hcp-deployment.md)** for the full HCP setup story, IAM policy, and S3 bucket naming lessons.

The Virtual Soils app already runs on manually provisioned resources in **ca-central-1** (account from your AWS console). This Terraform stack can adopt them instead of creating duplicates.

**Do not apply a full create** while `legacy_*` names point at existing resources unless you have imported them or you intend to replace them.

## Known legacy identifiers (from repo / exports)

| Resource | Identifier |
|----------|------------|
| DynamoDB | `eml_fields` (hash key `FieldID`) |
| S3 | `eml-soils-db` (legacy export name — **globally may be taken**; use generated `ubc-eml-virtual-soils-prod-assets-*` for Terraform-managed backups) |
| Cognito user pool | `ca-central-1_VnLGRFo8k` |
| Cognito app client | `q7bro5cdr1ucb3g7c00d420q5` |
| Cognito domain | `ca-central-1vnlgrfo8k.auth.ca-central-1.amazoncognito.com` |

API Gateway and Lambda ARNs are account-specific — discover them in the AWS console (API Gateway → HTTP APIs, Lambda → functions).

## Recommended approach

### Option A — Import into this stack (keep names)

1. Set `legacy_dynamodb_table_name = "eml_fields"` and `legacy_assets_bucket_name = "eml-soils-db"` in `terraform.auto.tfvars` (already set for prod).
2. In HCP, run **Plan only** without apply. Expect "already exists" errors until imports are done.
3. From a machine with Terraform CLI + AWS credentials (one-time), in `projects/ubc-eml/virtual-soils`:

```bash
cd projects/ubc-eml/virtual-soils/lambda && npm ci
cd ..
terraform init
terraform import 'module.fields_table.aws_dynamodb_table.this' eml_fields
terraform import 'module.assets[0].aws_s3_bucket.this' eml-soils-db
```

4. Cognito and API/Lambda are harder to import without matching every attribute. Options:
   - **Import** pool, client, domain, API, Lambda, routes (many IDs) — see AWS provider import docs.
   - **Cutover**: create new Cognito + API via Terraform, update Amplify env vars, retire old resources after validation.

### Option B — Greenfield Terraform (new names)

1. Clear `legacy_dynamodb_table_name` and `legacy_assets_bucket_name`.
2. Apply creates `ubc-eml-virtual-soils-prod-fields`, new Cognito pool, new API URL.
3. Migrate DynamoDB data (export/import or script).
4. Update frontend env vars and Cognito callback URLs.

## Data migration

A DynamoDB export snapshot may exist under `SoilDynamoDBExport/` locally. Use AWS Data Pipeline or `aws dynamodb import-table` to load into a new table if you choose Option B.

## After import

- Run plan until it shows no unexpected destroys.
- Rotate off hardcoded Cognito IDs in `src/auth.ts` using Terraform outputs.
- Deprecate duplicate API Gateway / Lambda in the console only after the new endpoint is verified.
