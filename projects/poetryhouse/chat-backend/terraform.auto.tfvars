client_name  = "poetry"
project_name = "chat"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "emerging-media-lab"
  Repo  = "PoetryHouse"
}

# Bedrock model the chat Lambda calls. In ca-central-1 the current Claude models
# are only invokable via cross-region inference profiles (us.* / global.*), so we
# use the Sonnet 4.6 global inference-profile ID rather than a bare foundation-model ID.
bedrock_model_id = "global.anthropic.claude-sonnet-4-6"

# Optional: restrict which model ARNs the Lambda may invoke (default: any).
# bedrock_model_arns = [
#   "arn:aws:bedrock:ca-central-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
# ]
