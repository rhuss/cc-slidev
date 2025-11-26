#!/usr/bin/env bash
# render-mermaid.sh - Render mermaid diagrams to high-quality SVG/PNG

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
INPUT_FILE="${1:-}"
OUTPUT_FILE="${2:-}"
FORMAT="${3:-svg}"  # svg or png
THEME="${4:-default}"

# Show usage if no arguments
if [[ -z "$INPUT_FILE" ]] || [[ -z "$OUTPUT_FILE" ]]; then
    echo "Usage: $0 <input.mmd> <output.svg|png> [format] [theme]"
    echo ""
    echo "Examples:"
    echo "  $0 diagram.mmd diagram.svg"
    echo "  $0 diagram.mmd diagram.png png"
    echo "  $0 diagram.mmd diagram.svg svg dark"
    exit 1
fi

# Check if mermaid-cli is available
if ! command -v mmdc &> /dev/null; then
    echo -e "${YELLOW}⚠ mermaid-cli not found${NC}"
    echo -e "${BLUE}Mermaid diagrams can still be rendered inline by Slidev.${NC}"
    echo ""
    echo -e "${BLUE}For high-quality offline rendering, install mermaid-cli:${NC}"
    echo "  npm install -g @mermaid-js/mermaid-cli"
    echo ""
    echo -e "${BLUE}Or use online rendering at: https://mermaid.live/${NC}"
    exit 1
fi

# Check if input file exists
if [[ ! -f "$INPUT_FILE" ]]; then
    echo -e "${RED}✗ Input file not found: $INPUT_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}Rendering mermaid diagram...${NC}"
echo -e "${BLUE}Input: $INPUT_FILE${NC}"
echo -e "${BLUE}Output: $OUTPUT_FILE${NC}"
echo -e "${BLUE}Format: $FORMAT${NC}"
echo -e "${BLUE}Theme: $THEME${NC}"

# Build mermaid-cli command
CMD="mmdc -i \"$INPUT_FILE\" -o \"$OUTPUT_FILE\" -t $THEME"

# Add format-specific options
if [[ "$FORMAT" == "png" ]]; then
    CMD="$CMD -b transparent -w 1920 -H 1080"
fi

# Execute rendering
if eval $CMD 2>&1; then
    echo -e "${GREEN}✓ Rendering successful${NC}"
    echo -e "${GREEN}Output: $OUTPUT_FILE${NC}"
    exit 0
else
    echo -e "${RED}✗ Rendering failed${NC}"
    echo -e "${YELLOW}Falling back to inline rendering (Slidev will handle it)${NC}"
    exit 1
fi
