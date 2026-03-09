# Contributing to Slidev Plugin

Build, test, and install the plugin from source.

## Prerequisites

- Claude Code CLI
- Node.js (v18+) and npm
- Make

### Optional

- LaTeX (pdflatex) for handout generation
- mermaid-cli for offline diagram rendering
- excalidraw-brute-export-cli for Excalidraw rendering

## Quick Start

```bash
# Validate manifests
make validate

# Install plugin
make install

# After making changes
make reinstall
```

## Plugin Structure

```
cc-slidev/                       # Repository root
├── .claude/                     # Project-level Claude config
├── .claude-plugin/
│   └── marketplace.json         # Development marketplace
├── ARCHITECTURE.md              # System architecture
├── README.md                    # User guide
├── Makefile                     # Build/install targets
├── references/                  # Research documentation
├── tests/                       # Test files
└── slidev/                      # Plugin (installed to ~/.claude/plugins/)
    ├── .claude-plugin/
    │   └── plugin.json          # Plugin manifest
    ├── commands/                # Slash commands
    ├── skills/                  # Contextual knowledge
    ├── agents/                  # Validation agents
    ├── scripts/                 # Utility scripts
    └── default.json             # Diagram configuration
```

### Understanding Plugin vs. Project Files

**Project-Level** (`.claude/`, root docs):
- Files affecting development ON this repo
- Used by developers working on the plugin

**Plugin-Level** (`slidev/`):
- Files users get when they install the plugin
- Installed to `~/.claude/plugins/`

**When adding features**: Modify plugin-level files in `slidev/`, NOT project-level files.

## Development Workflow

### 1. Make Changes

Edit files in `slidev/`:
- `commands/*.md` - Slash command definitions
- `skills/**/SKILL.md` - Contextual knowledge
- `agents/*.md` - Validation agent definitions
- `scripts/*` - Utility scripts
- `default.json` - Diagram configuration

### 2. Validate

```bash
make validate
```

### 3. Reinstall

```bash
make reinstall
```

### 4. Restart Claude Code

Required for changes to be detected.

### 5. Test

Run the commands and verify behavior:
```bash
/slidev:init Test Presentation
```

## Hot-Swappable vs. Reinstall Required

**Requires reinstall + restart**:
- Adding/removing commands, skills, or agents
- Modifying command prompts or skill content
- Changing `plugin.json`

**Hot-swappable (immediate effect)**:
- Scripts (`scripts/*`)

## Adding a New Command

1. Create `slidev/commands/my-command.md`:
   ```markdown
   ---
   description: Brief description of the command
   argument-hint: "[optional-arg]"
   ---

   # My Command

   Instructions for Claude...
   ```

2. Reinstall and restart:
   ```bash
   make reinstall
   # Restart Claude Code
   ```

3. Test with `/slidev:my-command`

## Adding a New Skill

1. Create `slidev/skills/my-skill/SKILL.md`:
   ```markdown
   # My Skill

   Knowledge content...
   ```

2. Reinstall and restart

## Adding a New Agent

1. Create `slidev/agents/my-agent.md` with personality, capabilities, and tool access definitions

2. Reinstall and restart

## Troubleshooting

### Validation Failures

```bash
# Check JSON syntax
jq . .claude-plugin/marketplace.json
jq . slidev/.claude-plugin/plugin.json
```

### Plugin Not Found

```bash
# Check installation
claude plugin list

# Reinstall
make reinstall
```

### Changes Not Reflected

1. Ensure you ran `make reinstall`
2. Restart Claude Code
3. Check for validation errors
