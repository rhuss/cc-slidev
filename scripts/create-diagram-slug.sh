#!/usr/bin/env bash
# create-diagram-slug.sh - Create readable directory slugs from slide titles
#
# Instead of mangling "Device Plugins Turn GPUs Into Schedulable Resources"
# into "device-plugins-turn-gpus-into-schedulable-resources",
# create readable slugs like "device-plugins-gpus" or "gpu-scheduling"
#
# Usage: create-diagram-slug.sh "<slide-title>" [slide-number]

set -euo pipefail

SLIDE_TITLE="${1:-}"
SLIDE_NUMBER="${2:-}"

if [[ -z "$SLIDE_TITLE" ]]; then
    echo "Usage: $0 \"<slide-title>\" [slide-number]" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  $0 \"Device Plugins Turn GPUs Into Schedulable Resources\" 21" >&2
    echo "  Output: slide-21-device-plugins-gpus" >&2
    exit 1
fi

# Function to create a meaningful slug from title
create_slug() {
    local title="$1"
    local slide_num="$2"

    # Convert to lowercase
    title=$(echo "$title" | tr '[:upper:]' '[:lower:]')

    # Remove common stop words to keep it concise
    title=$(echo "$title" | sed -E '
        s/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|into|onto)\b//gi
    ')

    # Replace non-alphanumeric with hyphens
    title=$(echo "$title" | sed 's/[^a-z0-9]/-/g')

    # Collapse multiple hyphens
    title=$(echo "$title" | sed 's/-\+/-/g')

    # Remove leading/trailing hyphens
    title=$(echo "$title" | sed 's/^-//;s/-$//')

    # Take first 3-4 meaningful words (max 30 chars)
    title=$(echo "$title" | cut -d'-' -f1-4 | cut -c1-30)

    # Remove trailing hyphen again (if cut created one)
    title=$(echo "$title" | sed 's/-$//')

    # Prepend slide number if provided
    if [[ -n "$slide_num" ]]; then
        echo "slide-${slide_num}-${title}"
    else
        echo "$title"
    fi
}

# Generate slug
SLUG=$(create_slug "$SLIDE_TITLE" "$SLIDE_NUMBER")

# Output the slug
echo "$SLUG"
