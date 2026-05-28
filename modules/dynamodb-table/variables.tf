variable "name_prefix" {
  type        = string
  description = "Prefix for resource names (client-project-environment)."
}

variable "table_name_suffix" {
  type        = string
  description = "Suffix appended after name_prefix for the DynamoDB table name."
  default     = "fields"
}

variable "hash_key" {
  type        = string
  description = "Partition key attribute name."
  default     = "FieldID"
}

variable "enable_point_in_time_recovery" {
  type        = bool
  description = "Enable DynamoDB point-in-time recovery."
  default     = true
}

variable "legacy_table_name" {
  type        = string
  description = "When set, use this exact table name instead of name_prefix-table_name_suffix (for importing existing tables)."
  default     = ""
}
