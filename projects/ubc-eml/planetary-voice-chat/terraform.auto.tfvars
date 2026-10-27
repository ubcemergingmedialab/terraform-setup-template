# Filled-in values for this project (committed; no secrets).
#
# DO NOT put chat_shared_secret, AWS credentials, or any other secret here.
# Set chat_shared_secret as a SENSITIVE variable in the HCP workspace instead.

client_name  = "ubc-eml"
project_name = "planetary-voice-chat"
environment  = "prod"
aws_region   = "ca-central-1"

# Chat
bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"

# Text-to-speech
polly_default_voice_id      = "Ruth"
polly_default_engine        = "neural"
polly_default_output_format = "mp3"

# Speech-to-text
transcribe_language_code          = "en-US"
transcribe_timeout_seconds        = 120
transcribe_object_expiration_days = 1

tags = {
  Owner = "emerging-media-lab"
}
