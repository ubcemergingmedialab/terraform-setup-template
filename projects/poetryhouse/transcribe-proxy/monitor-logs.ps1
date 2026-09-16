# Monitor Fargate container logs in real-time
$logGroup = "/ecs/poetry-transcribe-dev"

Write-Host "Monitoring logs for $logGroup (Press Ctrl+C to stop)" -ForegroundColor Green
Write-Host ""

aws logs tail $logGroup --follow --region ca-central-1 --format short
