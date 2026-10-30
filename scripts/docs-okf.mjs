#!/usr/bin/env node
// Maintains docs/ as an Open Knowledge Format (OKF v0.2) bundle.
//   node scripts/docs-okf.mjs index   regenerate every index.md from concept frontmatter
//   node scripts/docs-okf.mjs check   exit non-zero if the bundle is not valid or an index is stale
// Spec: https://github.com/GoogleCloudPlatform/open-knowledge-format (SPEC.md). Zero dependencies.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs')
const OKF_VERSION = '0.2'
const RESERVED = new Set(['index.md', 'log.md'])

// Directory blurbs and order shown in the parent index. Directories not listed
// here still get an index; they just list without a description.
const DIRS = {
  'project-phases': 'One file per project phase: task checkboxes, pending lists, design decisions.',
  history: 'Dated full write-ups of meaningful changes. The only place detail lives.',
  security: 'Risk registers and security audit records.',
  superpowers: 'Design specs and implementation plans produced by the brainstorming and planning skills.',
  specs: 'Design specs, one per feature.',
  plans: 'Implementation plans, one per feature.',
}

const PLURAL = { 'History Entry': 'History entries', 'Status Overview': 'Overview', Reference: 'Reference' }
const toPosix = (p) => p.split(path.sep).join('/')
const listDir = (dir) => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))

function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!m) return null
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim()
    if (/^".*"$/.test(v)) v = JSON.parse(v)
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'")
    data[kv[1]] = v
  }
  return data
}

const walk = (dir) =>
  listDir(dir).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))

const dirsWithConcepts = (dir) =>
  listDir(dir).some((e) =>
    e.isDirectory()
      ? dirsWithConcepts(path.join(dir, e.name))
      : e.name.endsWith('.md') && !RESERVED.has(e.name),
  )

function renderIndex(dir) {
  const isRoot = dir === ROOT
  const entries = listDir(dir)
  const concepts = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !RESERVED.has(e.name))
    .map((e) => {
      const fm = parseFrontmatter(fs.readFileSync(path.join(dir, e.name), 'utf8')) ?? {}
      return { file: e.name, title: fm.title ?? e.name.replace(/\.md$/, ''), description: fm.description ?? '', type: fm.type ?? 'Unknown', date: fm.date ?? '' }
    })
  const subdirs = entries.filter((e) => e.isDirectory() && dirsWithConcepts(path.join(dir, e.name)))

  // Dated concepts (history, specs, plans) read newest first; everything else alphabetically.
  const dated = concepts.some((c) => c.date)
  concepts.sort((a, b) => (dated ? b.date.localeCompare(a.date) || a.file.localeCompare(b.file) : a.title.localeCompare(b.title)))

  const line = (href, title, desc) => `* [${title}](${href})${desc ? ` - ${desc}` : ''}`
  let out = isRoot ? `---\nokf_version: "${OKF_VERSION}"\n---\n\n` : ''
  const byType = Map.groupBy(concepts, (c) => c.type)
  for (const [type, items] of byType) {
    out += `# ${PLURAL[type] ?? `${type}s`}\n\n${items.map((c) => line(c.file, c.title, c.description)).join('\n')}\n\n`
  }
  if (subdirs.length) {
    out += `# Sections\n\n${subdirs.map((d) => line(`${d.name}/`, d.name, DIRS[d.name] ?? '')).join('\n')}\n\n`
  }
  if (isRoot && fs.existsSync(path.join(dir, 'log.md'))) {
    out += `# Log\n\n${line('log.md', 'Update log', 'Chronological history of documentation changes, newest first.')}\n\n`
  }
  return out.trimEnd() + '\n'
}

const allDirs = (dir) => [dir, ...listDir(dir).filter((e) => e.isDirectory()).flatMap((e) => allDirs(path.join(dir, e.name)))]
const indexTargets = () => allDirs(ROOT).filter(dirsWithConcepts)

function check() {
  const errors = []
  const files = walk(ROOT).filter((f) => f.endsWith('.md'))
  for (const f of files) {
    const rel = toPosix(path.relative(ROOT, f))
    const base = path.basename(f)
    const src = fs.readFileSync(f, 'utf8')
    if (base === 'index.md' || base === 'log.md') {
      if (base === 'log.md') {
        for (const h of src.match(/^## .+$/gm) ?? []) {
          if (!/^## \d{4}-\d{2}-\d{2}$/.test(h)) errors.push(`${rel}: log date heading must be ISO YYYY-MM-DD, got "${h}"`)
        }
      }
      continue
    }
    const fm = parseFrontmatter(src)
    if (!fm) { errors.push(`${rel}: missing YAML frontmatter`); continue }
    if (!fm.type) errors.push(`${rel}: frontmatter needs a non-empty "type"`)
    if (!fm.title) errors.push(`${rel}: frontmatter needs a "title" (house rule; OKF only recommends it)`)
    if (!fm.description) errors.push(`${rel}: frontmatter needs a one-line "description" (feeds index.md)`)
    // Broken links between docs: the spec tolerates them, this repo does not.
    for (const [, href] of src.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(f), href))) errors.push(`${rel}: broken link to ${href}`)
    }
  }
  for (const d of indexTargets()) {
    const idx = path.join(d, 'index.md')
    const rel = toPosix(path.relative(ROOT, idx))
    if (!fs.existsSync(idx)) errors.push(`${rel}: missing (run: pnpm docs:index)`)
    else if (fs.readFileSync(idx, 'utf8') !== renderIndex(d)) errors.push(`${rel}: stale (run: pnpm docs:index)`)
  }
  if (errors.length) {
    console.error(errors.map((e) => `  ✗ ${e}`).join('\n'))
    console.error(`\ndocs check failed: ${errors.length} problem(s)`)
    process.exit(1)
  }
  console.log(`docs check ok: ${files.length} files, ${indexTargets().length} indexes, OKF v${OKF_VERSION}`)
}

const cmd = process.argv[2]
if (cmd === 'index') {
  for (const d of indexTargets()) fs.writeFileSync(path.join(d, 'index.md'), renderIndex(d))
  console.log(`wrote ${indexTargets().length} index.md files`)
} else if (cmd === 'check') {
  check()
} else {
  console.error('usage: docs-okf.mjs index|check')
  process.exit(2)
}
