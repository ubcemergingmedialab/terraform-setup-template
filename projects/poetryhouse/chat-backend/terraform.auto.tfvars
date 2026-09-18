client_name  = "poetry"
project_name = "chat"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "emerging-media-lab"
  Repo  = "PoetryHouse"
}

# Bedrock model the chat Lambda calls. For cross-region Anthropic models use an
# inference-profile ID, e.g. "us.anthropic.claude-3-5-sonnet-20241022-v2:0".
bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"

# Optional: restrict which model ARNs the Lambda may invoke (default: any).
# bedrock_model_arns = [
#   "arn:aws:bedrock:ca-central-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
# ]
