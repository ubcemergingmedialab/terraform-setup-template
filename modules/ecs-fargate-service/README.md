# `ecs-fargate-service`

ECS Fargate service, by default behind an Application Load Balancer. Set `enable_alb = false` for outbound-only workers that take no inbound traffic. Designed for WebSocket-capable backends and long-running containerized services.

## Features

- ✅ Application Load Balancer with HTTP/HTTPS support
- ✅ WebSocket support with sticky sessions
- ✅ Fargate compute (no EC2 management)
- ✅ Auto-scaling based on CPU utilization
- ✅ CloudWatch logging
- ✅ Health check monitoring
- ✅ Security groups for ALB and ECS tasks
- ✅ Optional HTTPS with ACM certificate
- ✅ Configurable task IAM permissions

## Inputs

### Required

| Name | Type | Description |
|------|------|-------------|
| `name_prefix` | string | Name prefix for all resources (use `${client_name}-${project_name}-${environment}` pattern). |
| `container_image` | string | Full container image URL (e.g., from ECR module output). |
| `vpc_id` | string | VPC ID where resources will be created. |
| `private_subnet_ids` | list(string) | Private subnet IDs for ECS tasks. |

### Optional

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `container_port` | number | `8080` | Port the container listens on. |
| `health_check_port` | number | `null` | Port for health checks. Set to null to use `container_port`. |
| `health_check_path` | string | `"/health"` | Health check path. |
| `cpu` | number | `512` | Fargate CPU units (256, 512, 1024, 2048, 4096). |
| `memory_mb` | number | `1024` | Fargate memory in MB (512, 1024, 2048, ...). |
| `desired_count` | number | `1` | Number of tasks to run. |
| `environment_variables` | map(string) | `{}` | Environment variables passed to the container (plaintext). |
| `secrets` | map(string) | `{}` | Secrets injected as env vars. Map of env var name => Secrets Manager/SSM ARN. ECS resolves at task start; the execution role is auto-granted read on the listed ARNs. |
| `task_policy_json` | string | `""` | IAM policy JSON for task role (application permissions). |
| `public_subnet_ids` | list(string) | `[]` | Public subnet IDs for the ALB. Required when `enable_alb` is true; ignored otherwise. |
| `enable_alb` | bool | `true` | Create the ALB, target group, listeners and ALB security group. Set `false` for workers with no inbound traffic; avoids the ALB hourly charge, capacity units and one public IPv4 per AZ. |
| `container_health_check_command` | list(string) | `[]` | ECS container health check, e.g. `["CMD-SHELL", "curl -fsS http://localhost:8081/health \|\| exit 1"]`. ECS ignores the Dockerfile `HEALTHCHECK`; use this when `enable_alb` is false. |
| `alb_ingress_cidr_blocks` | list(string) | `["0.0.0.0/0"]` | CIDR blocks allowed to access the ALB. |
| `alb_internal` | bool | `false` | Make the ALB internal (not internet-facing). |
| `alb_deletion_protection` | bool | `false` | Enable deletion protection on the ALB. |
| `enable_https` | bool | `false` | Enable HTTPS listener. Requires `certificate_arn`. |
| `certificate_arn` | string | `""` | ARN of ACM certificate for HTTPS. |
| `enable_sticky_sessions` | bool | `true` | Enable sticky sessions (recommended for WebSocket). |
| `target_group_deregistration_delay` | number | `30` | Time in seconds to wait before deregistering a target. |
| `enable_container_insights` | bool | `false` | Enable CloudWatch Container Insights. |
| `log_retention_days` | number | `7` | CloudWatch log retention in days. |
| `enable_autoscaling` | bool | `false` | Enable auto-scaling based on CPU. |
| `autoscaling_min_capacity` | number | `0` | Minimum number of tasks (set to 0 to scale to zero). |
| `autoscaling_max_capacity` | number | `3` | Maximum number of tasks. |
| `autoscaling_cpu_target` | number | `70` | Target CPU utilization percentage for auto-scaling. |

## Outputs

| Name | Description |
|------|-------------|
| `cluster_name` | ECS cluster name. |
| `cluster_arn` | ECS cluster ARN. |
| `service_name` | ECS service name. |
| `service_arn` | ECS service ARN. |
| `task_definition_arn` | Task definition ARN. |
| `task_role_arn` | Task role ARN (for adding additional permissions). |
| `task_role_name` | Task role name. |
| `alb_dns_name` | DNS name of the Application Load Balancer. |
| `alb_zone_id` | Hosted zone ID of the ALB (for Route53 alias records). |
| `alb_arn` | ARN of the Application Load Balancer. |
| `target_group_arn` | ARN of the target group. |
| `alb_security_group_id` | Security group ID of the ALB. |
| `ecs_security_group_id` | Security group ID of the ECS tasks. |
| `log_group_name` | CloudWatch log group name. |
| `websocket_url` | WebSocket URL for connecting to the service. |

## Example: WebSocket Transcription Proxy

```hcl
module "transcribe_proxy" {
  source = "../../../modules/ecs-fargate-service"

  name_prefix    = local.name_prefix
  container_image = module.container_repo.repository_url

  container_port     = 8080
  health_check_port  = 8081
  health_check_path  = "/health"

  cpu       = 512  # 0.5 vCPU
  memory_mb = 1024 # 1 GB

  desired_count = 1

  environment_variables = {
    AWS_REGION    = var.aws_region
    LANGUAGE_CODE = "en-US"
  }

  # Grant Transcribe permissions
  task_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "transcribe:StartStreamTranscription"
      ]
      Resource = "*"
    }]
  })

  vpc_id             = data.aws_vpc.default.id
  public_subnet_ids  = data.aws_subnets.public.ids
  private_subnet_ids = data.aws_subnets.private.ids

  enable_sticky_sessions = true  # Required for WebSocket

  # Optional: Auto-scale to 0 when idle
  enable_autoscaling         = true
  autoscaling_min_capacity   = 0
  autoscaling_max_capacity   = 3
  autoscaling_cpu_target     = 70
}
```

## Running without an ALB

With `enable_alb = false` the ALB resources are not created, the service has no `load_balancer` block, and the task security group has no ingress rules. The ALB outputs (`alb_dns_name`, `alb_zone_id`, `alb_arn`, `target_group_arn`, `alb_security_group_id`, `websocket_url`) return `null`. Pass `container_health_check_command` so ECS can still replace a hung container.

Switching an existing service from `true` to `false` recreates the ECS service (ECS cannot remove a load balancer from a service in place), so expect a short gap with no running task.

The ALB resources are addressed with `count`. `moved` blocks in `main.tf` map the old addresses to `[0]`, so existing deployments keep their ALB and DNS name when they pick up this version. Review the plan in HCP before applying.

## WebSocket Support

This module is configured for WebSocket applications:

- **Sticky sessions** are enabled by default (required for WebSocket connections)
- **HTTP/2** is enabled on the ALB (supports WebSocket upgrade)
- **Target group** uses connection draining for graceful shutdowns
- Use the `websocket_url` output to get the correct `ws://` or `wss://` URL

## Auto-Scaling to Zero

To minimize costs for dev/test environments, enable auto-scaling with `autoscaling_min_capacity = 0`:

```hcl
enable_autoscaling       = true
autoscaling_min_capacity = 0
autoscaling_max_capacity = 3
```

Tasks will scale down to zero when idle and scale up when connections arrive.

## IAM Permissions

The module creates two IAM roles:

1. **Task Execution Role** (managed automatically):
   - Pulls container images from ECR
   - Writes logs to CloudWatch

2. **Task Role** (you configure):
   - Your application's AWS permissions
   - Set via `task_policy_json` variable
   - Example: Transcribe, S3, DynamoDB access

## After Deployment

1. **Push your container image** to the ECR repository
2. **Update the ECS service** to deploy new image versions:
   ```bash
   aws ecs update-service --cluster <cluster-name> --service <service-name> --force-new-deployment
   ```
3. **View logs** in CloudWatch: `/ecs/<name-prefix>`
4. **Connect** using the `websocket_url` output

## Cost Optimization

- Use ARM architecture in your Dockerfile for 20% savings
- Enable auto-scaling to scale down when idle
- Set appropriate `log_retention_days` (default 7 days)
- Use smaller CPU/memory sizes when possible
