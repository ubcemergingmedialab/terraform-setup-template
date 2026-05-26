# Transplant — handing a project off to a client

When a project is ready for the client to own and operate, transplant it. This document is the checklist. Do the steps in order — they depend on each other.

## What "transplant" means

The lab built and ran a project in **lab AWS** with a workspace in the **lab's HCP organization**. You now want the same Terraform code to run in the **client's AWS** account with a workspace in the **client's HCP organization**, in a GitHub repo the client owns. After transplant, the lab can stop running that project's workspace; the client owns lifecycle, billing, and apply rights.

## Prerequisites

Before you start, confirm with the client:

- [ ] They have an AWS account (account ID known).
- [ ] They have or will sign up for HCP Terraform. They can use the free tier.
- [ ] They have a GitHub organization (or a personal account) where the new repo will live.
- [ ] A point of contact who can click "Apply" in HCP after merge.

## The checklist

### Phase A — Identify what's in scope

- [ ] Open `projects/<client>/<project>/main.tf` in the lab repo. List every `module "…"` block. Each one points at `../../../modules/<name>` — write those module names down.
- [ ] Open `terraform.auto.tfvars`. Note every value. Decide with the client which need to change (region? environment? tags?) and which stay.
- [ ] Open `versions.tf`. Note the current `cloud { organization = "..."; workspaces { name = "..." } }` values.
- [ ] Check whether the project depends on any *lab-shared* AWS resources via `data` blocks (e.g. a shared Route53 zone). If yes, those must either move with the project or be replaced with client-owned equivalents. **This is the most common transplant footgun — verify carefully.**

### Phase B — Create the client's repo

- [ ] Create a new GitHub repo. Convention: `<client-org>/<project>-infra` (e.g. `ubc-arts/splat-museum-infra`).
- [ ] Clone it locally (or use the GitHub web editor).
- [ ] Copy the contents of `projects/<client>/<project>/` from the lab repo **to the root of the new repo** (not into a `projects/...` subfolder — this repo only holds one project).
- [ ] Create a `modules/` folder in the new repo. Copy each in-scope module folder from the lab repo into it. After this step, the client repo looks like:

  ```
  splat-museum-infra/
  ├── main.tf
  ├── variables.tf
  ├── outputs.tf
  ├── versions.tf
  ├── terraform.auto.tfvars
  ├── README.md
  └── modules/
      ├── s3-static-site/
      ├── cognito-user-pool/
      └── ...
  ```

- [ ] In `main.tf`, change every module `source = "../../../modules/<name>"` to `source = "./modules/<name>"`. That's the only path change required.

### Phase C — Re-point the HCP cloud block

- [ ] Open `versions.tf` in the new repo.
- [ ] Change `organization = "lab-emerging-media"` to the client's HCP organization slug.
- [ ] Decide on the new workspace name (commonly just the project slug — `splat-museum`). Set `workspaces { name = "splat-museum" }`.
- [ ] Commit + push to the new repo's `main` branch (or via PR — client's choice of workflow).

### Phase D — Wire up the client's HCP workspace

- [ ] In the client's HCP org, create a new workspace.
- [ ] Workflow: **Version control workflow**.
- [ ] Connect to the new GitHub repo. **Working directory: leave empty** (the project is at repo root now).
- [ ] Workspace name must match what you set in `versions.tf` above.
- [ ] **Auto apply: OFF.** Always.
- [ ] Add an AWS credentials variable set. Either:
  - Static AWS access key + secret as **sensitive environment variables** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), or
  - **Dynamic credentials** via HCP↔AWS OIDC — strongly preferred. Requires the client to create a small IAM role for HCP. Setup steps in [HashiCorp's dynamic credentials docs](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/aws-configuration).

### Phase E — First plan + apply in the client's environment

- [ ] In HCP, click **Actions → Start new run → Plan only**. Read the output. Expect: "Plan: N to add, 0 to change, 0 to destroy." If you see destroys, something is referencing a resource that doesn't exist in the client's account — investigate before continuing.
- [ ] Click **Start new run → Plan and apply**. Confirm.
- [ ] Verify outputs in the HCP workspace: URLs, distribution IDs, etc.
- [ ] Sanity-check in the client's AWS console.

### Phase F — Wind down the lab's copy (optional, after a quiet period)

Once the client confirms their environment works and they own DNS / users / content cutover:

- [ ] Decide a sunset date with the client. Two-week minimum is typical.
- [ ] On sunset day, in the lab's HCP workspace for the project, run **Destroy plan**. Review. Apply.
- [ ] In the lab repo, delete `projects/<client>/<project>/` in a PR titled "sunset <client>/<project> — owned by client now."
- [ ] Archive the HCP workspace.

## After transplant: what the client gets

- A self-contained GitHub repo with their project + the modules it depends on.
- An HCP workspace they control.
- Resources in their AWS account, tagged with `ManagedBy = "terraform"` so they're traceable.
- The same conventions the lab used. The lab handbook (`deliverable.md` from this repo) is a useful starting point for the client too — copy or link a relevant subset into the client repo's README.

## After transplant: what the lab does *not* keep

- Any AWS resources for that client.
- Any state for that client (HCP workspace is archived).
- Any AWS credentials for the client's account — never store them in lab systems.

## What to do if something goes wrong mid-transplant

If Phase E plan shows surprising destroys or errors:

1. Do not click apply.
2. Compare the new repo to the lab repo file-by-file. The most common cause is a missed module path edit or a stray data-source reference to a lab resource.
3. If you can't figure it out in 30 minutes, ping the lab lead. Do not improvise — wrong applies in a client account are reputational damage.

## Future automation

Until usage patterns stabilize, transplant is a manual checklist. A `bundle.ps1` PowerShell script that automates Phase A-C is on the wishlist — see `task_plan.md`.
