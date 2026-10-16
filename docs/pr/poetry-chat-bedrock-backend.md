# Add bedrock-chat-backend module + poetry-chat project

## Summary

Adds a reusable `bedrock-chat-backend` Terraform module and a `poetry-chat`
project that uses it. This replaces the EC2 "moot-api" OpenAI chat proxy for
PoetryHouse with a serverless Lambda → Amazon Bedrock backend, retiring an
always-on EC2 cost.

The chat Lambda is fronted by an **IAM-authenticated Lambda Function URL**. The
game POSTs SigV4-signed requests using a **scoped IAM user** (invoke-only) whose
access key ships with the build. No public/unauthenticated endpoint, no
long-running proxy.

This is a new workspace (`poetry-chat`), independent of `poetry-transcribe` —
separate state, separate runs. The transcribe-proxy project is untouched.

## What's in this PR

**New module — `modules/bedrock-chat-backend/`**
- Lambda (Node 22, arm64) calling Bedrock `Converse`, with `BEDROCK_MODEL_ID` injected.
- Execution role: basic logging + `bedrock:InvokeModel` / `InvokeModelWithResponseStream`,
  scoped by `bedrock_model_arns` (default `*`).
- `aws_lambda_function_url` — `AWS_IAM` auth, `BUFFERED` invoke mode (single-reply,
  matching the game's existing message contract).
- CloudWatch log group.
- Optional scoped invoker IAM user + access key (`create_invoker_user`, default `true`)
  whose only permission is `lambda:InvokeFunctionUrl` on this function.
- Follows repo conventions: `name_prefix` input, `aws ~> 5.0`, `.build/` gitignored,
  sensitive outputs, module README.
- README documents that the default handler needs **no** `node_modules` bundling
  (the `@aws-sdk/*` v3 client is runtime-provided), and when bundling would be needed.

**New project — `projects/poetryhouse/chat-backend/`**
- Thin project composing the module. HCP workspace `poetry-chat`, org `EML`,
  working dir `projects/poetryhouse/chat-backend`.
- `name_prefix` = `poetry-chat-dev` (consistent with `poetry-transcribe-dev`).
- Lambda source: `lambda/chat-backend/{handler.mjs, package.json, package-lock.json, .gitignore}`.
  `node_modules/` is gitignored (not committed).
- Outputs the game needs: `chat_function_url`, `aws_region`, and sensitive
  `chat_invoker_access_key_id` / `chat_invoker_secret_access_key`.

**CI — `.github/workflows/terraform-checks.yml`**
- Added `npm ci` for the chat-backend lambda (so `validate`/`archive_file` can
  resolve + hash the source dir).
- Added `terraform init -backend=false` + `validate` for the poetry-chat project.

**IAM — `docs/iam/`**
- New project policy `hcp-terraform-poetry-chat-policy.json`, scoped to `poetry-chat-dev-*`.
- Back-ported `lambda:*FunctionUrlConfig` actions into the shared
  `hcp-terraform-policy.template.json` `LambdaProject` block (Function URLs
  weren't covered before), and added a `bedrock-chat-backend` row to the module
  table in `hcp-terraform-policy.md`.
- Removed nonexistent `apigateway:TagResource` / `apigateway:UntagResource`
  actions from the shared template (AWS rejects them; tagging goes through the
  `PUT`/`PATCH`/`DELETE` verbs on `.../tags/*`).

**IAM role consolidation — `docs/iam/existing_inline_policies/`**
- The `HCPTerraform` role hit the 10,240-char **aggregate inline** limit.
- De-duplicated the near-identical Virtual Soils + CoFood inline policies (and
  the CloudFront response-headers overflow) into one logical set
  (`Consolidated-HCPTerraform.json`), then split it into two **customer-managed**
  policies (`Managed-HCPTerraform-LambdaIam.json` 3.4 KB,
  `Managed-HCPTerraform-WebData.json` 4.1 KB) — each under the 6,144 managed
  limit, attached to the role, not counting against the inline aggregate.
- Verified the two managed policies' union is **exactly equal** to the
  consolidated policy (0 missing, 0 extra action/resource pairs).
- Inline aggregate drops ~15,900 → ~3,263 bytes (Episode + Poetry only).
- `CONSOLIDATION.md` documents the reasoning and manual apply steps.
- Episode and Poetry-transcribe policies intentionally left as-is (different
  service sets / scopes; merging would change effective access).

## Testing

- Terraform: files follow repo patterns and are internally consistent. **Not yet
  `plan`/`validate`-run against HCP** — the `poetry-chat` workspace doesn't exist
  until this merges and the workspace is created. The PR speculative plan + the
  new CI `validate` step are the first real validations.
- IAM: policy sizes and permission-equivalence were checked programmatically
  (JSON parse, byte counts vs limits, action/resource coverage diff). **Not yet
  applied to the live role.**
- Game side (separate Perforce repo, for context): the Unreal client
  (`AwsSigV4Signer`, `UBedrockChatClient`, `TextGeneratorWebSocket` rewire,
  `Build.cs`, `DefaultGame.ini`) compiled and linked clean against UE 5.5.

## Before first apply (deploy checklist)

- [ ] IAM: create the two managed policies from
      `docs/iam/existing_inline_policies/Managed-HCPTerraform-*.json`, attach both
      to the `HCPTerraform` role, then delete the three inline policies they
      replace (`HCPTerraform`, `HCPTerraformCoFoodPolicy`, `CloudFrontResponseHeaders`).
      Keep `HCPTerraformEpisodePolicy` and `HCPTerraformPoetryPolicy`.
- [ ] IAM: attach the poetry-chat project permissions (either fold into the
      managed policies or attach `hcp-terraform-poetry-chat-policy.json` after
      replacing `REPLACE_AWS_ACCOUNT_ID` / `REPLACE_AWS_REGION`).
      Note: `poetry-chat-dev-*` is already included in the consolidated/managed
      policies, so a separate poetry-chat policy is only needed if not using those.
- [ ] HCP: create workspace `poetry-chat` (VCS workflow, working dir
      `projects/poetryhouse/chat-backend`, auto-apply off), wire dynamic credentials,
      update OIDC trust for the new workspace.
- [ ] Bedrock: enable the chosen model in `ca-central-1` model access. If Claude
      3.5 Sonnet isn't offered there directly, set `bedrock_model_id` to the
      cross-region inference-profile ID and scope `bedrock_model_arns` to it.
- [ ] After apply, paste outputs into the game's `Config/DefaultGame.ini`
      `[PoetryHouse.Bedrock]`.

## Notes / follow-ups

- Read the speculative plan carefully: it should **only create**
  `module.chat_backend.*` resources. If anything shows destroy, do not merge.
- Sentiment-analysis and NPC chat paths are intentionally **not** migrated (not
  in the current game flow); they remain on moot-api. The module + infra already
  support them if migrated later.
- Consider a Bedrock spend budget/alarm so a leaked invoker key can't run up an
  unbounded bill.
- The shipped IAM key is revocable:
  `terraform taint module.chat_backend.aws_iam_access_key.invoker[0]` then apply,
  and re-deploy the game config.
- `HCPTerraformEpisodePolicy` is the least-scoped policy on the role
  (`service:*` on `*`) — a good candidate to tighten in a future PR.
