# Database Schema and Architecture

## Goals

- Store instructor records and connect instructors to scenarios they create.
- Allow public scenarios to be accessed through a public link.
- Restrict private scenarios to one or more audience-specific links, such as Semester 1 and Semester 2 classes.
- Keep learner attempts anonymous. Do not store learner names, email addresses, student IDs, Cognito identities, IP addresses, or device identifiers.
- Store anonymous attempt scores and rubric results for class-level analysis.
- Support offline workflow progress through IndexedDB.

## AWS Architecture

> **Infrastructure ownership:** All AWS resources described in this section are provisioned and managed in a **separate Terraform repository**. This application repository contains no Terraform code. See [Terraform Provisioning](#terraform-provisioning) at the end of this document for the full list of resources and configuration requirements.

```text
Browser React application
        |
        | HTTPS API requests
        v
Amazon API Gateway HTTP API
        |
        +--> Consolidated API Lambda
                    |
                    +--> Amazon Aurora PostgreSQL Serverless v2
                    +--> Cognito User Pool authorizer for instructor routes

Existing service Lambdas
        +--> Bedrock chat Lambda
        +--> Polly text-to-speech Lambda

Browser IndexedDB
        |
        +--> Offline cache for the active anonymous attempt

Amazon CloudWatch
        +--> API and Lambda logs and backend audit events
```

### Aurora PostgreSQL

Free tier: 
100,000 DPUs: The first 100,000 Distributed Processing Units (DPUs) are free each month, which covers database activity.
1 GB of storage: The first 1 GB of storage is free each month, covering stored data.
Permanent free tier: The free tier applies monthly and does not expire after 12 months like most AWS Free Tier benefits.


Aurora PostgreSQL is the system of record for instructors, scenarios, links, patients, medications, attempts, and reporting data.

Use relational columns and foreign keys for the core entities. Store the complete submitted workflow and raw evaluation response as `jsonb` on the attempt. Store individual rubric results relationally so instructors can query weak areas across a class.

### Cognito User Pool

Use a Cognito User Pool authorizer on the API Gateway HTTP API to authenticate instructors and protect only instructor management and analytics endpoints. Cognito identities are used for instructor access only and are not stored for anonymous learners.

Scenario access and attempt submission remain public API operations. A public scenario link or private audience link is the access mechanism for those routes; learners do not need Cognito authentication.

### API Gateway and consolidated API Lambda

The browser must access Aurora through the API Gateway HTTP API and one consolidated API Lambda. The Lambda handles the database-backed operations for both public learner routes and Cognito-protected instructor routes. It should:

- Receive Cognito-authorized requests only on instructor routes.
- Resolve public and private scenario links on public routes.
- Create and submit anonymous attempts on public routes.
- Write attempts and metrics transactionally.
- Prevent direct database access from the browser.
- Apply rate limits and input validation to both public and protected routes.

The existing Bedrock chat Lambda and Polly text-to-speech Lambda remain separate services. They do not need instructor authentication for public learner workflows. The browser may call their existing public endpoints, while each Lambda keeps only the IAM permissions required for its service. The consolidated API Lambda prevents the browser from receiving Aurora credentials or broad database permissions.

Recommended route authorization:

```text
Public routes:
GET  /scenarios/{linkToken}
POST /attempts

Cognito-protected instructor routes:
POST   /instructor/scenarios
PATCH  /instructor/scenarios/{id}
GET    /instructor/scenarios/{id}/analytics
POST   /instructor/scenario-links
POST   /instructor/scenario-links/{id}/revoke
GET    /instructor/scenario-links/{id}/analytics
```

### IndexedDB

IndexedDB is an offline cache, not the source of truth. Store only the active anonymous attempt and its resumable workflow state:

```text
attempt_id
scenario_id
scenario_link_id
workflow_state
conversation_messages
last_modified_at
sync_status
```

An attempt record is not created on the server until the learner completes and submits the scenario. All in-progress state — workflow steps, conversation messages, timestamps — is held in IndexedDB only and is never persisted to the database if the learner abandons the session. When the learner submits, synchronize through the API and mark the local record as synchronized after receiving server confirmation. Use the attempt ID as an idempotency key so retries cannot create duplicate submissions.

### CloudWatch

Send backend audit logs to CloudWatch. Log operational events such as:

- Instructor scenario creation and updates.
- Scenario link creation, revocation, and expiry.
- Attempt submission and evaluation failures.
- Authorization failures.
- Metric recalculation jobs.

Do not log learner-entered personal information or full conversation content in audit logs.

## Relational Schema

### `instructor`

Stores instructors who create and manage scenarios.

```text
id           uuid primary key
first_name   varchar not null
last_name    varchar not null
email        varchar not null
created_at   timestamptz not null
```

The email is instructor data, not learner data. It should be protected and never exposed through public scenario endpoints.

### `scenario`

Each scenario has one expected patient. A patient can be reused by multiple scenarios.

```text
id             uuid primary key
created_by     uuid not null references instructor(id)
title          varchar not null
private        boolean not null default false
system_prompt  text not null
emotive_state  text null
patient_id     uuid not null references patient(id)
created_at     timestamptz not null
updated_at     timestamptz not null
```

`private = false` means the scenario is public. `private = true` means access requires a scenario link.

`emotive_state` describes the patient's mental and emotional state for this specific scenario (e.g. "Anxious and tearful, worried about the baby's wellbeing"). Because the same patient can appear in multiple scenarios with different emotional contexts, this field lives on `scenario` rather than `patient`. It is injected into the system prompt at runtime so the AI responds consistently with the authored patient state.

If instructors can edit scenarios after links have been distributed, add scenario versioning before relying on historical comparisons. Otherwise, an old attempt could refer to changed scenario content.

### `scenario_link`

A link identifies an audience, not an individual learner. Multiple links can point to the same private scenario and produce separate aggregates.

```text
id                uuid primary key
scenario_id       uuid not null references scenario(id)
instructor_id     uuid not null references instructor(id)
audience_name     varchar not null
token_hash        varchar unique not null
created_at        timestamptz not null
expires_at        timestamptz null
revoked_at        timestamptz null
completion_count  integer not null default 0
```

`instructor_id` records which instructor created the link. This is separate from `scenario.created_by`, which records who authored the scenario. A public scenario can have links created by multiple instructors, each generating their own class-level metrics independently.

Aggregate statistics (average score, standard deviation, average time) are computed on demand from the `attempt` table and are not maintained as denormalized columns.

**Access control rules (enforced in the API Lambda, not at the database level):**

- **Creation:** An instructor may create a `scenario_link` only if `scenario.private = false` OR `scenario.created_by = instructor.id`. This allows any instructor to create a private link for a public scenario, while restricting private scenario links to the scenario's author.
- **Analytics read:** An instructor may read analytics for a `scenario_link` only if `scenario_link.instructor_id = authenticated instructor id`. Admin accounts bypass this check.

Examples:

```text
Perinatal Client / Public
Perinatal Client / Semester 1
Perinatal Client / Semester 2
```

Create a public link for public scenarios as well. This gives public and private access the same routing and analytics behavior.

### `patient`

Patients are reusable scenario data, not user accounts.

```text
id                uuid primary key
qr_code           varchar not null unique
name              varchar not null
date_of_birth     date not null
gender            varchar null
allergies         varchar null
relevant_history  varchar null
current_issue     varchar null
extra_details     jsonb null
```

QR values must be stored as strings. Values may be alphanumeric or contain leading zeroes.

`gender`, `allergies`, `relevant_history`, and `current_issue` are fixed clinical fields. All are nullable so non-perinatal patients do not require them.

`extra_details` holds an ordered array of instructor-defined label/value pairs for scenario-specific clinical details that do not fit the fixed columns (e.g. obstetric history, gestation). The array is rendered top-to-bottom in insertion order. No querying of individual fields is required.

Expected `extra_details` shape:

```json
[
  { "label": "Obstetric History", "value": "G3T1P0A1L1" },
  { "label": "Gestation", "value": "39+5 weeks" }
]
```

The expected patient for a scenario is referenced directly by `scenario.patient_id`. No `scenario_patient` join table is required because a scenario has only one expected patient.

### `medication_type`

A medication type includes the QR identifier because the application only needs a medication type and its scan value.

```text
id           uuid primary key
scenario_id  uuid not null references scenario(id)
name         varchar not null
qr_code      varchar not null
```

Examples:

```text
Gravol (dimenhydrinate) / AC7400000016020
Morphine                     / 111222333
```

The QR code is a string, not an integer.

### `medication_order`

An order references a medication type and supplies the order-specific details.

```text
id                      uuid primary key
scenario_id             uuid not null references scenario(id)
medication_type_id      uuid not null references medication_type(id)
dose                    varchar not null
route                   varchar not null
form                    varchar not null
frequency               varchar not null
indication              varchar not null
ordered_at_days_offset  integer not null default 0
status                  varchar not null default 'active'
is_expected             boolean not null default false
```

`ordered_at_days_offset` is the number of days relative to the scenario start date that the order was placed. `0` means the order was placed on the same day the learner starts the scenario; `-5` means it was placed five days before. The actual order date is computed at runtime by applying this offset to the current date when the learner starts the scenario.

A distractor medication can be available in `medication_type` without having an expected order. The expected medication order is identified with `is_expected = true`.

### `mar_record`

Pre-authored Medication Administration Record (MAR) entries for a scenario. Displayed in the EHR drug table alongside medication orders. One set of MAR entries is authored per scenario; the entries are not generated by learners.

```text
id                   uuid primary key
scenario_id          uuid not null references scenario(id)
medication_name      varchar not null
dose                 varchar not null
route                varchar not null
time_offset_minutes  integer not null
site                 varchar not null
initials             varchar not null
notes                varchar null
```

`time_offset_minutes` is applied to the scenario start timestamp at runtime to produce the displayed administration time. Negative values indicate the administration occurred before the scenario start (e.g. `-30` = 30 minutes before the learner starts the scenario).

### `attempt`

Attempts are anonymous. An attempt record is only written to the database when a learner completes and submits the scenario — there is no server-side record for in-progress sessions. All in-progress state (workflow steps, conversation messages, timestamps) is held in IndexedDB only and is never persisted to the database if the learner abandons the session.

```text
id                  uuid primary key
scenario_link_id    uuid not null references scenario_link(id)
score               numeric(5,2) not null
time_spent_seconds  integer not null
submitted_at        timestamptz not null
```

`scenario_link_id` identifies both the audience and, via join through `scenario_link`, the scenario itself. `score` is the learner's overall score at the end of the scenario. `time_spent_seconds` is the total time the learner had the scenario open in the browser.



## Analytics

Because every attempt references a `scenario_link_id`, statistics can be computed per audience link or rolled up across all links for a scenario.

### Per scenario-link aggregate

```sql
SELECT
  COUNT(*)                    AS attempt_count,
  AVG(a.score)                AS avg_score,
  STDDEV(a.score)             AS stddev_score,
  AVG(a.time_spent_seconds)   AS avg_time_seconds
FROM attempt a
WHERE a.scenario_link_id = :link_id;
```

### Per scenario aggregate (across all links)

```sql
SELECT
  sl.scenario_id,
  COUNT(*)                    AS attempt_count,
  AVG(a.score)                AS avg_score,
  STDDEV(a.score)             AS stddev_score,
  AVG(a.time_spent_seconds)   AS avg_time_seconds
FROM attempt a
JOIN scenario_link sl ON sl.id = a.scenario_link_id
WHERE sl.scenario_id = :scenario_id
GROUP BY sl.scenario_id;
```

These two queries cover all reporting requirements: per-link class metrics and optional cross-link scenario-wide stats.

## Scenario Access

| Scenario | Access | Metrics |
|---|---|---|
| Public | Public scenario link | Aggregate for the public link |
| Private | One or more audience links | Separate aggregate per link |

Example:

```text
Scenario: Medication Administration
  Public link       -> public metrics
  Semester 1 link  -> Semester 1 metrics
  Semester 2 link  -> Semester 2 metrics
```

All three links can reference the same scenario. The two semester links produce separate anonymous class results.

## Token Hashes

A scenario link contains a random bearer token in its URL. The database stores only a one-way hash of that token:

```text
URL token:  7f4c9b...
Database:   SHA-256(7f4c9b...)
```

When a request arrives, the API hashes the supplied token and looks up the matching `token_hash`. This means a database leak does not immediately reveal usable scenario links. Hashing also supports revoking and expiring links without changing the scenario itself.

The raw token should be generated with a cryptographically secure random generator and should never be written to CloudWatch logs.


---

## Terraform Provisioning

All AWS infrastructure for this project is declared in a separate Terraform repository. Nothing in this application repository provisions AWS resources. The notes below describe what that repository must create and the configuration decisions that affect how this application connects to it.

### Scope boundary

| Owned by this repo | Owned by the Terraform repo |
|---|---|
| React frontend build | Cognito User Pool and app client |
| API Lambda source code | Aurora PostgreSQL cluster |
| Database migration scripts | API Gateway HTTP API |
| IndexedDB offline logic | Lambda execution roles and VPC placement |
| | Secrets Manager secrets |
| | CloudWatch log groups, alarms, dashboards |
| | S3 / CloudFront for frontend hosting (if applicable) |

### Cognito User Pool

The Cognito User Pool and its app client must already exist before any instructor authentication is wired up. This repo expects the following outputs from the Terraform repo:

- `cognito_user_pool_id` � used to configure the API Gateway JWT authorizer.
- `cognito_user_pool_client_id` � used by the frontend to initiate sign-in.
- `cognito_user_pool_endpoint` � issuer URL for JWT validation.

The User Pool must be configured with:

- Email as the sign-in attribute for instructors.
- A password policy appropriate for an educational tool.
- No self-registration; instructor accounts are created by an administrator.

Learners do not use Cognito. Do not create an unauthenticated identity pool for learner access.

### Aurora PostgreSQL Serverless v2

Provision one Aurora PostgreSQL Serverless v2 cluster per environment (development, staging, production). Required configuration:

```hcl
engine         = "aurora-postgresql"
engine_mode    = "provisioned"   # Serverless v2 uses provisioned mode with scaling config
engine_version = "15"            # or latest supported

serverlessv2_scaling_configuration {
  min_capacity = 0.5  # ACUs � scale to near-zero when idle in dev/staging
  max_capacity = 4    # adjust per environment based on expected load
}
```

- Place the cluster in private subnets. It must not have a public endpoint.
- Enable storage encryption with a KMS key.
- Enable automated backups with a retention period appropriate to the environment (e.g. 1 day dev, 7 days staging, 30 days production).
- Enable deletion protection in staging and production.
- Create one database named `episode` and one application-level role with least-privilege grants (SELECT, INSERT, UPDATE, DELETE on application tables only; no DDL rights at runtime).
- Output the cluster endpoint, port, and database name so the Lambda can be configured.

### Secrets Manager

Store Aurora credentials in AWS Secrets Manager rather than environment variables. Create one secret per environment with the following structure:

```json
{
  "host": "<aurora-cluster-endpoint>",
  "port": 5432,
  "dbname": "episode",
  "username": "<app-role>",
  "password": "<generated>"
}
```

- Rotate the secret on a schedule using the Aurora rotation Lambda provided by AWS.
- Grant the API Lambda's execution role `secretsmanager:GetSecretValue` on this secret only.
- Output the secret ARN so the Lambda environment variable `DB_SECRET_ARN` can be set.

### VPC and networking

- The Aurora cluster and the API Lambda must share a VPC.
- Place Aurora in private data subnets (no route to the internet gateway).
- The Lambda security group must allow outbound TCP 5432 to the Aurora security group only.
- The Aurora security group must allow inbound TCP 5432 from the Lambda security group only.
- If the Lambda needs internet access (e.g. to call Bedrock or Polly endpoints), attach a NAT gateway or VPC endpoint as appropriate.

### API Gateway HTTP API

Provision one API Gateway HTTP API per environment.

- Attach a Lambda integration pointing to the consolidated API Lambda.
- Configure a JWT authorizer using the Cognito User Pool endpoint and client ID. Apply this authorizer only to instructor routes; leave public routes open.
- Configure CORS to allow the frontend origin for each environment.
- Set a throttling default (e.g. 100 req/s burst, 50 req/s steady) on public routes to limit abuse.
- Enable access logging to a CloudWatch log group.
- Output the invoke URL so the frontend `VITE_API_BASE_URL` environment variable can be set per environment.

### Consolidated API Lambda

Provision one Lambda function per environment for the consolidated API.

- Runtime: Node.js 20.x (or latest LTS supported by Lambda).
- Place in the same VPC and subnets as Aurora.
- Attach an execution role with:
  - `secretsmanager:GetSecretValue` on the DB secret.
  - `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, `ec2:DeleteNetworkInterface` for VPC placement.
  - No broad AWS permissions; Bedrock and Polly are called by their own existing Lambdas.
- Set environment variables:
  - `DB_SECRET_ARN` � ARN of the Secrets Manager secret.
  - `NODE_ENV` � `production` | `staging` | `development`.
- Reserve concurrency if needed to cap database connections.
- Output the Lambda ARN and function name for API Gateway integration and deployment pipeline use.

### Existing Bedrock and Polly Lambdas

Do not modify or re-provision these. They retain their existing IAM permissions and endpoints. The Terraform repo should only ensure they are not inadvertently destroyed during infrastructure updates.

### CloudWatch

Create the following per environment:

- Log group for API Gateway access logs (`/aws/apigateway/episode-{env}`), retention 30 days.
- Log group for the consolidated API Lambda (`/aws/lambda/episode-api-{env}`), retention 30 days.
- Metric filter and alarm on Lambda error rate (threshold: >1% over 5 minutes).
- Metric filter and alarm on Aurora `ServerlessDatabaseCapacity` approaching `max_capacity`.
- Dashboard combining API latency, Lambda errors, Lambda duration, and database capacity.

Do not log raw scenario link tokens, learner conversation content, or instructor PII in any CloudWatch log group.

### Outputs the application repo depends on

The Terraform repo should expose these as outputs (or store them in SSM Parameter Store) so the deployment pipeline for this repo can consume them:

| Output | Used by |
|---|---|
| `api_gateway_invoke_url` | Frontend `VITE_API_BASE_URL` per environment |
| `cognito_user_pool_client_id` | Frontend Cognito sign-in config |
| `cognito_user_pool_endpoint` | API Gateway JWT authorizer |
| `db_secret_arn` | API Lambda `DB_SECRET_ARN` env var |
| `api_lambda_function_name` | Deployment pipeline for Lambda code updates |
