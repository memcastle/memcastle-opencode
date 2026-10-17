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
cargo test --manifest-path sources/opencode/Cargo.toml --locked
# Build the source component for wasm32-wasip2 and copy it to sources/opencode/source.wasm first.
(cd integrations/opencode && bun install --frozen-lockfile && bun run build && bun test --timeout 60000)
archive="$("$MEMCASTLE_BIN" plugin package --json | jq -r .archive)"
"$MEMCASTLE_BIN" plugin test "$archive"
PATH="$PWD/sources/opencode/fixtures/bin:$PATH" "$MEMCASTLE_BIN" source test sources/opencode --no-build
ARCHIVE="$archive" node scripts/smoke_adoption.mjs
```

Core packaging generates `manifest.toml` inside the archive with hashes of the built module artifacts while leaving
the project-local `plugin.toml` descriptor untouched. Commit `sources/opencode/Cargo.lock`;
CI tests the packaged archive against Core.
The legacy smoke scenario checks an installed legacy source and miner, an explicit adoption, retained mined history and
incremental acquisition after the handoff.
OpenCode builds and checks its own archive; Core's shared validation tests source fixtures, installation,
activation and the legacy migration on the permanent `main`
prerelease, reports the exact Core SHA, and repeats all checks on explicitly selected plugin-capable stable versions.
Only add a stable release tree to `core_versions` when it supports the plugin install contract.
CI runs once per pull request and on every push to `main`, including merges.

git-cliff and gh-ship open a reviewed `release/next` PR for releasable commits, then publish the validated
`opencode/v<version>` archive and `.sha256sum` when it merges. Review the package inventory and reproducible hashes.
