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

variable "user_group_name" {
  type        = string
  description = "Optional Cognito user group to create (e.g. a single admin/approved group that gates app access). Leave empty to create no group."
  default     = ""
}

variable "user_group_description" {
  type        = string
  description = "Description for the user group created when user_group_name is set."
  default     = "Approved users allowed to access the app."
}

variable "seed_user_email" {
  type        = string
  description = "Optional email of a single user to seed into the pool (admin-created, no self sign-up). Leave empty to create no user. When user_group_name is also set, the user is added to that group."
  default     = ""
}

variable "allow_self_signup" {
  type        = bool
  description = "Allow public self sign-up. Default false locks the pool to admin-created users only (the lockdown posture for single-tenant apps)."
  default     = false
}
