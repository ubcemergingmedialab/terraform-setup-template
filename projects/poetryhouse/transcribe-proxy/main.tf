locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

# ECR Repository for the transcribe proxy container
module "container_repo" {
  source = "../../../modules/ecr-repository"

  repository_name       = "${local.name_prefix}-transcribe-proxy"
  lifecycle_keep_count  = 10
  scan_on_push          = true
}

# Use default VPC (or reference an existing VPC module)
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "map-public-ip-on-launch"
    values = ["false"]
  }
}

# Fallback: if no private subnets, use public subnets
locals {
  private_subnet_ids = length(data.aws_subnets.private.ids) > 0 ? data.aws_subnets.private.ids : data.aws_subnets.public.ids
}

# ECS Fargate service with Application Load Balancer
module "transcribe_proxy" {
  source = "../../../modules/ecs-fargate-service"

  name_prefix     = local.name_prefix
  container_image = "${module.container_repo.repository_url}:${var.container_image_tag}"

  # WebSocket on 8080, health check on 8081
  container_port    = 8080
  health_check_port = 8081
  health_check_path = "/health"

  # Fargate sizing
  cpu       = var.fargate_cpu
  memory_mb = var.fargate_memory_mb

  desired_count = var.desired_task_count

  # Environment variables for the Node.js proxy
  environment_variables = {
    AWS_REGION    = var.aws_region
    LANGUAGE_CODE = var.transcribe_language_code
    PORT          = "8080"
  }

  # IAM permissions for the task to call Transcribe
  task_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "transcribe:StartStreamTranscription",
          "transcribe:StartStreamTranscriptionWebSocket"
        ]
        Resource = "*"
      }
    ]
  })

  # Networking
  vpc_id             = data.aws_vpc.default.id
  public_subnet_ids  = data.aws_subnets.public.ids
  private_subnet_ids = local.private_subnet_ids

  alb_ingress_cidr_blocks = var.allowed_cidr_blocks

  # WebSocket configuration
  enable_sticky_sessions = true

  # Logging
  log_retention_days      = var.log_retention_days
  enable_container_insights = var.enable_container_insights

  # Auto-scaling (optional)
  enable_autoscaling       = var.enable_autoscaling
  autoscaling_min_capacity = var.autoscaling_min_capacity
  autoscaling_max_capacity = var.autoscaling_max_capacity
  autoscaling_cpu_target   = var.autoscaling_cpu_target

  # HTTPS (optional - requires ACM certificate)
  enable_https    = var.enable_https
  certificate_arn = var.certificate_arn
}
