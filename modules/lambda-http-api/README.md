# `lambda-http-api`

Lambda function behind an API Gateway HTTP API (v2) with configurable routes and JWT or IAM authorization.

## Inputs

See `variables.tf`. Package `source_path` must contain `handler.mjs` (or matching handler) and `node_modules` before `terraform plan` (run `npm ci` in that directory).

## Outputs

`function_name`, `function_arn`, `api_endpoint`, `api_id`, `log_group_name`.
