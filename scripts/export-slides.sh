#!/usr/bin/env bash
# export-slides.sh - Export Slidev presentation to various formats

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
SLIDES_FILE="${1:-slides.md}"
FORMAT="${2:-pdf}"
OUTPUT_DIR="${3:-exports}"

# Check if slidev is available
if ! command -v slidev &> /dev/null; then
    echo -e "${RED}✗ Slidev not found. Please install it first.${NC}"
    exit 1
fi

# Check if slides file exists
if [[ ! -f "$SLIDES_FILE" ]]; then
    echo -e "${RED}✗ Slides file not found: $SLIDES_FILE${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get base filename
BASENAME=$(basename "$SLIDES_FILE" .md)

echo -e "${BLUE}Exporting presentation...${NC}"
echo -e "${BLUE}Format: $FORMAT${NC}"

case "$FORMAT" in
    pdf)
        OUTPUT_FILE="$OUTPUT_DIR/${BASENAME}.pdf"
        echo -e "${YELLOW}Exporting to PDF...${NC}"
        slidev export "$SLIDES_FILE" --output "$OUTPUT_FILE"
        ;;
    pptx)
        OUTPUT_FILE="$OUTPUT_DIR/${BASENAME}.pptx"
        echo -e "${YELLOW}Exporting to PPTX...${NC}"
        slidev export "$SLIDES_FILE" --format pptx --output "$OUTPUT_FILE"
        ;;
    png)
        echo -e "${YELLOW}Exporting slides to individual PNG images...${NC}"
        # Use --per-slide to export each slide as a separate PNG
        slidev export "$SLIDES_FILE" --output "$OUTPUT_DIR/slides" --format png --per-slide

        # Count exported slides
        SLIDE_COUNT=$(ls -1 "$OUTPUT_DIR"/slide-*.png 2>/dev/null | wc -l)
        echo -e "${GREEN}✓ Exported $SLIDE_COUNT slides as PNG images${NC}"
        OUTPUT_FILE="$OUTPUT_DIR ($SLIDE_COUNT images)"
        ;;
    *)
        echo -e "${RED}✗ Unknown format: $FORMAT${NC}"
        echo "Supported formats: pdf, pptx, png"
        exit 1
        ;;
esac

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Export successful${NC}"
    echo -e "${GREEN}Output: $OUTPUT_FILE${NC}"
    exit 0
else
    echo -e "${RED}✗ Export failed${NC}"
    exit 1
fi
