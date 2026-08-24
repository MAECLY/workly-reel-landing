#!/usr/bin/env bash
#
# Install dependencies in an environment with no SSH agent.
#
# The design system is a private repository consumed as a pinned git
# dependency. A local machine resolves it through the developer's own SSH agent.
# A Vercel build has neither an agent nor a key, so `pnpm install` fails at the
# git fetch with a permission error that reads like a missing package.
#
# This writes a deploy key from the build environment, restricts SSH to it, and
# then installs normally. The key never reaches the repository and never reaches
# the built output.
#
# Set this as the project's install command:
#
#   bash scripts/vercel-install.sh
#
# And add ONE environment variable, for the Production and Preview scopes:
#
#   WORKLY_REEL_UI_DEPLOY_KEY   the private half of a read-only deploy key
#                               added to MAECLY/workly-reel-ui
#
# Generate the pair with:
#
#   ssh-keygen -t ed25519 -C "vercel@workly-reel-landing" -f ./deploy-key -N ""
#
# Add `deploy-key.pub` to MAECLY/workly-reel-ui under Settings, Deploy keys,
# WITHOUT write access. Paste the contents of `deploy-key` into the Vercel
# variable, then delete both local files.

set -euo pipefail

if [ -z "${WORKLY_REEL_UI_DEPLOY_KEY:-}" ]; then
  # Locally there is an agent, so this is the ordinary path and not an error.
  echo "No WORKLY_REEL_UI_DEPLOY_KEY set; installing with the ambient SSH configuration."
  exec pnpm install --no-frozen-lockfile
fi

KEY_DIR="$(mktemp -d)"
KEY_FILE="$KEY_DIR/id_ed25519"

cleanup() {
  rm -rf "$KEY_DIR"
}
trap cleanup EXIT

# Vercel's environment variables collapse newlines, so a key pasted as a single
# line has to be restored before ssh will read it.
printf '%s\n' "$WORKLY_REEL_UI_DEPLOY_KEY" | sed 's/\\n/\n/g' > "$KEY_FILE"
chmod 600 "$KEY_FILE"

if ! ssh-keygen -y -f "$KEY_FILE" > /dev/null 2>&1; then
  echo "WORKLY_REEL_UI_DEPLOY_KEY is not a readable private key." >&2
  echo "Paste the whole file including the BEGIN and END lines." >&2
  exit 1
fi

mkdir -p "$KEY_DIR/.ssh"
ssh-keyscan -t rsa,ecdsa,ed25519 github.com > "$KEY_DIR/.ssh/known_hosts" 2>/dev/null

# `IdentitiesOnly` matters: without it ssh offers every identity it can find and
# GitHub rejects the connection after too many attempts.
export GIT_SSH_COMMAND="ssh -i $KEY_FILE -o IdentitiesOnly=yes -o UserKnownHostsFile=$KEY_DIR/.ssh/known_hosts -o StrictHostKeyChecking=yes"

echo "Installing with the deploy key for MAECLY/workly-reel-ui."
pnpm install --no-frozen-lockfile
