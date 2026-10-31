#!/usr/bin/env node
// Validates docs/: every doc has frontmatter with a title and description, links between
// docs resolve, and log.md uses ISO date headings. Exits non-zero on any problem.
// Frontmatter follows Open Knowledge Format conventions but OKF conformance is not enforced.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs")

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(dir, e.name))
        : e.name.endsWith(".md")
          ? [path.join(dir, e.name)]
          : [],
    )

function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!m) return null
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (kv) data[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, "$1")
  }
  return data
}

const errors = []
const files = walk(ROOT)
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/")
  const src = fs.readFileSync(f, "utf8")
  if (path.basename(f) === "log.md") {
    for (const h of src.match(/^## .+$/gm) ?? []) {
      if (!/^## \d{4}-\d{2}-\d{2}$/.test(h))
        errors.push(`${rel}: log date heading must be YYYY-MM-DD, got "${h}"`)
    }
  } else {
    const fm = frontmatter(src)
    if (!fm) errors.push(`${rel}: missing YAML frontmatter`)
    else {
      if (!fm.title) errors.push(`${rel}: frontmatter needs a "title"`)
      if (!fm.description) errors.push(`${rel}: frontmatter needs a one-line "description"`)
    }
  }
  for (const [, href] of src.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(f), href)))
      errors.push(`${rel}: broken link to ${href}`)
  }
}

if (errors.length) {
  console.error(errors.map((e) => `  ✗ ${e}`).join("\n"))
  console.error(`\ndocs check failed: ${errors.length} problem(s)`)
  process.exit(1)
}
console.log(`docs check ok: ${files.length} files`)
