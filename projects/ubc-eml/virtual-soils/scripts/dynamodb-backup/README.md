# DynamoDB portable backup (zip handoff)

Small-table backup/restore for Virtual Soils **`eml_fields`** without cross-account S3 export setup.

## Authentication (required)

These scripts call **DynamoDB in AWS** from your laptop or CI. They use the **AWS SDK default credential chain** — the same as the AWS CLI.

They do **not** use:

- HCP Terraform / Terraform Cloud
- The **`HCPTerraform`** OIDC role (that role is only for HCP applies)

### Before you run export or import

1. **Confirm you can call AWS**, e.g.:

   ```bash
   aws sts get-caller-identity --profile lab
   ```

2. **Pick one auth method:**

| Method | When to use |
|--------|-------------|
| **AWS SSO** | UBC / lab SSO (`aws configure sso`) |
| **Named profile** | `~/.aws/credentials` from `aws configure` |
| **Environment variables** | CI or short-lived keys |

3. **Pass profile/region to the script** (optional if already in env):

   ```bash
   node export.mjs --profile lab --region ca-central-1 --table eml_fields --out ./eml_fields-backup.json
   ```

   Or:

   ```bash
   export AWS_PROFILE=lab
   export AWS_REGION=ca-central-1
   node export.mjs --table eml_fields --out ./eml_fields-backup.json
   ```

On first run, the script prints **`Authenticated — account 940309384764, region …`** via STS. If that fails, you get setup instructions (no silent anonymous access).

### IAM permissions (your user/role, not HCPTerraform)

| Script | Actions | Resource |
|--------|---------|----------|
| **export.mjs** | `dynamodb:Scan` | Source table ARN (e.g. `eml_fields`) |
| **import.mjs** | `dynamodb:BatchWriteItem`, `dynamodb:PutItem` | Target table ARN |

Example inline policy snippet for a human **backup operator** role:

```json
{
  "Effect": "Allow",
  "Action": ["dynamodb:Scan", "dynamodb:BatchWriteItem", "dynamodb:PutItem", "dynamodb:DescribeTable"],
  "Resource": [
    "arn:aws:dynamodb:ca-central-1:940309384764:table/eml_fields",
    "arn:aws:dynamodb:ca-central-1:940309384764:table/ubc-eml-virtual-soils-*"
  ]
}
```

---

## When to use this

| Scenario | Approach |
|----------|----------|
| Same table, Terraform adoption only | **`terraform import`** — data stays in place; no backup zip |
| New table, few dozen rows | **This zip workflow** |
| Large table / ongoing backups | AWS export → **`assets_bucket_name`** (same account) — see runbook |

---

## Export

```bash
cd projects/ubc-eml/virtual-soils/scripts/dynamodb-backup
npm ci
aws sso login --profile lab   # if using SSO
node export.mjs --profile lab --table eml_fields --out ./eml_fields-backup.json
```

Zip (PowerShell):

```powershell
Compress-Archive -Path .\eml_fields-backup.json -DestinationPath .\eml_fields-backup.zip -Force
```

Hand off **`eml_fields-backup.zip`**.

---

## Import

Unzip, authenticate to the **target** account, then:

```bash
npm ci
aws sso login --profile lab
node import.mjs --profile lab --file ./eml_fields-backup.json --table eml_fields
```

`--table` defaults to the table name in the backup file.

---

## Backup file format

Single JSON document:

- `format`: `virtual-soils-dynamodb-backup-v1`
- `tableName`, `region`, `exportedAt`, `itemCount`, `hashKey`
- `items`: array of field records (Document Client shape)

**Not** AWS native “Export to S3” `DYNAMODB_JSON` layout.

---

## Flags

| Flag | Purpose |
|------|---------|
| `--profile NAME` | AWS shared config profile (or `AWS_PROFILE`) |
| `--region REGION` | AWS region (default `ca-central-1`, or `AWS_REGION`) |
| `--table NAME` | DynamoDB table name |
| `--out PATH` | Export output file (export only) |
| `--file PATH` | Backup JSON path (import only) |
