output "function_name" { value = aws_lambda_function.this.function_name }
output "function_arn" { value = aws_lambda_function.this.arn }
output "execution_role_name" { value = aws_iam_role.lambda.name }
output "execution_role_arn" { value = aws_iam_role.lambda.arn }
output "api_endpoint" { value = aws_apigatewayv2_stage.default.invoke_url }
output "api_id" { value = aws_apigatewayv2_api.this.id }
output "api_execution_arn" { value = aws_apigatewayv2_api.this.execution_arn }
output "log_group_name" { value = aws_cloudwatch_log_group.lambda.name }