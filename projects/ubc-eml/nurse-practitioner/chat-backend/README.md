# NursePractitioner — Chat Backend (Lambda → Bedrock)

Replaces the EC2 "MOOT-API" OpenAI websocket proxy for NursePractitioner's
chat / agent path (the old DXL `[CHT]`/`[CHS]`/`[CSS]` interactions) with a
serverless Lambda that calls Amazon Bedrock. The game invokes a **public
Function URL (`NONE` auth)** and authenticates with a **shared secret** sent in
the `x-chat-secret` header; the Lambda handler validates it.

This is the same pattern proven in `projects/poetryhouse/chat-backend`.

> Why not IAM/SigV4? The scoped IAM *user* consistently returned 403 on
> `lambda:InvokeFunctionUrl` for this org's account despite correct identity +
> resource policies. The shared-secret approach is the reliable path for the
> shipped client.

## Secret handling (VCS-driven / HCP)

`chat_shared_secret` is declared in `variables.tf` with **no default** and is
**never** committed. Provide it as a **sensitive Terraform variable in the HCP
workspace** (`ubc-eml-np-chat` → Variables → add `chat_shared_secret`, mark
Sensitive). The game reads the same value from `DefaultGame.ini` (in Perforce,
not this repo). Do **not** put it in `terraform.auto.tfvars` — that file is
committed.

## What this provisions

- `aws_lambda_function.chat_backend` — Node.js 22 (arm64) function that calls
  Bedrock `Converse`, validates the `x-chat-secret` header, and returns the
  completion as JSON.
- `aws_lambda_function_url.chat_backend` — `NONE` auth, `BUFFERED` invoke mode.
- Lambda execution role with `bedrock:InvokeModel` + basic execution logging.

## Deploy

1. Create the HCP workspace `ubc-eml-np-chat`, connect it to this repo with
   working directory `projects/ubc-eml/nurse-practitioner/chat-backend`, and add
   `chat_shared_secret` as a sensitive workspace variable.
2. Make sure the chosen Bedrock model is enabled in the account/region
   (Bedrock console → Model access). We use the global inference profile
   `global.anthropic.claude-sonnet-4-6`, which is invokable from any region.
3. Commit + PR → review the HCP speculative plan → merge → Confirm & Apply.

The reference handler imports only `@aws-sdk/client-bedrock-runtime`, which is
preinstalled in the Lambda Node.js runtime, so the deploy zip only needs
`handler.mjs`; no `node_modules` is shipped or committed.

## Wire the game to it

After apply, read the outputs into `NursePractitioner/Config/DefaultGame.ini`
under `[NursePractitioner.Bedrock]`:

```powershell
terraform output -raw chat_function_url     # -> ChatEndpointUrl
terraform output -raw aws_region            # -> Region
terraform output -raw chat_shared_secret    # -> ChatSharedSecret (sensitive)
```

## Request / response contract

`POST`, `Content-Type: application/json`, header `x-chat-secret: <secret>`:

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

## Used by two game paths

1. **Patient chat / agent** — replaces the DXL `[CHT]`/`[CHS]`/`[CSS]` websocket
   calls (via `BP_NetworkManager`). Single-turn or multi-turn `messages`.
2. **Scoring / assessment** — replaces the direct VaRest POST to
   `api.openai.com/v1/chat/completions` (which used `Content/Assets/Keys/OpenAI.txt`).
   Same POST shape; point VaRest at `chat_function_url` and send the
   `x-chat-secret` header instead of the OpenAI bearer key.

## Security notes

- The shared secret ships in `DefaultGame.ini` inside the packaged build. Treat
  the build as sensitive. Worst case on leak is someone calling this one Lambda
  (Bedrock cost) — not access to anything else in the account.
- Rotate by changing `chat_shared_secret` in HCP and re-applying, then re-paste
  into `DefaultGame.ini` and repackage.
- Consider a Bedrock spend budget/alarm so a leaked secret can't run up an
  unbounded bill.
