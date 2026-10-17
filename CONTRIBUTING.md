# Contributing to memcastle-opencode

The source and integration are released together from this repository, independently of MemCastle Core.
Keep the public source and integration IDs `opencode` and the parent module IDs in `plugin.toml` stable.
Changes to the source WIT contract, permissions, `since`/`dir` semantics or persisted session identity need a
compatibility review against existing miners, cursors and mined drawers.

Install Rust with `wasm32-wasip2`, Bun 1.4.2 and a plugin-capable MemCastle Core binary; point `MEMCASTLE_BIN` at that binary.
The release archive records the Bun-built integration's SHA-256, so a different bundler version changes its reviewed
digest even if the source did not change.
Run these checks before submitting a change:

```sh
cargo test --manifest-path modules/opencode/Cargo.toml --locked
# Build the source component for wasm32-wasip2 and copy it to modules/opencode/source.wasm first.
(cd modules/opencode && bun install --frozen-lockfile && bun run build && bun test --timeout 60000)
"$MEMCASTLE_BIN" plugin package plugin.toml
"$MEMCASTLE_BIN" plugin test dist/opencode-0.1.0.tar.gz
PATH="$PWD/modules/opencode/fixtures/bin:$PATH" /path/to/memcastle source test modules/opencode --no-build
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py --legacy
```

Core packaging regenerates `manifest.toml` with hashes of the reviewed module artifacts while leaving the
project-local `plugin.toml` descriptor untouched. Commit that manifest and `modules/opencode/Cargo.lock`;
CI refuses an unreviewed hash or missing lock.
The legacy smoke scenario checks an installed legacy source and miner, an explicit adoption, retained mined history and
incremental acquisition after the handoff.
OpenCode builds and checks its own archive; Core's shared validation tests source fixtures, installation,
activation and the legacy migration on the permanent `main`
prerelease, reports the exact Core SHA, and repeats all checks on explicitly selected plugin-capable stable versions.
Only add an exact stable tag to `core-versions` when it supports the plugin install contract.
CI runs once per pull request and on every push to `main`, including merges.

git-cliff and gh-ship open a reviewed `release/next` PR for releasable commits, then publish the validated
`opencode/v<version>` archive and `.sha256sum` when it merges. Review the package inventory and reproducible hashes.
