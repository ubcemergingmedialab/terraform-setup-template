# Importing existing AWS resources

See also **[`virtual-soils-hcp-deployment.md`](./virtual-soils-hcp-deployment.md)** for the full HCP setup story, IAM policy, and S3 bucket naming lessons.

The Virtual Soils app already runs on manually provisioned resources in **ca-central-1**. This Terraform stack can adopt them instead of creating duplicates.

**Do not apply a full create** while `legacy_*` names point at existing resources unless you have imported them or you intend to replace them.

---

## Two different “imports”

Confusing these causes extra work:

| Kind | What it means | Moves row data? |
|------|----------------|-----------------|
| **Terraform resource import** | Tell Terraform state “this table/bucket already exists” | **No** — data stays in AWS |
| **Data migration** | Copy field **items** into a new or empty table | **Yes** |

You may need **one or both**.

---

## Known legacy identifiers

| Resource | Identifier |
|----------|------------|
| DynamoDB | `eml_fields` (hash key `FieldID`) |
| S3 | `eml-soils-db` (legacy name — may be globally taken; use `ubc-eml-virtual-soils-prod-assets-*` from HCP) |
| Cognito user pool | `ca-central-1_VnLGRFo8k` (pre-Terraform; new stack creates its own pool) |
| Cognito app client | `q7bro5cdr1ucb3g7c00d420q5` |
| Cognito domain | `ca-central-1vnlgrfo8k.auth.ca-central-1.amazoncognito.com` |

API Gateway and Lambda ARNs are account-specific — discover them in the AWS console.

---

## DynamoDB: Terraform import (keep `eml_fields` + keep data)

When the table **already exists** in the **same account** HCP manages and you set `legacy_dynamodb_table_name = "eml_fields"`:

1. **Import the table into state** (one-time, machine with Terraform CLI + AWS creds):

```bash
cd projects/ubc-eml/virtual-soils/lambda && npm ci
cd ..
terraform init
terraform import 'module.fields_table.aws_dynamodb_table.this' eml_fields
```

2. HCP apply then **manages** the table schema/settings; **existing items remain**.

No S3 export, no zip, no target bucket account ID.

---

## DynamoDB: moving data between tables or accounts

Use one of these paths.

### Option 1 — Zip handoff (recommended for small tables)

Best for lab handoff, dev→prod with few rows, or avoiding cross-account S3 policies.

Virtual Soils field count is small (~10 items). Use the portable scripts:

[`projects/ubc-eml/virtual-soils/scripts/dynamodb-backup/`](../projects/ubc-eml/virtual-soils/scripts/dynamodb-backup/)

**Export (source account):**

```bash
cd projects/ubc-eml/virtual-soils/scripts/dynamodb-backup
npm ci
aws sso login --profile lab   # or use AWS_ACCESS_KEY_ID / default profile
node export.mjs --profile lab --table eml_fields --out ./eml_fields-backup.json
Compress-Archive -Path .\eml_fields-backup.json -DestinationPath .\eml_fields-backup.zip -Force
```

Scripts use **your local AWS credentials** (CLI profile or env vars), **not** HCP Terraform. See [`scripts/dynamodb-backup/README.md`](../projects/ubc-eml/virtual-soils/scripts/dynamodb-backup/README.md#authentication-required).

**Import (target account):**

```bash
aws sso login --profile lab
node import.mjs --profile lab --file ./eml_fields-backup.json --table eml_fields
```

Deliverable: **one zip** containing a single JSON file — no destination bucket ARN, no cross-account trust setup.

### Option 2 — Same-account export to Terraform assets bucket (AWS native)

When the table is **large** or you want scheduled backups in AWS:

1. Use HCP output **`assets_bucket_name`** (e.g. `ubc-eml-virtual-soils-prod-assets-078d04`) — **same account** as the table.
2. DynamoDB console or CLI: **Export to S3** → that bucket.
3. To load into a **new** table: [Import from S3](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataImport.ImportTable.html) in `DYNAMODB_JSON` format.

You only need the **bucket name from HCP**, not a foreign account ID. Cross-account export is what forces extra bucket policies and account IDs (painful).

**Note:** Native export produces `AWSDynamoDB/<export-id>/manifest-*.json` and gzip data parts — **not** a simple zip for humans. Fine for AWS-to-AWS pipelines; poor for “email someone a backup.”

### Option 3 — Greenfield table + zip import

1. Clear `legacy_dynamodb_table_name` in tfvars → apply creates `ubc-eml-virtual-soils-prod-fields`.
2. Run **import.mjs** against the new table name from zip export.

---

## S3 bucket import

Same pattern as DynamoDB **resource** import only (no object migration via Terraform):

```bash
terraform import 'module.assets[0].aws_s3_bucket.this' eml-soils-db
```

Only works if that bucket **exists in your account**. If the name is globally taken elsewhere, use generated `assets_bucket_name` instead (see runbook S3 section).

---

## Cognito / API / Lambda

Harder to import atomically. Typical cutover:

- **Import** many resources by ID, or
- **Create new** via Terraform, update app `VITE_*` env vars, retire old resources after validation.

---

## After import

- Run plan until no unexpected **destroys**.
- Confirm `/pins` and admin see field data (check `pins_field_ids` in tfvars if map looks empty).
- Deprecate duplicate manual resources only after a quiet period.

---

## Legacy export on disk

An older AWS export may exist locally under `SoilDynamoDBExport/` (manifest references account `304292229203`, bucket `eml-soils-db`). That format is for **Import from S3**, not the zip scripts above. Prefer a fresh **export.mjs** run if you want a portable zip today.
