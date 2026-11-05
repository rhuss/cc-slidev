// Excalidraw Element Factory Functions
// Reference file loaded on demand by excalidraw-generation skill.
// These functions generate valid Excalidraw JSON elements.

// --- Color Palette (Colorblind-Safe) ---

const THEME_COLORS = {
  primary: "#3b82f6",      // Blue (8.6:1 contrast) - Main shapes
  secondary: "#f97316",    // Orange (3.4:1, >=24pt only) - Emphasis
  neutral: "#6b7280",      // Gray - Arrows, frames
  text: "#1f2937",         // Dark gray (16.1:1 contrast) - ALL text
  background: "#ffffff",   // White canvas
  accent: "#8b5cf6",       // Purple - Annotations
  light_bg: "#f3f4f6"      // Light gray - Frame fills
};

// --- Layout Constants ---

const LAYOUT = {
  MARGIN: 50,
  PADDING: 40,
  NODE_WIDTH: 180,
  NODE_HEIGHT: 80,
  ARROW_GAP: 10
};

// --- ID Generation ---

function generateId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// --- Element Factories ---

function createRectangle(x, y, width, height, text = null, options = {}) {
  const id = generateId();
  const element = {
    type: "rectangle", version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false, id: id,
    fillStyle: options.fillStyle || "hachure",
    strokeWidth: options.strokeWidth || 2,
    strokeStyle: "solid",
    roughness: options.roughness !== undefined ? options.roughness : 1,
    opacity: 100, angle: options.angle || 0,
    x: x, y: y,
    strokeColor: options.strokeColor || THEME_COLORS.primary,
    backgroundColor: options.backgroundColor || "transparent",
    width: width, height: height,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: { type: 3 },
    boundElements: [],
    updated: Date.now(), link: null, locked: false
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
    type: "text", version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false, id: options.id || generateId(),
    fillStyle: "hachure", strokeWidth: 1,
    strokeStyle: "solid", roughness: 0,
    opacity: 100, angle: 0, x: x, y: y,
    strokeColor: options.strokeColor || THEME_COLORS.text,
    backgroundColor: "transparent",
    width: options.width || 200, height: options.height || 25,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: null, boundElements: [],
    updated: Date.now(), link: null, locked: false,
    fontSize: options.fontSize || 20,
    fontFamily: 1, // 1=Excalifont/Virgil, 2=Helvetica, 3=Cascadia
    text: text,
    textAlign: options.textAlign || "center",
    verticalAlign: options.verticalAlign || "middle",
    containerId: options.containerId || null,
    originalText: text, lineHeight: 1.25, baseline: 18
  };
}

function createBoundText(text, containerId, containerX, containerY, containerWidth, containerHeight) {
  const textWidth = Math.min(containerWidth - 20, 200);
  const textHeight = 25;
  const textX = containerX + (containerWidth - textWidth) / 2;
  const textY = containerY + (containerHeight - textHeight) / 2;
  return createText(text, textX, textY, {
    width: textWidth, height: textHeight,
    containerId: containerId,
    textAlign: "center", verticalAlign: "middle"
  });
}

function createArrow(startX, startY, endX, endY, options = {}) {
  const points = [[0, 0], [endX - startX, endY - startY]];
  return {
    type: "arrow", version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false, id: generateId(),
    fillStyle: "hachure",
    strokeWidth: options.strokeWidth || 2,
    strokeStyle: "solid",
    roughness: options.roughness !== undefined ? options.roughness : 1,
    opacity: 100, angle: 0, x: startX, y: startY,
    strokeColor: options.strokeColor || THEME_COLORS.neutral,
    backgroundColor: "transparent",
    width: Math.abs(endX - startX), height: Math.abs(endY - startY),
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: { type: 2 }, boundElements: [],
    updated: Date.now(), link: null, locked: false,
    startBinding: options.startBinding || null,
    endBinding: options.endBinding || null,
    lastCommittedPoint: null,
    startArrowhead: null, endArrowhead: "arrow",
    points: points
  };
}

function createFrame(x, y, width, height, name, options = {}) {
  return {
    type: "frame", version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false, id: generateId(),
    fillStyle: "hachure", strokeWidth: 2,
    strokeStyle: "solid", roughness: 0,
    opacity: 100, angle: 0, x: x, y: y,
    strokeColor: options.strokeColor || THEME_COLORS.neutral,
    backgroundColor: options.backgroundColor || THEME_COLORS.light_bg,
    width: width, height: height,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: [], frameId: null,
    roundness: null, boundElements: [],
    updated: Date.now(), link: null, locked: false,
    name: name
  };
}

function createEllipse(x, y, width, height, text = null, options = {}) {
  const id = generateId();
  const element = {
    type: "ellipse", version: 1,
    versionNonce: Math.floor(Math.random() * 1000000),
    isDeleted: false, id: id,
    fillStyle: options.fillStyle || "hachure",
    strokeWidth: options.strokeWidth || 2,
    strokeStyle: "solid",
    roughness: options.roughness !== undefined ? options.roughness : 1,
    opacity: 100, angle: 0, x: x, y: y,
    strokeColor: options.strokeColor || THEME_COLORS.primary,
    backgroundColor: options.backgroundColor || "transparent",
    width: width, height: height,
    seed: Math.floor(Math.random() * 1000000),
    groupIds: options.groupIds || [],
    frameId: options.frameId || null,
    roundness: null, boundElements: [],
    updated: Date.now(), link: null, locked: false
  };
  if (text) {
    const textElement = createBoundText(text, id, x, y, width, height);
    element.boundElements.push({ type: "text", id: textElement.id });
    return [element, textElement];
  }
  return element;
}

function createCallout(targetX, targetY, text, direction = "top-right") {
  const offsets = {
    "top-right": { dx: 100, dy: -80 },
    "top-left": { dx: -100, dy: -80 },
    "bottom-right": { dx: 100, dy: 80 },
    "bottom-left": { dx: -100, dy: 80 }
  };
  const offset = offsets[direction];
  const textX = targetX + offset.dx;
  const textY = targetY + offset.dy;
  const calloutText = createText(text, textX, textY, {
    fontSize: 16, strokeColor: THEME_COLORS.accent
  });
  const arrow = createArrow(textX, textY + 12, targetX, targetY, {
    strokeColor: THEME_COLORS.accent, strokeWidth: 1.5
  });
  const groupId = generateId();
  calloutText.groupIds.push(groupId);
  arrow.groupIds.push(groupId);
  return [calloutText, arrow];
}

// --- Connection Binding ---

function createBindingPoint(shapeId, shapeX, shapeY, shapeWidth, shapeHeight, side) {
  const focusMap = {
    right: { x: 1, y: 0 }, left: { x: -1, y: 0 },
    bottom: { x: 0, y: 1 }, top: { x: 0, y: -1 }
  };
  return { elementId: shapeId, focus: focusMap[side], gap: LAYOUT.ARROW_GAP };
}

function connectShapesHorizontal(shapeA, shapeB) {
  return createArrow(
    shapeA.x + shapeA.width, shapeA.y + shapeA.height / 2,
    shapeB.x, shapeB.y + shapeB.height / 2,
    {
      startBinding: createBindingPoint(shapeA.id, shapeA.x, shapeA.y, shapeA.width, shapeA.height, "right"),
      endBinding: createBindingPoint(shapeB.id, shapeB.x, shapeB.y, shapeB.width, shapeB.height, "left")
    }
  );
}

// --- Layout Algorithms ---

function layoutHorizontalFlow(nodes) {
  const positions = [];
  let currentX = LAYOUT.MARGIN;
  const baseY = 200;
  nodes.forEach(node => {
    positions.push({ x: currentX, y: baseY, width: LAYOUT.NODE_WIDTH, height: LAYOUT.NODE_HEIGHT, text: node });
    currentX += LAYOUT.NODE_WIDTH + LAYOUT.PADDING;
  });
  return positions;
}

function layoutVerticalFlow(nodes) {
  const positions = [];
  const baseX = 300;
  let currentY = LAYOUT.MARGIN;
  nodes.forEach(node => {
    positions.push({ x: baseX, y: currentY, width: LAYOUT.NODE_WIDTH, height: LAYOUT.NODE_HEIGHT, text: node });
    currentY += LAYOUT.NODE_HEIGHT + LAYOUT.PADDING;
  });
  return positions;
}

function layoutRadial(centerNode, childNodes) {
  const positions = [];
  const centerX = 400, centerY = 300, radius = 200;
  positions.push({ x: centerX - LAYOUT.NODE_WIDTH / 2, y: centerY - LAYOUT.NODE_HEIGHT / 2,
    width: LAYOUT.NODE_WIDTH, height: LAYOUT.NODE_HEIGHT, text: centerNode });
  const angleStep = (2 * Math.PI) / childNodes.length;
  childNodes.forEach((node, index) => {
    const angle = index * angleStep;
    positions.push({
      x: centerX + radius * Math.cos(angle) - LAYOUT.NODE_WIDTH / 2,
      y: centerY + radius * Math.sin(angle) - LAYOUT.NODE_HEIGHT / 2,
      width: LAYOUT.NODE_WIDTH, height: LAYOUT.NODE_HEIGHT, text: node
    });
  });
  return positions;
}

// --- Validation ---

function validateExcalidrawJSON(json) {
  const errors = [];
  if (json.type !== "excalidraw") errors.push("Missing or invalid 'type'");
  if (json.version !== 2) errors.push("Version should be 2");
  if (!Array.isArray(json.elements)) errors.push("'elements' must be array");
  if (typeof json.appState !== "object") errors.push("'appState' must be object");
  json.elements.forEach((el, i) => {
    if (!el.id) errors.push(`Element ${i} missing 'id'`);
    if (!el.type) errors.push(`Element ${i} missing 'type'`);
    if (typeof el.x !== "number") errors.push(`Element ${i} missing 'x'`);
    if (typeof el.y !== "number") errors.push(`Element ${i} missing 'y'`);
    if (el.boundElements) {
      el.boundElements.forEach(bound => {
        if (bound.type === "text") {
          const textEl = json.elements.find(e => e.id === bound.id);
          if (!textEl) errors.push(`Bound text ${bound.id} not found`);
          if (textEl && textEl.containerId !== el.id) errors.push(`Bound text ${bound.id} containerId mismatch`);
        }
      });
    }
    if (el.type === "arrow") {
      ["startBinding", "endBinding"].forEach(binding => {
        if (el[binding] && el[binding].elementId) {
          if (!json.elements.find(e => e.id === el[binding].elementId))
            errors.push(`Arrow ${el.id} ${binding} target not found`);
        }
      });
    }
  });
  return { valid: errors.length === 0, errors };
}

function countCognitiveElements(json) {
  const units = { shapes: 0, arrows: 0, annotations: 0, frames: 0 };
  const grouped = new Set();
  json.elements.forEach(el => {
    if (el.groupIds && el.groupIds.length > 0) {
      if (grouped.has(el.groupIds[0])) return;
      grouped.add(el.groupIds[0]);
    }
    if (el.containerId) return;
    switch (el.type) {
      case "rectangle": case "ellipse": case "diamond": units.shapes++; break;
      case "arrow": case "line": units.arrows++; break;
      case "text": units.annotations++; break;
      case "frame": units.frames++; break;
    }
  });
  const total = units.shapes + units.arrows + units.annotations + units.frames;
  return { breakdown: units, total, withinLimit: total <= 9,
    recommendation: total > 9 ? "SPLIT into multiple diagrams" : "Good" };
}

// --- Assembly ---

function assembleExcalidrawJSON(elements) {
  return {
    type: "excalidraw", version: 2,
    source: "https://excalidraw.com",
    elements: elements,
    appState: { viewBackgroundColor: THEME_COLORS.background, gridSize: null, theme: "light" },
    files: {}
  };
}
