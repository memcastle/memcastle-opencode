# MemCastle for OpenCode

Release delivery uses gh-ship: releasable Conventional Commits open a `release/next` PR on pushes to `main`.
Review and merge that PR to publish a validated `opencode/vVERSION` archive. Configure the `release` environment
with `APP_CLIENT_ID` (variable) and `APP_PRIVATE_KEY` (secret) for a GitHub App installed on this repository with
contents, actions and pull requests write permissions (issues write for creating labels). Set squash title to PR title
and squash message to blank. `prepare-release` accepts `dry_run` without pushing.

OpenCode coding-agent history and lifecycle integration.

This provider plugin owns the versioned package, while each module has its own lifecycle.
Installing the plugin makes its modules available; enable sources and install integrations separately.

The plugin and both of its independently activated modules are named `opencode`, as in the Pi provider.
The source keeps the `since` and `dir` options, permission grants and per-source cursor.

Install Bun, Rust with the `wasm32-wasip2` target and a MemCastle Core binary.
For local development and review:

```sh
python3 scripts/package.py
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/check_modules.py
python3 -m unittest discover -s tests
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py --legacy
PATH="$PWD/modules/opencode/fixtures/bin:$PATH" /path/to/memcastle source test modules/opencode --no-build
```

The archive in `dist/` is independently releasable from MemCastle Core.
The root `plugin.toml` declares stable module identities; the package script fills artifact hashes after building.
Commit each source module's generated `Cargo.lock` before publishing a release.
The source module carries the versioned public WIT contract and its own fixtures; the agent integration uses MCP/HTTP.
No module needs a private Core checkout or a sibling provider to build or test.
The smoke check starts an isolated daemon and uses a temporary agent configuration to verify the archive install path.
Provider CI builds the archive locally, then calls Core's shared artifact-validation workflow to test source fixtures
and install/activate the plugin against the
permanent `main` prerelease, reporting its exact Core SHA.
`core-versions` can add exact plugin-capable stable releases to the full matrix; stable Core 0.4.1 predates plugin
installation and is not eligible. OpenCode's legacy adoption smoke runs on every matrix leg.
Core CI separately tests the generated plugin contract against its current checkout.
OpenCode's publish workflow accepts only an `opencode/v<plugin.toml version>` tag on `main`, then rebuilds the exact
reviewed artifact and runs the compatibility matrix before uploading to a draft release.

## Moving an existing installation

An installed legacy `opencode` source must be disabled and removed before installing the plugin;
removing its package does not erase its mined drawers, source cursor or checkpoint history.
Preview the plugin archive for the exact permission digest and adoption requirement, then install it with
`--consent opencode=<digest> --adopt-source opencode` if history has already been mined.
Enable `opencode` explicitly afterwards; keep existing miner settings, including `since` and `dir`.
The agent integration is installed separately with `memcastle integration install opencode`.
Older Core releases bundle a legacy OpenCode integration; use an assets root without it when checking an installed
plugin against those releases, since two packages offering the same public integration ID cannot be installed together.

Review and commit the archive hashes in `plugin.toml` and `modules/opencode/Cargo.lock` before merging the Release PR.
The publish workflow rebuilds and refuses a changed manifest.
