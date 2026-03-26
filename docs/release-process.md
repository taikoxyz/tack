# Release Process

Tack releases are tag-driven.

The `release` workflow will publish a GitHub release only when:
- the pushed tag matches `package.json` (`v${version}`)
- `CHANGELOG.md` contains a matching `## [vX.Y.Z] - YYYY-MM-DD` section
- lint, typecheck, tests, typos, and the Docker image build all pass

## Required GitHub Actions configuration

The `release` workflow itself needs no extra repository configuration beyond the default GitHub token.

Image publishing is handled by `.github/workflows/docker.yml` and requires:

- `GAR_JSON_KEY`

GKE rollout is handled by `.github/workflows/deploy-gke.yml`. Its required inputs are documented in `infra/terraform/gcp/README.md`.

## Cut a release

1. Update `package.json` to the next version.
2. Add the matching release section to `CHANGELOG.md`.
3. Merge the release commit to `main`.
4. Push a semver tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. Wait for `.github/workflows/docker.yml` to publish the `api` and `kubo` images for that tag.
6. Run `.github/workflows/deploy-gke.yml` with `release_tag=vX.Y.Z`.

## What the workflow does

1. Re-runs release gates: typos, lint, typecheck, tests, build, and Docker build.
2. Verifies the release tag matches `package.json`.
3. Verifies that `CHANGELOG.md` contains a matching release section.
4. Creates or updates the GitHub Release from the matching `CHANGELOG.md` section.

Deployment is intentionally separate now. That keeps tag creation safe even when deployment credentials or cluster state are unavailable, and it aligns the repo with the current GKE + Helm production path.
