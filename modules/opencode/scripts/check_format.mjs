// Keep source and tests free of platform-dependent whitespace.
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const files = ["src/index.ts", ...readdirSync(join(root, "test")).filter((name) => name.endsWith(".ts")).map((name) => `test/${name}`)]
for (const file of files) {
  const data = readFileSync(join(root, file), "utf8")
  if (data.includes("\r") || !data.endsWith("\n") || data.split("\n").some((line) => /[\t ]+$/.test(line))) {
    throw new Error(`${file}: use LF, remove trailing whitespace and add a final newline`)
  }
}
