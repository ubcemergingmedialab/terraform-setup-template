# Check ECS task and ALB status
$cluster = "poetry-transcribe-dev-cluster"
$service = "poetry-transcribe-dev-service"
$albArn = (aws elbv2 describe-load-balancers --region ca-central-1 --query "LoadBalancers[?LoadBalancerName=='poetry-transcribe-dev-alb'].LoadBalancerArn" --output text)

Write-Host "=== ECS Service Status ===" -ForegroundColor Cyan
aws ecs describe-services --cluster $cluster --services $service --region ca-central-1 --query "services[0].[serviceName,status,runningCount,desiredCount]" --output table

Write-Host "`n=== Running Tasks ===" -ForegroundColor Cyan
aws ecs list-tasks --cluster $cluster --service-name $service --region ca-central-1 --query "taskArns" --output table

Write-Host "`n=== ALB Target Health ===" -ForegroundColor Cyan
$targetGroupArn = (aws elbv2 describe-target-groups --load-balancer-arn $albArn --region ca-central-1 --query "TargetGroups[0].TargetGroupArn" --output text)
aws elbv2 describe-target-health --target-group-arn $targetGroupArn --region ca-central-1 --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]" --output table

Write-Host "`n=== ALB DNS Name ===" -ForegroundColor Cyan
aws elbv2 describe-load-balancers --load-balancer-arns $albArn --region ca-central-1 --query "LoadBalancers[0].DNSName" --output text
