# `bedrock-chat-backend`

A Lambda that calls Amazon Bedrock for chat completion, exposed via an
**IAM-authenticated Lambda Function URL**, plus an optional **scoped IAM user**
whose access key ships with a client app and SigV4-signs each request.

This is the reusable pattern for "a game/app talks to Bedrock without a
long-running proxy": no EC2, no API Gateway, just a Function URL the client signs.

## What it creates

- `aws_lambda_function` — your handler, with `BEDROCK_MODEL_ID` injected as an env var.
- Execution role with basic logging + `bedrock:InvokeModel` /
  `bedrock:InvokeModelWithResponseStream` (scoped by `bedrock_model_arns`).
- `aws_lambda_function_url` — `AWS_IAM` auth, `BUFFERED` by default.
- CloudWatch log group.
- Optional (`create_invoker_user = true`, default): an IAM user whose only
  permission is `lambda:InvokeFunctionUrl` on this function, plus an access key.

## Usage

```hcl
module "chat_backend" {
  source = "../../../modules/bedrock-chat-backend"

  name_prefix      = local.name_prefix              # e.g. ubc-poetryhouse-dev
  source_path      = "${path.module}/lambda/chat-backend"
  bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"

  # Optional: restrict which models the Lambda may call.
  # bedrock_model_arns = [
  #   "arn:aws:bedrock:ca-central-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
  # ]
}
```

Package Lambda deps before `plan`:

```powershell
npm --prefix lambda/chat-backend install
```

Expose what the client needs from the project's `outputs.tf`:

```hcl
output "chat_function_url"        { value = module.chat_backend.function_url }
output "chat_invoker_access_key_id"     { value = module.chat_backend.invoker_access_key_id,     sensitive = true }
output "chat_invoker_secret_access_key" { value = module.chat_backend.invoker_secret_access_key, sensitive = true }
```

## Client signing

The client signs requests with SigV4 using **service = `lambda`** and the
configured region. Read the outputs and drop them into the client config
(for PoetryHouse: `Config/DefaultGame.ini` `[PoetryHouse.Bedrock]`).

```powershell
terraform output -raw chat_function_url
terraform output -raw chat_invoker_access_key_id
terraform output -raw chat_invoker_secret_access_key
```

## Request / response contract (reference handler)

`POST` (SigV4-signed), `Content-Type: application/json`:

```json
{ "systemPrompt": "optional", "messages": [ { "role": "user", "text": "..." } ], "maxTokens": 512, "temperature": 0.7 }
```

Returns `{ "text": "...", "stopReason": "end_turn" }`, or `{ "error": "..." }`
with a non-2xx status. Swap the handler to `RESPONSE_STREAM` + NDJSON by setting
`invoke_mode = "RESPONSE_STREAM"` and streaming from the handler.

## Inputs / outputs

See `variables.tf` and `outputs.tf`. Key knobs: `bedrock_model_id`,
`bedrock_model_arns`, `invoke_mode`, `create_invoker_user`, `architecture`,
`memory_mb`, `timeout_seconds`.

## Security notes

- The shipped key is a real, revocable credential scoped to invoking only this
  Function URL. Rotate with `terraform taint module.chat_backend.aws_iam_access_key.invoker[0]`
  then `apply`, and re-deploy the client config.
- Consider a Bedrock spend budget/alarm so a leaked key can't run up an unbounded bill.
- Any secret placed in a client config file travels with the build — treat the
  packaged build as sensitive.
