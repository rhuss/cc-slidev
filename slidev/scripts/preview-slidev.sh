#!/usr/bin/env bash
# preview-slidev.sh - Start Slidev dev server

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Arguments
SLIDES_FILE="${1:-slides.md}"
PORT="${2:-3030}"
OPEN_BROWSER="${3:-true}"

# Check if slidev is available
if ! command -v slidev &> /dev/null; then
    echo -e "${YELLOW}⚠ Slidev not found. Please install it first.${NC}"
    exit 1
fi

# Check if slides file exists
if [[ ! -f "$SLIDES_FILE" ]]; then
    echo -e "${YELLOW}⚠ Slides file not found: $SLIDES_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}Starting Slidev preview...${NC}"
echo -e "${BLUE}File: $SLIDES_FILE${NC}"
echo -e "${BLUE}Port: $PORT${NC}"
echo -e "${GREEN}Server will be available at: http://localhost:$PORT${NC}"

# Build command
CMD="slidev $SLIDES_FILE --port $PORT"

if [[ "$OPEN_BROWSER" == "false" ]]; then
    CMD="$CMD --no-open"
fi

# Start Slidev in background
$CMD &
SLIDEV_PID=$!

# Save PID to file for later stopping
echo $SLIDEV_PID > /tmp/slidev-preview.pid

echo -e "${GREEN}✓ Slidev started (PID: $SLIDEV_PID)${NC}"
echo -e "${BLUE}To stop: kill $SLIDEV_PID${NC}"
