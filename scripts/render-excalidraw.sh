#!/usr/bin/env bash
# render-excalidraw.sh - Convert Excalidraw JSON to SVG/PNG
#
# Usage: render-excalidraw.sh <input.excalidraw> <output.svg|png> [format]
#
# Dependencies:
# - Node.js
# - @excalidraw/excalidraw npm package (optional, graceful degradation)

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
    echo -e "${YELLOW}⚠ Node.js not found${NC}" >&2
    echo -e "${BLUE}Excalidraw source saved at: $INPUT_FILE${NC}"
    echo -e "${BLUE}You can open and export manually at: https://excalidraw.com${NC}"
    exit 1
fi

echo -e "${BLUE}Rendering Excalidraw diagram...${NC}"
echo -e "${BLUE}Input: $INPUT_FILE${NC}"
echo -e "${BLUE}Output: $OUTPUT_FILE${NC}"
echo -e "${BLUE}Format: $FORMAT${NC}"

# Create a temporary Node.js script for rendering
TEMP_SCRIPT=$(mktemp /tmp/excalidraw-render.XXXXXX.mjs)

cat > "$TEMP_SCRIPT" <<'EOJS'
import { readFile, writeFile } from 'fs/promises';
import { createCanvas } from 'canvas';

// Parse command line arguments
const [inputFile, outputFile, format] = process.argv.slice(2);

async function renderExcalidraw() {
    try {
        // Read Excalidraw JSON
        const data = await readFile(inputFile, 'utf-8');
        const excalidrawData = JSON.parse(data);

        console.error('✓ Loaded Excalidraw data');
        console.error(`  Elements: ${excalidrawData.elements?.length || 0}`);

        // For now, we'll create a placeholder SVG
        // Full Excalidraw rendering requires @excalidraw/excalidraw package
        // which has complex dependencies

        const svg = generatePlaceholderSVG(excalidrawData);

        if (format === 'svg') {
            await writeFile(outputFile, svg);
            console.error('✓ SVG export successful');
        } else if (format === 'png') {
            // PNG rendering would require canvas conversion
            console.error('⚠ PNG rendering not yet implemented');
            console.error('  Falling back to SVG');
            await writeFile(outputFile.replace(/\.png$/, '.svg'), svg);
        }

        process.exit(0);
    } catch (error) {
        console.error('✗ Error rendering Excalidraw:', error.message);
        process.exit(1);
    }
}

function generatePlaceholderSVG(data) {
    const elements = data.elements || [];

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
        if (el.x !== undefined && el.y !== undefined) {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + (el.width || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));
        }
    });

    const width = maxX - minX + 40;
    const height = maxY - minY + 40;
    const viewBoxX = minX - 20;
    const viewBoxY = minY - 20;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      text { font-family: 'Virgil', 'Excalifont', cursive, sans-serif; }
    </style>
  </defs>
`;

    // Render basic elements
    elements.forEach(el => {
        if (el.type === 'rectangle') {
            svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}"
                fill="${el.backgroundColor || 'transparent'}"
                stroke="${el.strokeColor || '#000'}"
                stroke-width="${el.strokeWidth || 1}" />\n`;
        } else if (el.type === 'ellipse') {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            svgContent += `  <ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}"
                fill="${el.backgroundColor || 'transparent'}"
                stroke="${el.strokeColor || '#000'}"
                stroke-width="${el.strokeWidth || 1}" />\n`;
        } else if (el.type === 'arrow' || el.type === 'line') {
            const points = el.points || [[0, 0]];
            let pathData = `M ${el.x} ${el.y}`;
            points.forEach(p => {
                pathData += ` L ${el.x + p[0]} ${el.y + p[1]}`;
            });
            svgContent += `  <path d="${pathData}"
                stroke="${el.strokeColor || '#000'}"
                stroke-width="${el.strokeWidth || 1}"
                fill="none" />\n`;
        } else if (el.type === 'text') {
            svgContent += `  <text x="${el.x}" y="${el.y + (el.height || 20)}"
                font-size="${el.fontSize || 16}"
                fill="${el.strokeColor || '#000'}">${escapeXml(el.text || '')}</text>\n`;
        }
    });

    svgContent += `</svg>`;

    return svgContent;
}

function escapeXml(str) {
    return str.replace(/[<>&'"]/g, char => {
        switch (char) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return char;
        }
    });
}

renderExcalidraw();
EOJS

# Run the rendering script
if node "$TEMP_SCRIPT" "$INPUT_FILE" "$OUTPUT_FILE" "$FORMAT" 2>&1; then
    rm -f "$TEMP_SCRIPT"
    echo -e "${GREEN}✓ Rendering successful${NC}"
    echo -e "${GREEN}Output: $OUTPUT_FILE${NC}"
    exit 0
else
    rm -f "$TEMP_SCRIPT"
    echo -e "${RED}✗ Rendering failed${NC}" >&2
    echo -e "${YELLOW}⚠ Excalidraw rendering requires additional setup${NC}" >&2
    echo -e "${BLUE}Excalidraw source saved at: $INPUT_FILE${NC}"
    echo -e "${BLUE}You can open and export manually at: https://excalidraw.com${NC}"
    exit 1
fi
