client_name  = "ubc-eml"
project_name = "np-chat"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "emerging-media-lab"
  Repo  = "NursePractitioner"
}

# Bedrock model the chat Lambda calls. Global cross-region inference profile for
# Claude Sonnet 4.6 (enabled for this account); invokable from any region.
bedrock_model_id = "global.anthropic.claude-sonnet-4-6"

# chat_shared_secret is intentionally NOT set here — this file is committed to VCS.
# It's provided at apply time as a sensitive HCP workspace variable
# (ubc-eml-np-chat -> Variables -> add chat_shared_secret, mark Sensitive).

# Optional: restrict which model ARNs the Lambda may invoke (default: any).
# bedrock_model_arns = [
#   "arn:aws:bedrock:ca-central-1::foundation-model/anthropic.claude-sonnet-4-6"
# ]
