client_name  = "ubc-eml"
project_name = "np-transcribe"
environment  = "dev"
aws_region   = "ca-central-1"

tags = {
  Owner = "emerging-media-lab"
  Repo  = "NursePractitioner"
}

# Container configuration
container_image_tag = "latest"

# Fargate sizing (start small, scale up if needed)
fargate_cpu       = 512  # 0.5 vCPU
fargate_memory_mb = 1024 # 1 GB

# Transcribe settings
transcribe_language_code = "en-US"

# Access control (0.0.0.0/0 = public, or restrict to specific IPs)
allowed_cidr_blocks = ["0.0.0.0/0"]

# transcribe_shared_secret is intentionally NOT set here — this file is committed.
# Provide it (optional) as a sensitive HCP workspace variable on ubc-eml-np-transcribe.

# Auto-scaling (optional - scale to 0 when idle)
enable_autoscaling       = true
autoscaling_min_capacity = 0 # Scale to zero when idle
autoscaling_max_capacity = 3 # Scale up to 3 tasks under load
autoscaling_cpu_target   = 70

# Logging
log_retention_days        = 7
enable_container_insights = false

# HTTPS (optional - requires ACM certificate)
enable_https    = false
certificate_arn = ""
