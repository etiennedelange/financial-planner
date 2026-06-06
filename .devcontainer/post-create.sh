#!/usr/bin/env bash
set -e

echo "==> Starting devcontainer post-create setup..."

# ─── Claude Code CLI ───────────────────────────────────────────────────────────
# Always reinstall to stay current; preserve auth credentials and global config
echo "--> Installing Claude Code CLI..."
CLAUDE_CREDS="$HOME/.claude/.credentials.json"
CLAUDE_CONFIG="$HOME/.claude.json"
[ -f "$CLAUDE_CREDS" ]  && cp "$CLAUDE_CREDS"  /tmp/.claude_creds_backup
[ -f "$CLAUDE_CONFIG" ] && cp "$CLAUDE_CONFIG" /tmp/.claude_config_backup

CLAUDE_INSTALL=$(mktemp)
curl -fsSL https://claude.ai/install.sh -o "$CLAUDE_INSTALL"
bash "$CLAUDE_INSTALL"
rm -f "$CLAUDE_INSTALL"

[ -f /tmp/.claude_creds_backup ]  && mv /tmp/.claude_creds_backup  "$CLAUDE_CREDS"
[ -f /tmp/.claude_config_backup ] && mv /tmp/.claude_config_backup "$CLAUDE_CONFIG"

# Restore from backup on first install after a container wipe
if [ ! -f "$CLAUDE_CONFIG" ]; then
  LATEST_BACKUP=$(ls -t "$HOME/.claude/backups/.claude.json.backup."* 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    cp "$LATEST_BACKUP" "$CLAUDE_CONFIG"
    echo "    Restored Claude config from backup: $(basename "$LATEST_BACKUP")"
  fi
fi

# ─── uv + semgrep ──────────────────────────────────────────────────────────────
# Install uv (fast Python toolchain manager), then use `uv tool install semgrep`
# to get an isolated semgrep install. Symlink into /usr/local/bin so the semgrep
# MCP server command works from non-interactive processes (Claude Code MCP).
echo "--> Installing uv..."
UV_INSTALL=$(mktemp)
curl -LsSf https://astral.sh/uv/install.sh -o "$UV_INSTALL"
sh "$UV_INSTALL"
rm -f "$UV_INSTALL"
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.profile

echo "--> Installing semgrep via uv..."
uv tool install semgrep
sudo ln -sf "$HOME/.local/bin/semgrep" /usr/local/bin/semgrep
echo "    semgrep $(semgrep --version 2>/dev/null || echo 'installed')"

# ─── pnpm ──────────────────────────────────────────────────────────────────────
# Read the pinned version from packageManager field in package.json
echo "--> Installing pnpm..."
PNPM_VERSION=$(find . -name "package.json" -not -path "*/node_modules/*" \
  -exec grep -m1 '"packageManager"' {} \; 2>/dev/null \
  | grep -oP 'pnpm@\K[0-9]+\.[0-9]+\.[0-9]+' | head -1)

PNPM_INSTALL=$(mktemp)
curl -fsSL https://get.pnpm.io/install.sh -o "$PNPM_INSTALL"
ENV="$HOME/.bashrc" SHELL="$(which bash)" PNPM_VERSION="${PNPM_VERSION}" bash "$PNPM_INSTALL"
rm -f "$PNPM_INSTALL"

export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
echo "    pnpm $(pnpm --version 2>/dev/null || echo 'installed — reload shell to use')"

# ─── Supabase CLI ──────────────────────────────────────────────────────────────
echo "--> Installing Supabase CLI..."
# Install via npm globally so `supabase` is available in PATH
npm install -g supabase --prefer-offline 2>/dev/null || npm install -g supabase
echo "    supabase $(supabase --version 2>/dev/null || echo 'installed')"

# ─── Project dependencies ──────────────────────────────────────────────────────
if [ -f "package.json" ]; then
  echo "--> Installing project dependencies..."
  "$PNPM_HOME/pnpm" install --frozen-lockfile 2>/dev/null \
    || "$PNPM_HOME/pnpm" install \
    || echo "    Warning: pnpm install failed — run 'pnpm install' manually"
fi

# ─── Playwright browsers ───────────────────────────────────────────────────────
if [ -f "package.json" ] && grep -q '"@playwright/test"' package.json 2>/dev/null; then
  echo "--> Installing Playwright browsers..."
  "$PNPM_HOME/pnpm" exec playwright install --with-deps chromium firefox webkit \
    || npx playwright install --with-deps chromium \
    || echo "    Warning: Playwright browser install failed — run 'pnpm exec playwright install' manually"
fi

# ─── Google Chrome stable ─────────────────────────────────────────────────────
# Installs Chrome stable for chrome-devtools-mcp (headless DevTools inspection).
# Playwright uses its own Chromium build; this is a separate binary.
echo "--> Installing Google Chrome stable..."
sudo bash .devcontainer/install-chrome.sh

# ─── shadcn/ui ─────────────────────────────────────────────────────────────────
# Only initialise if components.json doesn't exist yet
if [ -f "package.json" ] && [ ! -f "components.json" ]; then
  echo "--> Initialising shadcn/ui..."
  npx --yes shadcn@latest init -d --base radix || echo "    shadcn init skipped — run 'npx shadcn@latest init -d --base radix' manually"
fi

# ─── App rename ────────────────────────────────────────────────────────────────
# Derive the app name from the git remote or the working directory name,
# then replace the "my-nextjs-app" placeholder in package.json.
# Skipped if the name has already been changed (i.e. this isn't a fresh clone).
TEMPLATE_NAME="my-nextjs-app"
CURRENT_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "")

if [ "$CURRENT_NAME" = "$TEMPLATE_NAME" ]; then
  echo "--> Renaming app from template placeholder..."

  # 1. Try the GitHub remote repo slug (works in Codespaces and after `gh repo create`)
  APP_NAME=$(git remote get-url origin 2>/dev/null \
    | sed -E 's|.*[:/]([^/]+/)?([^/]+)(\.git)?$|\2|' \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9-]/-/g' \
    | sed 's/--*/-/g; s/^-//; s/-$//')

  # 2. Fall back to the directory name
  if [ -z "$APP_NAME" ] || [ "$APP_NAME" = "$TEMPLATE_NAME" ]; then
    APP_NAME=$(basename "$(pwd)" \
      | tr '[:upper:]' '[:lower:]' \
      | sed 's/[^a-z0-9-]/-/g' \
      | sed 's/--*/-/g; s/^-//; s/-$//')
  fi

  # 3. Last resort — keep the template name so we don't break anything
  if [ -z "$APP_NAME" ]; then
    APP_NAME="$TEMPLATE_NAME"
  fi

  if [ "$APP_NAME" != "$TEMPLATE_NAME" ]; then
    sed -i "s|\"name\": \"$TEMPLATE_NAME\"|\"name\": \"$APP_NAME\"|" package.json
    echo "    ✓ package.json name → $APP_NAME"
  else
    echo "    Could not determine app name — update package.json manually"
  fi
else
  echo "--> App already renamed ($CURRENT_NAME) — skipping"
fi

# Claude Code plugins
npx plugins add vercel/vercel-plugin

echo ""
echo "==> Post-create complete!"
echo "    Run 'pnpm dev' to start the dev server."
echo "    Run 'pnpm supabase start' to start the local Supabase stack."
