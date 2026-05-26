# Design: lab-terraform monorepo

**Date:** 2026-05-26
**Status:** Approved by user (verbal: "seems good ... you can start implement")
**Author:** Claude + lab lead (yuchinchang6@gmail.com)

## Problem

The lab builds VR / AR / 3D-web experiences (Gaussian splat sites, WebXR apps, gated educational portals) for university clients. Today every project's AWS setup is ad-hoc and tied to the lab's shared account. When a client takes over, hand-off is fragile — there's no clean unit to copy, names collide, accounts get mixed up.

We need a Terraform monorepo that:

1. **Is the source of truth** for everything the lab provisions in AWS.
2. **Works without a local Terraform CLI.** The university-managed OS blocks it. HCP Terraform (Terraform Cloud) is the runner.
3. **Makes transplant cheap.** When a project ships, the .tf code drops into a client-owned repo + their HCP org + their AWS account with minimal edits.
4. **Is readable.** Lab staff who aren't TF experts can navigate it, follow the daily workflow, and start a new project from a template.

## Decisions

### Repo layout — monorepo with `modules/` + `projects/<client>/<project>/`

```
lab-terraform/
├── modules/<name>/                      # reusable, single-purpose
└── projects/<client>/<project>/         # per-deployment, one HCP workspace each
```

Trade-offs considered:

| Option | Why not |
|--------|---------|
| Single repo, everything in one folder | Can't reuse patterns across projects; transplant means leaking other clients |
| Separate `lab-terraform-modules` repo + per-project repos with Git-tag references | Client transplant means client repo pulls from lab GitHub; either we maintain the dep forever or fork on transplant — extra step |
| Monorepo with copy-on-deliver script | Right idea, but the script is extra surface to maintain v1; doc-driven transplant is fine until volume justifies automation |

### Module style — thin, single-purpose

Five v1 modules: `s3-static-site`, `cognito-user-pool`, `lambda-http-api`, `ecs-fargate-service`, `ec2-gpu-worker`. Each does one thing. Projects compose them.

Rejected: a thick `media-3d-site` composite that bundles S3+CF+Cognito+Lambda. Reason: every project we've sketched has *almost* the same shape but differs on one variable each — auth required or not, backend API or not. Composite modules end up bloated with feature flags; composition at project level is cleaner for now.

### Environments — single env per project, multi-env added when earned

YAGNI. Most projects start as "is the thing deployed at all" before they need a dev/prod split. When a project earns multi-env, split it then.

### Runner — HCP Terraform, VCS-driven

- HCP organization owned by the lab.
- One workspace per project. Workspace's "Working Directory" is `projects/<client>/<project>`.
- VCS connection: this GitHub repo. Speculative plans on PR. Real plan on merge. Auto-apply OFF — humans confirm.
- No CLI required anywhere. Browser-only ops.

### CI — checks only, no apply

`.github/workflows/terraform-checks.yml` runs `terraform fmt -check`, `terraform validate`, `tflint`. HCP owns apply. Reasons: avoid double-applies, keep credentials out of GitHub, single source of state.

### Variable contract

Every project root takes exactly these five vars:

```hcl
variable "client_name"   { type = string }
variable "project_name"  { type = string }
variable "environment"   { type = string default = "dev" }
variable "aws_region"    { type = string }
variable "tags"          { type = map(string) default = {} }
```

Resource names follow `${client_name}-${project_name}-${environment}-<descriptor>`. Default tags applied via provider `default_tags`. No module hardcodes any of these — they're inputs.

### Transplant strategy — doc-driven checklist

`docs/transplant.md` is the procedure. No bundler script for v1. The whole repo design (parameterized everything, no shared-lab data sources, isolated project folders) is what makes the checklist short enough to be doable.

### Documentation deliverables

User explicitly asked for two:

- `deliverable.md` at repo root — full lab-staff handbook with mermaid flow diagrams inline.
- `docs/flowchart.md` — six standalone diagrams (big picture, daily flow, new project, new module, transplant, revert).

Other docs that materialized as load-bearing: `docs/conventions.md` (variable contract, naming, tagging, allowed/disallowed module patterns), `docs/transplant.md` (the hand-off checklist), this design record.

## Non-goals (v1)

- Route53 / ACM — not selected by user. Sites use `*.cloudfront.net`.
- Multi-account AWS Organizations setup — lab works in a single shared dev account.
- Dynamic credentials (AWS-OIDC ↔ HCP) — recommended for the client transplant but not required for v1; transplant doc covers both paths.
- New-project scaffolding script — manual `Copy-Item` from `_template/` is fine while volume is low.
- Composite / opinionated modules — composition at project level.

## What this design depends on

- The lab has (or will create) an HCP Terraform organization.
- The lab has AWS credentials configured in HCP workspaces (variable sets).
- GitHub repo exists and HCP has VCS access to it via the GitHub app integration.

## Open items parked for v2

- A PowerShell transplant bundler that automates Phase A-C of `docs/transplant.md`.
- A `new-project.ps1` that copies `_template/` and substitutes slug values.
- A `cloudfront-custom-domain` module if any project ever needs a non-CloudFront-default URL.
- A "shared lab DNS" module if the lab acquires its own zone.
- Lifecycle policies on S3 buckets (asset rotation, intelligent tiering) — added once we see how big projects get.

## Open questions

- Confirm the lab's HCP organization slug to bake into `versions.tf` of the example project. Currently using `lab-emerging-media` as a placeholder.
- Confirm preferred default `aws_region`. Currently using `us-west-2`.
