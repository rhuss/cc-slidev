#!/usr/bin/env bash
# read-diagram-config.sh - Merge diagram configuration from multiple sources
#
# Priority order:
# 1. Presentation-specific: <presentation-dir>/slidev.config.json
# 2. Plugin defaults: cc-slidev/default.json
# 3. Hardcoded fallbacks
#
# Usage: read-diagram-config.sh [presentation-dir]
#
# Output: JSON configuration object

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

# Presentation directory (optional argument)
PRESENTATION_DIR="${1:-.}"

# Configuration file paths
PLUGIN_CONFIG="$PLUGIN_DIR/default.json"
PRESENTATION_CONFIG="$PRESENTATION_DIR/slidev.config.json"

# Hardcoded fallback configuration
FALLBACK_CONFIG=$(cat <<'EOF'
{
  "diagrams": {
    "platforms": {
      "mermaid": {
        "enabled": true,
        "generateRendered": true,
        "renderFormat": "svg",
        "theme": "base"
      },
      "plantuml": {
        "enabled": true,
        "generateRendered": true,
        "renderFormat": "svg",
        "server": "https://www.plantuml.com/plantuml"
      },
      "excalidraw": {
        "enabled": true,
        "generateSource": true,
        "generateRendered": true,
        "renderFormat": "svg"
      }
    },
    "storage": {
      "baseDir": "public/images",
      "namingStrategy": "slide-title-mangled",
      "keepSource": true
    },
    "embedding": {
      "defaultFormat": "mermaid-inline",
      "fallbackToImage": true
    }
  }
}
EOF
)

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed" >&2
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
    exit 1
fi

# Start with fallback config
CONFIG="$FALLBACK_CONFIG"

# Merge plugin default.json if it exists
if [[ -f "$PLUGIN_CONFIG" ]]; then
    CONFIG=$(echo "$CONFIG" | jq -s '.[0] * .[1]' - "$PLUGIN_CONFIG")
fi

# Merge presentation-specific config if it exists
if [[ -f "$PRESENTATION_CONFIG" ]]; then
    CONFIG=$(echo "$CONFIG" | jq -s '.[0] * .[1]' - "$PRESENTATION_CONFIG")
fi

# Output merged configuration
echo "$CONFIG"
