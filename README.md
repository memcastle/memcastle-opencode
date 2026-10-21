# MemCastle for OpenCode

[![CI][ci-badge]][ci-workflow] [![Codecov][codecov-badge]][codecov-project]

[ci-badge]: https://github.com/memcastle/memcastle-opencode/actions/workflows/ci.yaml/badge.svg?branch=main
[ci-workflow]: https://github.com/memcastle/memcastle-opencode/actions/workflows/ci.yaml
[codecov-badge]: https://codecov.io/gh/memcastle/memcastle-opencode/graph/badge.svg
[codecov-project]: https://codecov.io/gh/memcastle/memcastle-opencode

OpenCode coding-agent history and lifecycle integration.

This independently released plugin contains a history source and an agent integration, both named `opencode`.
They have separate implementations and activation states.
The source preserves the `since` and `dir` options, permission grants and per-source cursor, and supports an exact
`project_id` selector. For per-workspace Wing/Room mappings and independent cursors, define one `[[source_configs]]`
and multiple `[[miners]]`. See the [history source guide](sources/opencode/README.md#shared-source-configuration-separate-workspace-miners)
for TOML, CLI and REST examples.

## Install

When a release is available in the [MemCastle plugin catalogue](https://memcastle.github.io/plugins.json), install it
by ID with a plugin-capable MemCastle Core binary:

```sh
memcastle plugin install opencode
memcastle source enable opencode
memcastle integration install opencode
```

Core retrieves and checks the release archive for you. Installation makes the modules available;
source activation and agent registration are separate steps. If there is no published release yet,
build the project below and install its `dist/opencode-VERSION.tar.gz` archive instead.

### Moving an existing installation

An installed legacy `opencode` source must be disabled and removed before installing the plugin;
removing its package does not erase mined drawers, the source cursor or checkpoint history.
Preview installation for the exact permission digest and adoption requirement, then install with
`--consent opencode=<digest> --adopt-source opencode` if history has already been mined.
Enable `opencode` explicitly afterwards; keep existing miner settings, including `since` and `dir`.

Older Core releases bundle a legacy OpenCode integration. Use an assets root without it when checking an installed
plugin against those releases, since two packages offering the same public integration ID cannot coexist.

## Build and test locally

Install Bun, Rust with `wasm32-wasip2`, and a plugin-capable MemCastle Core binary. Generate and commit
`sources/opencode/Cargo.lock`, build its component to `sources/opencode/source.wasm`, then build the integration
in `integrations/opencode/` with Bun. The CI workflow contains the reproducible Wasm build and copy commands.

```sh
memcastle plugin inspect --json
memcastle plugin package
memcastle plugin test dist/opencode-VERSION.tar.gz
node scripts/smoke_adoption.mjs
PATH="$PWD/sources/opencode/fixtures/bin:$PATH" memcastle source test sources/opencode --no-build
```

Use the archive name generated in `dist/` instead of `VERSION`. The archive is independently releasable from Core.
Packaging leaves `plugin.toml` unchanged and writes a versioned `manifest.toml` inside the archive plus an external
`.sha256sum`. It also bundles the root `skills/` directory. A `VERSION` tag supplies the release version;
untagged commits receive a development version.

## CI and releases

CI builds the modules and validates the packaged artifact against Core `development` and `0.5`.
Core's shared workflow tests source fixtures, installation, activation and legacy adoption on each matrix leg;
the Core setup action verifies the binary against `SHA256SUMS` and exposes `MEMCASTLE_BIN` to integration tests.
The `0.5` matrix leg selects the latest stable patch; Core 0.4.1 predates plugin installation.

gh-ship and git-cliff open a reviewed `release/next` PR. After it merges, the release workflow validates the
`VERSION` tag and publishes the reviewed `opencode-VERSION.tar.gz` archive. Configure `APP_CLIENT_ID` and
`APP_PRIVATE_KEY` in the `release` environment for an installed GitHub App.
The publish workflow uses this credential to check the draft release and upload its validated archive.

Native Cargo/Bun coverage and test results upload to Codecov. The project and `integration-opencode` component
floors are 98%, with a 95% patch floor; `source-opencode` remains informational until its native tests upload
nonempty LCOV.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project checks and [AGENTS.md](AGENTS.md) for coding-agent guidance.
