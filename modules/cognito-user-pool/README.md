# `cognito-user-pool` (stub)

User authentication via Amazon Cognito for gated content (instructor dashboards, per-student experiences, restricted 3D content).

**Status: skeleton only.** Variables and the expected output list are in place. The resource definitions in `main.tf` are not yet implemented — implement on first project that needs auth. See `task_plan.md` Phase 3.

## Planned inputs

| Name | Type | Default |
|------|------|---------|
| `name_prefix` | string | (required) |
| `callback_urls` | list(string) | `[]` |
| `logout_urls` | list(string) | `[]` |
| `mfa_required` | bool | `false` |
| `password_minimum_length` | number | `12` |

## Planned outputs

`user_pool_id`, `user_pool_arn`, `user_pool_client_id`, `hosted_ui_domain`.
