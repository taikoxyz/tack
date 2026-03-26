# Tack GCP Terraform

This stack manages the stable GCP primitives behind Tack production:

- Artifact Registry repository for `api` and `kubo` images
- GitHub Actions GAR push service account and IAM binding
- Global static IP for the public HTTP gateway
- Regional static IP for the public Kubo swarm service
- Managed SSL certificate for `tack.taiko.xyz`
- Cloud Armor rate-limit policy

It intentionally does **not** manage:

- the GKE cluster itself
- Kubernetes secrets
- Helm releases
- DNS
- service account keys

## Layout

```text
infra/terraform/gcp/
  versions.tf
  variables.tf
  main.tf
  outputs.tf
  terraform.tfvars.example
```

## Usage

```bash
cd infra/terraform/gcp
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

For shared production use, move state to a remote backend before the first team-managed apply. A GCS backend in the same project is the simplest follow-up.

## Adopt Existing Production Resources

The current production resources were created manually already. Import them before the first `apply`:

```bash
cd infra/terraform/gcp

terraform init

terraform import google_artifact_registry_repository.tack \
  "projects/mainnet-trailblazer/locations/us-central1/repositories/tack"

terraform import google_service_account.github_actions_tack_gar \
  "projects/mainnet-trailblazer/serviceAccounts/github-actions-tack-gar@mainnet-trailblazer.iam.gserviceaccount.com"

terraform import google_project_iam_member.github_actions_tack_gar_writer \
  "mainnet-trailblazer roles/artifactregistry.writer serviceAccount:github-actions-tack-gar@mainnet-trailblazer.iam.gserviceaccount.com"

terraform import google_compute_global_address.tack_gateway \
  "projects/mainnet-trailblazer/global/addresses/tack-taiko-xyz"

terraform import google_compute_address.tack_kubo_swarm \
  "projects/mainnet-trailblazer/regions/us-central1/addresses/tack-kubo-swarm"

terraform import google_compute_managed_ssl_certificate.tack_gateway \
  "projects/mainnet-trailblazer/global/sslCertificates/ssl-certificate-tack-taiko-xyz"

terraform import google_compute_security_policy.tack \
  "projects/mainnet-trailblazer/global/securityPolicies/tack-armor-policy"
```

If `artifactregistry.googleapis.com` and `compute.googleapis.com` are already enabled, `terraform apply` will converge the `google_project_service` resources without extra imports.

## GitHub Actions Inputs

The new deploy workflow in [`.github/workflows/deploy-gke.yml`](../../../.github/workflows/deploy-gke.yml) expects these repository variables:

- `GCP_PROJECT_ID`
- `GKE_CLUSTER_NAME`
- `GKE_CLUSTER_LOCATION`
- `TACK_KUBO_SWARM_STATIC_IP`
- `TACK_KUBO_ANNOUNCE_ADDRESS` (optional; defaults to `/ip4/$TACK_KUBO_SWARM_STATIC_IP/tcp/4001`)
- `X402_SMOKE_RPC_URL` (optional)
- `X402_SMOKE_CHAIN_ID` (optional)
- `X402_SMOKE_CID` (optional)

Recommended repository secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`
- or `GCP_CREDENTIALS_JSON`
- `X402_SMOKE_PAYER_PRIVATE_KEY` (optional)
- `ECOSYSTEM_K8S_CONFIGS_TOKEN` (optional, only needed if that repo is private)

Use Terraform outputs to populate:

- `GCP_PROJECT_ID` from `var.project_id`
- `TACK_KUBO_SWARM_STATIC_IP` from `kubo_swarm_ip_address`

## Deployment Flow

1. Merge a release-prep PR that bumps `package.json` and `CHANGELOG.md`.
2. Push a semver tag such as `v0.1.6`.
3. Let `.github/workflows/release.yml` verify the tag and publish the GitHub release.
4. Let `.github/workflows/docker.yml` publish tagged images to Artifact Registry.
5. Run `.github/workflows/deploy-gke.yml` with `release_tag=v0.1.6`.
