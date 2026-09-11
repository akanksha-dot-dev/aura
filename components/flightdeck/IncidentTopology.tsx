'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
} from 'd3-force';
import type { TopologyNode, TopologyEdge, ClassificationType } from '@/lib/types';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function wrapText(text: string, maxCharsPerLine: number = 24): [string, string?] {
  if (!text) return [''];
  if (text.length <= maxCharsPerLine) {
    return [text];
  }
  const words = text.split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const word of words) {
    if (!line2 && (line1 ? line1 + ' ' + word : word).length <= maxCharsPerLine) {
      line1 = line1 ? line1 + ' ' + word : word;
    } else if ((line2 ? line2 + ' ' + word : word).length <= maxCharsPerLine) {
      line2 = line2 ? line2 + ' ' + word : word;
    } else if (!line2) {
      line2 = word;
    }
  }
  if (!line1 && line2) {
    line1 = line2;
    line2 = '';
  }
  if (line2 && text.length > line1.length + line2.length + 1) {
    if (line2.length > maxCharsPerLine - 2) {
      line2 = line2.substring(0, maxCharsPerLine - 2) + '…';
    } else {
      line2 = line2 + '…';
    }
  }
  return [line1, line2 || undefined];
}

export interface IncidentTopologyProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeHover?: (nodeId: string | null) => void;
  onNodeClick?: (nodeId: string) => void;
}

interface SimulationNode extends TopologyNode, SimulationNodeDatum {}

interface SimulationLink {
  source: string | SimulationNode;
  target: string | SimulationNode;
  type: TopologyEdge['type'];
}

function getNodeColors(category: ClassificationType, status?: string) {
  if (status === 'disproven') {
    return {
      fill: 'rgba(232, 84, 84, 0.1)',
      stroke: 'rgba(232, 84, 84, 0.45)',
      text: 'var(--color-conflict)',
      badge: 'var(--color-conflict)',
      glow: 'rgba(232, 84, 84, 0.25)',
    };
  }

  switch (category) {
    case 'fact':
      return {
        fill: 'rgba(59, 212, 162, 0.1)',
        stroke: 'var(--color-fact)',
        text: 'var(--color-fact)',
        badge: 'var(--color-fact)',
        glow: 'rgba(59, 212, 162, 0.3)',
      };
    case 'hypothesis':
      return {
        fill: 'rgba(212, 168, 83, 0.1)',
        stroke: 'var(--color-hypothesis)',
        text: 'var(--color-hypothesis)',
        badge: 'var(--color-hypothesis)',
        glow: 'rgba(212, 168, 83, 0.3)',
      };
    case 'decision':
      return {
        fill: 'rgba(123, 140, 255, 0.1)',
        stroke: 'var(--color-decision)',
        text: 'var(--color-decision)',
        badge: 'var(--color-decision)',
        glow: 'rgba(123, 140, 255, 0.3)',
      };
    case 'action':
      return {
        fill: 'rgba(232, 125, 62, 0.1)',
        stroke: 'var(--color-action)',
        text: 'var(--color-action)',
        badge: 'var(--color-action)',
        glow: 'rgba(232, 125, 62, 0.3)',
      };
    case 'conflict':
      return {
        fill: 'rgba(232, 84, 84, 0.1)',
        stroke: 'var(--color-conflict)',
        text: 'var(--color-conflict)',
        badge: 'var(--color-conflict)',
        glow: 'rgba(232, 84, 84, 0.4)',
      };
    default:
      return {
        fill: 'var(--bg-surface-raised)',
        stroke: 'var(--text-secondary)',
        text: 'var(--text-secondary)',
        badge: 'var(--text-secondary)',
        glow: 'rgba(255, 255, 255, 0.1)',
      };
  }
}

export function IncidentTopology({
  nodes,
  edges,
  onNodeHover,
  onNodeClick,
}: IncidentTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 450 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Simulation state for React rendering
  const [simNodes, setSimNodes] = useState<SimulationNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimulationLink[]>([]);

  // Simulation instance stored in ref for imperative simulation lifecycle
  const simulationRef = useRef<Simulation<SimulationNode, SimulationLink> | null>(null);

  // 1. Observe container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 2. Initialize or update force simulation with chronological lineage
  useEffect(() => {
    const { width, height } = dimensions;

    const existingSimNodes = simulationRef.current?.nodes() || [];
    const existingMap = new Map<string, SimulationNode>(
      existingSimNodes.map((n) => [n.id, n])
    );

    const sortedByTime = [...nodes].sort((a, b) => a.timestamp - b.timestamp);
    const minTime = sortedByTime[0]?.timestamp || Date.now();
    const maxTime = sortedByTime[sortedByTime.length - 1]?.timestamp || Date.now();
    const timeSpan = maxTime - minTime || 1;

    const newSimNodes: SimulationNode[] = sortedByTime.map((node, i) => {
      const existing = existingMap.get(node.id);
      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
        };
      }

      // Chronological horizontal distribution across the canvas
      const tNorm = nodes.length > 1 ? (node.timestamp - minTime) / timeSpan : 0.5;
      const targetX = width * 0.16 + tNorm * (width * 0.68);
      const staggerY = ((i % 3) - 1) * 75;

      return {
        ...node,
        x: targetX + (Math.random() - 0.5) * 30,
        y: height / 2 + staggerY + (Math.random() - 0.5) * 20,
      };
    });

    const newSimLinks: SimulationLink[] = edges.map((e) => ({
      source: typeof e.source === 'object' ? (e.source as TopologyNode).id : e.source,
      target: typeof e.target === 'object' ? (e.target as TopologyNode).id : e.target,
      type: e.type,
    }));

    if (!simulationRef.current) {
      const sim = forceSimulation<SimulationNode>(newSimNodes)
        .force('charge', forceManyBody<SimulationNode>().strength(-480))
        .force(
          'link',
          forceLink<SimulationNode, SimulationLink>(newSimLinks)
            .id((d) => d.id)
            .distance((link) => {
              if (link.type === 'temporal') return 145;
              if (link.type === 'dependency') return 160;
              return 180;
            })
            .strength(0.35)
        )
        .force('center', forceCenter<SimulationNode>(width / 2, height / 2 + 10))
        .force(
          'collision',
          forceCollide<SimulationNode>().radius(112)
        )
        .force(
          'x',
          forceX<SimulationNode>((d) => {
            const tNorm = nodes.length > 1 ? (d.timestamp - minTime) / timeSpan : 0.5;
            return width * 0.16 + tNorm * (width * 0.68);
          }).strength(0.10)
        )
        .force('y', forceY<SimulationNode>(height / 2 + 10).strength(0.08))
        .alphaDecay(0.025);

      let rafId: number;
      sim.on('tick', () => {
        // Enforce safe boundary clamping for 200x54 cards
        // padYTop is 68px to ensure cards never collide with top-right legend
        const padX = 130;
        const padYTop = 68;
        const padYBottom = 75;
        for (const node of sim.nodes()) {
          if (typeof node.x === 'number') {
            node.x = Math.max(padX, Math.min(width - padX, node.x));
          }
          if (typeof node.y === 'number') {
            node.y = Math.max(padYTop, Math.min(height - padYBottom, node.y));
          }
        }
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          setSimNodes([...sim.nodes()]);
          const linkForce = sim.force('link') as ReturnType<
            typeof forceLink<SimulationNode, SimulationLink>
          >;
          if (linkForce) {
            setSimLinks([...linkForce.links()]);
          }
        });
      });

      simulationRef.current = sim;
    } else {
      const sim = simulationRef.current;
      sim.nodes(newSimNodes);

      const linkForce = sim.force('link') as ReturnType<
        typeof forceLink<SimulationNode, SimulationLink>
      >;
      if (linkForce) {
        linkForce.links(newSimLinks).distance((link) => {
          if (link.type === 'temporal') return 145;
          if (link.type === 'dependency') return 160;
          return 180;
        });
      }

      const chargeForce = sim.force('charge') as ReturnType<
        typeof forceManyBody<SimulationNode>
      >;
      if (chargeForce) {
        chargeForce.strength(-480);
      }

      const collideForce = sim.force('collision') as ReturnType<
        typeof forceCollide<SimulationNode>
      >;
      if (collideForce) {
        collideForce.radius(112);
      }

      const centerForce = sim.force('center') as ReturnType<typeof forceCenter<SimulationNode>>;
      if (centerForce) {
        centerForce.x(width / 2).y(height / 2 + 10);
      }

      const xForce = sim.force('x') as ReturnType<typeof forceX<SimulationNode>>;
      if (xForce) {
        xForce.x((d) => {
          const tNorm = nodes.length > 1 ? (d.timestamp - minTime) / timeSpan : 0.5;
          return width * 0.16 + tNorm * (width * 0.68);
        }).strength(0.10);
      }

      const yForce = sim.force('y') as ReturnType<typeof forceY<SimulationNode>>;
      if (yForce) {
        yForce.y(height / 2 + 10).strength(0.08);
      }

      sim.alpha(0.3).restart();
    }
  }, [nodes, edges, dimensions]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, []);

  const handleMouseEnter = useCallback(
    (nodeId: string) => {
      setHoveredNodeId(nodeId);
      onNodeHover?.(nodeId);
    },
    [onNodeHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
    onNodeHover?.(null);
  }, [onNodeHover]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  const handleRecenter = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.5).restart();
    }
  }, []);

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return simNodes.find((n) => n.id === hoveredNodeId) || null;
  }, [hoveredNodeId, simNodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return simNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, simNodes]);

  const nodeMap = useMemo(() => {
    return new Map<string, SimulationNode>(simNodes.map((n) => [n.id, n]));
  }, [simNodes]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return { sources: [] as SimulationNode[], targets: [] as SimulationNode[] };
    const sources: SimulationNode[] = [];
    const targets: SimulationNode[] = [];
    edges.forEach((edge) => {
      const sId = typeof edge.source === 'object' ? (edge.source as TopologyNode).id : edge.source;
      const tId = typeof edge.target === 'object' ? (edge.target as TopologyNode).id : edge.target;
      if (tId === selectedNodeId) {
        const sNode = nodeMap.get(sId);
        if (sNode && !sources.some((s) => s.id === sNode.id)) sources.push(sNode);
      }
      if (sId === selectedNodeId) {
        const tNode = nodeMap.get(tId);
        if (tNode && !targets.some((t) => t.id === tNode.id)) targets.push(tNode);
      }
    });
    return { sources, targets };
  }, [selectedNodeId, edges, nodeMap]);

  // Ancestor / descendant highlighting when hovering or selecting a node
  const activeFocusId = hoveredNodeId || selectedNodeId;
  const connectedInfo = useMemo(() => {
    if (!activeFocusId) return { nodeIds: new Set<string>(), edgeIndices: new Set<number>() };
    const nodeIds = new Set<string>([activeFocusId]);
    const edgeIndices = new Set<number>();

    edges.forEach((edge, idx) => {
      const sId = typeof edge.source === 'object' ? (edge.source as TopologyNode).id : edge.source;
      const tId = typeof edge.target === 'object' ? (edge.target as TopologyNode).id : edge.target;
      if (sId === activeFocusId || tId === activeFocusId) {
        nodeIds.add(sId);
        nodeIds.add(tId);
        edgeIndices.add(idx);
      }
    });

    return { nodeIds, edgeIndices };
  }, [activeFocusId, edges]);

  if (nodes.length === 0) {
    return (
      <div className="topology-container topology-empty">
        <div className="topology-empty-message">
          <span className="topology-empty-pulse" />
          <span>AWAITING INCIDENT TELEMETRY TO GENERATE TOPOLOGY GRAPH...</span>
        </div>
      </div>
    );
  }

  const CARD_WIDTH = 200;
  const CARD_HEIGHT = 54;

  return (
    <div ref={containerRef} className="topology-container">
      <style>{`
        .topology-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: var(--bg-base);
        }

        .topology-legend {
          position: absolute;
          top: 12px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(14, 16, 21, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          z-index: 10;
          pointer-events: auto;
        }

        .topology-legend__item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-sans);
          font-size: 10.5px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: -0.01em;
          padding: 2px 5px;
        }

        .topology-legend__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .topology-controls {
          position: absolute;
          top: 12px;
          left: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 10;
        }

        .topology-control-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          background: rgba(14, 16, 21, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xs);
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 10px;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-standard);
        }

        .topology-control-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-emphasis);
          background: rgba(255, 255, 255, 0.04);
        }

        .topology-tooltip {
          position: absolute;
          width: 270px;
          background: rgba(14, 16, 21, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-emphasis);
          border-radius: var(--radius-md);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), var(--shadow-inner-glow);
          padding: 12px;
          z-index: 50;
          pointer-events: none;
          font-family: var(--font-sans);
          display: flex;
          flex-direction: column;
          gap: 6px;
          animation: tooltip-fade 0.15s ease-out;
        }

        .topology-tooltip-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .topology-tooltip-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid;
          letter-spacing: 0.04em;
        }

        .topology-tooltip-confidence {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .topology-tooltip-status {
          font-family: var(--font-mono);
          font-size: 9px;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          background: rgba(232, 84, 84, 0.15);
          color: var(--color-conflict);
        }

        .topology-tooltip-content {
          font-size: 12px;
          line-height: 1.42;
          color: var(--text-primary);
          margin: 0;
        }

        .topology-tooltip-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: var(--text-muted);
        }

        /* Signal Flow Animation on Causal Edges */
        @keyframes signalFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }

        .topology-edge {
          stroke: rgba(255, 255, 255, 0.14);
          stroke-width: 1.25;
          transition: opacity 0.2s var(--ease-standard), stroke 0.2s var(--ease-standard);
        }

        .topology-edge--causal {
          stroke: rgba(123, 140, 255, 0.38);
          stroke-dasharray: 4 4;
          animation: signalFlow 1.2s linear infinite;
        }

        .topology-edge--temporal {
          stroke: rgba(212, 168, 83, 0.45);
          stroke-width: 1.3;
          stroke-dasharray: 4 3;
          animation: signalFlow 2s linear infinite;
        }

        .topology-edge--dependency {
          stroke: rgba(232, 125, 62, 0.55);
          stroke-width: 1.4;
          stroke-dasharray: 5 3;
          animation: signalFlow 1.6s linear infinite;
        }

        .topology-edge--conflict {
          stroke: rgba(232, 84, 84, 0.55);
          stroke-width: 1.5;
          stroke-dasharray: 5 3;
        }

        .topology-edge--contradicts {
          stroke: rgba(232, 84, 84, 0.65);
          stroke-width: 1.5;
        }

        .topology-edge--highlighted {
          stroke-width: 2.2 !important;
          opacity: 1 !important;
        }

        .topology-edge--dimmed {
          opacity: 0.15 !important;
        }

        .topology-node-group {
          transition: opacity 0.2s var(--ease-standard);
        }

        .topology-node--dimmed {
          opacity: 0.25;
        }

        .topology-node--selected rect {
          stroke: var(--color-aura) !important;
          stroke-width: 2 !important;
          filter: drop-shadow(0 0 6px rgba(212, 168, 83, 0.45));
        }

        .topology-inspector {
          position: absolute;
          bottom: 14px;
          right: 14px;
          width: 310px;
          max-height: calc(100% - 70px);
          overflow-y: auto;
          background: rgba(14, 16, 21, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--border-emphasis);
          border-radius: var(--radius-md);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), var(--shadow-inner-glow);
          padding: 14px;
          z-index: 45;
          font-family: var(--font-sans);
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: tooltip-fade 0.15s ease-out;
        }

        .topology-inspector__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .topology-inspector__close {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 13px;
          padding: 2px 6px;
          border-radius: var(--radius-xs);
          line-height: 1;
        }

        .topology-inspector__close:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
        }

        .topology-inspector__content {
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-primary);
          margin: 0;
          word-break: break-word;
        }

        .topology-inspector__meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-muted);
          border-top: 1px solid var(--border-subtle);
          padding-top: 6px;
        }

        .topology-inspector__relations {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 10px;
          font-family: var(--font-mono);
          border-top: 1px solid var(--border-subtle);
          padding-top: 6px;
        }

        .topology-inspector__rel-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
        }
      `}</style>

      {/* Top-Right Category Legend */}
      <div className="topology-legend" aria-label="Topology graph legend">
        <span className="topology-legend__item">
          <span className="topology-legend__dot" style={{ background: 'var(--color-fact)' }} /> Fact
        </span>
        <span className="topology-legend__item">
          <span className="topology-legend__dot" style={{ background: 'var(--color-hypothesis)' }} /> Hypothesis
        </span>
        <span className="topology-legend__item">
          <span className="topology-legend__dot" style={{ background: 'var(--color-decision)' }} /> Decision
        </span>
        <span className="topology-legend__item">
          <span className="topology-legend__dot" style={{ background: 'var(--color-action)' }} /> Action
        </span>
        <span className="topology-legend__item">
          <span className="topology-legend__dot" style={{ background: 'var(--color-conflict)' }} /> Conflict
        </span>
      </div>

      {/* Bottom-Left Navigation / Recenter Controls */}
      <div className="topology-controls">
        <button
          type="button"
          className="topology-control-btn"
          onClick={handleRecenter}
          title="Reset force layout and re-center nodes"
          aria-label="Re-center simulation"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <span>Recenter</span>
        </button>
      </div>

      <svg
        className="topology-svg"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="topo-dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.035)" />
          </pattern>
          <marker
            id="topo-arrowhead"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(123, 140, 255, 0.7)" />
          </marker>
          <marker
            id="topo-arrowhead-temporal"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.8 L 7.5 5 L 0 8.2 z" fill="rgba(212, 168, 83, 0.75)" />
          </marker>
          <marker
            id="topo-arrowhead-dependency"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(232, 125, 62, 0.85)" />
          </marker>
          <marker
            id="topo-arrowhead-conflict"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(232, 84, 84, 0.85)" />
          </marker>
        </defs>

        {/* Subtle Precision Dot-Grid Canvas Background */}
        <rect width="100%" height="100%" fill="url(#topo-dot-grid)" />

        {/* 1. Directional Smooth Curved Bezier Edges */}
        <g className="topology-edges">
          {simLinks.map((link, idx) => {
            const sourceNode =
              typeof link.source === 'object'
                ? link.source
                : nodeMap.get(link.source as string);
            const targetNode =
              typeof link.target === 'object'
                ? link.target
                : nodeMap.get(link.target as string);

            if (!sourceNode || !targetNode) return null;
            if (sourceNode.x == null || sourceNode.y == null) return null;
            if (targetNode.x == null || targetNode.y == null) return null;

            const isConflict = link.type === 'conflict';
            const isContradicts = link.type === 'contradicts';
            const isTemporal = link.type === 'temporal';
            const isDependency = link.type === 'dependency';
            const isHighlighted = activeFocusId ? connectedInfo.edgeIndices.has(idx) : false;
            const isDimmed = activeFocusId ? !isHighlighted : false;

            let edgeClass = isConflict
              ? 'topology-edge topology-edge--conflict'
              : isContradicts
              ? 'topology-edge topology-edge--contradicts'
              : isTemporal
              ? 'topology-edge topology-edge--temporal'
              : isDependency
              ? 'topology-edge topology-edge--dependency'
              : 'topology-edge topology-edge--causal';

            if (isHighlighted) edgeClass += ' topology-edge--highlighted';
            if (isDimmed) edgeClass += ' topology-edge--dimmed';

            // Calculate boundary intersection offset so arrows cleanly meet the card edges
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dist = Math.hypot(dx, dy) || 1;
            const unitX = dx / dist;
            const unitY = dy / dist;

            // Half dimensions of cards with safe margin
            const halfW = CARD_WIDTH / 2;
            const halfH = CARD_HEIGHT / 2;
            const startX = sourceNode.x + unitX * Math.min(halfW, halfH * Math.abs(dx / (dy || 0.001)));
            const startY = sourceNode.y + unitY * Math.min(halfH, halfW * Math.abs(dy / (dx || 0.001)));
            const endX = targetNode.x - unitX * Math.min(halfW, halfH * Math.abs(dx / (dy || 0.001)));
            const endY = targetNode.y - unitY * Math.min(halfH, halfW * Math.abs(dy / (dx || 0.001)));

            const cx = (startX + endX) / 2 - dy * 0.06;
            const cy = (startY + endY) / 2 + dx * 0.06;
            const pathData = `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;

            return (
              <path
                key={`edge-${idx}-${sourceNode.id}-${targetNode.id}`}
                className={edgeClass}
                d={pathData}
                fill="none"
                markerEnd={
                  isConflict
                    ? undefined
                    : isContradicts
                    ? 'url(#topo-arrowhead-conflict)'
                    : isTemporal
                    ? 'url(#topo-arrowhead-temporal)'
                    : isDependency
                    ? 'url(#topo-arrowhead-dependency)'
                    : 'url(#topo-arrowhead)'
                }
              />
            );
          })}
        </g>

        {/* 2. Structured DAG Cards for Causal Nodes */}
        <g className="topology-nodes">
          {simNodes.map((node) => {
            if (node.x == null || node.y == null) return null;
            const colors = getNodeColors(node.category, node.status);
            const isDisproven = node.status === 'disproven';
            const isHovered = node.id === hoveredNodeId;
            const isSelected = node.id === selectedNodeId;
            const isConnected = activeFocusId ? connectedInfo.nodeIds.has(node.id) : false;
            const isDimmed = activeFocusId ? !isConnected : false;

            const halfW = CARD_WIDTH / 2;
            const halfH = CARD_HEIGHT / 2;
            const [line1, line2] = wrapText(node.content, 23);

            return (
              <g
                key={node.id}
                className={`topology-node-group ${isDimmed ? 'topology-node--dimmed' : ''} ${isSelected ? 'topology-node--selected' : ''}`}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => handleMouseEnter(node.id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node Card Outer Highlight Glow on Hover */}
                {isHovered && (
                  <rect
                    x={-halfW - 3}
                    y={-halfH - 3}
                    width={CARD_WIDTH + 6}
                    height={CARD_HEIGHT + 6}
                    rx="8"
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.8"
                  />
                )}

                {/* Main Card Surface */}
                <rect
                  x={-halfW}
                  y={-halfH}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  rx="6"
                  fill="var(--bg-surface-raised)"
                  stroke={isSelected ? 'var(--color-aura)' : isHovered ? colors.stroke : isConnected ? colors.stroke : 'var(--border-subtle)'}
                  strokeWidth={isSelected ? '2' : isHovered || isConnected ? '1.5' : '1'}
                  opacity={isDisproven ? 0.5 : 1}
                />

                {/* Sub-pixel Inner Top Highlight */}
                <line
                  x1={-halfW + 2}
                  y1={-halfH + 1}
                  x2={halfW - 2}
                  y2={-halfH + 1}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />

                {/* Left Category Accent Strip */}
                <line
                  x1={-halfW + 1.5}
                  y1={-halfH + 6}
                  x2={-halfW + 1.5}
                  y2={halfH - 6}
                  stroke={colors.stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Status Indicator Circle (Preserves Circle Element for Vitest Contract) */}
                <circle
                  className="topology-node"
                  cx={-halfW + 14}
                  cy={-halfH + 13}
                  r={5}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                />

                {/* Category Type Tag */}
                <text
                  x={-halfW + 24}
                  y={-halfH + 16}
                  fill={colors.badge}
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                  letterSpacing="0.04em"
                  pointerEvents="none"
                >
                  {node.category.toUpperCase()}
                </text>

                {/* Confidence Percentage Tag (Only for Hypotheses) */}
                {node.category === 'hypothesis' ? (
                  <text
                    x={halfW - 10}
                    y={-halfH + 16}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fontWeight="500"
                    pointerEvents="none"
                  >
                    {node.confidence}%
                  </text>
                ) : node.category === 'decision' ? (
                  <text
                    x={halfW - 10}
                    y={-halfH + 16}
                    textAnchor="end"
                    fill="var(--color-decision)"
                    fontSize="8.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="600"
                    pointerEvents="none"
                  >
                    COMMIT
                  </text>
                ) : null}

                {/* Content Statement Line 1 */}
                <text
                  x={-halfW + 14}
                  y={line2 ? -halfH + 31 : -halfH + 36}
                  textAnchor="start"
                  fill={isDisproven ? 'var(--text-muted)' : isHovered ? 'var(--text-primary)' : 'var(--text-primary)'}
                  fontSize="10.5"
                  fontFamily="var(--font-sans)"
                  fontWeight="500"
                  letterSpacing="-0.01em"
                  pointerEvents="none"
                >
                  {line1}
                </text>

                {/* Content Statement Line 2 (If wrapped) */}
                {line2 && (
                  <text
                    x={-halfW + 14}
                    y={-halfH + 43}
                    textAnchor="start"
                    fill={isDisproven ? 'var(--text-muted)' : 'var(--text-secondary)'}
                    fontSize="10"
                    fontFamily="var(--font-sans)"
                    letterSpacing="-0.01em"
                    pointerEvents="none"
                  >
                    {line2}
                  </text>
                )}

                {/* Disproven Strikethrough Line */}
                {isDisproven && (
                  <line
                    x1={-halfW + 12}
                    y1={line2 ? -halfH + 36 : -halfH + 33}
                    x2={halfW - 12}
                    y2={line2 ? -halfH + 36 : -halfH + 33}
                    stroke="rgba(232, 84, 84, 0.75)"
                    strokeWidth="1.2"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* 3. Interactive Glass Tooltip Popover on Hover */}
      {hoveredNode && !selectedNode && hoveredNode.x != null && hoveredNode.y != null && (
        <div
          className="topology-tooltip"
          style={{
            left: Math.min(dimensions.width - 280, Math.max(10, hoveredNode.x + 15)),
            top: Math.min(dimensions.height - 150, Math.max(10, hoveredNode.y - 45)),
          }}
        >
          <div className="topology-tooltip-header">
            <span
              className="topology-tooltip-badge"
              style={{
                background: getNodeColors(hoveredNode.category, hoveredNode.status).fill,
                color: getNodeColors(hoveredNode.category, hoveredNode.status).badge,
                borderColor: getNodeColors(hoveredNode.category, hoveredNode.status).stroke,
              }}
            >
              {hoveredNode.category.toUpperCase()}
            </span>
            <span className="topology-tooltip-confidence">
              {hoveredNode.confidence}% CONF
            </span>
            {hoveredNode.status && hoveredNode.status !== 'active' && (
              <span className={`topology-tooltip-status status-${hoveredNode.status}`}>
                {hoveredNode.status.toUpperCase()}
              </span>
            )}
          </div>
          <p className="topology-tooltip-content">{hoveredNode.fullContent || hoveredNode.content}</p>
          <div className="topology-tooltip-meta">
            <span>By {hoveredNode.speakerName}</span>
            <span>•</span>
            <span>{formatTime(hoveredNode.timestamp)}</span>
          </div>
        </div>
      )}

      {/* 4. Selected Node Full-Text Inspector Popover */}
      {selectedNode && (
        <div className="topology-inspector" role="dialog" aria-label="Incident Node Details">
          <div className="topology-inspector__header">
            <span
              className="topology-tooltip-badge"
              style={{
                background: getNodeColors(selectedNode.category, selectedNode.status).fill,
                color: getNodeColors(selectedNode.category, selectedNode.status).badge,
                borderColor: getNodeColors(selectedNode.category, selectedNode.status).stroke,
              }}
            >
              {selectedNode.category.toUpperCase()}
            </span>
            <span className="topology-tooltip-confidence">
              {selectedNode.confidence}% CONF
            </span>
            {selectedNode.status && selectedNode.status !== 'active' && (
              <span className={`topology-tooltip-status status-${selectedNode.status}`}>
                {selectedNode.status.toUpperCase()}
              </span>
            )}
            <button
              type="button"
              className="topology-inspector__close"
              onClick={() => setSelectedNodeId(null)}
              aria-label="Close inspector"
            >
              ✕
            </button>
          </div>
          <p className="topology-inspector__content">
            {selectedNode.fullContent || selectedNode.content}
          </p>
          <div className="topology-inspector__meta">
            <span>By {selectedNode.speakerName}</span>
            <span>•</span>
            <span>{formatTime(selectedNode.timestamp)}</span>
          </div>
          {(selectedNeighbors.sources.length > 0 || selectedNeighbors.targets.length > 0) && (
            <div className="topology-inspector__relations">
              {selectedNeighbors.sources.length > 0 && (
                <div className="topology-inspector__rel-item">
                  <span style={{ color: 'var(--text-muted)' }}>Preceded by:</span>
                  <span>{selectedNeighbors.sources.map((s) => s.category.toUpperCase()).join(', ')}</span>
                </div>
              )}
              {selectedNeighbors.targets.length > 0 && (
                <div className="topology-inspector__rel-item">
                  <span style={{ color: 'var(--text-muted)' }}>Leads to:</span>
                  <span>{selectedNeighbors.targets.map((t) => t.category.toUpperCase()).join(', ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
