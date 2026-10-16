variable "name_prefix" {
  type = string
}

variable "callback_urls" {
  type    = list(string)
  default = []
}

variable "logout_urls" {
  type    = list(string)
  default = []
}

variable "mfa_required" {
  type    = bool
  default = false
}

variable "password_minimum_length" {
  type    = number
  default = 12
}

variable "oauth_scopes" {
  type    = list(string)
  default = ["openid", "email"]
}

variable "hosted_ui_domain_prefix" {
  type    = string
  default = ""
}