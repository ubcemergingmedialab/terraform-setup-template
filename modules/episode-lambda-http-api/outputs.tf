output "function_names" { value = { for key, function in aws_lambda_function.this : key => function.function_name } }
output "function_arns" { value = { for key, function in aws_lambda_function.this : key => function.arn } }
output "execution_role_names" { value = { for key, role in aws_iam_role.lambda : key => role.name } }
output "execution_role_arns" { value = { for key, role in aws_iam_role.lambda : key => role.arn } }
output "api_endpoint" { value = aws_apigatewayv2_stage.default.invoke_url }
output "api_id" { value = aws_apigatewayv2_api.this.id }
output "api_execution_arn" { value = aws_apigatewayv2_api.this.execution_arn }
output "log_group_names" { value = { for key, log_group in aws_cloudwatch_log_group.lambda : key => log_group.name } }