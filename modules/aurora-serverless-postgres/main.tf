data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# AWS-managed keys (aws/secretsmanager) only grant cross-service actions like
# CreateGrant to calls made via their own service. RDS creates the managed
# master-user secret itself, so the KMS call arrives via RDS, not Secrets
# Manager, and aws/secretsmanager's fixed policy rejects it. A customer-managed
# key with a policy that delegates to IAM avoids that mismatch.
resource "aws_kms_key" "secrets" {
  description             = "Encrypts the RDS-managed master user secret for ${var.name_prefix}."
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableIAMUserPermissions"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.name_prefix}-aurora-secret"
  target_key_id = aws_kms_key.secrets.key_id
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-aurora"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "this" {
  name        = "${var.name_prefix}-aurora"
  description = "Aurora security group for ${var.name_prefix}"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow Aurora response traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_rds_cluster" "this" {
  cluster_identifier              = "${var.name_prefix}-aurora"
  engine                          = "aurora-postgresql"
  engine_mode                     = "provisioned"
  engine_version                  = var.engine_version != "" ? var.engine_version : null
  database_name                   = var.database_name
  master_username                 = var.master_username
  manage_master_user_password     = true
  master_user_secret_kms_key_id   = var.master_user_secret_kms_key_id != "" ? var.master_user_secret_kms_key_id : aws_kms_key.secrets.arn
  db_subnet_group_name            = aws_db_subnet_group.this.name
  vpc_security_group_ids          = [aws_security_group.this.id]
  backup_retention_period         = var.backup_retention_period
  deletion_protection             = var.deletion_protection
  skip_final_snapshot             = var.skip_final_snapshot
  final_snapshot_identifier       = var.skip_final_snapshot ? null : "${var.name_prefix}-aurora-final"
  storage_encrypted               = true
  kms_key_id                      = var.kms_key_id != "" ? var.kms_key_id : "arn:aws:kms:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:alias/aws/rds"
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = var.log_exports
  enable_http_endpoint            = true

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}

resource "aws_rds_cluster_instance" "this" {
  identifier         = "${var.name_prefix}-aurora-1"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  performance_insights_enabled = true
}