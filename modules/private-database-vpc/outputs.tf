output "vpc_id" {
  description = "ID of the private database VPC."
  value       = aws_vpc.this.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs keyed by Availability Zone."
  value       = { for availability_zone, subnet in aws_subnet.private : availability_zone => subnet.id }
}

output "private_subnet_id_list" {
  description = "Private subnet IDs in the requested Availability Zone order."
  value       = [for availability_zone in var.availability_zones : aws_subnet.private[availability_zone].id]
}