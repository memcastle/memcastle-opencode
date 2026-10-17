// An OpenCode source keeps its cursor and miner through plugin adoption and incremental growth.
import assert from "node:assert/strict"
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, cli, isolated, pluginArchive } from "./smoke_common.mjs"

await isolated("memcastle-opencode-adopt-", ({ root, env }) => {
  const fixtures = join(root, "fixtures")
  cpSync(join(ROOT, "sources/opencode/fixtures"), fixtures, { recursive: true })
  const agent = join(root, "bin")
  mkdirSync(agent)
  const executable = join(agent, "opencode")
  writeFileSync(executable,
    `#!/bin/sh\nif [ "$1" = '--version' ]; then printf 'opencode 1.99.0\\n'; else exec '${join(fixtures, "bin/opencode")}' "$@"; fi\n`)
  chmodSync(executable, 0o755)
  env.PATH = `${agent}:${process.env.PATH}`
}, async ({ root, env, request }) => {
  const archive = readFileSync(pluginArchive())
  const preview = await request("/api/plugins/preview", { method: "POST", data: archive })
  assert.deepEqual(preview.modules.map(({ type, id }) => [type, id]), [["source", "opencode"], ["integration", "opencode"]])
  const palace = join(root, "palace")
  const legacy = join(root, "legacy.tar.gz")
  cli(["--palace", palace, "source", "package", "--no-build", "--output", legacy,
    join(ROOT, "sources/opencode")], env)
  cli(["--palace", palace, "source", "install", legacy, "--enable", "--consent",
    preview.source_consents[0].digest], env)
  const run = async () => {
    const submitted = JSON.parse(cli(["--json", "--palace", palace, "mine", "opencode"], env))
    for (let attempt = 0; attempt < 120; attempt++) {
      const job = await request(`/api/jobs/${submitted.id}`)
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        assert.equal(job.status, "completed", JSON.stringify(job))
        return job.result
      }
      await new Promise((done) => setTimeout(done, 250))
    }
    throw new Error("OpenCode mining job did not complete within 30 seconds")
  }
  assert.equal((await run()).created, 3)
  const miner = await request("/api/miners/history", { method: "PUT", json: {
    source: "opencode", options: { since: "2026-07", dir: "/home/me/notes" },
  } })
  assert.equal(miner.miner.source, "opencode")
  cli(["--palace", palace, "source", "disable", "opencode"], env)
  cli(["--palace", palace, "source", "remove", "opencode", "--yes"], env)
  const adoption = await request("/api/plugins/preview", { method: "POST", data: archive })
  assert.deepEqual(adoption.adoptions, ["opencode"])
  const consents = Object.fromEntries(preview.source_consents.map(({ source, digest }) => [source, digest]))
  await request("/api/plugins", { method: "POST", data: archive, headers: {
    "X-MemCastle-Consents": JSON.stringify(consents), "X-MemCastle-Adopt-Sources": '["opencode"]',
  } })
  const retained = await request("/api/miners/history")
  assert.equal(retained.source, "opencode")
  assert.deepEqual(retained.options, { since: "2026-07", dir: "/home/me/notes" })
  assert.equal((await request("/api/source-packages/opencode")).state, "installed")
  cli(["--palace", palace, "source", "enable", "opencode"], env)
  assert.equal((await run()).documents, 0, "adoption rewound the OpenCode cursor")
  assert.equal((await request("/api/search?q=rotate%20signing%20keys")).length, 1)
  const fixtures = join(root, "fixtures")
  const exportPath = join(fixtures, "data/export/ses_alpha.out")
  const session = JSON.parse(readFileSync(exportPath, "utf8"))
  session.messages.push({
    info: { id: "msg_a4", sessionID: "ses_alpha", role: "user", time: { created: 1784039290000 } },
    parts: [{ id: "prt_a9", type: "text", text: "what about certificate revocation?" }],
  })
  writeFileSync(exportPath, JSON.stringify(session))
  const listing = join(fixtures, "data/sessions.tsv")
  const data = readFileSync(listing, "utf8")
  assert.ok(data.includes("ses_alpha\t1784039280000"))
  writeFileSync(listing, data.replace("ses_alpha\t1784039280000", "ses_alpha\t1784365205000"))
  const updated = await run()
  assert.equal(updated.documents, 1)
  assert.equal(updated.superseded, 1)
  assert.equal((await request("/api/search?q=certificate%20revocation")).length, 1)
})
console.log("OpenCode miner, cursor and mined data survived legacy adoption and incremental growth")
