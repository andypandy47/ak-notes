# Deployment and releases

## Preview stack and app test builds

`.github/workflows/deploy-api.yml` runs on pushes to `main`, pull requests, and manual runs. It
verifies the API, migrates the preview D1 database, and uploads a uniquely tagged preview Worker
version. The generated Worker preview URL is passed directly to the dependent Windows and
Android builds as `VITE_API_URL`, so each app artifact targets the API version from the same
commit. Preview builds also set `VITE_APP_ENV=preview` and merge
`src-tauri/tauri.preview.conf.json`, giving them the distinct `com.aknotes.preview` Tauri
identifier and app-data directory. Local development uses `npm run tauri:dev --workspace app`
to merge `src-tauri/tauri.local.conf.json` and use `com.aknotes.local`. Production keeps the base
`com.aknotes` identifier. The separate directories isolate SQLite data, Stronghold state, and
credentials between all three environments. Set `VITE_APP_ENV` and the matching Tauri config
explicitly whenever a custom build targets a different API environment. Preview artifacts set
`VITE_ENABLE_QUERY_DEVTOOLS=true` so TanStack Query Devtools remain available in the packaged
production-mode bundle; production releases omit the flag and do not mount the tools.

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
