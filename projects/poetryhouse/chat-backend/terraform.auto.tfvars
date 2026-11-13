client_name  = "poetry"
project_name = "chat"
environment  = "dev"
aws_region   = "ca-central-1"
alarm_email = "dante.cerron@ubc.ca"
max_input_chars = 20000
max_messages = 50

tags = {
  Owner = "emerging-media-lab"
  Repo  = "PoetryHouse"
}

# Bedrock model the chat Lambda calls. In ca-central-1 the current Claude models
# are only invokable via cross-region inference profiles (us.* / global.*), so we
# use the Sonnet 4.6 global inference-profile ID rather than a bare foundation-model ID.
bedrock_model_id = "global.anthropic.claude-sonnet-4-6"

# chat_shared_secret is intentionally NOT set here — this file is committed to VCS.
# It's provided at apply time as a sensitive HCP workspace variable (see below).

# Optional: restrict which model ARNs the Lambda may invoke (default: any).
# bedrock_model_arns = [
#   "arn:aws:bedrock:ca-central-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
# ]

# Bedrock Guardrail denied topics (blocked in input and output). Empty until stakeholders decide.
# guardrail_denied_topics = [
#   {
#     name       = "example-topic"
#     definition = "Short natural-language description of what to block."
#     examples   = ["Example phrase a user might say."]
#   },
# ]
