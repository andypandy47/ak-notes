# Deployment and releases

## Preview stack and app test builds

`.github/workflows/deploy-api.yml` runs on pushes to `main`, pull requests, and manual runs. It
verifies the API, migrates the preview D1 database, and uploads a uniquely tagged preview Worker
version. The generated Worker preview URL is passed directly to the dependent Windows and
Android builds as `VITE_API_URL`, so each app artifact targets the API version from the same
commit.

Create a GitHub environment named `preview` with environment secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs permission to upload Workers
and edit the preview D1 database, scoped to the relevant Cloudflare account. Migrations run
before the Worker upload, and a migration failure prevents both app builds.

The workflow builds unsigned Windows debug bundles and an Android debug APK. Outputs are stored
as GitHub Actions artifacts for 14 days; the workflow does not create Git tags or GitHub
Releases. The Android project is generated non-interactively on the runner before each build, so
`app/src-tauri/gen/android` does not need to be committed solely for CI.

Pull requests from forks cannot access the Cloudflare environment secrets. The preview deploy
and its dependent app builds are therefore skipped for fork-originated pull requests.

These packages are intended for testing. A distributable release still requires Windows code
signing and an Android release keystore.
