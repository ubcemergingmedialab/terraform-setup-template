# Progress Log

## Session 2026-05-26 — Initial scaffold

### Done
- Brainstormed scope with user. Locked in: monorepo, thin modules, HCP-VCS workflow, transplant-by-doc, mandatory variable contract.
- Full directory tree created (`modules/`, `projects/_template/`, `projects/example-client/example-project/`, `docs/`, `.github/workflows/`).
- All docs written: `README.md`, `deliverable.md`, `docs/flowchart.md` (mermaid diagrams), `docs/conventions.md`, `docs/transplant.md`, design spec in `docs/superpowers/specs/`, `CLAUDE.md`.
- All `.tf` files in place as **null/TODO templates** per user request to save tokens. Real resource definitions deferred until projects need them.
- CI workflow file created as a placeholder.
- `.gitignore` written.
- Module READMEs describe planned shape so the structure is documented even without code.

### Status
Phase 1 (scaffold + docs): complete.
Phases 2-6 (modules): structure in place, implementations are TODO stubs.
Phase 7 (CI): placeholder workflow file in place, real steps TODO.
Phase 8 (CLAUDE.md): written.

### Next session
- Pick first project to implement → flesh out the modules it actually needs (likely `s3-static-site` first).
- Once a real project is being planned, fill in `terraform-checks.yml` with the real CI steps.
- Replace the placeholder HCP organization slug (`lab-emerging-media`) in `versions.tf` files once confirmed with the lab.
