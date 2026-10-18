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
  assert.equal((await run()).created, 6)
  assert.equal((await request("/api/search?q=Unscoped")).length, 1, "an unfiltered miner includes sessions without project or directory metadata")
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

// Shared source defaults resolve independently for each miner, including overlapping directories and project-only
// sessions with no recorded directory. The installed plugin and every job run against a fresh disposable palace.
await isolated("memcastle-opencode-miners-", ({ root, env }) => {
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
  const palace = join(root, "palace")
  const archive = readFileSync(pluginArchive())
  const preview = await request("/api/plugins/preview", { method: "POST", data: archive })
  const consents = Object.fromEntries(preview.source_consents.map(({ source, digest }) => [source, digest]))
  await request("/api/plugins", { method: "POST", data: archive, headers: {
    "X-MemCastle-Consents": JSON.stringify(consents),
  } })
  cli(["--palace", palace, "source", "enable", "opencode"], env)

  await request("/api/source-configs/opencode-shared", { method: "PUT", json: {
    source: "opencode", options: { since: "2026-07" },
  } })
  const sourceConfig = await request("/api/source-configs/opencode-shared")
  assert.equal(sourceConfig.source, "opencode")
  assert.deepEqual(sourceConfig.options, { since: "2026-07" })

  const define = (name, settings) => request(`/api/miners/${name}`, { method: "PUT", json: {
    source: "opencode", source_config: "opencode-shared", ...settings,
  } })
  await define("project", {
    wing: "work", room: "history", max_documents: 2,
    schedule: { every: "1d", enabled: false },
    options: { dir: "/home/me/project", project_id: "prj_one" },
  })
  await define("notes", {
    wing: "personal", room: "sessions", options: { dir: "/home/me/notes", project_id: "prj_two" },
  })
  await define("overlap", {
    wing: "shared", room: "all", options: { dir: "/home/me/*" },
  })
  await define("remote", {
    wing: "remote", room: "all", options: { project_id: "prj_one" },
  })
  await define("mapped", {
    wing: "mapped", room: "fallback", mapping: { room_from: "project_id" },
    options: { dir: "/home/me/project" },
  })
  assert.equal((await request("/api/miners/project")).schedule.enabled, false)
  for (const name of ["project", "notes", "overlap", "remote", "mapped"]) {
    assert.equal((await request(`/api/miners/${name}`)).source_config, "opencode-shared")
  }

  const completed = async (submitted) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      const job = await request(`/api/jobs/${submitted.id}`)
      if (["completed", "failed", "cancelled"].includes(job.status)) {
        assert.equal(job.status, "completed", JSON.stringify(job))
        return job.result
      }
      await new Promise((done) => setTimeout(done, 250))
    }
    throw new Error(`miner job ${submitted.id} did not complete within 30 seconds`)
  }
  const run = async (name) => completed(await request(`/api/miners/${name}/run`, { method: "POST" }))
  const runCli = async (name) => completed(JSON.parse(cli(["--json", "--palace", palace, "miner", "run", name], env)))
  const hits = (q, wing, room) => request(`/api/search?q=${encodeURIComponent(q)}&wing=${wing}&room=${room}`)

  assert.equal((await runCli("project")).created, 2)
  assert.equal((await run("notes")).created, 1)
  assert.equal((await run("overlap")).created, 4, "overlapping miners each file their own matches")
  assert.equal((await run("remote")).created, 3, "a project-only selector includes missing directories")
  assert.equal((await run("mapped")).created, 3, "one directory can hold multiple OpenCode projects")
  assert.equal((await hits("Rotate the signing keys", "work", "history")).length, 1)
  assert.equal((await hits("Rotate the signing keys", "shared", "all")).length, 1)
  assert.equal((await hits("Remote workspace note", "remote", "all")).length, 1)
  assert.equal((await hits("Remote workspace note", "work", "history")).length, 0)
  assert.equal((await hits("Unscoped", "remote", "all")).length, 0)
  assert.equal((await hits("Rotate the signing keys", "mapped", "prj_one")).length, 1)
  assert.equal((await hits("Other project note", "mapped", "prj_two")).length, 1)
  for (const name of ["project", "notes", "overlap", "remote", "mapped"]) {
    assert.equal((await run(name)).documents, 0, `${name} must resume its own cursor`)
  }

  await request("/api/miners/project", { method: "PUT", json: { room: "new-history" } })
  assert.equal((await run("project")).created, 2, "a mapping change has an independent document history")
  assert.equal((await hits("Rotate the signing keys", "work", "new-history")).length, 1)
  assert.equal((await run("notes")).documents, 0, "changing a different mapping did not rewind notes")

  await request("/api/miners/project", { method: "PUT", json: {
    options: { project_id: "prj_two" }, allow_broaden: true,
  } })
  assert.equal((await run("project")).created, 1, "a changed project selector starts its own cursor")
  assert.equal((await hits("Other project note", "work", "new-history")).length, 1)
  assert.equal((await run("notes")).documents, 0, "changing another miner's scope cannot rewind notes")

  const fixtures = join(root, "fixtures")
  const exportPath = join(fixtures, "data/export/ses_bravo.out")
  const session = JSON.parse(readFileSync(exportPath, "utf8"))
  session.messages.push({
    info: { id: "msg_b4", role: "user", time: { created: 1784196070000 } },
    parts: [{ type: "text", text: "a new note for this workspace" }],
  })
  writeFileSync(exportPath, JSON.stringify(session))
  const listing = join(fixtures, "data/sessions.tsv")
  writeFileSync(listing, readFileSync(listing, "utf8").replace("ses_bravo\t1784196060000", "ses_bravo\t1784365205000"))
  assert.equal((await run("notes")).documents, 1)
  assert.equal((await run("overlap")).documents, 1)
  assert.equal((await run("project")).documents, 0)
  assert.equal((await hits("a new note for this workspace", "personal", "sessions")).length, 1)
  assert.equal((await hits("a new note for this workspace", "shared", "all")).length, 1)
})
console.log("Shared OpenCode source configuration and independently routed miners passed")
