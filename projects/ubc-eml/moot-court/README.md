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
4. **Build the Lambda bundle and push the agent image** (see below). The Lambda
   bundle (`lambda/token-service/dist/`) is committed to git, because HCP plans from
   a plain checkout with no `node_modules` and no pre-plan build step. The agent
   image is pushed to ECR by hand (or a separate CI job); the ECS service needs it
   before tasks can start.
5. **Open a PR → HCP plans → merge → HCP applies.** Terraform is the only thing
   HCP runs; the image build and SPA upload are CI/post-apply steps, not Terraform.
6. **One-time account prerequisites** (not Terraform):
   - Enable Bedrock model access for `anthropic.claude-sonnet-4-6` in
     `ca-central-1` (Bedrock console → Model access).
   - In the LiveKit Cloud project, set the **webhook URL** to the
     `livekit_webhook_url` output so session-end releases the lock.

### Build the agent image (pushed to the `agent_ecr_repository_url` output)

The Docker build context in `agent/` ships the Dockerfile and a health wrapper.
Copy the MootCourt agent sources in before building:

```bash
# from the MootCourt repo's livekit-agent/ dir, into this agent/ context:
cp agent.py prompts.py requirements.txt <repo>/projects/ubc-eml/moot-court/agent/
```

Then build and push. On a Windows workstation this uses the
[amazon-ecr-credential-helper](https://github.com/awslabs/amazon-ecr-credential-helper)
(`docker-credential-ecr-login`, bundled with Docker Desktop) instead of
`docker login`, plus an `aws configure export-credentials` step. Both are
explained below.

**One-time setup:** add a `credHelpers` entry for the registry to
`~/.docker/config.json`, keeping your existing keys:

```json
{
  "credHelpers": {
    "<account-id>.dkr.ecr.ca-central-1.amazonaws.com": "ecr-login"
  }
}
```

**Each push**, in a single shell:

```bash
# 1. Hand the credential helper plain env credentials (see "Why export-credentials")
eval "$(aws configure export-credentials --format env)"

# 2. Build and push. No `docker login` step; the helper fetches the ECR token.
cd <repo>/projects/ubc-eml/moot-court/agent
export ECR_URL=<account-id>.dkr.ecr.ca-central-1.amazonaws.com/ubc-eml-moot-court-dev-agent  # agent_ecr_repository_url output
docker build -t "$ECR_URL:latest" .
docker push "$ECR_URL:latest"

# 3. Roll the running service onto the new image (optional; ECS also retries on its own)
aws ecs update-service --region ca-central-1 \
  --cluster <agent_cluster_name> --service <agent_service_name> --force-new-deployment
```

If you use a non-default AWS profile, pass it to the export:
`aws configure export-credentials --profile <name> --format env`.

On an ARM machine (Apple Silicon), add `--platform linux/amd64` to
`docker build`. Fargate runs x86_64 by default, so an ARM image fails at task start
with `exec format error`.

#### Why export-credentials

If your AWS profile was set up with `aws login` (the config has a `login_session`
line instead of keys or SSO), the AWS CLI understands it but the credential
helper's embedded SDK does not. The helper then finds no credentials, falls back to
the EC2 metadata endpoint, and Docker reports `no basic auth credentials`.
`aws configure export-credentials --format env` resolves the session through the
CLI and exports it as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` /
`AWS_SESSION_TOKEN`, which the helper does read.

- The exported credentials are temporary and live only in that shell. If a push
  later fails with an auth error, the `aws login` session has expired: run
  `aws login` and repeat step 1.
- Quick check that the helper can get a token:
  `echo <account-id>.dkr.ecr.ca-central-1.amazonaws.com | docker-credential-ecr-login get >/dev/null && echo OK`
- The helper writes a log to `~/.ecr/log/ecr-login.log`. That is the place to look
  first when a push says `no basic auth credentials`.

#### Why not `docker login`

The usual `aws ecr get-login-password | docker login --username AWS --password-stdin`
flow fails on Windows Docker Desktop with
`error storing credentials ... The stub received bad data`. ECR tokens are longer
than the Windows credential store (`wincred`) accepts, so Docker cannot save the
login. The credential helper avoids this by fetching a fresh token on every push
instead of storing one.

> The Polly path (`agent.py`) is all-AWS and needs **no** `AZURE_SPEECH_KEY`. The
> agent authenticates Transcribe/Bedrock/Polly through the ECS task role; its
> `_resolve_stt_credentials()` resolves the task-role creds from the container
> credentials endpoint and hands them to the Transcribe plugin explicitly.

### Build the token-service Lambda bundle (commit `dist/`)

Terraform zips `lambda/token-service/dist/`, a single esbuild bundle of
`handler.mjs` that includes `livekit-server-sdk` (not part of the Lambda runtime).
`@aws-sdk/*` is left external because the `nodejs20.x` runtime provides it.

HCP Terraform VCS runs plan from a git checkout with no `node_modules` and no
pre-plan build step, so the bundle is built locally and **committed**. Rebuild it
whenever `handler.mjs` or the dependencies change:

```bash
cd projects/ubc-eml/moot-court/lambda/token-service
npm ci
npm run build        # writes dist/handler.mjs
git add dist package.json package-lock.json
```

CI (`terraform-checks.yml`) rebuilds the bundle and fails if `dist/` differs from
what is committed, so a handler change cannot merge without its rebuilt bundle.
`node_modules/` stays gitignored.

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
