# `ubc-eml/arcade` — ARCADE

Marker-anchored AR storytelling for UBC Emerging Media Lab. A visitor points a
phone at a printed picture on a wall and a story plays anchored to it; authors
build those stories in a browser studio and publish them.

- **App repo:** [`ubcemergingmedialab/26--1001-ARcade`](https://github.com/ubcemergingmedialab/26--1001-ARcade)
- **Live site:** https://arcade.ubc-dxl.ca
- **AWS account:** `940309384764`, region `ca-central-1`
- **HCP workspace:** `ubc-eml-arcade`

> **This stack adopts resources that already exist and serve production.**
> Do not run a first `terraform apply` against this workspace before completing
> the import below. Applying against empty state would try to *create* a second
> bucket and a second function, and the plan would show the live names as new
> resources.

## What this manages

| Resource | Live name | Notes |
|---|---|---|
| S3 bucket | `eml-arcade-storage` | `stories/`, `assets/`, `markers/`, `exhibits/`, `tmp/` |
| Bucket policy | — | Anonymous `GetObject` on the four published prefixes; `PutObject`/`GetObject` + `ListBucket` for the Lambda role |
| Bucket CORS / versioning / encryption / lifecycle | — | Matches production exactly |
| IAM role | `eml-arcade-lambda-exec` | `AWSLambdaBasicExecutionRole` only; bucket access comes from the bucket policy |
| Lambda | `eml-arcade-api` | Shape only — see below |
| Lambda Function URL | — | `AuthType = NONE`, deliberately |
| CloudWatch log group | `/aws/lambda/eml-arcade-api` | 30-day retention. Declared because an implicitly-created group never expires |

### Coverage is partial, and the gap is the whole hosting tier

This stack is the **storage and API** half of ARCADE. It does not describe how
the site is served. Audited against the account on 2026-09-03:

| Not managed here | Where it actually lives |
|---|---|
| Amplify app `d114nr20m4npww` — repo connection, in-console buildSpec, `VITE_ASSET_BASE_URL` / `VITE_STORY_BASE_URL`, all three rewrite rules, branches `main` + `feat/arcade-storage-b`, the `arcade.ubc-dxl.ca` domain and its Amplify-managed certificate | The Amplify console |
| DNS for `ubc-dxl.ca` | A Route 53 zone this account cannot even read — `route53:ListHostedZones` is denied to `PokemonGoServices`. Managing it from here is not merely undone, it is not currently possible |

So `terraform destroy` on this workspace would **not** take the site down, and a
clean `plan` here is **not** evidence that hosting is unchanged. Treat the two
halves as separate systems until Amplify is brought in deliberately.

## What this does **not** manage, on purpose

**Amplify hosting** (app `d114nr20m4npww`, custom domain `arcade.ubc-dxl.ca`).
Its two rewrite rules are load-bearing and easy to break in ways that are hard
to diagnose — a bare `/<*>` catch-all swallows `/assets/*.js` and the app dies
with a MIME-type error; the API rule needs *no* slash between the function URL
and `/api/`, or the router receives `//api/...` and 404s. Bringing that under
Terraform is worth doing deliberately, with a tested plan, not as a side effect
of this import. `outputs.tf` prints the exact rewrite targets so they can be
copied without being retyped from memory.

**The Lambda's code.** It ships out-of-band: `npm run build:lambda` in the app
repo, then upload `dist-lambda.zip`. Terraform owns the function's runtime,
memory, timeout, role and environment, and `ignore_changes` keeps a plan from
ever rolling production back to the placeholder archive in `main.tf`. Note that
this means **pushing the app does not deploy the API** — the two ship
separately, and the function has silently run week-old code before.

**The database.** There isn't one. `infra/terraform/` in the app repo defines an
RDS Postgres for the *marker testbed*, a separate single-operator experiment
with local state. Production ARCADE is S3 + Lambda only.

## The publish secret

`studio_publish_secret` is **not** in `terraform.auto.tfvars`, because that file
is committed. Set it as a **sensitive** variable on the HCP workspace. A plan
run without it fails immediately with an explicit message, rather than applying
an empty value and turning every publish into a confusing 401 later.

To read the value currently in production:

```bash
aws lambda get-function-configuration \
  --function-name eml-arcade-api --region ca-central-1 \
  --query 'Environment.Variables.STUDIO_PUBLISH_SECRET' --output text
```

## Importing

Run once, against the `ubc-eml-arcade` workspace, before the first apply. Every
address below is already described in `main.tf`, so a `terraform plan`
afterwards should report **no changes**.

```bash
terraform import aws_s3_bucket.storage                                      eml-arcade-storage
terraform import aws_s3_bucket_ownership_controls.storage                   eml-arcade-storage
terraform import aws_s3_bucket_versioning.storage                           eml-arcade-storage
terraform import aws_s3_bucket_server_side_encryption_configuration.storage eml-arcade-storage
terraform import aws_s3_bucket_public_access_block.storage                  eml-arcade-storage
terraform import aws_s3_bucket_policy.storage                               eml-arcade-storage
terraform import aws_s3_bucket_cors_configuration.storage                   eml-arcade-storage
terraform import aws_s3_bucket_lifecycle_configuration.storage              eml-arcade-storage

terraform import aws_iam_role.lambda_exec                    eml-arcade-lambda-exec
terraform import aws_iam_role_policy_attachment.lambda_basic_execution \
  'eml-arcade-lambda-exec/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'

terraform import aws_lambda_function.api      eml-arcade-api
terraform import aws_lambda_function_url.api  eml-arcade-api
MSYS_NO_PATHCONV=1 terraform import aws_cloudwatch_log_group.api /aws/lambda/eml-arcade-api
```

> **The `MSYS_NO_PATHCONV=1` on that last line is required in Git Bash on
> Windows.** Without it the leading slash is rewritten into a Windows path and
> the import fails with a confusing `InvalidParameterException` about
> `logGroupNamePrefix` — the ID arrives as
> `C:/Program Files/Git/aws/lambda/eml-arcade-api`. The same conversion breaks
> `aws logs describe-log-groups --log-group-name-prefix /aws/...`. Harmless in
> PowerShell, CMD, Linux or macOS.

`random_id.bucket_suffix` is **not** imported — it has `count = 0` whenever
`legacy_bucket_name` is set, which it is here.

### What the first plan legitimately shows

This was rehearsed against production with local state (import + plan, both
read-only). The expected result is **`0 to add, 5 to change, 0 to destroy`** —
five in-place updates, none of which alter behaviour:

| Change | Why it is safe |
|---|---|
| `tags_all` gains `Client` / `Environment` / `ManagedBy` / `Owner` / `Project` / `Repo` on the bucket, role, function and log group; the bucket's `Project` tag moves `eml-arcade` → `ARcade` | `default_tags` bringing hand-made resources under the tagging convention. This is the point of adopting them. |
| `+ force_destroy = false` on the bucket | A Terraform-side default being recorded. Not an API change, and the *safe* value. |
| `+ publish = false` on the function | Same — a default, meaning "do not cut a new version". |
| `+ filter {}` on two lifecycle rules | Provider normalisation. The live rules already have an empty filter. |
| `STUDIO_PUBLISH_SECRET` re-marked sensitive | Terraform says explicitly: *the value is unchanged*. |

**`0 to destroy` is the line to check.** Anything else — especially a bucket or
function being replaced — means `legacy_*` is unset or misspelled. Stop and fix
that before applying.

Two settings are pinned precisely because a plan revealed the config would
otherwise have quietly dropped them: `lambda_reserved_concurrency` (production
reserves 10; unset becomes `-1`, removing the cap on an *unauthenticated*
endpoint) and `lambda_role_description`.

If `plan` reports anything beyond the table above, read it before applying. The
likeliest causes are a `cors_allowed_origins` list that has drifted (a new
Amplify branch preview added by hand) or a lifecycle window tuned in the console.

## After a plan comes back clean

Verify a deploy by **content type**, not by whether the page loads —
`customHttp.yml` marks `/assets/` immutable for a year, so a bad response
sticks in browsers and redeploying does not fix it:

```bash
curl -o /dev/null -w '%{content_type}\n' https://arcade.ubc-dxl.ca/assets/<hashed>.js
# must print text/javascript
```
