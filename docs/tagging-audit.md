# Tagging Audit — Phase 1 (Terraform-managed resources)

Status of the Phase 1 tagging workstream described in
`temp/tagging-audit-phase1-terraform.md`. This document is the record the
handoff's "definition of done" asks for: it captures the coverage audit, the CI
enforcement that was added, and the list of resources that cannot inherit tags
(the exceptions the later resource-inventory tool must not misclassify).

Goal of Phase 1: **every Terraform-managed, taggable resource carries
`Client`, `Project`, `Environment`, and `ManagedBy = "terraform"`, sourced from
one place and enforced in CI.**

> Audit method: **static only** (source `.tf` scan). No `terraform plan` /
> `terraform apply` was run — the lab has no local Terraform CLI; HCP Terraform
> runs plans. Any item below marked "verify on next plan" should be confirmed
> against `tags_all` in an HCP speculative plan when convenient.

---

## 1. Summary — what was already in place

Steps 1 and 2 of the handoff (centralize via `default_tags`, hard-code
`ManagedBy`) were **already implemented** across the repo before this audit:

- All **14** `provider "aws"` blocks (13 project roots + `projects/_template`)
  declare a `default_tags` block.
- Every one includes the four required tags via the repo's standard pattern:

  ```hcl
  default_tags {
    tags = merge(
      {
        Client      = var.client_name
        Project     = var.project_name
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags,
    )
  }
  ```

- `ManagedBy` is hard-coded to the string `"terraform"` (not a variable),
  as required.
- The four tags come from the five-variable contract in `docs/conventions.md`
  (`client_name`, `project_name`, `environment`, `aws_region`, `tags`).
- One provider block (`projects/lab-shared/bedrock-auth`) adds an extra
  `Purpose` key. That is additive and does not affect the four required tags.

Because `default_tags` is set at each project root, the four tags propagate to
**every taggable resource the provider creates, including resources defined
inside `modules/`.** Modules do not need to re-declare the four tags.

## 2. Gaps that this change closed

| Gap (handoff step) | Before | After |
|---|---|---|
| Coverage audit recorded (step 3) | none | this document |
| Exception list for non-taggable resources (DoD) | none | section 4 below |
| CI enforcement (step 4) | `fmt` + `validate` + `tflint` only, no tag rule | provider-level tag gate added to `.github/workflows/terraform-checks.yml` + `.tflint.hcl` rule |
| `_template` contract variables | stub TODO only | five contract variables declared |

## 3. Inline tags in modules — no conflict with default_tags

Several modules set an inline `tags` attribute. All of them are **additive**:
they add resource-specific keys (`Name`, `Tier`) or pass through a module-local
`var.tags`, and **none** set any of the four reserved keys
(`Client`/`Project`/`Environment`/`ManagedBy`). So there is no key collision
with `default_tags` and no risk of the "perpetual diff" failure mode the handoff
warns about.

| Module | Inline tags | Keys set | Conflict? |
|---|---|---|---|
| `private-database-vpc` | literal map | `Name`, `Tier` | No |
| `bedrock-chat-backend` | `tags = var.tags` | module-local extras | No |
| `bedrock-oidc-auth` | `merge(...)` | `Name`/extras | No |
| `polly-tts-backend` | `tags = var.tags` | module-local extras | No |
| `transcribe-batch-backend` | `tags = var.tags` | module-local extras | No |

`aws_cognito_identity_pool_principal_tag.principal_tags` in `bedrock-oidc-auth`
is **not** a resource tag — it is a Cognito principal-tag mapping and is
unrelated to cost-allocation tagging. Ignore it for this audit.

## 4. Exception list — resources that cannot inherit the four tags

These resource types are **not modeled with a `tags` attribute** by the AWS
provider, so `default_tags` does not apply to them. This is expected and
correct; they simply cannot be tagged.

**Action for the later inventory tool:** treat the types below as
*non-taggable*, not as hand-created resources missing `ManagedBy`. If the tool
keys purely off "has `ManagedBy = terraform` in live tags", these will look
untagged and would otherwise generate bogus "add ManagedBy manually"
instructions that cannot be satisfied.

Non-taggable types present in this repo:

- API Gateway v2: `aws_apigatewayv2_authorizer`, `aws_apigatewayv2_integration`,
  `aws_apigatewayv2_route` (the `aws_apigatewayv2_api` and `_stage` **are**
  taggable and do inherit)
- App Auto Scaling: `aws_appautoscaling_policy`, `aws_appautoscaling_target`
- `aws_bedrock_guardrail_version` (child snapshot; the guardrail itself is taggable)
- CloudFront helpers: `aws_cloudfront_origin_access_control`,
  `aws_cloudfront_response_headers_policy`
- Cognito children: `aws_cognito_identity_pool_principal_tag`,
  `aws_cognito_identity_pool_roles_attachment`, `aws_cognito_user_group`,
  `aws_cognito_user_pool_client`, `aws_cognito_user_pool_domain`
- `aws_ecr_lifecycle_policy` (the repository is taggable)
- IAM sub-resources: `aws_iam_access_key`, `aws_iam_role_policy`,
  `aws_iam_role_policy_attachment`, `aws_iam_user_policy`
- `aws_kms_alias` (the key is taggable)
- `aws_lambda_function_url`, `aws_lambda_permission` (the function is taggable)
- `aws_lb_listener` (the LB and target group are taggable)
- `aws_route_table_association`
- S3 bucket sub-config: `aws_s3_bucket_cors_configuration`,
  `aws_s3_bucket_lifecycle_configuration`, `aws_s3_bucket_ownership_controls`,
  `aws_s3_bucket_policy`, `aws_s3_bucket_public_access_block`,
  `aws_s3_bucket_server_side_encryption_configuration`,
  `aws_s3_bucket_versioning`

### Items to verify on the next HCP plan

Newer resource types used in `projects/ubc-eml/episode` whose tag support should
be confirmed against `tags_all` on a real plan:

- `aws_s3vectors_vector_bucket`, `aws_s3vectors_index` — S3 Vectors; tag support
  is limited/absent in current provider versions. Likely **non-taggable** →
  treat as exceptions until confirmed.
- `aws_bedrockagent_data_source` — **non-taggable**.
- `aws_bedrockagent_knowledge_base` — **taggable**; should inherit the four
  tags. Confirm on plan.

## 5. Taggable resources — coverage

Every other `aws_*` resource type in `modules/` and `projects/` is taggable and
inherits the four tags from the project-root `default_tags`. Representative
taggable types confirmed present: `aws_s3_bucket`, `aws_cloudfront_distribution`,
`aws_lambda_function`, `aws_iam_role`, `aws_iam_user`, `aws_iam_policy`,
`aws_iam_openid_connect_provider`, `aws_cloudwatch_log_group`,
`aws_cognito_user_pool`, `aws_cognito_identity_pool`, `aws_dynamodb_table`,
`aws_ecr_repository`, `aws_ecs_cluster`, `aws_ecs_service`,
`aws_ecs_task_definition`, `aws_lb`, `aws_lb_target_group`, `aws_rds_cluster`,
`aws_rds_cluster_instance`, `aws_db_subnet_group`, `aws_kms_key`, `aws_vpc`,
`aws_subnet`, `aws_route_table`, `aws_security_group`, `aws_apigatewayv2_api`,
`aws_apigatewayv2_stage`, `aws_bedrock_guardrail`.

No taggable resource was found that sets a conflicting inline value for any of
the four reserved keys.

## 6. CI enforcement added

Two layers were added, both in CI:

1. **Provider-level gate (authoritative).** A new step
   *"Enforce default_tags on every provider"* in
   `.github/workflows/terraform-checks.yml` fails the build if any `.tf` file
   with an `aws` provider block under `projects/` is missing a `default_tags`
   block, is missing any of `Client` / `Project` / `Environment` / `ManagedBy`,
   or does not hard-code `ManagedBy = "terraform"`.

   This is the right guard for this repo because tags are applied via
   `default_tags`, and it catches the real regression: a new project root that
   forgets the tag block.

2. **`.tflint.hcl` rule (secondary).** `aws_resource_missing_tags` is enabled
   for the four tags, with a comprehensive `exclude` list of the non-taggable
   types in section 4.

   ⚠️ **Known limitation:** `aws_resource_missing_tags` does a source-text check
   and does **not** understand provider `default_tags` inheritance (upstream
   issue `terraform-linters/tflint-ruleset-aws#53`). It cannot, on its own,
   confirm inheritance-only resources are tagged. That is exactly why the
   provider-level gate above is the authoritative check. See the comments in
   `.tflint.hcl` for details.

### Optional, not done

- AWS Config `required-tags` managed rule (account-wide detection backstop).
  Out of scope for this change; noted in the handoff as optional. It also
  detects non-Terraform resources, which belongs to the later inventory phase.

## 7. Definition of done

- [x] `default_tags` on every `aws` provider block, from a single
      variable/`merge` pattern. *(was already true; audited)*
- [x] `ManagedBy = "terraform"` hard-coded in the default tag map.
- [x] Coverage audited (static); taggable resources inherit the four tags.
- [x] Non-taggable / exception resources documented (section 4).
- [x] One CI check fails on a new provider missing any of the four tags.
- [ ] (Optional) AWS Config `required-tags` rule — not enabled.
- [ ] Confirm `tags_all` on a real HCP plan for the "verify on next plan"
      resources in section 4.

## Out of scope (later phases)

Hand-created / console resources, and any tag-writing tooling, are handled by a
separate **read-only** resource-inventory tool. The `ManagedBy = "terraform"`
tag made consistent here is the signal that tool uses to tell Terraform-managed
resources apart from hand-created ones.
