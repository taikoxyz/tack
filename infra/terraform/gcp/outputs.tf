output "artifact_registry_repository" {
  description = "Artifact Registry repository resource name."
  value       = google_artifact_registry_repository.tack.name
}

output "artifact_registry_repository_url" {
  description = "Artifact Registry Docker host/repository path."
  value       = "${var.repository_location}-docker.pkg.dev/${var.project_id}/${var.repository_id}"
}

output "github_actions_gar_service_account_email" {
  description = "GitHub Actions service account email for GAR pushes."
  value       = google_service_account.github_actions_tack_gar.email
}

output "gateway_ip_name" {
  description = "Global static IP name for the Tack gateway."
  value       = google_compute_global_address.tack_gateway.name
}

output "gateway_ip_address" {
  description = "Global static IP address for the Tack gateway."
  value       = google_compute_global_address.tack_gateway.address
}

output "kubo_swarm_ip_name" {
  description = "Regional static IP name for the public Kubo swarm service."
  value       = google_compute_address.tack_kubo_swarm.name
}

output "kubo_swarm_ip_address" {
  description = "Regional static IP address for the public Kubo swarm service."
  value       = google_compute_address.tack_kubo_swarm.address
}

output "managed_certificate_name" {
  description = "Managed SSL certificate resource name."
  value       = google_compute_managed_ssl_certificate.tack_gateway.name
}

output "cloud_armor_policy_name" {
  description = "Cloud Armor security policy name."
  value       = google_compute_security_policy.tack.name
}
