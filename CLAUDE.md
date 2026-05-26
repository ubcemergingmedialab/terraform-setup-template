# CLAUDE.md

Context for future Claude sessions in this repo.

## What this is

Lab terraform monorepo. AWS infrastructure for an emerging media lab that builds VR / AR / Gaussian-splat 3D web apps for university clients. GitHub holds the .tf code; HCP Terraform (VCS-driven workspaces) runs plan/apply. No local Terraform CLI — university-managed OS blocks it.

## Where things live

- `README.md` — quick intro
- `deliverable.md` — lab-staff handbook (the primary user-facing doc)
- `docs/flowchart.md` — mermaid workflow diagrams
- `docs/conventions.md` — variable contract, naming, tagging rules
- `docs/transplant.md` — client hand-off checklist
- `docs/superpowers/specs/2026-05-26-lab-terraform-design.md` — design record / "why" archive
- `modules/<name>/` — reusable building blocks (s3-static-site, cognito-user-pool, lambda-http-api, ecs-fargate-service, ec2-gpu-worker) — currently null/TODO templates
- `projects/<client>/<project>/` — per-deployment, one HCP workspace each — currently null/TODO templates
- `projects/_template/` — starter for new projects
- `.github/workflows/terraform-checks.yml` — CI placeholder
- `task_plan.md`, `findings.md`, `progress.md` — planning-with-files state

## Current status (2026-05-26)

Scaffold + docs complete. All `.tf` files are intentionally **null templates** (single-line TODO comments) per user request to save tokens during scaffolding. Real terraform code gets written when a project actually needs it.

## Non-negotiable rules

- **Variable contract**: every project root must take `client_name`, `project_name`, `environment`, `aws_region`, `tags`. See `docs/conventions.md`.
- **No hardcoded account IDs, ARNs, or lab-specific names** anywhere. Code must work in any AWS account on day one — that's what makes transplant cheap.
- **Modules may not reference anything under `projects/`.** One-way dependency.
- **No apply step in GitHub Actions.** HCP owns apply.
- **No CLI assumed.** All TF runs happen in HCP via VCS-driven workspaces.

## Common tasks

- Adding a new module: create `modules/<name>/` with `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `README.md`. Promote from an in-project pattern once it recurs in 2+ projects.
- Adding a new project: copy `projects/_template/` → `projects/<client>/<project>/`. Steps in `deliverable.md` §4.
- Transplant: follow `docs/transplant.md` step by step.

## When in doubt

Read `deliverable.md` first. It's written for non-experts and covers most everyday questions.
