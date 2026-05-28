# Virtual Soils — HCP Terraform deployment runbook

This document records how Virtual Soils AWS infrastructure was brought under Terraform via **HCP Terraform** (org **EML**), the problems encountered during the first applies, and the **final IAM policy** used for the `HCPTerraform` OIDC role.

**Related docs**

- App repo: `25---1002-SOIL-SCIENCE` (frontend only; no Terraform in that repo)
- Project code: `projects/ubc-eml/virtual-soils/`
- Import notes: [`virtual-soils-import-existing.md`](./virtual-soils-import-existing.md)
- HCP wiring: [`../projects/ubc-eml/virtual-soils/README.md`](../projects/ubc-eml/virtual-soils/README.md)

---

## Architecture decision: lab monorepo, not app repo

Virtual Soils infrastructure lives in the **lab Terraform monorepo** (`terraform-setup-template`), not in the application repository.

| Piece | Location |
|-------|----------|
| Terraform modules | `modules/` |
| Virtual Soils stack | `projects/ubc-eml/virtual-soils/` |
| HCP organization | `EML` |
| HCP workspace | `ubc-eml-virtual-soils` |
| Working directory | `projects/ubc-eml/virtual-soils` |
| Apply runner | HCP Terraform (VCS on merge to `main`) |
| Lab laptops | No Terraform CLI required |

The app repo consumes **outputs** via Amplify environment variables (`VITE_API_URL`, Cognito IDs).

---

## What the stack provisions

| Resource | Purpose |
|----------|---------|
| DynamoDB table | Field records (`FieldID`); legacy name `eml_fields` when importing |
| Cognito user pool + OAuth client | Admin sign-in at `/admin` |
| Lambda + API Gateway HTTP API | `GET /pins`, `GET /fields`, admin CRUD on `/admin/api/fields` |
| S3 bucket | Optional assets / **DynamoDB backup export** target |
| IAM (optional) | SigV4 invoker user if `create_iam_api_invoker = true` (default: false) |

Lambda source: `projects/ubc-eml/virtual-soils/lambda/` — run `npm ci` there before plan (CI does this on PRs).

---

## Setup steps (summary)

1. **GitHub** — Virtual Soils project merged into lab repo under `projects/ubc-eml/virtual-soils/`.
2. **HCP workspace** — Created `ubc-eml-virtual-soils` in org `EML`, VCS-connected, working directory `projects/ubc-eml/virtual-soils`.
3. **AWS OIDC** — IAM role `HCPTerraform` with trust policy for HCP dynamic credentials (org `EML`, workspace-scoped).
4. **Permissions policy** — Custom scoped policy on `HCPTerraform` (see [Final IAM policy](#final-iam-policy) below). Iterated after each apply failure.
5. **Terraform variables** — Committed in `terraform.auto.tfvars` (not duplicated in HCP UI unless overriding).
6. **Apply** — Merge to `main` → HCP plan/apply (auto-apply or manual confirm per workspace setting).
7. **Frontend** — Copy HCP outputs to Amplify env vars; update `src/auth.ts` when cutting over from hardcoded Cognito IDs.

---

## Challenges and debugging

### 1. Repo layout confusion

**Issue:** An initial attempt put a full `terraform/` tree inside the app repo. That would require a second HCP workspace and duplicate modules.

**Resolution:** Infrastructure only in the lab monorepo; app repo keeps a short `terraform/README.md` pointer.

---

### 2. HCP organization slug

**Issue:** Placeholder org name `lab-emerging-media` in `versions.tf`.

**Resolution:** Updated to **`EML`** in all project `versions.tf` files.

---

### 3. IAM permissions — iterative “whack-a-mole”

**Issue:** First applies failed with `AccessDenied` on many **read/describe** APIs the AWS provider calls during create and refresh—not only on write actions.

**Pattern:** Terraform often needs `Describe*`, `Get*`, and tag-related actions that are not obvious from the `.tf` files alone. Missing permissions are usually **safe to add when scoped** to project resource names (`ubc-eml-virtual-soils-*`), not a reason to grant `AdministratorAccess`.

**Errors encountered and fixes:**

| Error | Action needed | Risk if scoped |
|-------|---------------|----------------|
| API Gateway create + default tags | `apigateway:POST` on `/tags/*` as well as `/apis/*` | Low |
| DynamoDB refresh on `eml_fields` | `dynamodb:DescribeTimeToLive` | Very low (read-only) |
| Lambda execution role | `iam:CreateRole`, `iam:PassRole` on `role/ubc-eml-virtual-soils-*` | Low |
| CloudWatch log group refresh | `logs:DescribeLogGroups` (often needs `Resource: *`) | Low (read-only) |
| Cognito MFA refresh | `cognito-idp:GetUserPoolMfaConfig` | Very low |
| Lambda code signing check | `lambda:GetFunctionCodeSigningConfig` | Very low |
| Cognito domain wait | `cognito-idp:DescribeUserPoolDomain` on `Resource: *` | Low (AWS quirk) |
| S3 bucket refresh | `s3:GetAccelerateConfiguration` and other `GetBucket*` / `PutBucket*` | Low on named buckets |

**Lost policy in console:** The permissions policy was re-created from scratch more than once; the [final policy](#final-iam-policy) below is the consolidated version.

---

### 4. Legacy S3 bucket name `eml-soils-db`

**Issue:** `legacy_assets_bucket_name = "eml-soils-db"` caused **BucketAlreadyExists** on create, but the bucket did **not** appear in the AWS console (account `940309384764`).

**Why this is confusing:**

- **S3 bucket names are globally unique** across all AWS accounts. `eml-soils-db` may be owned by another account—you will never see it in your console.
- An older DynamoDB export in the app repo referenced account **`304292229203`**, not necessarily the current lab account.
- If create fails, Terraform usually **does not** put the bucket in state—so there is nothing to see and the error can repeat on every apply.

**Resolution for Terraform-managed backups:**

- Clear `legacy_assets_bucket_name = ""` and let Terraform generate a unique name, e.g. `ubc-eml-virtual-soils-prod-assets-078d04`.
- Use HCP output **`assets_bucket_name`** as the DynamoDB export / backup destination.
- Do **not** rely on the generic global name `eml-soils-db` unless you confirm it exists **in your account** and **import** it:

  ```bash
  terraform import 'module.assets[0].aws_s3_bucket.this' eml-soils-db
  ```

---

### 5. Partial apply state

**Issue:** Early applies failed mid-way (e.g. Cognito domain or API partially created).

**Resolution:** Fix IAM policy → re-run plan/apply. HCP/Terraform converges on subsequent runs; review plan for unexpected destroys before confirming.

---

### 6. Workspace variables vs Amplify variables

**Clarification:**

| Where | What |
|-------|------|
| **HCP workspace** | AWS credentials for Terraform only (OIDC role `HCPTerraform`, or static keys). Project inputs live in committed `terraform.auto.tfvars`. |
| **Amplify / `.env`** | App vars from Terraform **outputs**: `VITE_API_URL`, `VITE_COGNITO_*`. Not HCP Terraform variables. |

No sensitive Terraform *input* variables are required for Virtual Soils (Cognito app client has no secret).

---

## After successful apply

1. **HCP outputs** → Amplify:
   - `api_endpoint` → `VITE_API_URL`
   - `cognito_user_pool_id` → `VITE_COGNITO_USER_POOL_ID`
   - `cognito_user_pool_client_id` → `VITE_COGNITO_CLIENT_ID`
   - `cognito_hosted_ui_domain` → `VITE_COGNITO_OAUTH_DOMAIN`
   - `assets_bucket_name` → backup/export jobs
2. Ensure `cognito_callback_urls` / `cognito_logout_urls` in `terraform.auto.tfvars` include every Amplify URL (including preview branches if used).
3. Replace hardcoded Cognito values in `src/auth.ts` and `src/Admin.tsx` when ready to cut over.
4. Run **Plan only** periodically; expect **no** unexpected destroys.

---

## Final IAM policy

Attach this as a **customer managed policy** or **inline policy** on IAM role **`HCPTerraform`** in account **`940309384764`**.

**Trust policy** (OIDC for HCP) is separate—configure via [HashiCorp dynamic credentials](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration), scoped to org `EML` and workspace `ubc-eml-virtual-soils`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformReadIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBVirtualSoils",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:UpdateContinuousBackups",
        "dynamodb:UpdateTable",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:ListTagsOfResource"
      ],
      "Resource": [
        "arn:aws:dynamodb:ca-central-1:940309384764:table/eml_fields",
        "arn:aws:dynamodb:ca-central-1:940309384764:table/ubc-eml-virtual-soils-*"
      ]
    },
    {
      "Sid": "CognitoVirtualSoils",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:UpdateUserPool",
        "cognito-idp:GetUserPoolMfaConfig",
        "cognito-idp:SetUserPoolMfaConfig",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:UpdateUserPoolClient",
        "cognito-idp:CreateUserPoolDomain",
        "cognito-idp:DeleteUserPoolDomain",
        "cognito-idp:DescribeUserPoolDomain",
        "cognito-idp:UpdateUserPoolDomain",
        "cognito-idp:TagResource",
        "cognito-idp:UntagResource",
        "cognito-idp:ListTagsForResource"
      ],
      "Resource": "arn:aws:cognito-idp:ca-central-1:940309384764:userpool/*"
    },
    {
      "Sid": "CognitoDescribeUserPoolDomainGlobal",
      "Effect": "Allow",
      "Action": "cognito-idp:DescribeUserPoolDomain",
      "Resource": "*"
    },
    {
      "Sid": "LambdaVirtualSoils",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:GetFunctionCodeSigningConfig",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:ListVersionsByFunction",
        "lambda:PublishVersion",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags"
      ],
      "Resource": "arn:aws:lambda:ca-central-1:940309384764:function:ubc-eml-virtual-soils-*"
    },
    {
      "Sid": "ApiGatewayV2VirtualSoils",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:PATCH",
        "apigateway:DELETE",
        "apigateway:TagResource",
        "apigateway:UntagResource"
      ],
      "Resource": [
        "arn:aws:apigateway:ca-central-1::/apis",
        "arn:aws:apigateway:ca-central-1::/apis/*",
        "arn:aws:apigateway:ca-central-1::/tags/*"
      ]
    },
    {
      "Sid": "LogsDescribeAccount",
      "Effect": "Allow",
      "Action": "logs:DescribeLogGroups",
      "Resource": "*"
    },
    {
      "Sid": "LogsVirtualSoils",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy",
        "logs:ListTagsForResource",
        "logs:TagResource",
        "logs:UntagResource"
      ],
      "Resource": [
        "arn:aws:logs:ca-central-1:940309384764:log-group:/aws/lambda/ubc-eml-virtual-soils-*",
        "arn:aws:logs:ca-central-1:940309384764:log-group:/aws/lambda/ubc-eml-virtual-soils-*:*"
      ]
    },
    {
      "Sid": "S3VirtualSoils",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetAccelerateConfiguration",
        "s3:PutAccelerateConfiguration",
        "s3:GetBucketAcl",
        "s3:PutBucketAcl",
        "s3:GetBucketCORS",
        "s3:PutBucketCORS",
        "s3:GetBucketLocation",
        "s3:GetBucketLogging",
        "s3:PutBucketLogging",
        "s3:GetBucketNotification",
        "s3:PutBucketNotification",
        "s3:GetBucketObjectLockConfiguration",
        "s3:PutBucketObjectLockConfiguration",
        "s3:GetBucketOwnershipControls",
        "s3:PutBucketOwnershipControls",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketRequestPayment",
        "s3:PutBucketRequestPayment",
        "s3:GetBucketTagging",
        "s3:PutBucketTagging",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration",
        "s3:GetLifecycleConfiguration",
        "s3:PutLifecycleConfiguration",
        "s3:GetReplicationConfiguration",
        "s3:PutReplicationConfiguration"
      ],
      "Resource": [
        "arn:aws:s3:::eml-soils-db",
        "arn:aws:s3:::eml-soils-db/*",
        "arn:aws:s3:::ubc-eml-virtual-soils-*",
        "arn:aws:s3:::ubc-eml-virtual-soils-*/*"
      ]
    },
    {
      "Sid": "IAMRolesVirtualSoils",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:UpdateRole",
        "iam:PutRolePolicy",
        "iam:GetRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": "arn:aws:iam::940309384764:role/ubc-eml-virtual-soils-*"
    },
    {
      "Sid": "IAMPassRoleToLambda",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::940309384764:role/ubc-eml-virtual-soils-*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "lambda.amazonaws.com"
        }
      }
    },
    {
      "Sid": "AttachLambdaBasicExecution",
      "Effect": "Allow",
      "Action": "iam:AttachRolePolicy",
      "Resource": "arn:aws:iam::940309384764:role/ubc-eml-virtual-soils-*",
      "Condition": {
        "ArnEquals": {
          "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        }
      }
    },
    {
      "Sid": "IAMOptionalApiInvokerUser",
      "Effect": "Allow",
      "Action": [
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:GetUser",
        "iam:PutUserPolicy",
        "iam:DeleteUserPolicy",
        "iam:CreateAccessKey",
        "iam:DeleteAccessKey",
        "iam:ListAccessKeys",
        "iam:TagUser",
        "iam:UntagUser"
      ],
      "Resource": "arn:aws:iam::940309384764:user/ubc-eml-virtual-soils-*"
    }
  ]
}
```

### Policy notes

- **`iam:PassRole`** uses a `lambda.amazonaws.com` condition; **`iam:CreateRole`** does not (CreateRole failed when PassRole was the only IAM grant).
- **`logs:DescribeLogGroups`** and **`cognito-idp:DescribeUserPoolDomain`** use `Resource: *` because AWS evaluates those APIs at account/global scope.
- **`eml-soils-db`** remains in the S3 ARNs for optional import; production backups should use the generated `ubc-eml-virtual-soils-prod-assets-*` bucket.
- This policy is for **Terraform runs only**. The **Lambda execution role** (DynamoDB access) is created separately by Terraform and is not the `HCPTerraform` role.

---

## Lessons for future lab projects

1. Start with a **scoped** policy, but expect **describe/get/tag** gaps—plan for 2–3 apply iterations.
2. Keep the **full policy in git** (this doc) so console edits are recoverable.
3. **Never assume** a legacy bucket name from old exports exists in the current account—verify or use generated names.
4. **Import** pre-existing resources before apply when using `legacy_*` names.
5. Separate **HCP credentials** (infra) from **Amplify env vars** (app).

---

## Document history

| Date | Notes |
|------|--------|
| 2026-05-28 | Initial runbook after first successful Virtual Soils apply in account `940309384764`, HCP org `EML`. |
