#!/usr/bin/env bash
# Installs Google Chrome stable on Debian/Ubuntu devcontainers.
# Called from postCreateCommand so it runs on every container rebuild.
set -euo pipefail

if command -v google-chrome-stable &>/dev/null; then
  echo "Chrome $(google-chrome-stable --version) already installed, skipping."
  exit 0
fi

echo "Installing Google Chrome stable..."

# Prerequisites
apt-get update -qq
apt-get install -y --no-install-recommends wget gnupg ca-certificates

# Google signing key (modern gpg keyring location)
wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
  | gpg --dearmor -o /usr/share/keyrings/google-chrome-archive-keyring.gpg

# APT source
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-archive-keyring.gpg] \
http://dl.google.com/linux/chrome/deb/ stable main" \
  > /etc/apt/sources.list.d/google-chrome.list

# Install
apt-get update -qq
apt-get install -y --no-install-recommends google-chrome-stable

echo "Installed $(google-chrome-stable --version)"
