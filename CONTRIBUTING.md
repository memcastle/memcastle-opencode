# Contributing to memcastle-opencode

The source and integration are released together from this repository, independently of MemCastle Core.
Keep both public module IDs `opencode` and their entries in `plugin.toml` stable.
Changes to the WIT contract, permissions, `since`/`dir` semantics or persisted session identity need a
compatibility review against existing miners, cursors and mined drawers.

## Development checks

Install Rust with `wasm32-wasip2`, Bun 1.4.2 and a plugin-capable MemCastle Core binary;
point `MEMCASTLE_BIN` at that binary. Build the source component to `sources/opencode/source.wasm` before packaging.
The release archive records the Bun-built integration's SHA-256, so a different bundler version changes its
reviewed digest even if the source did not change.

```sh
cargo test --manifest-path sources/opencode/Cargo.toml --locked
# Build the source component for wasm32-wasip2 and copy it to sources/opencode/source.wasm first.
(cd integrations/opencode && bun install --frozen-lockfile && bun run build && bun test --timeout 60000)
archive="$("$MEMCASTLE_BIN" plugin package --json | jq -r .archive)"
"$MEMCASTLE_BIN" plugin test "$archive"
PATH="$PWD/sources/opencode/fixtures/bin:$PATH" "$MEMCASTLE_BIN" source test sources/opencode --no-build
ARCHIVE="$archive" node scripts/smoke_adoption.mjs
```

Core packaging generates `manifest.toml` inside the archive with hashes of the built artifacts, without rewriting
the local `plugin.toml`. Commit `sources/opencode/Cargo.lock`; do not commit generated archives.
The legacy smoke checks explicit adoption, retained mined history and incremental acquisition after the handoff.
Core's shared validation tests fixtures, installation and activation against `development` and the latest stable
`0.5` patch, reporting each Core build's exact SHA.
CI runs once per pull request and on pushes to `main`.

## Template updates and releases

Template answers and child commits live in `.config/git.tpl.toml`. To update, run `git tpl update --defaults --json`,
review `git tpl diff --json`, then apply with `git tpl merge --json` and reconcile provider-specific documentation.
If adding native tests that upload nonempty LCOV, update the corresponding covered-module answers and choose
realistic coverage targets. See the [README](README.md) for installation and release setup.

git-cliff and gh-ship open a reviewed `release/next` PR for releasable commits, then publish the validated
`opencode-<version>.tar.gz` archive and `.sha256sum` under the `<version>` tag when it merges.
Review the package inventory and hashes.
