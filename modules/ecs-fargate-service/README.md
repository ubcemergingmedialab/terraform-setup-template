# `ecs-fargate-service` (stub)

ECS Fargate service behind an Application Load Balancer. For longer-running containerized backends — anything that doesn't fit in a 10-second Lambda.

**Status: skeleton only.** Implement on first project that needs it. See `task_plan.md` Phase 5.

## Planned inputs

| Name | Type | Default |
|------|------|---------|
| `name_prefix` | string | (required) |
| `container_image` | string | (required) |
| `container_port` | number | `8080` |
| `cpu` | number | `256` |
| `memory_mb` | number | `512` |
| `desired_count` | number | `1` |
| `vpc_id` | string | (required) |
| `subnet_ids` | list(string) | (required) |

## Planned outputs

`cluster_name`, `service_name`, `alb_dns_name`, `target_group_arn`.
