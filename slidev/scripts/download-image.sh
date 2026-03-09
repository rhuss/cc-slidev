#!/usr/bin/env bash
# download-image.sh - Download and optimize images for presentations

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
IMAGE_URL="${1:-}"
OUTPUT_DIR="${2:-public/images}"
FILENAME="${3:-}"

# Show usage if no URL provided
if [[ -z "$IMAGE_URL" ]]; then
    echo "Usage: $0 <image-url> [output-dir] [filename]"
    echo ""
    echo "Examples:"
    echo "  $0 https://images.unsplash.com/photo-123 public/images"
    echo "  $0 https://example.com/image.jpg public/images custom-name.jpg"
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl not found${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Determine filename
if [[ -z "$FILENAME" ]]; then
    # Extract filename from URL or generate hash
    FILENAME=$(basename "$IMAGE_URL" | sed 's/?.*//')

    # If no extension, add .jpg
    if [[ ! "$FILENAME" =~ \.(jpg|jpeg|png|gif|webp|svg)$ ]]; then
        FILENAME="${FILENAME}.jpg"
    fi
fi

OUTPUT_PATH="$OUTPUT_DIR/$FILENAME"

echo -e "${BLUE}Downloading image...${NC}"
echo -e "${BLUE}URL: $IMAGE_URL${NC}"
echo -e "${BLUE}Output: $OUTPUT_PATH${NC}"

# Download with curl
if curl -L -o "$OUTPUT_PATH" "$IMAGE_URL" 2>&1 | grep -q "HTTP"; then
    # Check if file was actually downloaded
    if [[ -f "$OUTPUT_PATH" ]] && [[ -s "$OUTPUT_PATH" ]]; then
        echo -e "${GREEN}✓ Download successful${NC}"

        # Get file size
        if command -v du &> /dev/null; then
            SIZE=$(du -h "$OUTPUT_PATH" | cut -f1)
            echo -e "${GREEN}Size: $SIZE${NC}"
        fi

        # Optional: optimize with imagemagick if available
        if command -v convert &> /dev/null; then
            echo -e "${BLUE}Optimizing for presentations...${NC}"
            # Resize to max 1920px width while maintaining aspect ratio
            convert "$OUTPUT_PATH" -resize '1920x1080>' "$OUTPUT_PATH" 2>/dev/null || true
        fi

        echo -e "${GREEN}Path: $OUTPUT_PATH${NC}"
        exit 0
    else
        echo -e "${RED}✗ Download failed - empty or missing file${NC}"
        rm -f "$OUTPUT_PATH"
        exit 1
    fi
else
    echo -e "${RED}✗ Download failed${NC}"
    rm -f "$OUTPUT_PATH"
    exit 1
fi
