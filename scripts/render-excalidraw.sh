#!/usr/bin/env bash
# render-excalidraw.sh - Convert Excalidraw JSON to SVG/PNG using excalidraw-brute-export-cli
#
# Usage: render-excalidraw.sh <input.excalidraw> <output.svg|png> [format]
#
# Dependencies:
# - Node.js and npm
# - excalidraw-brute-export-cli (auto-installed if missing)
# - playwright chromium (auto-installed if missing)

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Arguments
INPUT_FILE="${1:-}"
OUTPUT_FILE="${2:-}"
FORMAT="${3:-svg}"  # svg or png

# Show usage if no arguments
if [[ -z "$INPUT_FILE" ]] || [[ -z "$OUTPUT_FILE" ]]; then
    echo "Usage: $0 <input.excalidraw> <output.svg|png> [format]"
    echo ""
    echo "Examples:"
    echo "  $0 diagram.excalidraw diagram.svg"
    echo "  $0 diagram.excalidraw diagram.png png"
    exit 1
fi

# Check if input file exists
if [[ ! -f "$INPUT_FILE" ]]; then
    echo -e "${RED}✗ Input file not found: $INPUT_FILE${NC}" >&2
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}" >&2
    echo -e "${YELLOW}Please install Node.js to render Excalidraw diagrams${NC}"
    echo -e "${BLUE}Visit: https://nodejs.org${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}" >&2
    echo -e "${YELLOW}Please install npm to render Excalidraw diagrams${NC}"
    exit 1
fi

# Check if excalidraw-brute-export-cli is installed
if ! command -v excalidraw-brute-export-cli &> /dev/null; then
    echo -e "${YELLOW}⚠ excalidraw-brute-export-cli not found${NC}"
    echo -e "${BLUE}Installing excalidraw-brute-export-cli...${NC}"

    # Install globally
    if npm install -g excalidraw-brute-export-cli; then
        echo -e "${GREEN}✓ excalidraw-brute-export-cli installed${NC}"
    else
        echo -e "${RED}✗ Failed to install excalidraw-brute-export-cli${NC}" >&2
        exit 1
    fi

    # Install playwright dependencies
    echo -e "${BLUE}Installing playwright dependencies...${NC}"
    if npx playwright install-deps && npx playwright install chromium; then
        echo -e "${GREEN}✓ Playwright dependencies installed${NC}"
    else
        echo -e "${YELLOW}⚠ Playwright installation may have issues${NC}"
        echo -e "${YELLOW}  Rendering may still work, continuing...${NC}"
    fi
fi

echo -e "${BLUE}Rendering Excalidraw diagram...${NC}"
echo -e "${BLUE}Input:  $INPUT_FILE${NC}"
echo -e "${BLUE}Output: $OUTPUT_FILE${NC}"
echo -e "${BLUE}Format: $FORMAT${NC}"

# Create output directory if it doesn't exist
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
mkdir -p "$OUTPUT_DIR"

# Render using excalidraw-brute-export-cli
if npx excalidraw-brute-export-cli \
    -i "$INPUT_FILE" \
    --background 1 \
    --embed-scene 0 \
    --dark-mode 0 \
    --scale 1 \
    --format "$FORMAT" \
    -o "$OUTPUT_FILE" 2>&1; then

    echo -e "${GREEN}✓ Rendering successful${NC}"
    echo -e "${GREEN}Output: $OUTPUT_FILE${NC}"
    exit 0
else
    echo -e "${RED}✗ Rendering failed${NC}" >&2
    echo -e "${YELLOW}⚠ You can edit and export manually:${NC}" >&2
    echo -e "${BLUE}  1. Open https://excalidraw.com${NC}"
    echo -e "${BLUE}  2. Load file: $INPUT_FILE${NC}"
    echo -e "${BLUE}  3. Export to $FORMAT${NC}"
    exit 1
fi
