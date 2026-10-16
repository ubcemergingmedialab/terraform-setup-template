variable "client_name" {
  type        = string
  description = "Client slug (lowercase, hyphen-separated)."
}

variable "project_name" {
  type        = string
  description = "Project slug."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, prod, …)."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region for all resources."
}

variable "tags" {
  type        = map(string)
  description = "Extra tags merged onto default_tags."
  default     = {}
}

# --- Project-specific ---

variable "cognito_callback_urls" {
  type        = list(string)
  description = "OAuth callback URLs for the public site login flow."
}

variable "cognito_logout_urls" {
  type        = list(string)
  description = "OAuth sign-out redirect URLs for the public site."
}

variable "cognito_hosted_ui_domain_prefix" {
  type        = string
  description = "Cognito hosted UI domain prefix. Set when importing an existing pool domain."
  default     = ""
}

variable "cognito_password_minimum_length" {
  type        = number
  description = "Minimum password length for Episode Cognito users."
  default     = 12
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model ID used by the chat backend Lambda."
  default     = "us.anthropic.claude-sonnet-4-6"
}

variable "chat_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the chat backend Lambda source."
  default     = "lambda/chat-backend"
}

variable "polly_lambda_source_dir" {
  type        = string
  description = "Path, relative to this project root, containing the Polly Lambda source."
  default     = "lambda/polly"
}

variable "cors_allow_origins" {
  type        = list(string)
  description = "Origins for API Gateway CORS."
  default     = ["*"]
}

variable "enable_viewer_site" {
  type        = bool
  description = "S3 + CloudFront for the public viewer app (apps/viewer). Bucket suffix: site."
  default     = true
}

variable "enable_episode_database" {
  type        = bool
  description = "Create the Episode Aurora database and its separate public/authenticated API controllers."
  default     = true
}

variable "database_vpc_cidr" {
  type        = string
  description = "CIDR block for the Terraform-managed private database VPC."
  default     = "10.42.0.0/16"
}

variable "database_availability_zones" {
  type        = list(string)
  description = "Availability Zones for the Terraform-managed private database subnets."
  default     = ["ca-central-1a", "ca-central-1b"]
}

variable "database_private_subnet_cidrs" {
  type        = list(string)
  description = "One private subnet CIDR per database Availability Zone."
  default     = ["10.42.1.0/24", "10.42.2.0/24"]
}

variable "database_name" {
  type        = string
  description = "Initial Aurora PostgreSQL database name."
  default     = "episode"
}

variable "database_engine_version" {
  type        = string
  description = "Aurora PostgreSQL engine version."
  default     = "16.6"
}

variable "database_min_capacity" {
  type        = number
  description = "Aurora Serverless v2 minimum capacity in ACUs."
  default     = 0.5
}

variable "database_max_capacity" {
  type        = number
  description = "Aurora Serverless v2 maximum capacity in ACUs."
  default     = 2
}

variable "database_deletion_protection" {
  type        = bool
  description = "Protect the Aurora cluster from accidental deletion."
  default     = true
}

variable "database_api_source_dir" {
  type        = string
  description = "Path relative to this project containing the public and authenticated database handlers."
  default     = "lambda/database-controller"
}

variable "app_base_url" {
  type        = string
  description = "Public frontend base URL used when creating learner scenario links."
  default     = "http://localhost:5173"
}

variable "api_throttling_rate_limit" {
  type        = number
  description = "Steady-state API Gateway requests per second across the EPISODE API."
  default     = 50
}

variable "api_throttling_burst_limit" {
  type        = number
  description = "API Gateway burst request limit across the EPISODE API."
  default     = 100
}