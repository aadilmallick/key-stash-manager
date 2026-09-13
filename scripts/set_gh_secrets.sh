#!/usr/bin/env bash
# ==============================================================================
# Script: set_gh_secrets.sh
# Description: Reads an input .env file and sets its key-value pairs as GitHub
#              repository secrets using the GitHub CLI (`gh`).
# ==============================================================================

set -euo pipefail

# Text formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 1. Check for gh CLI
if ! command -v gh &> /dev/null; then
  echo -e "${RED}Error:${NC} GitHub CLI ('gh') is not installed."
  echo "Please install it via 'brew install gh' or https://cli.github.com/"
  exit 1
fi

# 2. Check gh authentication status
if ! gh auth status &> /dev/null; then
  echo -e "${RED}Error:${NC} You are not authenticated with GitHub CLI."
  echo "Please run 'gh auth login' first."
  exit 1
fi

# 3. Determine target .env file path
ENV_FILE="${1:-}"

if [ -z "$ENV_FILE" ]; then
  if [ -f "landing/.env" ]; then
    ENV_FILE="landing/.env"
  elif [ -f ".env" ]; then
    ENV_FILE=".env"
  elif [ -f "../landing/.env" ]; then
    ENV_FILE="../landing/.env"
  elif [ -f "../.env" ]; then
    ENV_FILE="../.env"
  else
    echo -e "${RED}Error:${NC} No .env file specified and could not auto-detect one."
    echo "Usage: $0 [path/to/.env]"
    exit 1
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error:${NC} File not found: '$ENV_FILE'"
  exit 1
fi

echo -e "${BLUE}==>${NC} ${BOLD}Reading environment variables from:${NC} $ENV_FILE"

# Detect repository
CURRENT_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -n "$CURRENT_REPO" ]; then
  echo -e "${BLUE}==>${NC} ${BOLD}Target Repository:${NC} $CURRENT_REPO"
else
  echo -e "${YELLOW}Notice:${NC} Could not auto-detect repo name, gh will use current directory git context."
fi

COUNT=0

# Read file line by line safely
while IFS= read -r line || [ -n "$line" ]; do
  # Strip leading/trailing whitespace
  trimmed=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  # Skip empty lines or comments
  if [ -z "$trimmed" ] || [[ "$trimmed" =~ ^# ]]; then
    continue
  fi

  # Must contain an '='
  if [[ "$trimmed" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    KEY="${BASH_REMATCH[1]}"
    VALUE="${BASH_REMATCH[2]}"

    # Strip surrounding quotes if present (double or single)
    if [[ "$VALUE" =~ ^\"(.*)\"$ ]]; then
      VALUE="${BASH_REMATCH[1]}"
    elif [[ "$VALUE" =~ ^\'(.*)\'$ ]]; then
      VALUE="${BASH_REMATCH[1]}"
    fi

    echo -ne "  Setting secret ${BOLD}${KEY}${NC}... "
    
    # Send value via stdin to avoid exposing secrets in process list
    printf "%s" "$VALUE" | gh secret set "$KEY"

    echo -e "${GREEN}✓ Done${NC}"
    COUNT=$((COUNT + 1))
  else
    echo -e "${YELLOW}  Skipping invalid line:${NC} $trimmed"
  fi
done < "$ENV_FILE"

echo ""
echo -e "${GREEN}${BOLD}Success!${NC} Set ${BOLD}$COUNT${NC} secret(s) in repository."
echo -e "You can verify secrets at: ${BLUE}https://github.com/${CURRENT_REPO}/settings/secrets/actions${NC}"
