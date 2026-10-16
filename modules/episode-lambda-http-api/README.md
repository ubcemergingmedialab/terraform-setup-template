# `episode-lambda-http-api`

Episode-owned HTTP API module for the Aurora controllers. It creates a Lambda
execution role, optional RDS Data API permissions, API Gateway HTTP API routes,
and an optional Cognito JWT authorizer. The pre-existing shared
`lambda-http-api` module is intentionally unchanged for other projects.