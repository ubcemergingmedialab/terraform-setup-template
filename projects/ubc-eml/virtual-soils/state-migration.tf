# Renamed module.site → module.viewer_site (admin/viewer split).
# HCP Terraform has no UI for `terraform state mv`; this block updates remote state on the next apply.
# Safe to leave in place; after a successful apply the migration is recorded in state history.
# See README.md — "State migration (HCP, no CLI)".

moved {
  from = module.site[0]
  to   = module.viewer_site[0]
}
