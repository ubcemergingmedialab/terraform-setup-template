# ---------------------------------------------------------------------------
# The five-variable contract (see docs/conventions.md).
# ---------------------------------------------------------------------------
variable "client_name" {
  type        = string
  description = "Client slug. Lowercase, hyphen-separated, no spaces, max 24 chars."
}

variable "project_name" {
  type        = string
  description = "Project slug. Lowercase, hyphen-separated, no spaces, max 24 chars."
}

variable "environment" {
  type        = string
  description = "Environment within the project (e.g. dev, prod)."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region this project deploys into."
  default     = "ca-central-1"
}

variable "tags" {
  type        = map(string)
  description = "Extra tags to add on top of the defaults."
  default     = {}
}

# ---------------------------------------------------------------------------
# Auth / Cognito lockdown
# ---------------------------------------------------------------------------
variable "admin_email" {
  type        = string
  description = "Email of the single approved user seeded into the Cognito pool. Cognito emails this address a temporary password on first apply."
}

variable "extra_callback_urls" {
  type        = list(string)
  description = "Additional OAuth callback URLs beyond the CloudFront site URL (e.g. http://localhost:5173 for local dev of the SPA)."
  default     = []
}

variable "extra_logout_urls" {
  type        = list(string)
  description = "Additional OAuth sign-out URLs beyond the CloudFront site URL."
  default     = []
}

# ---------------------------------------------------------------------------
# LiveKit Cloud (external SaaS). URL is public; key/secret are sensitive and are
# delivered via Secrets Manager (set in the HCP workspace, never committed).
# ---------------------------------------------------------------------------
variable "livekit_url" {
  type        = string
  description = "LiveKit Cloud project URL, e.g. wss://<project>.livekit.cloud. Public; safe to commit."
}

variable "livekit_api_key" {
  type        = string
  description = "LiveKit API key. Set as a SENSITIVE variable in the HCP workspace; leave unset in tfvars."
  sensitive   = true
}

variable "livekit_api_secret" {
  type        = string
  description = "LiveKit API secret. Set as a SENSITIVE variable in the HCP workspace; leave unset in tfvars."
  sensitive   = true
}

# Note: LiveKit signs its webhook callbacks with the same project API key/secret
# as above. The webhook Lambda verifies them using the LiveKit secret from
# Secrets Manager, so no separate webhook key variable is needed.

# ---------------------------------------------------------------------------
# Simli (external SaaS). Key is sensitive -> Secrets Manager.
# ---------------------------------------------------------------------------
variable "simli_api_key" {
  type        = string
  description = "Simli API key used by the token service to mint Simli session tokens. Set as a SENSITIVE variable in the HCP workspace."
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Agent (ECS Fargate) tuning
# ---------------------------------------------------------------------------
variable "agent_image_tag" {
  type        = string
  description = "Tag of the agent container image in ECR to run (pushed by CI before apply)."
  default     = "latest"
}

variable "agent_cpu" {
  type        = number
  description = "Fargate CPU units for the agent task (256, 512, 1024, ...)."
  default     = 512
}

variable "agent_memory_mb" {
  type        = number
  description = "Fargate memory (MB) for the agent task."
  default     = 1024
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model / inference-profile ID the agent's LLM calls. Model access must be enabled in the account/region."
  default     = "global.anthropic.claude-sonnet-4-6"
}

variable "bedrock_model_arns" {
  type        = list(string)
  description = "ARNs the agent task role may invoke via bedrock:InvokeModel. Default ['*'] allows any model/profile in the account."
  default     = ["*"]
}

variable "polly_voice" {
  type        = string
  description = "Amazon Polly voice the judge speaks with."
  default     = "Tiffany"
}

variable "polly_engine" {
  type        = string
  description = "Amazon Polly engine: generative | neural | standard. Must be supported by polly_voice."
  default     = "generative"
}

variable "moot_player_position" {
  type        = string
  description = "Which side counsel argues; selects the judge's question themes. Appellant | Respondent."
  default     = "Appellant"

  validation {
    condition     = contains(["Appellant", "Respondent"], var.moot_player_position)
    error_message = "moot_player_position must be Appellant or Respondent."
  }
}

variable "moot_room_name" {
  type        = string
  description = "LiveKit room name the app uses. The single-session lock and webhook release key off this room."
  default     = "mootcourt"
}

variable "agent_log_retention_days" {
  type        = number
  description = "CloudWatch log retention (days) for the agent's ECS logs."
  default     = 7
}
