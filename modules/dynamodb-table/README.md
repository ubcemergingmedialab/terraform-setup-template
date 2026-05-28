# `dynamodb-table`

Single-key DynamoDB table with on-demand billing and encryption enabled.

## Inputs

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `name_prefix` | string | (required) | Name prefix for resources. |
| `table_name_suffix` | string | `"fields"` | Suffix for table name when not using legacy name. |
| `hash_key` | string | `"FieldID"` | Partition key attribute. |
| `legacy_table_name` | string | `""` | Exact table name for import/migration (e.g. `eml_fields`). |

## Outputs

`table_name`, `table_arn`, `table_id`.
