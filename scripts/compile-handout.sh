#!/usr/bin/env bash
# compile-handout.sh - Compile LaTeX handout to PDF

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arguments
TEX_FILE="${1:-handout.tex}"
CLEANUP="${2:-true}"

# Check if pdflatex is available
if ! command -v pdflatex &> /dev/null; then
    echo -e "${YELLOW}⚠ pdflatex not found. LaTeX is not installed.${NC}"
    echo -e "${BLUE}Install LaTeX:${NC}"
    echo "  macOS: brew install --cask mactex-no-gui"
    echo "  Ubuntu: sudo apt-get install texlive-latex-base texlive-latex-extra"
    exit 1
fi

# Check if tex file exists
if [[ ! -f "$TEX_FILE" ]]; then
    echo -e "${RED}✗ LaTeX file not found: $TEX_FILE${NC}"
    exit 1
fi

BASENAME=$(basename "$TEX_FILE" .tex)
WORKDIR=$(dirname "$TEX_FILE")

echo -e "${BLUE}Compiling LaTeX handout...${NC}"
echo -e "${BLUE}File: $TEX_FILE${NC}"

# Change to working directory
cd "$WORKDIR"

# Run pdflatex multiple times for references and ToC
echo -e "${YELLOW}First pass...${NC}"
pdflatex -interaction=nonstopmode "$BASENAME.tex" > /dev/null 2>&1

echo -e "${YELLOW}Second pass (for references)...${NC}"
pdflatex -interaction=nonstopmode "$BASENAME.tex" > /dev/null 2>&1

# Optional third pass for bibliography if .bib file exists
if [[ -f "${BASENAME}.bib" ]]; then
    echo -e "${YELLOW}Running BibTeX...${NC}"
    bibtex "$BASENAME" > /dev/null 2>&1 || true

    echo -e "${YELLOW}Third pass (for bibliography)...${NC}"
    pdflatex -interaction=nonstopmode "$BASENAME.tex" > /dev/null 2>&1
fi

# Check if PDF was created
if [[ -f "${BASENAME}.pdf" ]]; then
    echo -e "${GREEN}✓ Compilation successful${NC}"
    echo -e "${GREEN}Output: ${BASENAME}.pdf${NC}"

    # Cleanup auxiliary files
    if [[ "$CLEANUP" == "true" ]]; then
        echo -e "${BLUE}Cleaning up auxiliary files...${NC}"
        rm -f "${BASENAME}.aux" "${BASENAME}.log" "${BASENAME}.out" \
              "${BASENAME}.toc" "${BASENAME}.bbl" "${BASENAME}.blg"
    fi

    exit 0
else
    echo -e "${RED}✗ Compilation failed${NC}"
    echo -e "${YELLOW}Check ${BASENAME}.log for errors${NC}"
    exit 1
fi
