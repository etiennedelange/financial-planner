#!/usr/bin/env bash
set -e

echo "==> Starting devcontainer post-create setup..."

# ─── Claude Code CLI ───────────────────────────────────────────────────────────
# Always reinstall to stay current; preserve auth credentials and global config
# echo "--> Installing Claude Code CLI..."
# CLAUDE_CREDS="$HOME/.claude/.credentials.json"
# CLAUDE_CONFIG="$HOME/.claude.json"
# [ -f "$CLAUDE_CREDS" ]  && cp "$CLAUDE_CREDS"  /tmp/.claude_creds_backup
# [ -f "$CLAUDE_CONFIG" ] && cp "$CLAUDE_CONFIG" /tmp/.claude_config_backup

# CLAUDE_INSTALL=$(mktemp)
# curl -fsSL https://claude.ai/install.sh -o "$CLAUDE_INSTALL"
# bash "$CLAUDE_INSTALL"
# rm -f "$CLAUDE_INSTALL"

# [ -f /tmp/.claude_creds_backup ]  && mv /tmp/.claude_creds_backup  "$CLAUDE_CREDS"
# [ -f /tmp/.claude_config_backup ] && mv /tmp/.claude_config_backup "$CLAUDE_CONFIG"

# Restore from backup on first install after a container wipe
# if [ ! -f "$CLAUDE_CONFIG" ]; then
#   LATEST_BACKUP=$(ls -t "$HOME/.claude/backups/.claude.json.backup."* 2>/dev/null | head -1)
#   if [ -n "$LATEST_BACKUP" ]; then
#     cp "$LATEST_BACKUP" "$CLAUDE_CONFIG"
#     echo "    Restored Claude config from backup: $(basename "$LATEST_BACKUP")"
#   fi
# fi

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

# Ensure the node user owns the Claude config directory for credential storage
sudo chown node:node /home/node/.claude

# ─── Claude settings symlink ──────────────────────────────────────────────────
# Keep settings.json in the repo so plugin installs persist across rebuilds.
echo "--> Linking Claude settings to devcontainer config..."
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
REPO_SETTINGS="/workspaces/retirement-calculator-claude/.devcontainer/claude-settings.json"
# Replace with symlink only if it's a regular file (or missing); skip if already linked correctly
if [ ! -L "$CLAUDE_SETTINGS" ] || [ "$(readlink "$CLAUDE_SETTINGS")" != "$REPO_SETTINGS" ]; then
  # Seed repo file from existing settings if it has content
  if [ -f "$CLAUDE_SETTINGS" ] && [ ! -L "$CLAUDE_SETTINGS" ] && [ -s "$CLAUDE_SETTINGS" ] && [ ! -s "$REPO_SETTINGS" ]; then
    cp "$CLAUDE_SETTINGS" "$REPO_SETTINGS"
  fi
  rm -f "$CLAUDE_SETTINGS"
  ln -s "$REPO_SETTINGS" "$CLAUDE_SETTINGS"
  echo "    Linked $CLAUDE_SETTINGS -> $REPO_SETTINGS"
else
  echo "    Already linked — skipping"
fi

echo ""
echo "==> Post-create complete!"
echo "    Run 'pnpm dev' to start the dev server."
echo "    Run 'pnpm supabase start' to start the local Supabase stack."
