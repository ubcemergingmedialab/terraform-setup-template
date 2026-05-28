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

### 7. CloudFront static site (`module.site`)

**Issue:** Adding `s3-static-site` requires CloudFront and OAC permissions not in the original policy.

**Resolution:** Add `CloudFrontVirtualSoils` and `CloudFrontListAccount` statements (see [Final IAM policy](#final-iam-policy)). Site S3 buckets (`ubc-eml-virtual-soils-prod-site-*`) are already covered by the existing `S3VirtualSoils` wildcard.

**Separate role for app deploy (Task 5):** GitHub Actions that run `aws s3 sync` + `cloudfront create-invalidation` should **not** use `HCPTerraform`. Use a narrower deploy role — see [`docs/iam/github-deploy-virtual-soils-policy.json`](./iam/github-deploy-virtual-soils-policy.json).

---

## After successful apply

1. **HCP outputs** → frontend build (Amplify today, GitHub Actions + CloudFront after cutover):
   - `site_url`, `site_bucket_name`, `cloudfront_distribution_id` → deploy pipeline
   - `api_endpoint` → `VITE_API_URL`
   - `cognito_user_pool_id` → `VITE_COGNITO_USER_POOL_ID`
   - `cognito_user_pool_client_id` → `VITE_COGNITO_CLIENT_ID`
   - `cognito_hosted_ui_domain` → `VITE_COGNITO_OAUTH_DOMAIN`
   - `assets_bucket_name` → backup/export jobs
2. After first apply with `module.site`, add **`site_url`** to `cognito_callback_urls`, `cognito_logout_urls`, and `cors_allow_origins`, then re-apply.
3. Replace hardcoded Cognito values in `src/auth.ts` and `src/Admin.tsx` when ready to cut over.
4. Run **Plan only** periodically; expect **no** unexpected destroys.

---

## Final IAM policy

Attach this as a **customer managed policy** or **inline policy** on IAM role **`HCPTerraform`** in account **`940309384764`**.

**Canonical copy in git:** [`docs/iam/hcp-terraform-virtual-soils-policy.json`](./iam/hcp-terraform-virtual-soils-policy.json) — paste from there if the console loses your edit.

**Trust policy** (OIDC for HCP) is separate—configure via [HashiCorp dynamic credentials](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration), scoped to org `EML` and workspace `ubc-eml-virtual-soils`.

The JSON below matches the file in git (includes **CloudFront** for `module.site`).

### New statements for CloudFront (Task 3)

If you are **appending** to an existing policy instead of replacing it, add these two blocks:

```json
{
  "Sid": "CloudFrontVirtualSoils",
  "Effect": "Allow",
  "Action": [
    "cloudfront:CreateDistribution",
    "cloudfront:UpdateDistribution",
    "cloudfront:DeleteDistribution",
    "cloudfront:GetDistribution",
    "cloudfront:GetDistributionConfig",
    "cloudfront:CreateOriginAccessControl",
    "cloudfront:UpdateOriginAccessControl",
    "cloudfront:DeleteOriginAccessControl",
    "cloudfront:GetOriginAccessControl",
    "cloudfront:TagResource",
    "cloudfront:UntagResource",
    "cloudfront:ListTagsForResource"
  ],
  "Resource": [
    "arn:aws:cloudfront::940309384764:distribution/*",
    "arn:aws:cloudfront::940309384764:origin-access-control/*"
  ]
},
{
  "Sid": "CloudFrontListAccount",
  "Effect": "Allow",
  "Action": [
    "cloudfront:ListDistributions",
    "cloudfront:ListOriginAccessControls",
    "cloudfront:ListTagsForResource"
  ],
  "Resource": "*"
}
```

Site buckets (`ubc-eml-virtual-soils-prod-site-*`) are already covered by the existing **`S3VirtualSoils`** wildcard (`arn:aws:s3:::ubc-eml-virtual-soils-*`).

**Full policy:** open [`docs/iam/hcp-terraform-virtual-soils-policy.json`](./iam/hcp-terraform-virtual-soils-policy.json) and paste the entire file into the IAM console.

### Policy notes

- **`iam:PassRole`** uses a `lambda.amazonaws.com` condition; **`iam:CreateRole`** does not (CreateRole failed when PassRole was the only IAM grant).
- **`logs:DescribeLogGroups`** and **`cognito-idp:DescribeUserPoolDomain`** use `Resource: *` because AWS evaluates those APIs at account/global scope.
- **`CloudFrontListAccount`** uses `Resource: *` for list/describe APIs (same pattern as CloudWatch Logs).
- **`eml-soils-db`** remains in the S3 ARNs for optional import; production backups should use the generated `ubc-eml-virtual-soils-prod-assets-*` bucket; site buckets use `ubc-eml-virtual-soils-prod-site-*`.
- This policy is for **Terraform runs only**. App deploy CI uses a **separate, narrower role** — see [`github-deploy-virtual-soils-policy.json`](./iam/github-deploy-virtual-soils-policy.json).
- The **Lambda execution role** (DynamoDB access) is created separately by Terraform and is not the `HCPTerraform` role.

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
| 2026-05-28 | Added CloudFront IAM for `module.site`; policy file at `docs/iam/hcp-terraform-virtual-soils-policy.json`. |
