# OpenCode integration

This integration connects OpenCode sessions to MemCastle over MCP and HTTP. It is installed separately with
`memcastle integration install opencode` after installing the containing provider plugin.
See the [integration guide](docs/integration.md) for configuration, capabilities and lifecycle behavior.

From this directory, run `bun install --frozen-lockfile`, then `bun run format:check`, `bun run lint`,
`bun test --timeout 60000` and `bun run build`. The build produces the packaged `dist/index.js`.
The history source with the same ID lives in [`sources/opencode/`](../../sources/opencode/).
