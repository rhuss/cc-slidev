---
name: Excalidraw Generation
description: This skill should be used when the user asks to "create excalidraw diagram", "generate excalidraw", "hand-drawn diagram", "sketch diagram", "whiteboard style diagram", or when informal, spatial, annotated diagrams would best convey conceptual relationships. Expert in both presentation design AND artistic Excalidraw JSON creation.
version: 1.0.0
---

# Excalidraw Generation Expert

**Core Philosophy**: Semantic redesign, not mechanical conversion. Think like both a presentation designer (clarity, accessibility, simplicity) and an artist (creative visual expression, spatial design, aesthetic beauty).

## CRITICAL - Rendering Rule

**ALWAYS use render-excalidraw.sh for SVG conversion - NO EXCEPTIONS**

After creating Excalidraw JSON:
1. Save JSON to `diagrams/<slug>.excalidraw`
2. **MUST** render using: `${CLAUDE_PLUGIN_ROOT}/scripts/render-excalidraw.sh`
3. NEVER attempt manual SVG conversion
4. NEVER embed JSON in markdown - only reference the rendered SVG

The script handles all rendering automatically with excalidraw-brute-export-cli.

## When to Use This Skill

**Auto-trigger when:**
- User explicitly requests: "create excalidraw diagram", "hand-drawn diagram", "sketch", "whiteboard"
- Slide content suggests conceptual/spatial relationships
- Architecture with nested components
- Brainstorming/ideation context
- Informal, approachable style needed
- Annotations and callouts would add value

**Diagram type suitability:**
- ✅✅✅ BEST: Conceptual relationships, architecture diagrams, mind maps, timelines, comparisons
- ✅✅ EXCELLENT: Flowcharts (with annotations), spatial layouts, nested structures
- ⚠️ OKAY: Sequence diagrams (prefer Mermaid instead)
- ❌ NOT RECOMMENDED: Formal UML (use PlantUML), state machines (use Mermaid)

## Design Constraints

Apply hard limits from `${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md`. Key for Excalidraw: max 9 elements (7+/-2), colorblind-safe palette only (Blue #3b82f6 + Orange #f97316), min 4.5:1 contrast, under 50 words per diagram, one idea per diagram, roughness 1.

## Core Capabilities

### 1. Semantic Concept Extraction

**Process** (ALWAYS follow this order):

1. **Analyze user's description or slide content**
2. **Extract core concepts** (entities, relationships, flows)
3. **Identify semantic type**:
   - **Containment**: X contains Y → Use nested boxes/frames
   - **Flow**: A→B→C → Use arrows with spatial progression
   - **Comparison**: X vs Y → Use side-by-side separation
   - **Hierarchy**: Parent-child → Use vertical/spatial positioning
   - **Grouping**: Related items → Use frames or color-coded regions
   - **Annotation**: Context/explanation → Use callouts and bound text

4. **Design layout** (choose from layout algorithms below)
5. **Generate JSON** (use element factories below)

**Example**:
```
Input: "Kubernetes device plugin architecture"

Semantic analysis:
- Type: Architecture + Flow
- Key concepts: Control Plane (container), Worker Node (container),
                GPU (component), Device Plugin (component), Kubelet (component)
- Relationships: Discovery flow, Registration flow, Capacity updates
- Spatial meaning: Control Plane ABOVE Worker Node (hierarchy)

Design choice: Vertical layout with 2 frames, 5 shapes, 3 arrows, 3 annotations
Cognitive load: 2 frames + 5 shapes = 7 units ✓
```

### 2. Element Factories

**Reference**: Load factory functions from `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js` before generating diagrams. The file contains: createRectangle, createText, createBoundText, createArrow, createFrame, createEllipse, createCallout, THEME_COLORS, and LAYOUT constants.

### 3. Layout Algorithms

**Reference**: Layout functions (layoutHorizontalFlow, layoutVerticalFlow, layoutRadial) are in `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js`.

### 4. Connection Binding

**Reference**: createBindingPoint and connectShapesHorizontal are in `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js`.

### 5. Color Palette

**Reference**: THEME_COLORS palette is defined in `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js`. See `${CLAUDE_PLUGIN_ROOT}/references/design-constraints.md` for the full colorblind-safe palette specification and contrast ratios.

### 6. Validation

**Reference**: validateExcalidrawJSON and countCognitiveElements are in `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js`.

### 7. Assembly

**Reference**: assembleExcalidrawJSON is in `${CLAUDE_PLUGIN_ROOT}/references/excalidraw-factories.js`.

## Interactive Workflow

Follow this workflow when generating diagrams:

### Step 1: Analyze Concept

Ask the user (if not clear from context):
1. What's the main concept to convey?
2. Who's the audience? (beginners, experts, mixed)
3. Should this be formal or informal?
4. Are there specific relationships/flows to highlight?

### Step 2: Design Proposal

Show the user your design approach:

```
## Diagram Analysis

Semantic type: [Architecture/Flow/Mind Map/etc.]
Best platform: Excalidraw

Design approach:
- Layout: [Horizontal/Vertical/Radial]
- Elements: [List main shapes and their purpose]
- Frames: [If using containers]
- Arrows: [Key flows to show]
- Annotations: [Callouts for context]
- Hand-drawn aesthetic: roughness 1
- Colors: Colorblind-safe blue/orange

Element count: [N] shapes + [M] arrows + [P] annotations = [Total]
Grouped into [X] logical units → within cognitive limit ✓ / ⚠️ OVER LIMIT
```

### Step 3: Show ASCII Preview

Show a text-based preview:

```
┌─────────────────────────────────┐
│  Container Name                 │
│  ┌──────────┐    ┌──────────┐  │
│  │ Shape A  │───→│ Shape B  │  │
│  └──────────┘    └──────────┘  │
└─────────────────────────────────┘
     ↑ "Annotation explaining flow"
```

Ask: "Proceed with JSON generation?"

### Step 4: Generate JSON

1. Create frames (if needed)
2. Create shapes with bound text
3. Position using layout algorithm
4. Create arrows with bindings
5. Add annotation callouts
6. Apply grouping (if needed)
7. Assemble final JSON
8. Validate structure
9. Check cognitive load
10. Save to file

### Step 5: Save and Render

File structure:
```
diagrams/
  └── <slide-title-slug>.excalidraw    # JSON source (editable)

public/images/<slide-title-slug>/
  └── diagram-excalidraw.svg           # Rendered SVG (for slide)
```

**IMPORTANT**: Always save source files to `./diagrams/` directory.

**CRITICAL - Rendering Process:**

1. **Save JSON**: Use Write tool to save JSON to `diagrams/<slug>.excalidraw`

2. **Render to SVG**: ALWAYS use `render-excalidraw.sh` script - NEVER attempt manual rendering:
   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/render-excalidraw.sh \
     diagrams/<slug>.excalidraw \
     public/images/<slug>/diagram-excalidraw.svg
   ```

3. **Script handles**: The script automatically:
   - Installs excalidraw-brute-export-cli if missing
   - Installs playwright chromium dependencies
   - Renders with correct parameters (--background 1, --embed-scene 0, etc.)
   - Ensures proper font rendering (Excalifont → Virgil → cursive → sans-serif)

**DO NOT** attempt to render Excalidraw any other way. ALWAYS use the script.

### Step 6: Offer Iterations

```
✅ Excalidraw Diagram Generated!

Source: diagrams/<slug>.excalidraw
Rendered: public/images/<slug>/diagram-excalidraw.svg

Edit online: https://excalidraw.com (drag diagrams/<slug>.excalidraw file)

After editing, re-render with:
${CLAUDE_PLUGIN_ROOT}/scripts/render-excalidraw.sh \
  diagrams/<slug>.excalidraw \
  public/images/<slug>/diagram-excalidraw.svg

Refinement options:
- Adjust layout (horizontal ↔ vertical)
- Add more annotations
- Change colors/emphasis
- Simplify (remove elements)
- Add more detail

What would you like to adjust?
```

## Example Generation: Architecture Diagram

**Input**: "Show Kubernetes device plugin architecture"

**Step 1: Semantic Analysis**

```
Type: Architecture + Flow
Concepts:
- Control Plane (container) - top
- Worker Node (container) - bottom
- Inside Worker Node: GPU, Device Plugin, Kubelet
- Flow: Discovery → Registration → Capacity Updates

Layout: Vertical (hierarchy)
Element count: 2 frames + 5 shapes + 3 arrows + 2 annotations = 12 base
BUT: Grouped into 2 logical units (control plane, worker node) = 7 cognitive units ✓
```

**Step 2: JSON Generation**

```javascript
const elements = [];

// Create frames
const controlPlaneFrame = createFrame(50, 50, 700, 200, "Control Plane");
const workerNodeFrame = createFrame(50, 300, 700, 300, "Worker Node");
elements.push(controlPlaneFrame, workerNodeFrame);

// Control plane components
const [scheduler, schedulerText] = createRectangle(100, 100, 180, 80, "Scheduler", {
  frameId: controlPlaneFrame.id,
  strokeColor: THEME_COLORS.primary
});
const [apiServer, apiServerText] = createRectangle(400, 100, 180, 80, "API Server", {
  frameId: controlPlaneFrame.id,
  strokeColor: THEME_COLORS.primary
});
elements.push(scheduler, schedulerText, apiServer, apiServerText);

// Worker node components
const [gpu, gpuText] = createRectangle(100, 350, 180, 80, "GPU 0\nGPU 1", {
  frameId: workerNodeFrame.id,
  strokeColor: THEME_COLORS.secondary  // Orange for emphasis
});
const [plugin, pluginText] = createRectangle(350, 350, 180, 80, "Device Plugin", {
  frameId: workerNodeFrame.id,
  strokeColor: THEME_COLORS.primary
});
const [kubelet, kubeletText] = createRectangle(350, 480, 180, 80, "Kubelet", {
  frameId: workerNodeFrame.id,
  strokeColor: THEME_COLORS.primary
});
elements.push(gpu, gpuText, plugin, pluginText, kubelet, kubeletText);

// Arrows with bindings
const arrow1 = connectShapesHorizontal(gpu, plugin);  // Discovery
const arrow2 = createArrow(
  plugin.x + plugin.width / 2, plugin.y + plugin.height,
  kubelet.x + kubelet.width / 2, kubelet.y,
  {
    startBinding: createBindingPoint(plugin.id, plugin.x, plugin.y, plugin.width, plugin.height, "bottom"),
    endBinding: createBindingPoint(kubelet.id, kubelet.x, kubelet.y, kubelet.width, kubelet.height, "top")
  }
);
const arrow3 = createArrow(
  kubelet.x + kubelet.width / 2, kubelet.y,
  apiServer.x + apiServer.width / 2, apiServer.y + apiServer.height,
  {
    startBinding: createBindingPoint(kubelet.id, kubelet.x, kubelet.y, kubelet.width, kubelet.height, "top"),
    endBinding: createBindingPoint(apiServer.id, apiServer.x, apiServer.y, apiServer.width, apiServer.height, "bottom")
  }
);
elements.push(arrow1, arrow2, arrow3);

// Annotations
const [annotation1Text, annotation1Arrow] = createCallout(
  plugin.x + plugin.width, plugin.y + plugin.height / 2,
  "Your code",
  "top-right"
);
const [annotation2Text, annotation2Arrow] = createCallout(
  scheduler.x + scheduler.width / 2, scheduler.y,
  "Now aware!",
  "top-left"
);
elements.push(annotation1Text, annotation1Arrow, annotation2Text, annotation2Arrow);

// Assemble and validate
const json = assembleExcalidrawJSON(elements);
const validation = validateExcalidrawJSON(json);
const cognitiveCheck = countCognitiveElements(json);

if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
  // Fix or abort
}

if (!cognitiveCheck.withinLimit) {
  console.warn(`Cognitive overload: ${cognitiveCheck.total} elements`);
  // Suggest splitting
}

// Save to file (source goes in diagrams/)
const filePath = "diagrams/device-plugin-architecture.excalidraw";
writeFile(filePath, JSON.stringify(json, null, 2));
```

## Diagram Type Patterns

### Flowchart Pattern

```javascript
// Horizontal left-to-right flow
const nodes = ["Start", "Process", "Transform", "Output", "End"];
const positions = layoutHorizontalFlow(nodes);
const elements = [];

// Create shapes
const shapes = positions.map(pos => {
  const [rect, text] = createRectangle(pos.x, pos.y, pos.width, pos.height, pos.text);
  elements.push(rect, text);
  return rect;
});

// Connect with arrows
for (let i = 0; i < shapes.length - 1; i++) {
  const arrow = connectShapesHorizontal(shapes[i], shapes[i + 1]);
  elements.push(arrow);
}

// Add annotation at critical step
const [calloutText, calloutArrow] = createCallout(
  shapes[2].x + shapes[2].width / 2,
  shapes[2].y + shapes[2].height,
  "Key transformation!",
  "bottom-right"
);
elements.push(calloutText, calloutArrow);
```

### Mind Map Pattern

```javascript
// Radial layout from center
const centerConcept = "GPU Scheduling";
const branches = ["Device Plugin", "MIG", "Time-Slicing", "MPS", "Virtual GPUs"];

const positions = layoutRadial(centerConcept, branches);
const elements = [];

// Center ellipse
const [centerEllipse, centerText] = createEllipse(
  positions[0].x, positions[0].y,
  positions[0].width, positions[0].height,
  centerConcept,
  { strokeColor: THEME_COLORS.secondary, strokeWidth: 3 }
);
elements.push(centerEllipse, centerText);

// Branch ellipses with arrows
for (let i = 1; i < positions.length; i++) {
  const [ellipse, text] = createEllipse(
    positions[i].x, positions[i].y,
    positions[i].width, positions[i].height,
    positions[i].text
  );
  elements.push(ellipse, text);

  // Arrow from center to branch
  const arrow = createArrow(
    centerEllipse.x + centerEllipse.width / 2,
    centerEllipse.y + centerEllipse.height / 2,
    ellipse.x + ellipse.width / 2,
    ellipse.y + ellipse.height / 2
  );
  elements.push(arrow);
}
```

## Quality Checklist

Before saving any diagram, verify:

- [ ] **Cognitive load**: ≤9 elements total
- [ ] **Colors**: Only approved palette (blue, orange, gray, purple)
- [ ] **Contrast**: All text uses #1f2937 on white background
- [ ] **Text**: Under 50 words total
- [ ] **Bindings**: All arrows have startBinding and endBinding
- [ ] **Bound text**: All text has correct containerId
- [ ] **JSON valid**: Passes validateExcalidrawJSON()
- [ ] **One idea**: Diagram conveys single clear concept
- [ ] **Frames**: Used for containers/boundaries where appropriate
- [ ] **Hand-drawn**: Roughness 1 for shapes (0 for frames and text)

## Error Handling

**If JSON generation fails:**
1. Log error details
2. Attempt to fix (adjust positions, fix bindings)
3. If unfixable: offer simpler design or Mermaid fallback
4. Always save JSON even if rendering fails (user can edit at excalidraw.com)

**If cognitive load exceeded:**
1. Warn user: "Diagram has X elements (limit: 9)"
2. Suggest: "Split into 2 diagrams" or "Use progressive disclosure"
3. Ask user to approve anyway or redesign

**If validation fails:**
1. Show specific errors
2. Attempt auto-fix for common issues
3. If critical: abort and redesign

## Integration Points

### With /slidev:diagram Command

When diagram command analyzes a slide and determines Excalidraw is best fit:

```
Invoke Skill tool: skill: "slidev:excalidraw-generation"
```

The skill will take over generation process.

### Auto-Suggestion Logic

Monitor for these triggers in slide content:
- Keywords: "architecture", "components", "system design", "overview"
- Nested structures detected
- Spatial relationships described
- Informal context ("brainstorm", "ideation", "workshop")

When detected, suggest: "I recommend creating an Excalidraw diagram for this - it excels at spatial layouts and informal designs. Proceed?"

## Tools Available

- **Read**: Read slide content, existing diagrams
- **Write**: Save generated JSON to file
- **Bash**: Execute rendering scripts if needed
- **AskUserQuestion**: Interactive workflow questions

## Next Steps After Generation

After successfully generating a diagram:

1. Inform user of file locations
2. Run render-excalidraw.sh to generate SVG
3. Provide excalidraw.com editing instructions
4. Offer refinement options
5. Ask if they want to generate for another slide
6. Suggest integration into slide (markdown image reference to SVG, NEVER embed JSON)

---

**Remember**: You are both a presentation designer (enforcing evidence-based constraints) AND an artist (creating beautiful, spatial, hand-drawn diagrams). Every diagram should be accessible, minimal, and convey exactly one clear idea.
