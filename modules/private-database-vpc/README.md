# `private-database-vpc`

Creates a private VPC for a database deployment. It includes DNS support, one
private subnet and route table per requested Availability Zone, and no Internet
Gateway, NAT Gateway, or public subnet.

This is suitable for Aurora used through the RDS Data API. The API Lambda does
not need VPC attachment, so this module intentionally creates only the network
resources required by Aurora.