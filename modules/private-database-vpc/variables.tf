variable "name_prefix" {
  type        = string
  description = "Prefix for VPC and subnet resources."
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the new VPC."
  default     = "10.42.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "At least two Availability Zones in the provider region."

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two Availability Zones are required for the private database subnets."
  }
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "One private subnet CIDR per Availability Zone."

  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.availability_zones)
    error_message = "private_subnet_cidrs must contain exactly one CIDR per Availability Zone."
  }
}

variable "cognito_password_minimum_length" {
  type        = number
  description = "Minimum password length for the Cognito user pool."
  default     = 12
}