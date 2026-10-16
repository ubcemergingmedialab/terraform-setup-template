# `aurora-serverless-postgres`

Creates a private Aurora PostgreSQL Serverless v2 cluster in caller-supplied
subnets. The RDS Data API is enabled so a Lambda outside the VPC can issue SQL
through IAM without opening a database ingress rule or storing credentials in
Lambda environment variables.

Provide at least two private subnets in separate Availability Zones. For the
Episode deployment, keep the AWS region set to `ca-central-1`; this preserves
Canada-only data residency while retaining Aurora's multi-AZ requirements.

This module creates infrastructure only. Schema migrations, tables, indexes,
and seed data belong to the application deployment that will follow the schema
specification.