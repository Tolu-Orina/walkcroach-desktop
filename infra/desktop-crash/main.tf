# Desktop crash ingest — thin Lambda (PE.9 / PE.10)
# Opt-in client path independent of enableTelemetry=false (NFR-F17).
# Scale-to-$0: pay per invocation; no VPC; no Cognito/CRDB.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "zip_path" {
  type        = string
  description = "Path to packaged crash Lambda zip"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "crash" {
  name               = "${var.name_prefix}-${var.environment}-desktop-crash"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.crash.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "crash" {
  name              = "/aws/lambda/${var.name_prefix}-${var.environment}-desktop-crash"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_lambda_function" "crash" {
  function_name    = "${var.name_prefix}-${var.environment}-desktop-crash"
  role             = aws_iam_role.crash.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = var.zip_path
  source_code_hash = filebase64sha256(var.zip_path)
  timeout          = 10
  memory_size      = 128
  tags             = var.tags

  environment {
    variables = {
      ENVIRONMENT = var.environment
      # Never enable prompt/body capture
      ALLOW_BODY_FIELDS = "false"
    }
  }

  depends_on = [aws_cloudwatch_log_group.crash]
}

resource "aws_apigatewayv2_api" "crash" {
  name          = "${var.name_prefix}-${var.environment}-desktop-crash"
  protocol_type = "HTTP"
  tags          = var.tags
}

resource "aws_apigatewayv2_integration" "crash" {
  api_id                 = aws_apigatewayv2_api.crash.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.crash.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "crash" {
  api_id    = aws_apigatewayv2_api.crash.id
  route_key = "POST /desktop/v1/crash"
  target    = "integrations/${aws_apigatewayv2_integration.crash.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.crash.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.crash.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.crash.execution_arn}/*/*"
}

output "crash_api_endpoint" {
  value = aws_apigatewayv2_api.crash.api_endpoint
}

output "crash_post_path" {
  value = "/desktop/v1/crash"
}

output "lambda_name" {
  value = aws_lambda_function.crash.function_name
}
