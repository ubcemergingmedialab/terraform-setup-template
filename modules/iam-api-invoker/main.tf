resource "aws_iam_user" "this" {
  name = "${var.name_prefix}-api-invoker"
}

resource "aws_iam_user_policy" "invoke_api" {
  name = "${var.name_prefix}-invoke-api"
  user = aws_iam_user.this.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "execute-api:Invoke"
      Resource = var.allowed_route_arns
    }]
  })
}

resource "aws_iam_access_key" "this" {
  user = aws_iam_user.this.name
}
