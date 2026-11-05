# `cognito-user-pool`

Cognito user pool, hosted UI domain, and OAuth app client for admin sign-in.

By default the pool is locked to **admin-created users only** (`allow_self_signup = false`) — the right posture for single-tenant apps that must stay behind login. Optionally seed one user group and one user to bootstrap access.

## Inputs

Required: `name_prefix`.

Optional: `callback_urls`, `logout_urls`, `mfa_required`, `password_minimum_length`, `oauth_scopes`, `hosted_ui_domain_prefix`, `allow_self_signup` (default `false`), `user_group_name`, `user_group_description`, `seed_user_email`.

When `seed_user_email` is set, Cognito admin-creates that user (invite email with a temp password). When `user_group_name` is also set, the user is placed in that group.

## Outputs

`user_pool_id`, `user_pool_arn`, `user_pool_client_id`, `hosted_ui_domain`, `jwt_issuer`.
