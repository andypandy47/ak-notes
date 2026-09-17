# Deployment and releases

## API production deployment

`.github/workflows/deploy-api.yml` verifies the API, applies all pending D1 migrations, and
then deploys the Worker. It runs for API changes pushed to `master` and can also be run
manually. GitHub serializes production deployments so migrations and Worker uploads cannot
overlap.

Create a GitHub environment named `production`, then configure:

- Environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The Cloudflare token needs permission to deploy Workers and edit the production D1 database.
Scope it to the relevant account. The production `aknotes-prod` D1 binding is declared under the
explicit `production` environment in `api/wrangler.jsonc`. CI always supplies
`--env production`; local commands use the separate top-level `aknotes-local` binding.

Migrations run before the Worker upload and a migration failure prevents deployment. Schema
changes should therefore use an expand-and-contract approach: add backwards-compatible schema
first, deploy code that uses it, and remove old schema in a later deployment.

## Desktop app releases

`.github/workflows/release-app.yml` builds Linux x64, Windows x64, macOS Intel, and macOS Apple
Silicon bundles and publishes them to one GitHub release. Configure repository variable
`VITE_API_URL` with the deployed API's HTTPS origin, without `/api/v1`.

Keep these versions equal before releasing:

- `app/package.json`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/Cargo.toml`

Push a tag matching the application version to publish a release. For version `0.1.0`:

```sh
git tag app-v0.1.0
git push origin app-v0.1.0
```

The workflow rejects a pushed tag that does not match `app/package.json`. A manual run uses the
version from `app/package.json` and creates the matching `app-v<version>` release.

The generated packages are currently unsigned. Before distributing to end users, configure
Apple notarization/signing and Windows code signing; unsigned builds can trigger operating
system warnings.
