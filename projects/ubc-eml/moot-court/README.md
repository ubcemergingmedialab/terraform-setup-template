# MootCourt — AWS deployment (ubc-eml)

Brings up the AWS resources for the MootCourt mooting-practice app: a LiveKit
voice agent (the appellate judge), a token service, a login-gated React SPA, and
a strict one-live-session lock. Deployed through the **HCP Terraform VCS-driven
apply workflow** — there are no local `terraform` CLI runs.

## Architecture

```
                 Cognito hosted UI (login; one approved user only)
                          │ JWT
browser (courtroom SPA, S3+CloudFront)
   │  GET /token, POST /simli-token  (Authorization: Bearer <Cognito JWT>)
   ▼
API Gateway HTTP API ── Lambda (token-service, Node)
   ├─ /token         → acquire single-session lock (DynamoDB) → mint LiveKit JWT (or 409)
   ├─ /simli-token   → proxy Simli /compose/token (server-held key)
   └─ /livekit-webhook (public, signed) → release lock on room_finished
   │
   ▼ (browser joins LiveKit room with the minted JWT)
LiveKit Cloud room ── dispatches ──▶ agent worker (ECS Fargate, always-on 1 task)
                                       Transcribe STT → Bedrock LLM → Polly TTS
                                       (all AWS, via the ECS task role)
```

| Piece | AWS | Module |
|------|-----|--------|
| Agent worker (`agent.py`, Polly path) | ECS Fargate + ALB (health only) + ECR | `ecs-fargate-service`, `ecr-repository` |
| Token service (`handler.mjs`) | Lambda + API Gateway HTTP API | `lambda-http-api` |
| Login gate | Cognito user pool (admin-created users only) + one group + one user | `cognito-user-pool` |
| Frontend (`courtroom`) | S3 + CloudFront (OAC) | `s3-static-site` |
| One-live-session lock | DynamoDB (conditional write + TTL) | project-local resource |
| Secrets (LiveKit, Simli) | Secrets Manager | project-local resources |

Not managed here: **LiveKit Cloud** (external SaaS), **Simli** (external SaaS).
Those provide the keys you set as HCP sensitive variables.

## Auth model: strictly one live session

Two layers combine to give "only one session, ever":

1. **Who can log in** — Cognito is locked to admin-created users only
   (`allow_self_signup = false`). We seed exactly one user (`admin_email`) in an
   `approved` group. No self sign-up.
2. **One live session at a time** — `/token` acquires a DynamoDB lock keyed by the
   room name via a conditional write before minting a LiveKit join token. If a
   session already holds the lock, `/token` returns **409**. The lock has a TTL
   safety net, and the LiveKit **webhook** releases it the moment the room ends.

## Secrets (set in HCP, never in git)

In the HCP workspace, add these as **Sensitive** Terraform variables:

| Variable | What |
|----------|------|
| `livekit_api_key` | LiveKit Cloud API key |
| `livekit_api_secret` | LiveKit Cloud API secret |
| `simli_api_key` | Simli API key (for `/simli-token`) |

AWS speech/LLM services (Transcribe, Bedrock, Polly) use the **ECS task role** —
no keys. `livekit_url` is public and lives in `terraform.auto.tfvars`.

## Deploy (VCS-driven, no local CLI)

1. **Create the HCP workspace** `ubc-eml-moot-court`, VCS-driven, pointed at this
   repo + this directory. The `cloud` block in `versions.tf` already names it.
2. **Set the sensitive variables** above in the workspace.
3. **Edit `terraform.auto.tfvars`**: `admin_email`, `livekit_url`, and (optionally)
   voice/position. Commit it.
4. **Build + push the agent image and install the Lambda deps in CI** (see below)
   so the plan can resolve the ECR image and zip the Lambda. HCP's own runner can
   do this in a pre-plan step, or a separate CI job pushes to ECR on merge.
5. **Open a PR → HCP plans → merge → HCP applies.** Terraform is the only thing
   HCP runs; the image build and SPA upload are CI/post-apply steps, not Terraform.
6. **One-time account prerequisites** (not Terraform):
   - Enable Bedrock model access for `anthropic.claude-sonnet-4-6` in
     `ca-central-1` (Bedrock console → Model access).
   - In the LiveKit Cloud project, set the **webhook URL** to the
     `livekit_webhook_url` output so session-end releases the lock.

### Build the agent image (CI, pushed to the `agent_ecr_repository_url` output)

The Docker build context in `agent/` ships the Dockerfile and a health wrapper.
Copy the MootCourt agent sources in before building:

```bash
# from the MootCourt repo's livekit-agent/ dir, into this agent/ context:
cp agent.py prompts.py requirements.txt <repo>/projects/ubc-eml/moot-court/agent/

cd <repo>/projects/ubc-eml/moot-court/agent
docker build -t "$ECR_URL:latest" .
aws ecr get-login-password --region ca-central-1 | docker login --username AWS --password-stdin "${ECR_URL%/*}"
docker push "$ECR_URL:latest"
```

> The Polly path (`agent.py`) is all-AWS and needs **no** `AZURE_SPEECH_KEY`. The
> agent authenticates Transcribe/Bedrock/Polly through the ECS task role; its
> `_resolve_stt_credentials()` resolves the task-role creds from the container
> credentials endpoint and hands them to the Transcribe plugin explicitly.

### Install Lambda deps (CI, before plan)

`archive_file` zips `lambda/token-service/`, so `node_modules` must exist and
`livekit-server-sdk` must be bundled (it is not in the Lambda runtime):

```bash
npm --prefix lambda/token-service ci
```

### Deploy the SPA (post-apply)

```bash
# build courtroom with VITE_* pointed at the token API + Cognito, then:
aws s3 sync dist/ "s3://$(terraform output -raw site_bucket_name)/" --delete
aws cloudfront create-invalidation \
  --distribution-id "$(terraform output -raw cloudfront_distribution_id)" --paths "/*"
```

Frontend runtime config (from outputs):
- `VITE_LIVEKIT_TOKEN_URL = <token_api_endpoint>/token`
- `VITE_SIMLI_TOKEN_URL   = <token_api_endpoint>/simli-token`
- Cognito login via `cognito_hosted_ui_domain` + `cognito_user_pool_client_id`;
  the SPA must attach the Cognito access token as `Authorization: Bearer` on the
  token/simli calls (the API Gateway JWT authorizer requires it).

## Outputs

`site_url`, `token_api_endpoint`, `livekit_webhook_url`, `cognito_hosted_ui_domain`,
`cognito_user_pool_client_id`, `agent_ecr_repository_url`, `agent_cluster_name`,
`agent_service_name`, `session_lock_table_name`.

## IAM for the HCP runner

The runner needs permissions for: Cognito, Secrets Manager, DynamoDB, Lambda,
API Gateway, IAM (roles/policies), CloudWatch Logs, ECR, ECS, EC2 (VPC/SG/ALB
data + ALB resources), S3, and CloudFront.

Most of this is already granted to the shared `HCPTerraform` role by the existing
`Managed-HCPTerraform-WebData` (Cognito pool, API Gateway, CloudFront) and the
`Episode` / `Poetry` inline policies (Lambda, IAM, Logs, S3, ECS, ECR, ELB, EC2).
The gaps are covered by `docs/iam/hcp-terraform-ubc-eml-moot-court-policy.json`
(DynamoDB, Cognito user/group admin, API Gateway tagging, Secrets Manager), a
customer-managed policy named `HCPTerraform-ubc-eml-moot-court`. Attach it to
`HCPTerraform` before the first apply.

## Notes / cost

- The agent is **always-on** (one Fargate task) so it can accept dispatch; that's
  the fixed cost even at zero sessions (~$15–40/mo). Everything else scales with
  use. See `temp/azure-livekit-costs.md` in the MootCourt repo (note: this
  deployment uses the Polly path, so there is no Azure Speech cost).
- Single session is enforced in the token service, not by infra alone — the lock
  lives in DynamoDB and is released by the LiveKit **`room_finished`** webhook.
- Lock lifecycle tuning: `room_finished` fires when the room closes or the last
  participant leaves **and** LiveKit's room empty-timeout elapses. The lock also
  carries a `SESSION_TTL_SECONDS` safety-net TTL (default 900s). Keep the TTL
  comfortably above a normal session length so a live session is never unlocked
  underneath the user; the webhook handles the normal fast release. We do not
  release on `participant_left`, so a brief reconnect keeps the slot.
