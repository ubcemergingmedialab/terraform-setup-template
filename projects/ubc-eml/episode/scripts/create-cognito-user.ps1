param(
    [Parameter(Mandatory = $true)]
    [string]$UserPoolId,

    [Parameter(Mandatory = $true)]
    [string]$Email,

    [ValidateSet("admin", "instructor")]
    [string]$Group = "admin",

    [string]$Region = "ca-central-1",

    [string]$FirstName = "",

    [string]$LastName = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI was not found on PATH. Install it and run 'aws configure' or select the correct AWS profile first."
}

$password = Read-Host "Permanent password for $Email" -AsSecureString
$passwordText = [System.Net.NetworkCredential]::new("", $password).Password

if ($passwordText.Length -lt 12 -or $passwordText -notmatch "[a-z]" -or $passwordText -notmatch "[A-Z]" -or $passwordText -notmatch "[0-9]") {
    throw "The password must be at least 12 characters and include lowercase, uppercase, and a number."
}

$attributes = @(
    "Name=email,Value=$Email",
    "Name=email_verified,Value=true"
)

if ($FirstName) {
    $attributes += "Name=given_name,Value=$FirstName"
}

if ($LastName) {
    $attributes += "Name=family_name,Value=$LastName"
}

Write-Host "Creating Cognito user $Email in $UserPoolId..." -ForegroundColor Cyan
aws cognito-idp admin-create-user `
    --region $Region `
    --user-pool-id $UserPoolId `
    --username $Email `
    --user-attributes $attributes `
    --message-action SUPPRESS `
    --output json | Out-Null

aws cognito-idp admin-set-user-password `
    --region $Region `
    --user-pool-id $UserPoolId `
    --username $Email `
    --password $passwordText `
    --permanent

aws cognito-idp admin-add-user-to-group `
    --region $Region `
    --user-pool-id $UserPoolId `
    --username $Email `
    --group-name $Group

Write-Host "Created $Email and assigned the '$Group' group." -ForegroundColor Green
Write-Host "Use the Episode app client ID with USER_PASSWORD_AUTH in Postman to obtain an access token."