# Filled-in values for this project (committed; no secrets).
#
# DO NOT put chat_shared_secret, AWS credentials, or any other secret here.
# Set chat_shared_secret as a SENSITIVE variable in the HCP workspace instead.

client_name  = "ubc-eml"
project_name = "planetary-voice-chat"
environment  = "prod"
aws_region   = "ca-central-1"

# Chat
# Claude Haiku 5.5 cannot be invoked on-demand by its base ID (anthropic.claude-haiku-5-5);
# use the global cross-Region inference profile ID.
bedrock_model_id = "global.anthropic.claude-haiku-5-5"

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
