# Test WebSocket connection manually using websocat or wscat
# Install websocat: choco install websocat
# Or install wscat: npm install -g wscat

$albDns = (aws elbv2 describe-load-balancers --region ca-central-1 --query "LoadBalancers[?LoadBalancerName=='poetry-transcribe-dev-alb'].DNSName" --output text)
$wsUrl = "ws://$albDns"

Write-Host "WebSocket URL: $wsUrl" -ForegroundColor Green
Write-Host ""
Write-Host "To test manually:" -ForegroundColor Yellow
Write-Host "  1. Install wscat: npm install -g wscat"
Write-Host "  2. Run: wscat -c $wsUrl"
Write-Host "  3. Type 'test' and press enter to send a text message"
Write-Host ""
Write-Host "Or with websocat:" -ForegroundColor Yellow
Write-Host "  1. Install: choco install websocat"
Write-Host "  2. Run: websocat $wsUrl"
Write-Host ""
