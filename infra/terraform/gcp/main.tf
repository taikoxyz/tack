locals {
  common_labels = {
    app        = "tack"
    managed_by = "terraform"
  }
}

resource "google_project_service" "artifactregistry" {
  project            = var.project_id
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "tack" {
  project       = var.project_id
  location      = var.repository_location
  repository_id = var.repository_id
  format        = "DOCKER"
  description   = var.repository_description

  labels = local.common_labels

  depends_on = [google_project_service.artifactregistry]
}

resource "google_service_account" "github_actions_tack_gar" {
  project      = var.project_id
  account_id   = var.gar_service_account_id
  display_name = var.gar_service_account_display_name
}

resource "google_project_iam_member" "github_actions_tack_gar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions_tack_gar.email}"
}

resource "google_compute_global_address" "tack_gateway" {
  project = var.project_id
  name    = var.gateway_address_name

  depends_on = [google_project_service.compute]
}

resource "google_compute_address" "tack_kubo_swarm" {
  project = var.project_id
  region  = var.region
  name    = var.swarm_address_name

  depends_on = [google_project_service.compute]
}

resource "google_compute_managed_ssl_certificate" "tack_gateway" {
  project = var.project_id
  name    = var.managed_certificate_name

  managed {
    domains = var.managed_certificate_domains
  }

  depends_on = [google_project_service.compute]
}

resource "google_compute_security_policy" "tack" {
  project     = var.project_id
  name        = var.cloud_armor_policy_name
  description = "Rate-limit policy for Tack API"

  rule {
    action   = "rate_based_ban"
    priority = 1000

    match {
      expr {
        expression = "true"
      }
    }

    rate_limit_options {
      rate_limit_threshold {
        count        = var.cloud_armor_rate_limit_count
        interval_sec = var.cloud_armor_rate_limit_interval_sec
      }

      ban_duration_sec = var.cloud_armor_ban_duration_sec
      conform_action   = "allow"
      exceed_action    = "deny(429)"
      enforce_on_key   = "IP"
    }

    description = "Default per-IP rate limit"
  }

  rule {
    action   = "allow"
    priority = 2147483647

    match {
      versioned_expr = "SRC_IPS_V1"

      config {
        src_ip_ranges = ["*"]
      }
    }

    description = "Default allow"
  }

  depends_on = [google_project_service.compute]
}
