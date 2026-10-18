variable "name_prefix" {
  type        = string
  description = "Prefix for Aurora and networking resources."
}

variable "vpc_id" {
  type        = string
  description = "VPC containing the private Aurora subnets."
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs in at least two Availability Zones in the deployment region."

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "Aurora requires at least two private subnet IDs in separate Availability Zones."
  }
}

variable "database_name" {
  type        = string
  description = "Initial PostgreSQL database name."
  default     = "episode"
}

variable "master_username" {
  type        = string
  description = "Master username. The password is generated and stored by RDS in Secrets Manager."
  default     = "episode_admin"
}

variable "engine_version" {
  type        = string
  description = "Optional Aurora PostgreSQL engine version. Leave empty to use the region's current default."
  default     = ""
}

variable "kms_key_id" {
  type        = string
  description = "Optional KMS key ARN for Aurora storage encryption. Leave empty to use the account's default aws/rds key. Must be set explicitly (not left to the provider's implicit default) because manage_master_user_password combined with storage_encrypted causes AWS to reject a null KMS key id on cluster creation."
  default     = ""
}

variable "master_user_secret_kms_key_id" {
  type        = string
  description = "Optional KMS key ARN encrypting the RDS-managed master password secret in Secrets Manager. Leave empty to use a customer-managed key this module creates. The AWS-managed aws/secretsmanager key does not work here: its fixed policy only allows cross-service actions via Secrets Manager itself, and RDS creates this secret via an RDS-context KMS call, which that policy rejects."
  default     = ""
}

variable "min_capacity" {
  type        = number
  description = "Minimum Aurora Serverless v2 capacity in ACUs."
  default     = 0.5
}

variable "max_capacity" {
  type        = number
  description = "Maximum Aurora Serverless v2 capacity in ACUs."
  default     = 2
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups."
  default     = 7
}

variable "deletion_protection" {
  type        = bool
  description = "Prevent accidental deletion of the Aurora cluster."
  default     = true
}

variable "skip_final_snapshot" {
  type        = bool
  description = "Skip the final snapshot when the cluster is destroyed."
  default     = false
}

variable "log_exports" {
  type        = list(string)
  description = "Aurora PostgreSQL logs to export to CloudWatch."
  default     = ["postgresql"]
}