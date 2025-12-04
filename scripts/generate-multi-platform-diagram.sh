#!/usr/bin/env bash
# generate-multi-platform-diagram.sh - Orchestrate generation of multi-platform diagrams
#
# Usage: generate-multi-platform-diagram.sh <slide-title> <mermaid-code> [presentation-dir]
#
# Generates diagrams in all enabled formats (Mermaid, PlantUML, Excalidraw)
# and stores them in an organized directory structure.
#
# CRITICAL STORAGE RULE:
# - ALL sources (.mmd, .puml, .excalidraw) → ./diagrams/ (top-level, version controlled)
# - Rendered images (.svg, .png) → ./public/images/<slug>/ (generated artifacts)
# NO EXCEPTIONS TO THIS RULE

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

# Arguments
SLIDE_TITLE="${1:-}"
MERMAID_CODE="${2:-}"
PRESENTATION_DIR="${3:-.}"

# Show usage if no arguments
if [[ -z "$SLIDE_TITLE" ]] || [[ -z "$MERMAID_CODE" ]]; then
    echo "Usage: $0 <slide-title> <mermaid-code> [presentation-dir]"
    echo ""
    echo "Example:"
    echo "  $0 \"Device Plugins Turn GPUs\" \"\$(cat diagram.mmd)\" ."
    exit 1
fi

# Function to create readable slug from slide title
create_slug() {
    local title="$1"
    local slide_num="$2"

    # Use the dedicated slug creation script if available
    if [[ -x "$SCRIPT_DIR/create-diagram-slug.sh" ]]; then
        "$SCRIPT_DIR/create-diagram-slug.sh" "$title" "$slide_num"
    else
        # Fallback: simple slugification
        echo "$title" | \
            tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9]/-/g' | \
            sed 's/-\+/-/g' | \
            sed 's/^-//;s/-$//' | \
            cut -c1-40
    fi
}

# Read configuration
echo -e "${BLUE}Reading configuration...${NC}"
CONFIG=$("$SCRIPT_DIR/read-diagram-config.sh" "$PRESENTATION_DIR")

if [[ -z "$CONFIG" ]]; then
    echo -e "${RED}✗ Failed to read configuration${NC}" >&2
    exit 1
fi

# Extract configuration values
MERMAID_ENABLED=$(echo "$CONFIG" | jq -r '.diagrams.platforms.mermaid.enabled // true')
MERMAID_RENDER=$(echo "$CONFIG" | jq -r '.diagrams.platforms.mermaid.generateRendered // true')
MERMAID_FORMAT=$(echo "$CONFIG" | jq -r '.diagrams.platforms.mermaid.renderFormat // "svg"')

PLANTUML_ENABLED=$(echo "$CONFIG" | jq -r '.diagrams.platforms.plantuml.enabled // true')
PLANTUML_RENDER=$(echo "$CONFIG" | jq -r '.diagrams.platforms.plantuml.generateRendered // true')
PLANTUML_FORMAT=$(echo "$CONFIG" | jq -r '.diagrams.platforms.plantuml.renderFormat // "svg"')
PLANTUML_SERVER=$(echo "$CONFIG" | jq -r '.diagrams.platforms.plantuml.server // "https://www.plantuml.com/plantuml"')

EXCALIDRAW_ENABLED=$(echo "$CONFIG" | jq -r '.diagrams.platforms.excalidraw.enabled // true')
EXCALIDRAW_SOURCE=$(echo "$CONFIG" | jq -r '.diagrams.platforms.excalidraw.generateSource // true')
EXCALIDRAW_RENDER=$(echo "$CONFIG" | jq -r '.diagrams.platforms.excalidraw.generateRendered // true')
EXCALIDRAW_FORMAT=$(echo "$CONFIG" | jq -r '.diagrams.platforms.excalidraw.renderFormat // "svg"')

BASE_DIR=$(echo "$CONFIG" | jq -r '.diagrams.storage.baseDir // "public/images"')

# Create readable slug from slide title
# Extract slide number from title if present (e.g., "21. Title" or "Slide 21: Title")
SLIDE_NUM=$(echo "$SLIDE_TITLE" | grep -oE '^[0-9]+' || echo "")
SLUG=$(create_slug "$SLIDE_TITLE" "$SLIDE_NUM")

# CRITICAL: Sources and rendered files are stored separately
SOURCE_DIR="$PRESENTATION_DIR/diagrams"      # ALL sources (.mmd, .puml, .excalidraw)
RENDER_DIR="$PRESENTATION_DIR/$BASE_DIR/$SLUG"  # Rendered images (.svg, .png)

echo -e "${BLUE}Slide title: $SLIDE_TITLE${NC}"
echo -e "${BLUE}Directory slug: $SLUG${NC}"
echo -e "${BLUE}Source directory: $SOURCE_DIR${NC}"
echo -e "${BLUE}Render directory: $RENDER_DIR${NC}"
echo -e ""

# Create directories
mkdir -p "$SOURCE_DIR"
mkdir -p "$RENDER_DIR"

# Track generated files
GENERATED_FILES=()

# ========================================
# 1. Generate Mermaid files
# ========================================

if [[ "$MERMAID_ENABLED" == "true" ]]; then
    echo -e "${CYAN}Generating Mermaid diagram...${NC}"

    # Save Mermaid source to diagrams/
    MERMAID_FILE="$SOURCE_DIR/$SLUG.mmd"
    echo "$MERMAID_CODE" > "$MERMAID_FILE"
    GENERATED_FILES+=("$MERMAID_FILE")
    echo -e "${GREEN}✓ Mermaid source: $MERMAID_FILE${NC}"

    # Render Mermaid to public/images/ if enabled
    if [[ "$MERMAID_RENDER" == "true" ]]; then
        MERMAID_OUTPUT="$RENDER_DIR/diagram.$MERMAID_FORMAT"

        if "$SCRIPT_DIR/render-mermaid.sh" "$MERMAID_FILE" "$MERMAID_OUTPUT" "$MERMAID_FORMAT" 2>&1; then
            GENERATED_FILES+=("$MERMAID_OUTPUT")
            echo -e "${GREEN}✓ Mermaid rendered: $MERMAID_OUTPUT${NC}"
        else
            echo -e "${YELLOW}⚠ Mermaid rendering skipped (mmdc not available)${NC}"
        fi
    fi

    echo ""
fi

# ========================================
# 2. Generate PlantUML files
# ========================================

if [[ "$PLANTUML_ENABLED" == "true" ]]; then
    echo -e "${CYAN}Generating PlantUML diagram...${NC}"

    # Save PlantUML source to diagrams/
    PLANTUML_FILE="$SOURCE_DIR/$SLUG.puml"

    # Translate Mermaid to PlantUML
    if node "$SCRIPT_DIR/translate-diagram.js" mermaid plantuml "$MERMAID_FILE" "$PLANTUML_FILE" 2>&1; then
        GENERATED_FILES+=("$PLANTUML_FILE")
        echo -e "${GREEN}✓ PlantUML source: $PLANTUML_FILE${NC}"

        # Render PlantUML to public/images/ if enabled
        if [[ "$PLANTUML_RENDER" == "true" ]]; then
            PLANTUML_OUTPUT="$RENDER_DIR/diagram-plantuml.$PLANTUML_FORMAT"

            if "$SCRIPT_DIR/render-plantuml.sh" "$PLANTUML_FILE" "$PLANTUML_OUTPUT" "$PLANTUML_FORMAT" "$PLANTUML_SERVER" 2>&1; then
                GENERATED_FILES+=("$PLANTUML_OUTPUT")
                echo -e "${GREEN}✓ PlantUML rendered: $PLANTUML_OUTPUT${NC}"
            else
                echo -e "${YELLOW}⚠ PlantUML rendering failed${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ PlantUML translation failed${NC}"
    fi

    echo ""
fi

# ========================================
# 3. Generate Excalidraw files
# ========================================

if [[ "$EXCALIDRAW_ENABLED" == "true" ]]; then
    echo -e "${CYAN}Generating Excalidraw diagram...${NC}"

    # Save Excalidraw source to diagrams/
    EXCALIDRAW_FILE="$SOURCE_DIR/$SLUG.excalidraw"

    # Translate Mermaid to Excalidraw
    if [[ "$EXCALIDRAW_SOURCE" == "true" ]]; then
        if node "$SCRIPT_DIR/translate-diagram.js" mermaid excalidraw "$MERMAID_FILE" "$EXCALIDRAW_FILE" 2>&1; then
            GENERATED_FILES+=("$EXCALIDRAW_FILE")
            echo -e "${GREEN}✓ Excalidraw source: $EXCALIDRAW_FILE${NC}"

            # Render Excalidraw to public/images/ if enabled
            if [[ "$EXCALIDRAW_RENDER" == "true" ]]; then
                EXCALIDRAW_OUTPUT="$RENDER_DIR/diagram-excalidraw.$EXCALIDRAW_FORMAT"

                if "$SCRIPT_DIR/render-excalidraw.sh" "$EXCALIDRAW_FILE" "$EXCALIDRAW_OUTPUT" "$EXCALIDRAW_FORMAT" 2>&1; then
                    GENERATED_FILES+=("$EXCALIDRAW_OUTPUT")
                    echo -e "${GREEN}✓ Excalidraw rendered: $EXCALIDRAW_OUTPUT${NC}"
                else
                    echo -e "${YELLOW}⚠ Excalidraw rendering failed${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠ Excalidraw translation failed${NC}"
        fi
    fi

    echo ""
fi

# ========================================
# Summary
# ========================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Multi-Platform Diagram Generated${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Slide:${NC} $SLIDE_TITLE"
echo -e "${BLUE}Slug:${NC} $SLUG"
echo ""
echo -e "${BLUE}Sources saved to:${NC} $SOURCE_DIR"
echo -e "${BLUE}Renders saved to:${NC} $RENDER_DIR"
echo ""
echo -e "${BLUE}Generated Files (${#GENERATED_FILES[@]}):${NC}"
for file in "${GENERATED_FILES[@]}"; do
    # Show relative path for clarity
    rel_path="${file#$PRESENTATION_DIR/}"
    echo -e "  • $rel_path"
done
echo ""

# Output primary format for slide embedding (Mermaid inline)
echo -e "${BLUE}Embed in slide:${NC} Mermaid code block (inline rendering)"
echo ""

# Success
exit 0
