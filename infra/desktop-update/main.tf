# Desktop update CDN — S3 + CloudFront (PE.5 / PE.10)
# Scale-to-$0 idle: storage + request pricing only; no always-on compute.
# Wire from infra-backend root when DNS / ACM ready; safe to plan locally.

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

variable "enable_cloudfront" {
  type    = bool
  default = false
  description = "Set true when ACM cert in us-east-1 exists for updates.walkcroach.dev"
}

resource "aws_s3_bucket" "updates" {
  bucket = "${var.name_prefix}-${var.environment}-desktop-updates"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "updates" {
  bucket                  = aws_s3_bucket.updates.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "updates" {
  bucket = aws_s3_bucket.updates.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "updates" {
  bucket = aws_s3_bucket.updates.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Channel prefixes (objects published by CI)
resource "aws_s3_object" "stable_keep" {
  bucket       = aws_s3_bucket.updates.id
  key          = "desktop/stable/.keep"
  content      = ""
  content_type = "text/plain"
}

resource "aws_s3_object" "insiders_keep" {
  bucket       = aws_s3_bucket.updates.id
  key          = "desktop/insiders/.keep"
  content      = ""
  content_type = "text/plain"
}

output "updates_bucket_name" {
  value = aws_s3_bucket.updates.bucket
}

output "updates_bucket_arn" {
  value = aws_s3_bucket.updates.arn
}

output "channel_prefixes" {
  value = {
    stable   = "desktop/stable/"
    insiders = "desktop/insiders/"
  }
}
