# Task Plan: lab-terraform repo

**Goal:** Build a GitHub-tracked, HCP-Terraform-run monorepo for the lab's AWS infrastructure. Holds reusable modules (`modules/`) and per-client project deployments (`projects/<client>/<project>/`). Designed so that any project folder + its referenced modules can be transplanted to a client's AWS account/HCP org at delivery time.

## Constraints

- **No local Terraform CLI** — university-customized OS blocks it. HCP Terraform runs all plans/applies via VCS-driven workspaces.
- **GitHub is the source of truth.** HCP pulls .tf from a branch + subdirectory.
- **Transplant-safe:** no hardcoded account IDs, ARNs, lab-specific names, or shared lab resources referenced via data sources. Everything parameterized.
- **Lab clients are educational** (universities) — keep it simple, readable, documented for staff who may not be deep AWS/TF experts.

## Decisions locked in (from brainstorming)

- Monorepo: `modules/` + `projects/<client>/<project>/`
- One HCP workspace per project (single env to start; multi-env added per-project when earned)
- Thin, single-purpose modules: `s3-static-site`, `cognito-user-pool`, `lambda-http-api`, `ecs-fargate-service`, `ec2-gpu-worker`
- Variable contract every project root must take: `client_name`, `project_name`, `environment`, `aws_region`, `tags`
- Naming: `${client_name}-${project_name}-${environment}-<resource>`
- CI: GitHub Actions runs `terraform fmt -check` + `terraform validate` + `tflint` only. No apply (HCP owns that).
- Transplant: doc-driven checklist in `docs/transplant.md`

## Phases

### Phase 1: Repo skeleton + docs — Status: pending
- Directory tree (modules/, projects/, docs/, .github/workflows/)
- README.md (root entry point)
- deliverable.md (lab-staff handbook — the doc the user asked for)
- docs/flowchart.md (mermaid: daily flow, new-project flow, transplant flow)
- docs/conventions.md (naming, tagging, variable contract)
- docs/transplant.md (client hand-off checklist)
- docs/superpowers/specs/2026-05-26-lab-terraform-design.md (design spec record)
- .gitignore
- projects/_template/ starter

### Phase 2: Module — s3-static-site — Status: pending
S3 bucket (private) + CloudFront distribution + Origin Access Control. No public bucket. SPA-friendly defaults.

### Phase 3: Module — cognito-user-pool — Status: pending
Cognito user pool + app client + (optional) identity pool. Configurable password policy, optional MFA.

### Phase 4: Module — lambda-http-api — Status: pending
Lambda function (Node.js or Python runtime selectable) + API Gateway HTTP API + CloudWatch log group. Sensible defaults.

### Phase 5: Module — ecs-fargate-service — Status: pending
ECS cluster + Fargate service + ALB + task definition. For longer-running backends.

### Phase 6: Module — ec2-gpu-worker — Status: pending
GPU EC2 instance (g4dn/g5) with optional spot, IAM role, security group. For Gaussian splat training.

### Phase 7: CI workflow — Status: pending
.github/workflows/terraform-checks.yml — fmt, validate (per module + per project root), tflint.

### Phase 8: /init CLAUDE.md — Status: pending
Run /init at the end to produce CLAUDE.md describing the repo for future Claude sessions.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |

## Open questions (parked, not blocking)
- Where lab's HCP organization slug is defined — confirm with user once we have the docs in front of them.
- Do projects need shared lab-level state (e.g. a single Route53 zone)? If yes, future `modules/` could include a "shared lab DNS" module — out of scope for v1.
