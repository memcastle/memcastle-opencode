# MemCastle for OpenCode

OpenCode coding-agent history and lifecycle integration.

This provider plugin owns the versioned package, while each module has its own lifecycle.
Installing the plugin makes its modules available; enable sources and install integrations separately.
Sources live in `sources/<id>/` and integrations in `integrations/<id>/`; typed modules may share an ID without
sharing their implementation files or activation state.

The plugin and both of its independently activated modules are named `opencode`, as in the Pi provider.
The source keeps the `since` and `dir` options, permission grants and per-source cursor.

Install Bun, Rust with the `wasm32-wasip2` target and a MemCastle Core binary.
For local development and review:

```sh
memcastle plugin inspect --json
# Build sources/opencode for wasm32-wasip2 and run bun run build in integrations/opencode first.
memcastle plugin package
memcastle plugin test dist/opencode-VERSION.tar.gz
node scripts/smoke_adoption.mjs
PATH="$PWD/sources/opencode/fixtures/bin:$PATH" memcastle source test sources/opencode --no-build
```

The archive in `dist/` is independently releasable from MemCastle Core.
The root `plugin.toml` is immutable; Core generates `manifest.toml` only inside the SCM-versioned archive with
release versions and artifact checksums. It also packages the shared root `skills/` directory.
Commit each source module's generated `Cargo.lock` before publishing a release.
The source module carries the versioned public WIT contract and its own fixtures; the agent integration uses MCP/HTTP.
No module needs a private Core checkout or a sibling provider to build or test.
The smoke check starts an isolated daemon and uses a temporary agent configuration to verify the archive install path.
Provider CI builds the archive locally, then calls Core's shared artifact-validation workflow to test source fixtures
and install/activate the plugin against the
permanent `main` prerelease, reporting its exact Core SHA.
`core_versions` can add plugin-capable stable release trees to the static matrix; stable Core 0.4.1 predates plugin
installation and is not eligible. OpenCode's legacy adoption smoke runs on every matrix leg.
Core CI separately tests the generated plugin contract against its current checkout.
OpenCode's release workflow validates the reviewed `opencode/vVERSION` tag on `main`, rebuilds the
exact artifact and runs the compatibility matrix before attaching it to gh-ship's draft release.

## Moving an existing installation

An installed legacy `opencode` source must be disabled and removed before installing the plugin;
removing its package does not erase its mined drawers, source cursor or checkpoint history.
Preview the plugin archive for the exact permission digest and adoption requirement, then install it with
`--consent opencode=<digest> --adopt-source opencode` if history has already been mined.
Enable `opencode` explicitly afterwards; keep existing miner settings, including `since` and `dir`.
The agent integration is installed separately with `memcastle integration install opencode`.
Older Core releases bundle a legacy OpenCode integration; use an assets root without it when checking an installed
plugin against those releases, since two packages offering the same public integration ID cannot be installed together.

Commit `sources/opencode/Cargo.lock` before release. gh-ship and git-cliff open a
reviewed `release/next` PR; configure `APP_CLIENT_ID` and `APP_PRIVATE_KEY` in the `release` environment for an
installed GitHub App. Native Cargo/Bun coverage and test results are uploaded to Codecov.
