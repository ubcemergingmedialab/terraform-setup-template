# HCPTerraform inline policy consolidation

## Problem

The `HCPTerraform` OIDC role carries five inline policies. Inline policy JSON
counts against a per-entity aggregate limit, and we've hit it. Adding
`poetry-chat` pushes it over.

Current inline policies (minified byte counts):

| Policy | Minified bytes | Scope |
|---|---|---|
| `HCPTerraform.json` (Virtual Soils) | 5960 | `ubc-eml-virtual-soils-*` + legacy `eml_fields`, `eml-soils-db` |
| `HCPTerraformCoFoodPolicy.json` | 6235 | `cofood-garden-capture-*` |
| `HCPTerraformPoetryPolicy.json` | 2914 | ECS/ECR/ELB/EC2 for transcribe, all `*` |
| `HCPTerraformEpisodePolicy.json` | 349 | broad `service:*` on `*` |
| `CloudFrontResponseHeaders.json` | 473 | response-headers overflow for Virtual Soils |
| **Total** | **~15,900** | |

## Root cause of the bloat

`HCPTerraform.json` (Virtual Soils) and `HCPTerraformCoFoodPolicy.json` are
**structurally identical** — same service blocks, same action lists — differing
only in the resource prefix (`ubc-eml-virtual-soils-*` vs
`cofood-garden-capture-*`) and in `Sid` names (`*VirtualSoils` vs `*Project`).
That's ~6 KB of duplicated action lists.

The scoped Sonnet-style approach lists the full action set once per project. It
should list the full action set **once**, with every project prefix in the
`Resource` array.

## What consolidates safely (no change in effective access)

Collapse the per-project blocks into one statement per service, with a
multi-prefix `Resource` array covering every scoped project
(`ubc-eml-virtual-soils-*`, `cofood-garden-capture-*`, `poetry-chat-dev-*`, plus
the legacy Virtual Soils ARNs). Verified equivalences:

- **Action lists identical** across Virtual Soils and CoFood for every shared
  service block (DynamoDB, Cognito, Lambda, ApiGatewayV2, Logs, S3, IAMRoles,
  PassRole, AttachBasicExecution, InvokerUser) — confirmed by diff.
- **CloudFront**: CoFood's block is a superset of Virtual Soils' — it adds the
  four `*ResponseHeadersPolicy` actions and the `response-headers-policy/*`
  resource. Virtual Soils currently gets those from the separate
  `CloudFrontResponseHeaders.json`. Merging to the superset preserves Virtual
  Soils' effective access, so **`CloudFrontResponseHeaders.json` becomes
  redundant and can be deleted.**
- **CloudFrontListAccount**: CoFood's list is a superset of Virtual Soils' — use
  CoFood's (adds cache/origin-request/response-headers `List*`/`Get*`, all on
  `*`, read-only).
- Adds `poetry-chat-dev-*` to the Lambda / Logs / IAMRoles / PassRole /
  AttachBasicExecution / InvokerUser resource arrays, and the
  `lambda:*FunctionUrlConfig` actions to the shared Lambda block.

Result: `Consolidated-HCPTerraform.json` replaces **three** files
(`HCPTerraform.json`, `HCPTerraformCoFoodPolicy.json`,
`CloudFrontResponseHeaders.json`) with equivalent access.

## What is NOT merged (would change access — left as separate policies)

- **`HCPTerraformEpisodePolicy.json`** grants broad `iam:*`, `s3:*`, `bedrock:*`,
  `bedrock-agent:*`, `lambda:*`, `logs:*`, `cognito-identity:*`, `transcribe:*`,
  `polly:*` on `Resource: *`. Folding this into the scoped blocks would either
  widen everyone else to `*` or narrow Episode. Leave as its own policy.
  (Separately worth tightening later — it's the least-scoped policy on the role.)
- **`HCPTerraformPoetryPolicy.json`** (ECS/ECR/ELB/EC2/autoscaling for
  transcribe-proxy) is a different service set on `*`. No overlap with the
  scoped web/lambda blocks, so merging saves little and mixes concerns. Leave
  as its own policy.

## Net effect

De-duplicates 3 policies (~12,670 bytes of overlapping inline JSON) into one
logical set, then moves that set to two attached managed policies (see the
managed-policy section below). Net result: inline aggregate on the role drops
from ~15,900 to ~3,263 bytes, which frees room for `poetry-chat` and future
projects.

Projects covered: Virtual Soils (+ legacy ARNs),
CoFood garden-capture, PoetryHouse chat (`poetry-chat-dev-*`). Future scoped
projects: add their prefix to each `Resource` array rather than pasting a new
per-project block.

## Inline aggregate limit — why we also split to managed policies

The 10,240-char limit is the **aggregate of all inline policies on the role**,
not per-policy. Even after consolidation, three inline policies don't fit:

| Inline policy | Minified bytes |
|---|---|
| Consolidated | 7557 |
| Episode | 349 |
| Poetry | 2914 |
| **Aggregate** | **10820 — over the 10240 limit** |

**Fix:** move the big consolidated policy off inline and onto the role as
**customer-managed policies** (separate 6,144-char-each limit, up to 10 attached
per role, and they do **not** count against the inline aggregate). A single
managed policy can't hold 7557 chars either, so it's split in two by concern:

| Managed policy file | Contents | Minified bytes |
|---|---|---|
| `Managed-HCPTerraform-LambdaIam.json` | Lambda, Logs, IAM roles/pass-role/invoker-user, `sts:GetCallerIdentity` | 3449 |
| `Managed-HCPTerraform-WebData.json` | DynamoDB, Cognito, API Gateway v2, CloudFront, S3 | 4146 |

The union of these two managed policies is **exactly equal** to
`Consolidated-HCPTerraform.json` (verified: 0 missing, 0 extra action/resource
pairs). After the move, inline aggregate = Episode (349) + Poetry (2914) =
**3263 bytes**, well under 10,240.

> Note: `apigateway:TagResource` / `apigateway:UntagResource` were removed — AWS
> rejects them as nonexistent. API Gateway tagging goes through the `PUT`/`PATCH`/
> `DELETE` verbs on `.../tags/*`, which the block already grants.

## Apply steps (manual, live IAM — review first)

1. Review `Managed-HCPTerraform-LambdaIam.json` and `Managed-HCPTerraform-WebData.json`.
2. Create two **customer-managed** policies from those files (e.g.
   `HCPTerraformScopedLambdaIam` and `HCPTerraformScopedWebData`) and **attach**
   both to the `HCPTerraform` role.
3. **Delete** the three inline policies they replace: `HCPTerraform`,
   `HCPTerraformCoFoodPolicy`, `CloudFrontResponseHeaders`.
4. Keep `HCPTerraformEpisodePolicy` and `HCPTerraformPoetryPolicy` inline as-is.
5. Run a speculative plan on each affected workspace (virtual-soils, cofood,
   poetry-chat) to confirm no `AccessDenied` regressions before merging anything.

`Consolidated-HCPTerraform.json` is kept as the readable single-document
reference; the two `Managed-*` files are what you actually attach.
