#!/usr/bin/env node
/**
 * translate-diagram.js - Convert diagram definitions between formats
 *
 * Supported translations:
 * - Mermaid → PlantUML (flowcharts, sequence diagrams)
 * - Mermaid → Excalidraw JSON (basic shapes and flows)
 *
 * IMPORTANT: This script only creates .excalidraw JSON files.
 * To render Excalidraw JSON to SVG, ALWAYS use render-excalidraw.sh:
 *   ${CLAUDE_PLUGIN_ROOT}/scripts/render-excalidraw.sh diagram.excalidraw diagram.svg
 *
 * Usage: node translate-diagram.js <input-format> <output-format> <input-file> <output-file>
 *
 * Examples:
 *   node translate-diagram.js mermaid plantuml diagram.mmd diagram.puml
 *   node translate-diagram.js mermaid excalidraw diagram.mmd diagram.excalidraw
 */

const fs = require('fs');
const path = require('path');

// Colorblind-safe theme colors
const THEME_COLORS = {
    primary: '#3b82f6',      // Blue
    secondary: '#f97316',    // Orange
    neutral: '#6b7280',      // Gray
    tertiary: '#8b5cf6'      // Purple
};

class DiagramTranslator {
    constructor(inputFormat, outputFormat) {
        this.inputFormat = inputFormat.toLowerCase();
        this.outputFormat = outputFormat.toLowerCase();
    }

    translate(inputContent) {
        if (this.inputFormat === 'mermaid' && this.outputFormat === 'plantuml') {
            return this.mermaidToPlantUML(inputContent);
        } else if (this.inputFormat === 'mermaid' && this.outputFormat === 'excalidraw') {
            return this.mermaidToExcalidraw(inputContent);
        } else {
            throw new Error(`Unsupported translation: ${this.inputFormat} → ${this.outputFormat}`);
        }
    }

    mermaidToPlantUML(mermaid) {
        // Detect diagram type
        if (mermaid.includes('sequenceDiagram')) {
            return this.mermaidSequenceToPlantUML(mermaid);
        } else if (mermaid.includes('graph ') || mermaid.includes('flowchart ')) {
            return this.mermaidFlowchartToPlantUML(mermaid);
        } else if (mermaid.includes('stateDiagram')) {
            return this.mermaidStateToPlantUML(mermaid);
        } else {
            // Default: try flowchart conversion
            return this.mermaidFlowchartToPlantUML(mermaid);
        }
    }

    mermaidFlowchartToPlantUML(mermaid) {
        let plantuml = '@startuml\n';
        plantuml += '!theme plain\n';
        plantuml += 'skinparam backgroundColor white\n';
        plantuml += `skinparam activity {\n`;
        plantuml += `  BackgroundColor ${THEME_COLORS.primary}\n`;
        plantuml += `  BorderColor ${THEME_COLORS.neutral}\n`;
        plantuml += `  FontColor white\n`;
        plantuml += `}\n\n`;

        // Parse Mermaid flowchart
        const lines = mermaid.split('\n');
        const nodes = new Map();
        const edges = [];

        lines.forEach(line => {
            line = line.trim();

            // Skip config lines and empty lines
            if (line.startsWith('%%') || line.startsWith('graph ') ||
                line.startsWith('flowchart ') || !line) {
                return;
            }

            // Extract node definitions with labels
            const nodeMatch = line.match(/([A-Za-z0-9_]+)\[([^\]]+)\]/);
            if (nodeMatch) {
                nodes.set(nodeMatch[1], nodeMatch[2]);
            }

            // Extract edges (arrows)
            const edgeMatch = line.match(/([A-Za-z0-9_]+)\s*(-->|->)\s*([A-Za-z0-9_]+)/);
            if (edgeMatch) {
                edges.push({
                    from: edgeMatch[1],
                    to: edgeMatch[3],
                    label: null
                });
            }

            // Extract edges with labels
            const labeledEdgeMatch = line.match(/([A-Za-z0-9_]+)\s*-->\|([^|]+)\|\s*([A-Za-z0-9_]+)/);
            if (labeledEdgeMatch) {
                edges.push({
                    from: labeledEdgeMatch[1],
                    to: labeledEdgeMatch[3],
                    label: labeledEdgeMatch[2]
                });
            }
        });

        // Add start marker
        plantuml += 'start\n';

        // Convert nodes and edges to PlantUML activity diagram
        const processed = new Set();
        edges.forEach(edge => {
            if (!processed.has(edge.from)) {
                const label = nodes.get(edge.from) || edge.from;
                plantuml += `:${label};\n`;
                processed.add(edge.from);
            }

            if (edge.label) {
                plantuml += `if (${edge.label}) then (yes)\n`;
                const toLabel = nodes.get(edge.to) || edge.to;
                plantuml += `  :${toLabel};\n`;
                plantuml += `endif\n`;
            } else {
                const toLabel = nodes.get(edge.to) || edge.to;
                plantuml += `:${toLabel};\n`;
            }

            processed.add(edge.to);
        });

        plantuml += 'stop\n';
        plantuml += '@enduml\n';

        return plantuml;
    }

    mermaidSequenceToPlantUML(mermaid) {
        let plantuml = '@startuml\n';
        plantuml += '!theme plain\n';
        plantuml += 'skinparam backgroundColor white\n\n';

        const lines = mermaid.split('\n');

        lines.forEach(line => {
            line = line.trim();

            // Skip config and empty lines
            if (line.startsWith('%%') || line.startsWith('sequenceDiagram') || !line) {
                return;
            }

            // Parse participant
            const participantMatch = line.match(/participant\s+(\S+)(?:\s+as\s+(.+))?/);
            if (participantMatch) {
                const name = participantMatch[1];
                const alias = participantMatch[2] || name;
                plantuml += `participant "${alias}" as ${name}\n`;
                return;
            }

            // Parse messages
            const messageMatch = line.match(/(\S+)\s*(->>|-->>|->>?\+|-->>?\+)\s*(\S+)\s*:\s*(.+)/);
            if (messageMatch) {
                const from = messageMatch[1];
                const arrow = messageMatch[2];
                const to = messageMatch[3];
                const msg = messageMatch[4];

                // Convert arrow type
                let pumlArrow = '->';
                if (arrow.includes('--')) {
                    pumlArrow = '-->';
                }

                plantuml += `${from} ${pumlArrow} ${to}: ${msg}\n`;
            }
        });

        plantuml += '@enduml\n';
        return plantuml;
    }

    mermaidStateToPlantUML(mermaid) {
        let plantuml = '@startuml\n';
        plantuml += '!theme plain\n\n';

        const lines = mermaid.split('\n');

        lines.forEach(line => {
            line = line.trim();

            if (line.startsWith('%%') || line.startsWith('stateDiagram') || !line) {
                return;
            }

            // Convert state transitions
            const transitionMatch = line.match(/(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.+))?/);
            if (transitionMatch) {
                const from = transitionMatch[1];
                const to = transitionMatch[2];
                const label = transitionMatch[3] || '';

                plantuml += `${from} --> ${to}`;
                if (label) {
                    plantuml += ` : ${label}`;
                }
                plantuml += '\n';
            }
        });

        plantuml += '@enduml\n';
        return plantuml;
    }

    mermaidToExcalidraw(mermaid) {
        // Parse Mermaid and create Excalidraw JSON
        const elements = [];
        let elementId = 1000;

        // Detect diagram type
        const isSequence = mermaid.includes('sequenceDiagram');
        const isFlowchart = mermaid.includes('graph ') || mermaid.includes('flowchart ');

        if (isFlowchart) {
            return this.mermaidFlowchartToExcalidraw(mermaid);
        } else if (isSequence) {
            return this.mermaidSequenceToExcalidraw(mermaid);
        }

        // Default empty Excalidraw
        return JSON.stringify({
            type: 'excalidraw',
            version: 2,
            source: 'https://excalidraw.com',
            elements: [],
            appState: {
                gridSize: null,
                viewBackgroundColor: '#ffffff'
            }
        }, null, 2);
    }

    mermaidFlowchartToExcalidraw(mermaid) {
        const elements = [];
        const nodes = new Map();
        const edges = [];
        let elementId = 1000;

        // First pass: collect all nodes and edges
        const lines = mermaid.split('\n');
        lines.forEach(line => {
            line = line.trim();

            if (line.startsWith('%%') || line.startsWith('graph ') ||
                line.startsWith('flowchart ') || !line) {
                return;
            }

            // Node definition with various bracket types - use matchAll to get all nodes on a line
            const nodePattern = /([A-Za-z0-9_]+)([\[\(\{])([^\]\)\}]+)([\]\)\}])/g;
            const nodeMatches = line.matchAll(nodePattern);
            for (const nodeMatch of nodeMatches) {
                if (!nodes.has(nodeMatch[1])) {
                    nodes.set(nodeMatch[1], {
                        label: nodeMatch[3],
                        shape: this.getShapeFromBrackets(nodeMatch[2], nodeMatch[4])
                    });
                }
            }

            // Edge definitions - handle various arrow types
            // Pattern captures node IDs, ignoring any bracket definitions
            const edgePatterns = [
                /([A-Za-z0-9_]+)(?:\[[^\]]+\])?\s*-->\|([^|]+)\|\s*([A-Za-z0-9_]+)(?:\[[^\]]+\])?/, // labeled arrow
                /([A-Za-z0-9_]+)(?:\[[^\]]+\])?\s*(-->|->)\s*([A-Za-z0-9_]+)(?:\[[^\]]+\])?/,        // simple arrow
            ];

            // Try labeled arrow first
            const labeledMatch = line.match(edgePatterns[0]);
            if (labeledMatch) {
                edges.push({
                    from: labeledMatch[1],
                    to: labeledMatch[3],
                    label: labeledMatch[2]
                });
            } else {
                // Try simple arrow
                const simpleMatch = line.match(edgePatterns[1]);
                if (simpleMatch) {
                    edges.push({
                        from: simpleMatch[1],
                        to: simpleMatch[3],
                        label: null
                    });
                }
            }
        });

        // Layout nodes in a hierarchical structure
        const levels = this.calculateNodeLevels(nodes, edges);
        const positions = this.layoutNodes(levels, nodes.size);

        // Create Excalidraw elements for nodes
        let nodeIndex = 0;
        for (const [nodeId, nodeData] of nodes) {
            const pos = positions[nodeIndex++];
            const excalidrawId = `node-${elementId++}`;

            nodeData.excalidrawId = excalidrawId;
            nodeData.x = pos.x;
            nodeData.y = pos.y;
            nodeData.width = 200;
            nodeData.height = 60;

            // Create shape based on Mermaid notation
            const shapeElement = {
                type: nodeData.shape,
                version: 1,
                versionNonce: elementId,
                isDeleted: false,
                id: excalidrawId,
                fillStyle: 'solid',
                strokeWidth: 2,
                strokeStyle: 'solid',
                roughness: 0,
                opacity: 100,
                angle: 0,
                x: pos.x,
                y: pos.y,
                strokeColor: THEME_COLORS.primary,
                backgroundColor: THEME_COLORS.primary + '20',
                width: nodeData.width,
                height: nodeData.height,
                seed: elementId,
                groupIds: [],
                roundness: nodeData.shape === 'rectangle' ? { type: 2 } : null,
                boundElements: [],
                updated: Date.now(),
                link: null,
                locked: false
            };

            elements.push(shapeElement);

            // Add text label
            elements.push({
                type: 'text',
                version: 1,
                versionNonce: elementId + 1,
                isDeleted: false,
                id: `text-${elementId++}`,
                fillStyle: 'solid',
                strokeWidth: 2,
                strokeStyle: 'solid',
                roughness: 0,
                opacity: 100,
                angle: 0,
                x: pos.x + 10,
                y: pos.y + 18,
                strokeColor: THEME_COLORS.primary,
                backgroundColor: 'transparent',
                width: nodeData.width - 20,
                height: 25,
                seed: elementId,
                groupIds: [],
                roundness: null,
                boundElements: [],
                updated: Date.now(),
                link: null,
                locked: false,
                fontSize: 16,
                fontFamily: 1,
                text: nodeData.label,
                textAlign: 'center',
                verticalAlign: 'middle',
                containerId: excalidrawId,
                originalText: nodeData.label,
                lineHeight: 1.25
            });
        }

        // Create arrow elements for edges with proper connections
        edges.forEach(edge => {
            const fromNode = nodes.get(edge.from);
            const toNode = nodes.get(edge.to);

            if (fromNode && toNode) {
                // Calculate connection points
                const fromCenterX = fromNode.x + fromNode.width / 2;
                const fromCenterY = fromNode.y + fromNode.height / 2;
                const toCenterX = toNode.x + toNode.width / 2;
                const toCenterY = toNode.y + toNode.height / 2;

                // Calculate arrow path
                const dx = toCenterX - fromCenterX;
                const dy = toCenterY - fromCenterY;

                const arrowId = `arrow-${elementId++}`;

                elements.push({
                    type: 'arrow',
                    version: 1,
                    versionNonce: elementId,
                    isDeleted: false,
                    id: arrowId,
                    fillStyle: 'solid',
                    strokeWidth: 2,
                    strokeStyle: 'solid',
                    roughness: 0,
                    opacity: 100,
                    angle: 0,
                    x: fromCenterX,
                    y: fromCenterY,
                    strokeColor: THEME_COLORS.neutral,
                    backgroundColor: 'transparent',
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                    seed: elementId,
                    groupIds: [],
                    roundness: { type: 2 },
                    boundElements: edge.label ? [{
                        type: 'text',
                        id: `arrow-label-${elementId}`
                    }] : [],
                    updated: Date.now(),
                    link: null,
                    locked: false,
                    startBinding: {
                        elementId: fromNode.excalidrawId,
                        focus: 0,
                        gap: 1
                    },
                    endBinding: {
                        elementId: toNode.excalidrawId,
                        focus: 0,
                        gap: 1
                    },
                    lastCommittedPoint: null,
                    startArrowhead: null,
                    endArrowhead: 'arrow',
                    points: [[0, 0], [dx, dy]]
                });

                // Add arrow label if present
                if (edge.label) {
                    const labelX = fromCenterX + dx / 2 - 30;
                    const labelY = fromCenterY + dy / 2 - 10;

                    elements.push({
                        type: 'text',
                        version: 1,
                        versionNonce: elementId + 1,
                        isDeleted: false,
                        id: `arrow-label-${elementId++}`,
                        fillStyle: 'solid',
                        strokeWidth: 2,
                        strokeStyle: 'solid',
                        roughness: 0,
                        opacity: 100,
                        angle: 0,
                        x: labelX,
                        y: labelY,
                        strokeColor: THEME_COLORS.neutral,
                        backgroundColor: '#ffffff',
                        width: 60,
                        height: 20,
                        seed: elementId,
                        groupIds: [],
                        roundness: null,
                        boundElements: [],
                        updated: Date.now(),
                        link: null,
                        locked: false,
                        fontSize: 14,
                        fontFamily: 1,
                        text: edge.label,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        containerId: arrowId,
                        originalText: edge.label,
                        lineHeight: 1.25
                    });
                }
            }
        });

        return JSON.stringify({
            type: 'excalidraw',
            version: 2,
            source: 'https://excalidraw.com',
            elements: elements,
            appState: {
                gridSize: null,
                viewBackgroundColor: '#ffffff'
            }
        }, null, 2);
    }

    mermaidSequenceToExcalidraw(mermaid) {
        // Sequence diagrams are complex - create placeholder
        return JSON.stringify({
            type: 'excalidraw',
            version: 2,
            source: 'https://excalidraw.com',
            elements: [],
            appState: {
                gridSize: null,
                viewBackgroundColor: '#ffffff'
            }
        }, null, 2);
    }

    getShapeFromBrackets(open, close) {
        // Map Mermaid bracket types to Excalidraw shapes
        if (open === '[' && close === ']') return 'rectangle';
        if (open === '(' && close === ')') return 'ellipse';
        if (open === '{' && close === '}') return 'diamond';
        return 'rectangle'; // default
    }

    calculateNodeLevels(nodes, edges) {
        // Simple hierarchical layout: assign levels based on dependencies
        const levels = new Map();
        const visited = new Set();

        // Find root nodes (nodes with no incoming edges)
        const hasIncoming = new Set();
        edges.forEach(edge => hasIncoming.add(edge.to));

        const roots = [];
        for (const [nodeId] of nodes) {
            if (!hasIncoming.has(nodeId)) {
                roots.push(nodeId);
            }
        }

        // BFS to assign levels
        let currentLevel = roots.map(id => ({ id, level: 0 }));
        while (currentLevel.length > 0) {
            const nextLevel = [];

            currentLevel.forEach(({ id, level }) => {
                if (!visited.has(id)) {
                    visited.add(id);
                    levels.set(id, level);

                    // Find children
                    edges.forEach(edge => {
                        if (edge.from === id && !visited.has(edge.to)) {
                            nextLevel.push({ id: edge.to, level: level + 1 });
                        }
                    });
                }
            });

            currentLevel = nextLevel;
        }

        // Handle nodes not in any path
        for (const [nodeId] of nodes) {
            if (!levels.has(nodeId)) {
                levels.set(nodeId, 0);
            }
        }

        return levels;
    }

    layoutNodes(levels, totalNodes) {
        // Calculate positions based on hierarchical levels
        const positions = [];
        const levelCounts = new Map();

        // Count nodes per level
        for (const [nodeId, level] of levels) {
            levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        }

        const levelX = new Map();
        const levelY = new Map();
        const startX = 100;
        const startY = 100;
        const horizontalGap = 300;
        const verticalGap = 150;

        // Track position within each level
        const levelIndex = new Map();

        for (const [nodeId, level] of levels) {
            const idx = levelIndex.get(level) || 0;
            levelIndex.set(level, idx + 1);

            const x = startX + level * horizontalGap;
            const y = startY + idx * verticalGap;

            positions.push({ x, y });
        }

        return positions;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 4) {
        console.error('Usage: translate-diagram.js <input-format> <output-format> <input-file> <output-file>');
        console.error('');
        console.error('Formats: mermaid, plantuml, excalidraw');
        console.error('');
        console.error('Examples:');
        console.error('  translate-diagram.js mermaid plantuml diagram.mmd diagram.puml');
        console.error('  translate-diagram.js mermaid excalidraw diagram.mmd diagram.excalidraw');
        process.exit(1);
    }

    const [inputFormat, outputFormat, inputFile, outputFile] = args;

    try {
        const inputContent = fs.readFileSync(inputFile, 'utf-8');
        const translator = new DiagramTranslator(inputFormat, outputFormat);
        const outputContent = translator.translate(inputContent);

        fs.writeFileSync(outputFile, outputContent);
        console.log(`✓ Translated ${inputFormat} → ${outputFormat}`);
        console.log(`  Input: ${inputFile}`);
        console.log(`  Output: ${outputFile}`);
        process.exit(0);
    } catch (error) {
        console.error(`✗ Translation failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = { DiagramTranslator };
