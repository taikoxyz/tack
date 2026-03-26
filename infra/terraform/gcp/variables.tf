variable "project_id" {
  description = "GCP project ID that hosts Tack production resources."
  type        = string
}

variable "region" {
  description = "Primary GCP region for Tack resources."
  type        = string
  default     = "us-central1"
}

variable "repository_location" {
  description = "Artifact Registry location for Tack images."
  type        = string
  default     = "us-central1"
}

variable "repository_id" {
  description = "Artifact Registry repository ID."
  type        = string
  default     = "tack"
}

variable "repository_description" {
  description = "Artifact Registry repository description."
  type        = string
  default     = "Tack container images"
}

variable "gar_service_account_id" {
  description = "Service account ID used by GitHub Actions to push images."
  type        = string
  default     = "github-actions-tack-gar"
}

variable "gar_service_account_display_name" {
  description = "Display name for the GitHub Actions GAR service account."
  type        = string
  default     = "GitHub Actions GAR pusher"
}

variable "gateway_address_name" {
  description = "Global static IP name for the Tack HTTP gateway."
  type        = string
  default     = "tack-taiko-xyz"
}

variable "swarm_address_name" {
  description = "Regional static IP name for the public Kubo swarm service."
  type        = string
  default     = "tack-kubo-swarm"
}

variable "managed_certificate_name" {
  description = "Managed SSL certificate name for Tack."
  type        = string
  default     = "ssl-certificate-tack-taiko-xyz"
}

variable "managed_certificate_domains" {
  description = "Domains served by the managed SSL certificate."
  type        = list(string)
  default     = ["tack.taiko.xyz"]
}

variable "cloud_armor_policy_name" {
  description = "Cloud Armor security policy name."
  type        = string
  default     = "tack-armor-policy"
}

variable "cloud_armor_rate_limit_count" {
  description = "Maximum requests per interval per IP before a ban is applied."
  type        = number
  default     = 100
}

variable "cloud_armor_rate_limit_interval_sec" {
  description = "Rate-limit interval in seconds."
  type        = number
  default     = 60
}

variable "cloud_armor_ban_duration_sec" {
  description = "Cloud Armor ban duration in seconds."
  type        = number
  default     = 300
}
