# `lambda-http-api` (stub)

Lambda function fronted by an API Gateway HTTP API. For small backends — auth callbacks, asset signing endpoints, lightweight processing webhooks.

**Status: skeleton only.** Implement on first project that needs a backend API. See `task_plan.md` Phase 4.

## Planned inputs

| Name | Type | Default |
|------|------|---------|
| `name_prefix` | string | (required) |
| `runtime` | string | `"nodejs20.x"` |
| `handler` | string | `"index.handler"` |
| `source_dir` | string | (required) |
| `memory_mb` | number | `256` |
| `timeout_seconds` | number | `10` |
| `environment_variables` | map(string) | `{}` |

## Planned outputs

`function_name`, `function_arn`, `api_endpoint`, `api_id`, `log_group_name`.
