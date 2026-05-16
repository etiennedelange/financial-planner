---
name: security-audit
description: >
  Security audit for Node.js devcontainer projects. Use this skill whenever the user wants to
  check if their devcontainer, pnpm setup, or codebase is secure and up to date. Triggers on:
  "check my devcontainer", "audit pnpm setup", "run semgrep", "check for vulnerabilities",
  "is my setup secure", "check node version", "check pnpm version", "approve-builds audit",
  "blockExoticSubdeps", or any combination of devcontainer + security/version checking.
  Even if the user only mentions one part (e.g. "run semgrep"), use this skill to also
  check the surrounding setup — the checks are fast and often surface related issues.
---

# Node.js Devcontainer Security Audit

Run these checks in order. Each is fast — do them all unless the user specifically asks for only one.

---

## 1. Node version

Check the base image in `.devcontainer/devcontainer.json`:

```bash
grep '"image"' .devcontainer/devcontainer.json
node --version
```

- The image tag should match the running node version (e.g. `typescript-node:1-24-bookworm` → Node 24)
- If they diverge, the container was likely built from an outdated image — flag it

---

## 2. pnpm installation method

Check `.devcontainer/post-create.sh` (or `postCreateCommand` in `devcontainer.json`):

**Good** — uses pnpm's official standalone installer (no npm, no corepack):
```bash
curl -fsSL https://get.pnpm.io/install.sh -o "$PNPM_INSTALL"
ENV="$HOME/.bashrc" SHELL="$(which bash)" bash "$PNPM_INSTALL"
```

**Acceptable** — pinned via npm (uses npm once as a bootstrapper):
```bash
npm install -g pnpm@<version>
```

**Avoid** — `npm install -g pnpm@latest` (unpinned, may pull breaking changes on rebuild)

**Avoid** — `corepack enable && corepack prepare` (corepack's future in Node.js core is uncertain)

Also check that install scripts download to a temp file rather than piping directly to shell:
```bash
# Good — download then execute
SCRIPT=$(mktemp) && curl -fsSL <url> -o "$SCRIPT" && bash "$SCRIPT" && rm "$SCRIPT"

# Risky — streaming pipe
curl -fsSL <url> | bash
```

---

## 3. pnpm version pinning

Check `package.json` for:
```json
"packageManager": "pnpm@<version>"
```

This is the source of truth. The install method in step 2 should install this version (or latest if the user prefers security updates over strict pinning).

To upgrade pnpm and update this field atomically:
```bash
corepack use pnpm@latest   # or pnpm self-update
```

---

## 4. pnpm-workspace.yaml security settings

Check that `pnpm-workspace.yaml` contains:
```yaml
blockExoticSubdeps: true
```

This prevents transitive dependencies from pulling in packages via non-standard protocols (`git:`, `github:`, `file:`, `link:`). Add it if missing.

---

## 5. Build approval audit

Run:
```bash
pnpm approve-builds 2>&1
```

For each package listed, verify it's a legitimate transitive dependency:
```bash
pnpm why <package-name>
```

Only approve packages that have a clear, trusted dependency chain. Common legitimate ones:
- `sharp` — pulled in by Next.js for image optimisation
- `unrs-resolver` — pulled in by `eslint-import-resolver-typescript` (Rust native binary)
- `esbuild`, `@swc/core` — build tooling with native binaries

Update `pnpm-workspace.yaml`:
```yaml
allowBuilds:
  sharp: true        # next.js image optimisation
  unrs-resolver: true  # eslint-import-resolver-typescript (Rust native binary)
```

Flag any package you can't trace to a known dependency.

---

## 6. Semgrep scan

Find all source files (exclude node_modules, .next, coverage, dist):
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" ! -path "*/.next/*" \
  ! -path "*/coverage/*" ! -path "*/dist/*" | sort
```

Run the scan:
```bash
semgrep scan --config auto --timeout 60 <source dirs> \
  --exclude "node_modules" --exclude ".next" --exclude "coverage" \
  --json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
findings = data.get('results', [])
if not findings:
    print('No findings.')
else:
    for f in findings:
        print(f\"{f['path']}:{f['start']['line']} [{f['extra']['severity']}] {f['check_id']}\")
        print(f\"  {f['extra']['message'][:120]}\")
        print()
print(f'Total: {len(findings)} findings')
"
```

### Triage guide

| Severity | Action |
|----------|--------|
| ERROR    | Investigate immediately |
| WARNING  | Review — may be a false positive |
| INFO     | Usually false positive, note it |

**Common false positive:** `SameSite: None` flagged on cookies that are passed through from `@supabase/ssr` — the cookie options come from the auth library, not your code.

---

## Report format

After all checks, give a concise summary:

```
Node: v24.x.x ✓ (matches devcontainer image)
pnpm: official installer, download-then-execute ✓
packageManager field: pnpm@11.1.2 ✓
blockExoticSubdeps: true ✓
allowBuilds: sharp ✓, unrs-resolver ✓ (both verified legitimate)
Semgrep: 1 INFO finding — false positive (Supabase cookie passthrough)
```

Only flag items that need action. Don't pad with "all good" lines for things that passed cleanly.
