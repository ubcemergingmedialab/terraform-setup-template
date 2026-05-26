# lab-terraform

Terraform monorepo that manages every AWS resource the lab provisions.

- **Source of truth:** this GitHub repo.
- **What applies the changes:** HCP Terraform (Terraform Cloud), connected to this repo as a VCS-driven workspace.
- **What lab members do:** edit `.tf` files in a branch, open a PR, get the speculative plan reviewed, merge.
- **What no one needs:** the Terraform CLI on their laptop. The university-managed OS doesn't allow it, and the workflow doesn't need it.

## Start here

Read [**deliverable.md**](./deliverable.md). It's the lab-staff handbook — how the repo is organized, what to do day-to-day, how to start a new client project, and how to transplant a project to a client at delivery.

Visual workflow diagrams live in [`docs/flowchart.md`](./docs/flowchart.md).

## Repo at a glance

```
modules/              # Reusable building blocks (s3-static-site, cognito-user-pool, …)
projects/<client>/    # Per-client project deployments — each folder = one HCP workspace
docs/                 # Handbook, flow diagrams, conventions, transplant procedure
.github/workflows/    # CI checks (fmt + validate + tflint) — no apply, HCP does that
```

## Conventions in one line

- Every project takes the same five variables: `client_name`, `project_name`, `environment`, `aws_region`, `tags`.
- Resource names follow `${client_name}-${project_name}-${environment}-<resource>`.
- No hardcoded AWS account IDs, ARNs, or lab-specific resource names anywhere. Everything must work in someone else's AWS account on day one — that's what makes transplant cheap.

Full conventions: [`docs/conventions.md`](./docs/conventions.md).
