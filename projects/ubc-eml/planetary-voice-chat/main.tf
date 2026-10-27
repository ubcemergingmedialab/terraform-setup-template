locals {
  name_prefix = "${var.client_name}-${var.project_name}-${var.environment}"
}

# ------------------------------------------------------------------------------
# Chat: Unity -> Function URL -> Lambda -> Amazon Bedrock -> text
# Unity POSTs { messages, systemPrompt } and gets back { text }.
# ------------------------------------------------------------------------------
module "chat_backend" {
  source = "../../../modules/bedrock-chat-backend"

  name_prefix      = local.name_prefix
  source_path      = "${path.module}/lambda/chat-backend"
  bedrock_model_id = var.bedrock_model_id

  bedrock_model_arns = var.bedrock_model_arns

  # Public Function URL gated by a shared secret the handler checks. This is the
  # reliable path for a shipped client that can't SigV4-sign (same choice as poetryhouse).
  invoke_mode         = "BUFFERED"
  auth_type           = "NONE"
  shared_secret       = var.chat_shared_secret
  create_invoker_user = false

  tags = var.tags
}

# ------------------------------------------------------------------------------
# Text-to-speech: Unity -> Function URL -> Lambda -> Amazon Polly -> audio (base64)
# Unity POSTs { text, voiceId? } and gets back { audioBase64, contentType }.
# ------------------------------------------------------------------------------
module "tts_backend" {
  source = "../../../modules/polly-tts-backend"

  name_prefix = local.name_prefix
  source_path = "${path.module}/lambda/tts-backend"

  default_voice_id      = var.polly_default_voice_id
  default_engine        = var.polly_default_engine
  default_output_format = var.polly_default_output_format

  auth_type           = "NONE"
  shared_secret       = var.chat_shared_secret
  create_invoker_user = false

  tags = var.tags
}

# ------------------------------------------------------------------------------
# Speech-to-text (record-then-transcribe): Unity -> Function URL -> Lambda ->
# S3 scratch + Amazon Transcribe batch -> text
# Unity records a clip, POSTs { audioBase64, mediaFormat }, gets back { text }.
# No proxy, no streaming.
# ------------------------------------------------------------------------------
module "transcribe_backend" {
  source = "../../../modules/transcribe-batch-backend"

  name_prefix = local.name_prefix
  source_path = "${path.module}/lambda/transcribe-backend"

  language_code          = var.transcribe_language_code
  timeout_seconds        = var.transcribe_timeout_seconds
  object_expiration_days = var.transcribe_object_expiration_days

  auth_type           = "NONE"
  shared_secret       = var.chat_shared_secret
  create_invoker_user = false

  tags = var.tags
}
