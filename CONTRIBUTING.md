# Contributing to memcastle-opencode

The source and integration are released together from this repository, independently of MemCastle Core.
Keep the public source and integration IDs `opencode` and the parent module IDs in `plugin.toml` stable.
Changes to the source WIT contract, permissions, `since`/`dir` semantics or persisted session identity need a
compatibility review against existing miners, cursors and mined drawers.

Install Rust with `wasm32-wasip2`, Bun and a MemCastle Core binary; point `MEMCASTLE_BIN` at that binary.
Run these checks before submitting a change:

```sh
python3 scripts/package.py
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/check_modules.py
python3 -m unittest discover -s tests
PATH="$PWD/modules/opencode/fixtures/bin:$PATH" /path/to/memcastle source test modules/opencode --no-build
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py
MEMCASTLE_BIN=/path/to/memcastle python3 scripts/smoke_install.py --legacy
```

The first command updates `plugin.toml` with hashes of the reviewed module artifacts.
Commit that manifest and `modules/opencode/Cargo.lock` with your change; CI refuses an unreviewed hash or missing lock.
The legacy smoke scenario checks an installed legacy source and miner, an explicit adoption, retained mined history and
incremental acquisition after the handoff.
CI runs the source against the newest stable released Core, and uses its plugin installer once that release supports
the plugin contract; use a current Core binary locally to check the newer contract before the first compatible release.

The release workflow publishes `<plugin-id>-<version>.tar.gz` from a reviewed `main` commit tagged
`opencode/v<version>`. Increment the parent plugin version when the archive changes; module versions change only when
their public implementation changes. Review the package inventory and reproducible hashes before tagging.
