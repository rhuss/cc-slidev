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

**Check all handout dependencies:**
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/check-handout-deps.sh
```

**Handle exit codes:**
- **0**: All dependencies available → Proceed with full handout (PNG slides, rich formatting)
- **1**: pdflatex missing → EXIT with error, provide installation instructions
- **2**: LaTeX packages missing → Proceed with basic handout (standard LaTeX formatting)
- **3**: Playwright missing → Proceed with text-only handout (no slide images)

**Graceful degradation strategies:**

If **LaTeX packages** (tcolorbox, enumitem) missing:
- Skip `\usepackage{tcolorbox}` and `\usepackage{enumitem}`
- Use standard LaTeX boxes instead of colored tcolorbox
- Use standard enumerate/itemize instead of enumitem features
- Handout quality: Basic but functional

If **Playwright** missing:
- Skip slide PNG export step entirely
- Generate handout with prose only (no slide images)
- Still include all Further Reading links and content
- Handout quality: Text-only reference document

If **pdflatex** missing:
- Cannot generate handout at all
- Inform user LaTeX is required
- Provide installation instructions
- Offer to create .tex file anyway (user can compile later)

### 2. Export Slides to Individual PNGs (If Playwright Available)

**Only if dependency check returned 0 or 2 (Playwright available):**

Export each slide as a separate PNG image:
```bash
cd [presentation-dir]
slidev export slides.md --output exports/slides --format png --per-slide
```

This creates `exports/slide-1.png`, `exports/slide-2.png`, etc.

**Why PNGs instead of PDF:**
- Better LaTeX compatibility with includegraphics
- Individual files easier to manage
- Can be used in other documents
- Higher quality rendering for print

**If Playwright NOT available (exit code 3):**
- Skip this step entirely
- Proceed to generate text-only handout
- Handout will contain only prose and links, no slide images

### 3. Parse Slides for Content

Read slides.md and extract:
- Presentation title
- All slide headings
- Slide content (bullets, text)
- Presenter notes
- Section structure

### 4. Gather Supplementary Content

**From brainstorm.md (if exists):**
- Research notes
- References and sources
- Background context
- Additional examples

**Research for Further Reading:**
For each major section, conduct web research to find:
- Authoritative articles and papers
- Official documentation
- Tutorial resources
- Best practices guides
- Community resources

Use WebSearch to find 3-5 high-quality resources per section that provide:
- Deeper technical details
- Real-world examples
- Alternative perspectives
- Current best practices

### 5. Generate LaTeX Document

Using latex-handouts skill, create `handout.tex`:

**Preamble (adapt based on available packages):**
```latex
\documentclass[11pt,a4paper]{article}

% Core packages (always included)
\usepackage[utf8]{inputenc}
\usepackage[margin=1in]{geometry}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{fancyhdr}
\usepackage{float}
\usepackage{parskip}

% Optional packages (include only if available - exit code 0)
% If exit code 2 or 3, skip these:
% \usepackage{tcolorbox}   % For colored boxes
% \usepackage{enumitem}    % For enhanced lists

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

[Brief overview of presentation - 2-3 paragraphs of prose]

\section{Presentation Content}

% For each section in presentation:
\subsection{[Section Name]}

% For each slide in section:
\subsubsection{[Slide Title]}

% Include slide image ONLY if Playwright available (exit code 0 or 2)
% If exit code 3 (Playwright missing), skip this figure block:
\begin{figure}[H]
  \centering
  \includegraphics[width=0.75\textwidth]{exports/slide-[NNN].png}
  \caption{[Slide Title]}
  \label{fig:slide[N]}
\end{figure}

\paragraph{Overview:}
[Expressive prose paragraph expanding on slide content - NOT just bullet points.
Write 2-4 complete sentences that explain the concept in detail, provide context,
and connect to the broader topic. Transform bullet points into flowing narrative.]

\paragraph{Key Considerations:}
[Another prose paragraph discussing implications, trade-offs, or important details.
This should add value beyond what's on the slide - explain WHY things matter,
provide examples, or discuss real-world applications.]

\paragraph{Technical Details:}
[If applicable: Code explanations, architecture decisions, implementation notes.
Write in prose form, not bullets. Explain HOW things work, not just WHAT they are.]

\paragraph{Further Reading:}
\begin{itemize}
  \item \href{https://...}{[Resource Title]} - [Brief description of what reader will learn]
  \item \href{https://...}{[Resource Title]} - [Brief description]
  \item \href{https://...}{[Resource Title]} - [Brief description]
\end{itemize}

\vspace{0.5cm}

% Repeat for all slides in section

\paragraph{Section Summary:}
[Prose summary of the section, tying together all slides. 2-3 sentences.]

\newpage

% Repeat for all sections

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

\subsection{Further Reading by Topic}

% Organized by presentation sections
\subsubsection{[Section 1 Topic]}
\begin{itemize}
  \item \href{https://...}{[Title]} - [Description]
  \item \href{https://...}{[Title]} - [Description]
  \item \href{https://...}{[Title]} - [Description]
\end{itemize}

\subsubsection{[Section 2 Topic]}
\begin{itemize}
  \item \href{https://...}{[Title]} - [Description]
  \item \href{https://...}{[Title]} - [Description]
\end{itemize}

\subsection{Official Documentation}
\begin{itemize}
  \item \href{https://...}{[Official Docs]} - [What it covers]
  \item \href{https://...}{[API Reference]} - [What it covers]
\end{itemize}

\subsection{Community Resources}
\begin{itemize}
  \item \href{https://...}{[Forum/Discussion]} - [What it is]
  \item \href{https://...}{[Tutorial/Blog]} - [What it covers]
\end{itemize}

\subsection{Original References}
\begin{itemize}
  \item [Citations from brainstorm.md]
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
- ✅ **Write in prose, not bullets** - Transform slide bullets into flowing paragraphs
- ✅ **Add value beyond slides** - Explain WHY and HOW, not just WHAT
- ✅ **Include researched URLs** - 3-5 quality resources per section
- ✅ **Make it standalone** - Reader should understand without attending presentation
- ❌ **Don't copy slide bullets** - Expand them into complete explanations
- ❌ **Don't use generic descriptions** - Be specific about what each URL provides

**Organization:**
- Match presentation structure
- Clear section divisions
- Comprehensive ToC
- Consistent formatting

Inform user handout is complete and ready for distribution.
