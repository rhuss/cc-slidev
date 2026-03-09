#!/usr/bin/env bash
# check-slidev.sh - Check if Slidev is installed and get version info

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if slidev is installed globally
if command -v slidev &> /dev/null; then
    INSTALLED_VERSION=$(slidev --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
    echo -e "${GREEN}✓ Slidev is installed${NC}"
    echo "Version: $INSTALLED_VERSION"

    # Check npm for latest version
    LATEST_VERSION=$(npm view @slidev/cli version 2>/dev/null || echo "unknown")

    if [[ "$INSTALLED_VERSION" != "unknown" ]] && [[ "$LATEST_VERSION" != "unknown" ]]; then
        if [[ "$INSTALLED_VERSION" == "$LATEST_VERSION" ]]; then
            echo -e "${GREEN}✓ You have the latest version${NC}"
            exit 0
        else
            echo -e "${YELLOW}⚠ Newer version available: $LATEST_VERSION${NC}"
            exit 2
        fi
    fi
    exit 0
else
    echo -e "${RED}✗ Slidev is not installed${NC}"
    exit 1
fi
