#!/usr/bin/env bash
set -e

echo "==> Starting devcontainer post-create setup..."

# ─── OpenCode CLI ─────────────────────────────────────────────────────────────
# No official devcontainer feature exists for OpenCode (unlike Claude Code), so
# install via the official installer. The binary, global config and auth/session
# data are persisted as named volumes mounted in devcontainer.json, so auth and
# plugins survive rebuilds — only the ~/.opencode/bin binary is (re)installed here.
echo "--> Installing OpenCode CLI..."
export PATH="$HOME/.opencode/bin:$PATH"
if command -v opencode >/dev/null 2>&1; then
  echo "    opencode already installed ($(opencode --version)) — upgrading..."
  opencode upgrade || echo "    Warning: opencode upgrade failed — will try again on next startup"
else
  curl -fsSL https://opencode.ai/install | bash \
    || echo "    Warning: opencode install failed — run 'curl -fsSL https://opencode.ai/install | bash' manually"
fi
if ! grep -q '.opencode/bin' ~/.bashrc 2>/dev/null; then
  echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.bashrc
fi
echo "    opencode $(opencode --version 2>/dev/null || echo 'not yet on PATH — reload shell')"

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

# ─── Environment variables ─────────────────────────────────────────────────────
# Copy .env.example → .env.local on first container build so the app can
# connect to local Supabase without any manual setup.
if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  echo "--> Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "    .env.local created. Edit it if you need to point at a different Supabase project."
fi

# # ─── Claude Code user settings ────────────────────────────────────────────────
# # Symlink ~/.claude/settings.json to the repo file so changes are always committed
# echo "--> Linking Claude Code user settings..."
# ln -sf "$(pwd)"/.devcontainer/claude-settings.json "$HOME/.claude/settings.json"
# ─── Claude Code user settings ────────────────────────────────────────────────

# Symlink ~/.claude/settings.json to the repo file so changes are always committed.
# postCreateCommand runs with cwd = workspace folder, so $(pwd) resolves correctly
# regardless of what the repo/workspace folder is named.
echo "--> Linking Claude Code user settings..."
ln -sf "$(pwd)/.devcontainer/claude-settings.json" "$HOME/.claude/settings.json"

# Ensure the node user owns the Claude config directory for credential storage
sudo chown node:node /home/node/.claude

# ─── Claude statusline symlink ──────────────────────────────────────────────────
# Keep the statusline script in the repo (referenced by claude-settings.json) so
# it survives rebuilds. claude-settings.json points at ~/.claude/statusline-command.sh.
echo "--> Linking Claude statusline script..."
STATUSLINE_SCRIPT="$HOME/.claude/statusline-command.sh"
REPO_STATUSLINE_SCRIPT="$(pwd)/.devcontainer/statusline-command.sh"
if [ ! -L "$STATUSLINE_SCRIPT" ] || [ "$(readlink "$STATUSLINE_SCRIPT")" != "$REPO_STATUSLINE_SCRIPT" ]; then
  rm -f "$STATUSLINE_SCRIPT"
  ln -s "$REPO_STATUSLINE_SCRIPT" "$STATUSLINE_SCRIPT"
  chmod +x "$REPO_STATUSLINE_SCRIPT"
  echo "    Linked $STATUSLINE_SCRIPT -> $REPO_STATUSLINE_SCRIPT"
else
  echo "    Already linked — skipping"
fi

# ─── Claude settings symlink (robust re-check) ─────────────────────────────────
# Keep settings.json in the repo so plugin installs persist across rebuilds.
echo "--> Linking Claude settings to devcontainer config..."
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
REPO_SETTINGS="$(pwd)/.devcontainer/claude-settings.json"
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

# Fix claude-code ownership: the devcontainer feature installs as root, which
# blocks auto-updates. Transfer ownership to node so npm can write to the prefix.
echo "--> Fixing Claude Code npm prefix ownership..."
sudo chown -R node:npm \
  /usr/local/share/npm-global/lib/node_modules/@anthropic-ai \
  /usr/local/share/npm-global/bin/claude 2>/dev/null || true

# ─── OpenCode user config ────────────────────────────────────────────────────
# Symlink the global opencode config to a committed file in .devcontainer/ so
# changes are always version-controlled, mirroring the Claude settings link
# above. The named volume mount keeps auth + plugins persisted across rebuilds.
echo "--> Linking OpenCode user config..."
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.jsonc"
REPO_OPENCODE_CONFIG="$(pwd)/.devcontainer/opencode-settings.jsonc"
if [ ! -L "$OPENCODE_CONFIG" ] || [ "$(readlink "$OPENCODE_CONFIG")" != "$REPO_OPENCODE_CONFIG" ]; then
  # Seed repo file from existing config if it has content
  if [ -f "$OPENCODE_CONFIG" ] && [ ! -L "$OPENCODE_CONFIG" ] && [ -s "$OPENCODE_CONFIG" ] && [ ! -s "$REPO_OPENCODE_CONFIG" ]; then
    cp "$OPENCODE_CONFIG" "$REPO_OPENCODE_CONFIG"
  fi
  rm -f "$OPENCODE_CONFIG"
  ln -s "$REPO_OPENCODE_CONFIG" "$OPENCODE_CONFIG"
  echo "    Linked $OPENCODE_CONFIG -> $REPO_OPENCODE_CONFIG"
else
  echo "    Already linked — skipping"
fi

# Ensure the node user owns the opencode config/data dirs for credential storage
sudo chown node:node /home/node/.config/opencode /home/node/.local/share/opencode /home/node/.opencode 2>/dev/null || true

echo ""
echo "==> Post-create complete!"
echo "    Run 'pnpm dev' to start the dev server."
echo "    Run 'pnpm supabase start' to start the local Supabase stack."
