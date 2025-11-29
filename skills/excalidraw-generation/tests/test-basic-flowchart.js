#!/usr/bin/env node
/**
 * Test: Basic Flowchart Generation
 *
 * Validates that the Excalidraw JSON generation works correctly by creating
 * a simple 3-node horizontal flowchart.
 */

// ============================================================================
// CONSTANTS AND THEME
// ============================================================================

const THEME_COLORS = {
  primary: "#3b82f6",      // Blue (8.6:1 contrast)
  secondary: "#f97316",    // Orange (3.4:1, ≥24pt only)
  neutral: "#6b7280",      // Gray
  text: "#1f2937",         // Dark gray (16.1:1 contrast)
  background: "#ffffff",   // White
  accent: "#8b5cf6",       // Purple
  light_bg: "#f3f4f6"      // Light gray
};

const LAYOUT = {
  MARGIN: 50,
  PADDING: 40,
  NODE_WIDTH: 180,
  NODE_HEIGHT: 80,
  ARROW_GAP: 10
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// ELEMENT FACTORIES
// ============================================================================

function createRectangle(x, y, width, height, text = null, options = {}) {
  const id = generateId();

  const element = {
    type: "rectangle",
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    id: id,
    fillStyle: options.fillStyle || "hachure",
    strokeWidth: options.strokeWidth || 2,
    strokeStyle: "solid",
    roughness: options.roughness !== undefined ? options.roughness : 1,
    opacity: 100,
    angle: options.angle || 0,
    x: x,
    y: y,
    strokeColor: options.strokeColor || THEME_COLORS.primary,
    backgroundColor: options.backgroundColor || "transparent",
    width: width,
    height: height,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: { type: 3 },
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false
  };

  if (text) {
    const textElement = createBoundText(text, id, x, y, width, height);
    element.boundElements.push({ type: "text", id: textElement.id });
    return [element, textElement];
  }

  return element;
}

function createText(text, x, y, options = {}) {
  return {
    type: "text",
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    id: options.id || generateId(),
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    angle: 0,
    x: x,
    y: y,
    strokeColor: options.strokeColor || THEME_COLORS.text,
    backgroundColor: "transparent",
    width: options.width || 200,
    height: options.height || 25,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    fontSize: options.fontSize || 20,
    fontFamily: 1,  // 1 = Virgil/Excalifont (hand-drawn), 2 = Helvetica, 3 = Cascadia
    text: text,
    textAlign: options.textAlign || "center",
    verticalAlign: options.verticalAlign || "middle",
    containerId: options.containerId || null,
    originalText: text,
    lineHeight: 1.25,
    baseline: 18
  };
}

function createBoundText(text, containerId, containerX, containerY, containerWidth, containerHeight) {
  const textWidth = Math.min(containerWidth - 20, 200);
  const textHeight = 25;
  const textX = containerX + (containerWidth - textWidth) / 2;
  const textY = containerY + (containerHeight - textHeight) / 2;

  return createText(text, textX, textY, {
    width: textWidth,
    height: textHeight,
    containerId: containerId,
    textAlign: "center",
    verticalAlign: "middle"
  });
}

function createArrow(startX, startY, endX, endY, options = {}) {
  const points = [
    [0, 0],
    [endX - startX, endY - startY]
  ];

  return {
    type: "arrow",
    version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false,
    id: generateId(),
    fillStyle: "hachure",
    strokeWidth: options.strokeWidth || 2,
    strokeStyle: "solid",
    roughness: options.roughness !== undefined ? options.roughness : 1,
    opacity: 100,
    angle: 0,
    x: startX,
    y: startY,
    strokeColor: options.strokeColor || THEME_COLORS.neutral,
    backgroundColor: "transparent",
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: { type: 2 },
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    startBinding: options.startBinding || null,
    endBinding: options.endBinding || null,
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: "arrow",
    points: points
  };
}

// ============================================================================
// BINDING LOGIC
// ============================================================================

function createBindingPoint(shapeId, shapeX, shapeY, shapeWidth, shapeHeight, side) {
  let focus = { x: 0, y: 0 };

  switch(side) {
    case "right":
      focus = { x: 1, y: 0 };
      break;
    case "left":
      focus = { x: -1, y: 0 };
      break;
    case "bottom":
      focus = { x: 0, y: 1 };
      break;
    case "top":
      focus = { x: 0, y: -1 };
      break;
  }

  return {
    elementId: shapeId,
    focus: focus,
    gap: LAYOUT.ARROW_GAP
  };
}

function connectShapesHorizontal(shapeA, shapeB) {
  const startX = shapeA.x + shapeA.width;
  const startY = shapeA.y + shapeA.height / 2;
  const endX = shapeB.x;
  const endY = shapeB.y + shapeB.height / 2;

  return createArrow(startX, startY, endX, endY, {
    startBinding: createBindingPoint(shapeA.id, shapeA.x, shapeA.y, shapeA.width, shapeA.height, "right"),
    endBinding: createBindingPoint(shapeB.id, shapeB.x, shapeB.y, shapeB.width, shapeB.height, "left")
  });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function validateExcalidrawJSON(json) {
  const errors = [];

  if (json.type !== "excalidraw") {
    errors.push("Missing or invalid 'type'");
  }
  if (json.version !== 2) {
    errors.push("Version should be 2");
  }
  if (!Array.isArray(json.elements)) {
    errors.push("'elements' must be array");
  }
  if (typeof json.appState !== "object") {
    errors.push("'appState' must be object");
  }

  json.elements.forEach((element, index) => {
    if (!element.id) errors.push(`Element ${index} missing 'id'`);
    if (!element.type) errors.push(`Element ${index} missing 'type'`);
    if (typeof element.x !== "number") errors.push(`Element ${index} missing 'x'`);
    if (typeof element.y !== "number") errors.push(`Element ${index} missing 'y'`);

    if (element.boundElements) {
      element.boundElements.forEach(bound => {
        if (bound.type === "text") {
          const textElement = json.elements.find(e => e.id === bound.id);
          if (!textElement) {
            errors.push(`Bound text ${bound.id} not found`);
          }
          if (textElement && textElement.containerId !== element.id) {
            errors.push(`Bound text ${bound.id} containerId mismatch`);
          }
        }
      });
    }

    if (element.type === "arrow") {
      if (element.startBinding && element.startBinding.elementId) {
        const target = json.elements.find(e => e.id === element.startBinding.elementId);
        if (!target) {
          errors.push(`Arrow ${element.id} startBinding target not found`);
        }
      }
      if (element.endBinding && element.endBinding.elementId) {
        const target = json.elements.find(e => e.id === element.endBinding.elementId);
        if (!target) {
          errors.push(`Arrow ${element.id} endBinding target not found`);
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function countCognitiveElements(json) {
  const cognitiveUnits = {
    shapes: 0,
    arrows: 0,
    annotations: 0,
    frames: 0
  };

  const groupedElements = new Set();

  json.elements.forEach(element => {
    if (element.groupIds && element.groupIds.length > 0) {
      if (groupedElements.has(element.groupIds[0])) {
        return;
      }
      groupedElements.add(element.groupIds[0]);
    }

    if (element.containerId) return;

    switch(element.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
        cognitiveUnits.shapes++;
        break;
      case "arrow":
      case "line":
        cognitiveUnits.arrows++;
        break;
      case "text":
        cognitiveUnits.annotations++;
        break;
      case "frame":
        cognitiveUnits.frames++;
        break;
    }
  });

  const total = cognitiveUnits.shapes +
                cognitiveUnits.arrows +
                cognitiveUnits.annotations +
                cognitiveUnits.frames;

  return {
    breakdown: cognitiveUnits,
    total: total,
    withinLimit: total <= 9,
    recommendation: total > 9 ? "SPLIT into multiple diagrams" : "Good"
  };
}

// ============================================================================
// ASSEMBLY FUNCTION
// ============================================================================

function assembleExcalidrawJSON(elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: elements,
    appState: {
      viewBackgroundColor: THEME_COLORS.background,
      gridSize: null,
      theme: "light"
    },
    files: {}
  };
}

// ============================================================================
// TEST: GENERATE BASIC FLOWCHART
// ============================================================================

function generateBasicFlowchart() {
  console.log("Generating basic 3-node flowchart...\n");

  const elements = [];

  // Create 3 rectangles with bound text
  const [rect1, text1] = createRectangle(
    LAYOUT.MARGIN,
    200,
    LAYOUT.NODE_WIDTH,
    LAYOUT.NODE_HEIGHT,
    "Start"
  );

  const [rect2, text2] = createRectangle(
    LAYOUT.MARGIN + LAYOUT.NODE_WIDTH + LAYOUT.PADDING,
    200,
    LAYOUT.NODE_WIDTH,
    LAYOUT.NODE_HEIGHT,
    "Process"
  );

  const [rect3, text3] = createRectangle(
    LAYOUT.MARGIN + (LAYOUT.NODE_WIDTH + LAYOUT.PADDING) * 2,
    200,
    LAYOUT.NODE_WIDTH,
    LAYOUT.NODE_HEIGHT,
    "End"
  );

  elements.push(rect1, text1, rect2, text2, rect3, text3);

  // Create arrows with bindings
  const arrow1 = connectShapesHorizontal(rect1, rect2);
  const arrow2 = connectShapesHorizontal(rect2, rect3);

  elements.push(arrow1, arrow2);

  // Assemble JSON
  const json = assembleExcalidrawJSON(elements);

  return json;
}

// ============================================================================
// RUN TEST
// ============================================================================

const json = generateBasicFlowchart();

console.log("Validating JSON structure...");
const validation = validateExcalidrawJSON(json);

if (validation.valid) {
  console.log("✅ JSON structure is VALID\n");
} else {
  console.log("❌ JSON structure has ERRORS:");
  validation.errors.forEach(err => console.log(`   - ${err}`));
  console.log();
}

console.log("Checking cognitive load...");
const cognitive = countCognitiveElements(json);
console.log(`Elements breakdown:`);
console.log(`  - Shapes: ${cognitive.breakdown.shapes}`);
console.log(`  - Arrows: ${cognitive.breakdown.arrows}`);
console.log(`  - Annotations: ${cognitive.breakdown.annotations}`);
console.log(`  - Frames: ${cognitive.breakdown.frames}`);
console.log(`  Total: ${cognitive.total} (limit: 9)`);

if (cognitive.withinLimit) {
  console.log(`✅ Within cognitive load limit\n`);
} else {
  console.log(`⚠️  OVER cognitive load limit - ${cognitive.recommendation}\n`);
}

console.log("Generated JSON stats:");
console.log(`  - Total elements: ${json.elements.length}`);
console.log(`  - JSON size: ${JSON.stringify(json).length} bytes`);
console.log(`  - File would be: ~${(JSON.stringify(json, null, 2).length / 1024).toFixed(1)} KB\n`);

console.log("Saving to test output...");
const fs = require('fs');
const path = require('path');
const outputPath = path.join(__dirname, 'output-basic-flowchart.excalidraw');
fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
console.log(`✅ Saved to: ${outputPath}\n`);

console.log("To view/edit:");
console.log("1. Visit https://excalidraw.com");
console.log("2. Drag the .excalidraw file to the browser");
console.log("3. Edit and export as needed\n");

// Exit with appropriate code
process.exit(validation.valid && cognitive.withinLimit ? 0 : 1);
