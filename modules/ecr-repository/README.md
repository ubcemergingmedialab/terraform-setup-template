# `ecr-repository`

Amazon Elastic Container Registry (ECR) repository for Docker images. Includes optional lifecycle policy to clean old images.

## Inputs

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `repository_name` | string | (required) | ECR repository name (use `name_prefix` pattern from project). |
| `image_tag_mutability` | string | `"MUTABLE"` | Image tag mutability: `MUTABLE` or `IMMUTABLE`. |
| `scan_on_push` | bool | `true` | Enable image scanning on push. |
| `enable_lifecycle_policy` | bool | `true` | Enable lifecycle policy to clean old images. |
| `lifecycle_keep_count` | number | `10` | Number of images to keep when lifecycle policy is enabled. |

## Outputs

| Name | Description |
|------|-------------|
| `repository_url` | Full URL of the ECR repository (for `docker push`). |
| `repository_arn` | ARN of the ECR repository. |
| `repository_name` | Name of the ECR repository. |
| `registry_id` | Registry ID where the repository was created. |

## Example

```hcl
module "container_repo" {
  source = "../../../modules/ecr-repository"

  repository_name = "${local.name_prefix}-transcribe-proxy"
}
```

## After Creating

Push your container image:

```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build -t transcribe-proxy .
docker tag transcribe-proxy:latest <repository_url>:latest
docker push <repository_url>:latest
```
