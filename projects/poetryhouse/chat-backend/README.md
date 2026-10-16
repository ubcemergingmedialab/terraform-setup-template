# PoetryHouse — Chat Backend (Lambda → Bedrock)

Replaces the EC2 "moot-api" OpenAI chat proxy for PoetryHouse's chat-completion
path with a serverless Lambda that calls Amazon Bedrock. The game invokes a
**public Function URL (`NONE` auth)** and authenticates with a **shared secret**
sent in the `x-chat-secret` header; the Lambda handler validates it.

> Why not IAM/SigV4? The scoped IAM *user* consistently returned 403 on
> `lambda:InvokeFunctionUrl` for this account despite correct identity + resource
> policies (and an `allowed` policy-simulator result). The shared-secret approach is
> the reliable path for the shipped client.

## Secret handling (VCS-driven / HCP)

`chat_shared_secret` is declared in `variables.tf` with **no default** and is
**never** committed. Provide it as a **sensitive Terraform variable in the HCP
workspace** (`poetry-chat-backend` → Variables → add `chat_shared_secret`, mark
Sensitive). The game reads the same value from `DefaultGame.ini` (in Perforce, not
this repo). Do **not** put it in `terraform.auto.tfvars` — that file is committed.

## What this provisions

- `aws_lambda_function.chat_backend` — Node.js 22 (arm64) function that calls
  Bedrock `Converse`, validates the `x-chat-secret` header, and returns the
  completion as plain text.
- `aws_lambda_function_url.chat_backend` — `NONE` auth, `BUFFERED` invoke mode.
- Lambda execution role with `bedrock:InvokeModel` + basic execution logging.
- The scoped `aws_iam_user.chat_invoker` is **disabled** (`create_invoker_user =
  false`); it's retained in the module for the optional `AWS_IAM` auth mode.

## Deploy

1. `Copy-Item terraform.auto.tfvars.example terraform.auto.tfvars` and edit values
   (region, `bedrock_model_id`).
2. Install Lambda deps so they're packaged:
   ```powershell
   npm --prefix lambda/chat-backend install
   ```
3. Make sure the chosen Bedrock model is enabled in the account/region
   (Bedrock console → Model access). For cross-region Anthropic models use an
   inference-profile ID, e.g. `us.anthropic.claude-3-5-sonnet-20241022-v2:0`.
4. `terraform init && terraform apply`.

## Wire the game to it

After apply, read the outputs and paste them into
`PoetryHouse/Config/DefaultGame.ini` under `[PoetryHouse.Bedrock]`:

```powershell
terraform output -raw chat_backend_lambda_url          # -> EndpointUrl
terraform output -raw aws_region                       # -> Region
terraform output -raw chat_invoker_access_key_id       # -> AccessKeyId
terraform output -raw chat_invoker_secret_access_key   # -> SecretAccessKey  (sensitive)
```

`SessionToken` stays empty for the long-lived IAM user key.

## Request / response contract

`POST` (SigV4-signed), `Content-Type: application/json`:

```json
{
  "systemPrompt": "optional role prompt",
  "messages": [ { "role": "user", "text": "..." } ],
  "maxTokens": 512,
  "temperature": 0.7
}
```

Response:

```json
{ "text": "assistant reply", "stopReason": "end_turn" }
```

Errors return a non-200 status with `{ "error": "..." }`.

## Security notes

- The shipped key is a **real, revocable credential** scoped to invoking only this
  Function URL. If it leaks, the worst case is someone calling this one Lambda
  (running up Bedrock cost) — not access to anything else in the account.
- **Rotate / revoke** by tainting the key and re-applying:
  ```powershell
  terraform taint aws_iam_access_key.chat_invoker
  terraform apply
  ```
  then re-paste the new key into `DefaultGame.ini` and repackage.
- Consider adding a Bedrock spend budget/alarm so a leaked key can't run up an
  unbounded bill.
- `DefaultGame.ini` will contain the secret. Treat the packaged build (and that
  ini) as sensitive; don't publish it.

## Not migrated (left on the old moot-api WebSocket)

`USentimentAnalysisWebSocket` and `UNPCWebSocket` were intentionally left
untouched because they aren't hit in the current game flow. To migrate either
later, follow the same pattern used for `UTextGeneratorWebSocket`: give it a
`UBedrockChatClient` member, create+bind it in `ConnectWebSocket`, forward
`SendMessage`, and re-broadcast `OnReply` through the existing delegate
(`OnSentimentAnalysisUpdate` parses the reply as a hex color; `OnNPCWebSocketUpdate`
passes text through). The Lambda + IAM infra here already supports them as-is.

## Game-side changes (for reference)

In `PoetryHouse/Source/PoetryHouse`:
- New: `Public/Http/AwsSigV4Signer.h`, `Private/Http/AwsSigV4Signer.cpp` —
  self-contained SigV4 signer using engine OpenSSL (SHA-256 + HMAC-SHA256).
- New: `Public/Http/BedrockChatClient.h`, `Private/Http/BedrockChatClient.cpp` —
  `UBedrockChatClient` implements `IWebSocketClient` over HTTP+SigV4, reads config
  from `DefaultGame.ini`, keeps system prompt + history, broadcasts replies on the
  game thread.
- Changed: `Public/Websockets/TextGeneratorWebSocket.h` +
  `Private/Websockets/TextGeneratorWebSocket.cpp` — now delegates to
  `UBedrockChatClient` (same class name, `OnTextGenerationUpdate` delegate, and
  `IWebSocketClient` interface, so `GameInstanceManager` and Blueprints are
  unchanged).
- Changed: `PoetryHouse.Build.cs` — added `HTTP` and `OpenSSL` module deps.
- Changed: `Config/DefaultGame.ini` — added `[PoetryHouse.Bedrock]`.

Verified: `PoetryHouseEditor Win64 Development` compiles and links against UE 5.5.
