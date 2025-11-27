#!/usr/bin/env bash
# render-plantuml.sh - Render PlantUML diagrams to high-quality SVG/PNG
#
# Usage: render-plantuml.sh <input.puml> <output.svg|png> [format] [server-url]
#
# Dependencies:
# - curl (for server-based rendering)
# - java + plantuml.jar (optional, for local rendering)

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
SERVER_URL="${4:-https://www.plantuml.com/plantuml}"

# Show usage if no arguments
if [[ -z "$INPUT_FILE" ]] || [[ -z "$OUTPUT_FILE" ]]; then
    echo "Usage: $0 <input.puml> <output.svg|png> [format] [server-url]"
    echo ""
    echo "Examples:"
    echo "  $0 diagram.puml diagram.svg"
    echo "  $0 diagram.puml diagram.png png"
    echo "  $0 diagram.puml diagram.svg svg https://plantuml.example.com"
    exit 1
fi

# Check if input file exists
if [[ ! -f "$INPUT_FILE" ]]; then
    echo -e "${RED}✗ Input file not found: $INPUT_FILE${NC}" >&2
    exit 1
fi

# Check if curl is available for server-based rendering
if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl is required but not installed${NC}" >&2
    exit 1
fi

echo -e "${BLUE}Rendering PlantUML diagram...${NC}"
echo -e "${BLUE}Input: $INPUT_FILE${NC}"
echo -e "${BLUE}Output: $OUTPUT_FILE${NC}"
echo -e "${BLUE}Format: $FORMAT${NC}"
echo -e "${BLUE}Server: $SERVER_URL${NC}"

# Encode PlantUML for server API
# PlantUML uses a custom encoding (not base64)
encode_plantuml() {
    local input="$1"
    # Use Python for encoding if available
    if command -v python3 &> /dev/null; then
        python3 -c "
import sys
import zlib
import base64

def plantuml_encode(text):
    zlibbed = zlib.compress(text.encode('utf-8'))
    compressed = zlibbed[2:-4]  # Remove zlib header and checksum

    # PlantUML alphabet
    alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

    result = ''
    for i in range(0, len(compressed), 3):
        if i+2 < len(compressed):
            b1, b2, b3 = compressed[i:i+3]
        elif i+1 < len(compressed):
            b1, b2 = compressed[i:i+2]
            b3 = 0
        else:
            b1 = compressed[i]
            b2 = b3 = 0

        result += alphabet[(b1 >> 2) & 0x3F]
        result += alphabet[((b1 & 0x3) << 4) | ((b2 >> 4) & 0xF)]
        result += alphabet[((b2 & 0xF) << 2) | ((b3 >> 6) & 0x3)]
        result += alphabet[b3 & 0x3F]

    return result

with open('$input', 'r') as f:
    text = f.read()

print(plantuml_encode(text))
" 2>/dev/null
    else
        echo -e "${YELLOW}⚠ Python3 not found, using simple encoding${NC}" >&2
        # Fallback: use base64 (not perfect but might work for simple diagrams)
        base64 < "$input" | tr -d '\n'
    fi
}

# Encode the PlantUML diagram
ENCODED=$(encode_plantuml "$INPUT_FILE")

if [[ -z "$ENCODED" ]]; then
    echo -e "${RED}✗ Failed to encode PlantUML diagram${NC}" >&2
    exit 1
fi

# Determine format endpoint
case "$FORMAT" in
    svg)
        FORMAT_ENDPOINT="svg"
        ;;
    png)
        FORMAT_ENDPOINT="png"
        ;;
    *)
        echo -e "${RED}✗ Unsupported format: $FORMAT${NC}" >&2
        echo "Supported formats: svg, png" >&2
        exit 1
        ;;
esac

# Construct server URL
RENDER_URL="${SERVER_URL}/${FORMAT_ENDPOINT}/${ENCODED}"

echo -e "${BLUE}Requesting: $RENDER_URL${NC}"

# Make request to PlantUML server
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT_FILE" "$RENDER_URL")

if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "${GREEN}✓ Rendering successful${NC}"
    echo -e "${GREEN}Output: $OUTPUT_FILE${NC}"
    exit 0
else
    echo -e "${RED}✗ Rendering failed (HTTP $HTTP_CODE)${NC}" >&2
    echo -e "${YELLOW}Server URL: $RENDER_URL${NC}" >&2

    # Try local rendering if plantuml.jar is available
    if command -v java &> /dev/null && [[ -f "$HOME/.plantuml/plantuml.jar" ]]; then
        echo -e "${YELLOW}Attempting local rendering with plantuml.jar...${NC}"
        if java -jar "$HOME/.plantuml/plantuml.jar" -t"$FORMAT" "$INPUT_FILE" -o "$(dirname "$OUTPUT_FILE")" 2>&1; then
            # PlantUML changes extension, rename if needed
            GENERATED="${INPUT_FILE%.*}.$FORMAT"
            if [[ -f "$GENERATED" ]] && [[ "$GENERATED" != "$OUTPUT_FILE" ]]; then
                mv "$GENERATED" "$OUTPUT_FILE"
            fi
            echo -e "${GREEN}✓ Local rendering successful${NC}"
            exit 0
        fi
    fi

    echo -e "${YELLOW}⚠ Could not render PlantUML diagram${NC}" >&2
    echo -e "${BLUE}PlantUML source saved at: $INPUT_FILE${NC}" >&2
    echo -e "${BLUE}You can render manually at: https://www.plantuml.com/plantuml/uml/${NC}" >&2
    exit 1
fi
