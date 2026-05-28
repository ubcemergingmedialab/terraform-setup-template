variable "name_prefix" {
  type        = string
  description = "Prefix for Cognito resources."
}

variable "callback_urls" {
  type        = list(string)
  description = "OAuth callback URLs for the app client (Hosted UI)."
  default     = []
}

variable "logout_urls" {
  type        = list(string)
  description = "OAuth sign-out URLs for the app client."
  default     = []
}

variable "mfa_required" {
  type        = bool
  description = "Require MFA for all users."
  default     = false
}

variable "password_minimum_length" {
  type        = number
  description = "Minimum password length."
  default     = 12
}

variable "oauth_scopes" {
  type        = list(string)
  description = "OAuth scopes for the app client."
  default     = ["openid", "email"]
}

variable "hosted_ui_domain_prefix" {
  type        = string
  description = "Optional explicit Cognito hosted UI domain prefix. Defaults to name_prefix with hyphens removed."
  default     = ""
}
