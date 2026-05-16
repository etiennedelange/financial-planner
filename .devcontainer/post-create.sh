#!/usr/bin/env bash
set -e

# Browsers
sudo bash .devcontainer/install-chrome.sh
npx playwright install --with-deps chromium

# Claude Code CLI — always reinstall to stay up to date, but preserve auth credentials
CLAUDE_CREDS="$HOME/.claude/.credentials.json"
[ -f "$CLAUDE_CREDS" ] && cp "$CLAUDE_CREDS" /tmp/.claude_creds_backup
CLAUDE_INSTALL=$(mktemp)
curl -fsSL https://claude.ai/install.sh -o "$CLAUDE_INSTALL"
bash "$CLAUDE_INSTALL"
rm -f "$CLAUDE_INSTALL"
[ -f /tmp/.claude_creds_backup ] && mv /tmp/.claude_creds_backup "$CLAUDE_CREDS"

# Python tooling (uv + semgrep) — same pattern
UV_INSTALL=$(mktemp)
curl -LsSf https://astral.sh/uv/install.sh -o "$UV_INSTALL"
sh "$UV_INSTALL"
rm -f "$UV_INSTALL"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
~/.local/bin/uv tool install semgrep

# pnpm — official standalone installer (no npm or corepack needed)
PNPM_INSTALL=$(mktemp)
curl -fsSL https://get.pnpm.io/install.sh -o "$PNPM_INSTALL"
ENV="$HOME/.bashrc" SHELL="$(which bash)" bash "$PNPM_INSTALL"
rm -f "$PNPM_INSTALL"
