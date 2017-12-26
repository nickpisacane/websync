provider "aws" {
    region = "us-west-2"
}

resource "aws_s3_bucket" "websync_basic_example_bucket" {
    bucket = "websync-basic-example-bucket"
    acl = "public-read"
    policy = "${file("${path.module}/bucket_policy.json")}"
    website {
        index_document = "index.html"
        error_document = "error.html"
    }
}

resource "aws_cloudfront_distribution" "websyc_basic_example_dist" {
    enabled = true 
    default_root_object = "index.html"
    origin {
        domain_name = "${aws_s3_bucket.websync_basic_example_bucket.bucket_domain_name}"
        origin_id = "websync-basic-example"
    }
    restrictions = {
        geo_restriction {
           restriction_type = "none"
        }
    }
    viewer_certificate {
        cloudfront_default_certificate = true
    }
    default_cache_behavior {
        allowed_methods = ["GET", "HEAD", "DELETE", "OPTIONS", "PATCH", "PUT", "POST"]
        cached_methods = ["GET", "HEAD"]
        forwarded_values {
            query_string = false
            cookies {
                forward = "none"
            }
        }
        min_ttl = 0
        default_ttl = 3600
        max_ttl = 86400
        target_origin_id = "websync-basic-example"
        compress = true
        viewer_protocol_policy = "redirect-to-https"
    }
}