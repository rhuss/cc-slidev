#!/usr/bin/env bash
# install-slidev.sh - Install or update Slidev globally

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ACTION="${1:-install}"  # install or update

# Detect package manager
if command -v pnpm &> /dev/null; then
    PKG_MGR="pnpm"
    INSTALL_CMD="pnpm add -g @slidev/cli"
elif command -v yarn &> /dev/null; then
    PKG_MGR="yarn"
    INSTALL_CMD="yarn global add @slidev/cli"
else
    PKG_MGR="npm"
    INSTALL_CMD="npm install -g @slidev/cli"
fi

echo -e "${BLUE}Using package manager: $PKG_MGR${NC}"

if [[ "$ACTION" == "update" ]]; then
    echo -e "${YELLOW}Updating Slidev globally...${NC}"
else
    echo -e "${YELLOW}Installing Slidev globally...${NC}"
fi

# Run installation/update
if $INSTALL_CMD; then
    echo -e "${GREEN}✓ Slidev installed successfully${NC}"

    # Verify installation
    if command -v slidev &> /dev/null; then
        VERSION=$(slidev --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo -e "${GREEN}Version: $VERSION${NC}"
    fi
    exit 0
else
    echo -e "${RED}✗ Failed to install Slidev${NC}"
    exit 1
fi
