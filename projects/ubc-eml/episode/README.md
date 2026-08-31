# `_template/` — starter for a new project

This is the project skeleton. Copy this folder to start a new deployment.

## How to use

1. `Copy-Item -Recurse projects\_template projects\<client-slug>\<project-slug>`
2. Open the new folder.
3. Rename `terraform.auto.tfvars.example` → `terraform.auto.tfvars` and edit the values.
4. In `versions.tf`, set `cloud.workspaces.name` to the HCP workspace name you'll create (typically `<client-slug>-<project-slug>`).
5. In `main.tf`, uncomment the module blocks for the services this project actually needs. Delete the rest.
6. In `outputs.tf`, uncomment the outputs that match the modules you enabled.
7. Write a short README in the new folder explaining what the project is.
8. Commit + push, open a PR, then create the matching HCP workspace (see [`deliverable.md` §4](../../deliverable.md#4-starting-a-new-client-project)).

## What's already wired up for you

- The variable contract (`client_name`, `project_name`, `environment`, `aws_region`, `tags`) with validation.
- `provider "aws"` with `default_tags` that propagate `Client` / `Project` / `Environment` / `ManagedBy` tags to every taggable resource.
- The `local.name_prefix` value that every module expects: `${client_name}-${project_name}-${environment}`.
- The HCP `cloud {}` block in `versions.tf`, ready for you to set the workspace name.

## What's intentionally not in the template

- Specific module instances — uncomment what you need.
- `terraform.auto.tfvars` with real values — that's per-project, you fill it in.
- Lambda source code, CloudFront response-header configs, etc. — module-level concerns, configured at the call site.
