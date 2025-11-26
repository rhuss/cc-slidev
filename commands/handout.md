---
name: handout
description: Generate comprehensive LaTeX handout from presentation
allowed-tools: ["Read", "Write", "Bash", "Grep"]
---

# Handout Generation

Create comprehensive LaTeX handout combining slides, presenter notes, and supplementary research.

**Note**: Handouts should include detailed explanations that don't appear on slides (MIT CommLab principle: slides are minimal, handouts are comprehensive).

## Execution

### 1. Check Prerequisites

**Required:**
- slides.md must exist
- Slides must be exportable (Slidev working)

**Optional but helpful:**
- brainstorm.md (for additional context)
- Presenter notes in slides (for note sections)

**LaTeX availability:**
```bash
command -v pdflatex
```

If not available:
- Inform user LaTeX is required
- Provide installation instructions:
  - macOS: `brew install --cask mactex-no-gui`
  - Ubuntu: `sudo apt-get install texlive-latex-base texlive-latex-extra`
- Offer to create .tex file anyway (user can compile later)

### 2. Export Slides to PDF

First, export slides for embedding:
```bash
cd [presentation-dir]
${CLAUDE_PLUGIN_ROOT}/scripts/export-slides.sh slides.md pdf exports
```

This creates `exports/slides.pdf` with all slides.

### 3. Parse Slides for Content

Read slides.md and extract:
- Presentation title
- All slide headings
- Slide content (bullets, text)
- Presenter notes
- Section structure

### 4. Gather Supplementary Content

Read brainstorm.md (if exists) for:
- Research notes
- References and sources
- Background context
- Additional examples

### 5. Generate LaTeX Document

Using latex-handouts skill, create `handout.tex`:

**Preamble:**
```latex
\documentclass[11pt,a4paper]{article}

% Packages
\usepackage[utf8]{inputenc}
\usepackage[margin=1in]{geometry}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{fancyhdr}
\usepackage{float}
\usepackage{parskip}

% PDF metadata
\hypersetup{
    pdftitle={[Title] - Handout},
    pdfauthor={[Author]},
    colorlinks=true,
    linkcolor=blue,
    urlcolor=cyan
}

% Header/footer
\pagestyle{fancy}
\fancyhead[L]{[Presentation Title]}
\fancyhead[R]{\thepage}
\fancyfoot[C]{}

\title{[Presentation Title]\\[0.5em]\large Comprehensive Handout}
\author{[Author Name]}
\date{\today}

\begin{document}

\maketitle
\tableofcontents
\newpage
```

**Body structure:**
```latex
\section{Introduction}

[Brief overview of presentation]

\section{Presentation Content}

% For each section in presentation:
\subsection{[Section Name]}

% For each slide in section:
\subsubsection{[Slide Title]}

\begin{figure}[H]
  \centering
  \includegraphics[page=[N],width=0.85\textwidth]{exports/slides.pdf}
  \caption{Slide [N]: [Title]}
  \label{fig:slide[N]}
\end{figure}

\paragraph{Key Points:}
\begin{itemize}
  \item [Point from slide]
  \item [Point from slide]
\end{itemize}

\paragraph{Presenter Notes:}
[Notes from slides.md]

\paragraph{Additional Context:}
[Extra information from brainstorm.md or research]

\newpage

% Repeat for all slides

\section{Summary}

\subsection{Key Takeaways}
\begin{enumerate}
  \item [Takeaway 1]
  \item [Takeaway 2]
  \item [Takeaway 3]
\end{enumerate}

\subsection{Next Steps}
[Call to action from presentation]

\section{Additional Resources}

\subsection{References}
\begin{itemize}
  \item [Reference 1]
  \item [Reference 2]
\end{itemize}

\subsection{Further Reading}
\begin{itemize}
  \item [Resource 1] - \url{https://...}
  \item [Resource 2] - \url{https://...}
\end{itemize}

\end{document}
```

### 6. Compile to PDF

If LaTeX available:
```bash
cd [presentation-dir]
${CLAUDE_PLUGIN_ROOT}/scripts/compile-handout.sh handout.tex
```

This runs pdflatex multiple times for references and ToC.

### 7. Verify Output

Check if handout.pdf created:
- If yes: Success
- If no: Check handout.log for errors
- Show relevant error messages if compilation failed

### 8. Summary

Present completion message:
```markdown
## ✅ Handout Generated

**Files Created:**
- `handout.tex` - LaTeX source
- `handout.pdf` - Compiled handout ([X] pages)

**Contents:**
- Title page and table of contents
- [Y] slides with embedded images
- Presenter notes for each slide
- Additional context and research
- References and resources
- [Z] total pages

**View Handout:**
```bash
open handout.pdf  # macOS
xdg-open handout.pdf  # Linux
```

**Edit Handout:**
If you need to customize, edit `handout.tex` and recompile:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/compile-handout.sh handout.tex
```
```

## Customization Options

Ask user if they want to customize:

**Layout options:**
- Single column (default) vs two-column
- Page size (A4, Letter, custom)
- Margins (1in default)

**Content options:**
- Include all slides vs key slides only
- Detailed notes vs summary notes
- Include code listings
- Add appendices

**Visual options:**
- Slide size (full width, smaller)
- Color scheme
- Section formatting

Apply customizations to handout.tex if requested.

## Error Handling

**LaTeX errors:**
- Check .log file for specific error
- Common issues:
  - Missing packages: Install texlive-latex-extra
  - Image not found: Check exports/slides.pdf exists
  - Syntax errors: Show line number and error

**Large presentations:**
- If >50 slides, warn about handout size
- Offer to create sections separately
- Suggest key slides only option

## Best Practices

**Handout Quality:**
- Keep slide images large enough to read (0.8-0.9\textwidth)
- Balance slide image with surrounding text
- Use page breaks strategically
- Include page numbers and headers

**Content Balance:**
- Don't just duplicate slides
- Add value with notes and context
- Provide resources for deeper learning
- Make it standalone (useful without presentation)

**Organization:**
- Match presentation structure
- Clear section divisions
- Comprehensive ToC
- Consistent formatting

Inform user handout is complete and ready for distribution.
