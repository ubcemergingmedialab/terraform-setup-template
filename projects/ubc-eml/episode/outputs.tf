# TODO: declare outputs (site_url, api_endpoint, etc.) for the modules this project uses.
# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------

output "knowledgebase_source_bucket" {
  value = aws_s3_bucket.knowledgebase_source.bucket
}

output "s3_vector_bucket_name" {
  value = aws_s3vectors_vector_bucket.knowledge_base.vector_bucket_name
}

output "s3_vector_index_arn" {
  value = aws_s3vectors_index.knowledge_base_default.arn
}

output "bedrock_knowledge_base_id" {
  value = aws_bedrockagent_knowledge_base.episode.id
}

output "bedrock_data_source_id" {
  value = aws_bedrockagent_data_source.episode_s3.data_source_id
}

output "bedrock_guardrail_id" {
  value = aws_bedrock_guardrail.episode.guardrail_id
}

output "bedrock_guardrail_version" {
  value = "DRAFT"
}

output "chat_backend_lambda_url" {
  value = aws_lambda_function_url.chat_backend.function_url
}

output "polly_lambda_url" {
  value = aws_lambda_function_url.polly.function_url
}

output "cognito_identity_pool_id" {
  value = aws_cognito_identity_pool.transcribe.id
}