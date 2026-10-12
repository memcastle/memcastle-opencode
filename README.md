# MemCastle for OpenCode

OpenCode coding-agent history and lifecycle integration.

This provider plugin owns the versioned package, while each module has its own lifecycle.
Installing the plugin makes its modules available; enable sources and install integrations separately.

The plugin is `opencode`; its source module is `opencode` and its integration module is
`opencode-integration`. Both expose the existing public name `opencode`.
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
Provider CI tests sources against the latest stable Core and installs the archive when that release supports plugins;
Core CI separately tests a freshly composed project against its current install contract.
The release workflow accepts only an `opencode/v<plugin.toml version>` tag on `main`, then rebuilds the exact
reviewed artifact, runs manifest tests and source conformance against a stable Core release, and refuses an existing release.

## Moving an existing installation

An installed legacy `opencode` source must be disabled and removed before installing the plugin;
removing its package does not erase its mined drawers, source cursor or checkpoint history.
Preview the plugin archive for the exact permission digest and adoption requirement, then install it with
`--consent opencode=<digest> --adopt-source opencode` if history has already been mined.
Enable `opencode` explicitly afterwards; keep existing miner settings, including `since` and `dir`.
The agent integration is installed separately with `memcastle integration install opencode`.
While Core still bundles its legacy OpenCode integration, use an assets root without that integration during a local
plugin smoke check; two packages offering the same public integration ID cannot be installed together.

Do not publish a tag until the archive hashes in `plugin.toml` and `modules/opencode/Cargo.lock` are reviewed and
committed. The release workflow rebuilds and refuses a changed manifest.
