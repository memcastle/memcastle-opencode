# OpenCode history source

The conversation history of the [OpenCode](https://opencode.ai) coding agent, as a MemCastle mining source:
a WebAssembly component built from `src/lib.rs`, one document per session.

It is acquisition only.
MemCastle owns normalisation into drawers, chunking, deduplication, provenance, the cursor, idempotency and the durable
job, and the live OpenCode integration ([integration guide](../../integrations/opencode/docs/integration.md)) is separate: it talks to the daemon
over MCP and only decides when to ask for mining.

## Requirements

OpenCode 1.2 or later (the version that moved history into a database), installed so that `opencode` is on the daemon's
`PATH`; it was written against 1.18.
The source never opens OpenCode's database: it runs `opencode db` and `opencode export`, which own it, so no SQLite code is
part of this component or of MemCastle.

## Use it

```sh
# `fixtures/bin` holds a stand-in `opencode` for the conformance cases; they need it first on the PATH.
PATH="$PWD/sources/opencode/fixtures/bin:$PATH" memcastle source test sources/opencode --no-build
memcastle plugin install dist/opencode-VERSION.tar.gz --consent opencode=<digest>
memcastle source enable opencode
memcastle mine opencode                       # or: memcastle mine opencode since=2026-09 dir=/path/to/workspace
```

The build needs the `wasm32-wasip2` target (`rustup target add wasm32-wasip2`).
[Mining sources](https://github.com/memcastle/memcastle/blob/main/docs/mining-sources.md#opencode) describes what is filed and its limits.

### Shared source configuration, separate workspace miners

With a Core version supporting [source configurations and miners](https://github.com/memcastle/memcastle/blob/main/docs/configuration.md#miners), put this in `~/.config/memcastle/config.toml` (replace the paths and destinations):

```toml
[[source_configs]]
id = "opencode-history"
source = "opencode"
[source_configs.options]
since = "2026-09"                 # shared bootstrap date; no destination or schedule here

[[miners]]
name = "api-workspace"
source = "opencode"
source_config = "opencode-history"
wing = "engineering"
room = "api-sessions"
max_documents = 200
[miners.options]
dir = "/home/alice/work/api"
project_id = "prj_api"            # optional exact OpenCode project ID
[miners.schedule]
every = "1d"
enabled = false                   # enable deliberately with `memcastle miner schedule-enable api-workspace`

[[miners]]
name = "site-workspace"
source = "opencode"
source_config = "opencode-history"
wing = "website"
room = "sessions"
max_documents = 50
[miners.options]
dir = "/home/alice/work/site"
```

Run either with `memcastle miner run api-workspace` or `memcastle mine site-workspace`.
The same miners can be created with `memcastle source config set opencode-history --source opencode --option since=2026-09`
and `memcastle miner set api-workspace --source opencode --source-config opencode-history --wing engineering --room api-sessions --option dir=/home/alice/work/api --option project_id=prj_api`.
REST callers use `PUT /api/source-configs/opencode-history` with `{"source":"opencode","options":{"since":"2026-09"}}`,
`PUT /api/miners/api-workspace` with `{"source":"opencode","source_config":"opencode-history","wing":"engineering","room":"api-sessions","options":{"dir":"/home/alice/work/api","project_id":"prj_api"}}`,
and `POST /api/miners/api-workspace/run`. `memcastle mine opencode dir=...` remains available for one-off runs.

Each miner owns its selectors, per-job limit, schedule and fixed destination. Core's optional
`mapping = { wing_from = "project_id" }` or `mapping = { room_from = "project_id" }` can route by the exported metadata;
the session ID is the drawer name, and changing a Wing/Room or mapping creates a separate document history.
Shared source defaults apply to every referencing miner, while the same key in a miner's options overrides the default.
Changing `since` to an earlier date or broadening another selector may require `--allow-broaden` and `--full` to revisit
history behind the existing cursor.

`dir` matches the recorded session working directory, after removing a trailing slash; `*` matches across `/`, so
`/home/alice/work/*` overlaps both example miners. Overlaps intentionally file the session in **each** miner's
destination, with independent cursors. A session with no directory matches no `dir` selector; an exact `project_id`
selector can still find it if OpenCode recorded its project. An absent project ID matches no `project_id` selector.
Use only a shared bootstrap option such as `since` on the source configuration if each miner must select its own scope.
Existing `dir`-only miners retain their identity and cursor; adding `project_id` selects a new, isolated cursor.

## Capabilities and permissions

| Declared | Value | Why |
|---|---|---|
| `incremental` | yes | A `time_updated` watermark finds the sessions that changed; only their new tail is filed again. |
| `retains_raw` | yes | OpenCode's database is the user's to prune and compact, so the transcript is kept once read. |
| `needs_credentials` | no | OpenCode is run as the user, with whatever access it already has. |
| `process` | `opencode` | The one program run, by exact name and without a shell. It runs with the daemon's own authority. |
| `env` | `XDG_DATA_HOME` | Read by OpenCode to find its data directory when it has been moved. |
| `filesystem`, `network` | none | The component reads no file and reaches no network. |

## Identity and provenance

| Field | Value |
|---|---|
| `external_id` | The OpenCode session id, such as `ses_fffdd730a0010XFnQ4chp5K3uS`. |
| `revision` | A hash of the whole export, so it changes exactly when the session does. |
| `occurred_at` | When the session was created. |
| metadata | `session_id`, `directory`, `project_id`, `title`, `version` and `parent_id`. |
| `uri` | `opencode://session/<id>`. |
| room, name, tags | The working directory's name, the session id, `transcript` and `opencode`. |

## Tests

`fixtures/opencode-history/` is the conformance case `memcastle source test` runs: four sessions in two working
directories and the usual noise.
`fixtures/bin/opencode` stands in for the real command and answers from `fixtures/data/`, so nothing here needs OpenCode
or a database.
`memcastle plugin test dist/opencode-VERSION.tar.gz` installs the archive into a disposable Core daemon;
`node scripts/smoke_adoption.mjs` checks the legacy cursor handoff and incremental growth.
