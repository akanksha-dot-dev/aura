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
        fill: 'rgba(232, 168, 56, 0.1)',
        stroke: 'var(--color-hypothesis)',
        text: 'var(--color-hypothesis)',
        badge: 'var(--color-hypothesis)',
        glow: 'rgba(232, 168, 56, 0.3)',
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

  // 2. Initialize or update force simulation
  useEffect(() => {
    const { width, height } = dimensions;

    const existingSimNodes = simulationRef.current?.nodes() || [];
    const existingMap = new Map<string, SimulationNode>(
      existingSimNodes.map((n) => [n.id, n])
    );

    const newSimNodes: SimulationNode[] = nodes.map((node) => {
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

      // Position near center with gentle radial distribution
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
      };
    });

    const newSimLinks: SimulationLink[] = edges.map((e) => ({
      source: typeof e.source === 'object' ? (e.source as TopologyNode).id : e.source,
      target: typeof e.target === 'object' ? (e.target as TopologyNode).id : e.target,
      type: e.type,
    }));

    if (!simulationRef.current) {
      const sim = forceSimulation<SimulationNode>(newSimNodes)
        .force('charge', forceManyBody<SimulationNode>().strength(-320))
        .force(
          'link',
          forceLink<SimulationNode, SimulationLink>(newSimLinks)
            .id((d) => d.id)
            .distance(150)
            .strength(0.35)
        )
        .force('center', forceCenter<SimulationNode>(width / 2, height / 2))
        .force(
          'collision',
          forceCollide<SimulationNode>().radius(80)
        )
        .force('x', forceX<SimulationNode>(width / 2).strength(0.06))
        .force('y', forceY<SimulationNode>(height / 2).strength(0.08))
        .alphaDecay(0.025);

      let rafId: number;
      sim.on('tick', () => {
        // Enforce safe boundary clamping
        for (const node of sim.nodes()) {
          const padX = 110;
          const padY = 50;
          if (typeof node.x === 'number') {
            node.x = Math.max(padX, Math.min(width - padX, node.x));
          }
          if (typeof node.y === 'number') {
            node.y = Math.max(padY, Math.min(height - padY, node.y));
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
        linkForce.links(newSimLinks).distance(150);
      }

      const chargeForce = sim.force('charge') as ReturnType<
        typeof forceManyBody<SimulationNode>
      >;
      if (chargeForce) {
        chargeForce.strength(-320);
      }

      const collideForce = sim.force('collision') as ReturnType<
        typeof forceCollide<SimulationNode>
      >;
      if (collideForce) {
        collideForce.radius(80);
      }

      const centerForce = sim.force('center') as ReturnType<typeof forceCenter<SimulationNode>>;
      if (centerForce) {
        centerForce.x(width / 2).y(height / 2);
      }

      const xForce = sim.force('x') as ReturnType<typeof forceX<SimulationNode>>;
      if (xForce) {
        xForce.x(width / 2).strength(0.06);
      }

      const yForce = sim.force('y') as ReturnType<typeof forceY<SimulationNode>>;
      if (yForce) {
        yForce.y(height / 2).strength(0.08);
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

  const hoveredNode = useMemo(() => {
    if (!hoveredNodeId) return null;
    return simNodes.find((n) => n.id === hoveredNodeId) || null;
  }, [hoveredNodeId, simNodes]);

  const nodeMap = useMemo(() => {
    return new Map<string, SimulationNode>(simNodes.map((n) => [n.id, n]));
  }, [simNodes]);

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
          background: rgba(14, 16, 21, 0.88);
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
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: -0.01em;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .topology-legend__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 6px currentColor;
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
          stroke: rgba(255, 255, 255, 0.12);
          stroke-width: 1.5;
        }

        .topology-edge--causal {
          stroke: rgba(123, 140, 255, 0.35);
          stroke-dasharray: 4 4;
          animation: signalFlow 1.2s linear infinite;
        }

        .topology-edge--conflict {
          stroke: rgba(232, 84, 84, 0.55);
          stroke-width: 2;
          stroke-dasharray: 5 3;
        }

        .topology-edge--contradicts {
          stroke: rgba(232, 84, 84, 0.65);
          stroke-width: 2;
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
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(123, 140, 255, 0.5)" />
          </marker>
          <marker
            id="topo-arrowhead-conflict"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(232, 84, 84, 0.75)" />
          </marker>
        </defs>

        {/* Subtle Precision Dot-Grid Canvas Background */}
        <rect width="100%" height="100%" fill="url(#topo-dot-grid)" />

        {/* 1. Curved Dynamic Bezier Edges */}
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
            const edgeClass = isConflict
              ? 'topology-edge topology-edge--conflict'
              : isContradicts
              ? 'topology-edge topology-edge--contradicts'
              : 'topology-edge topology-edge--causal';

            // Quadratic Bezier curve control point calculation
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const cx = (sourceNode.x + targetNode.x) / 2 - dy * 0.08;
            const cy = (sourceNode.y + targetNode.y) / 2 + dx * 0.08;
            const pathData = `M ${sourceNode.x} ${sourceNode.y} Q ${cx} ${cy} ${targetNode.x} ${targetNode.y}`;

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
                    : 'url(#topo-arrowhead)'
                }
              />
            );
          })}
        </g>

        {/* 2. Precision Pill Capsules for Causal Nodes */}
        <g className="topology-nodes">
          {simNodes.map((node) => {
            if (node.x == null || node.y == null) return null;
            const colors = getNodeColors(node.category, node.status);
            const isDisproven = node.status === 'disproven';
            const isHovered = node.id === hoveredNodeId;

            // Calculate responsive pill capsule width
            const labelLength = node.content.length;
            const pillWidth = Math.max(140, Math.min(240, labelLength * 6.5 + 54));
            const pillHeight = 32;
            const circleX = -pillWidth / 2 + 16;

            return (
              <g
                key={node.id}
                className={`topology-node-group ${isDisproven ? 'topology-node--disproven' : ''}`}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => handleMouseEnter(node.id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onNodeClick?.(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pill Capsule Outer Glow on Hover */}
                {isHovered && (
                  <rect
                    x={-pillWidth / 2 - 3}
                    y={-pillHeight / 2 - 3}
                    width={pillWidth + 6}
                    height={pillHeight + 6}
                    rx="18"
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.75"
                  />
                )}

                {/* Pill Capsule Main Rounded Background */}
                <rect
                  x={-pillWidth / 2}
                  y={-pillHeight / 2}
                  width={pillWidth}
                  height={pillHeight}
                  rx="16"
                  fill="var(--bg-surface-raised)"
                  stroke={isHovered ? colors.stroke : 'var(--border-subtle)'}
                  strokeWidth={isHovered ? '1.5' : '1'}
                  opacity={isDisproven ? 0.45 : 1}
                />

                {/* Epistemic Indicator Circle (Preserves Circle Element for Vitest Contract) */}
                <circle
                  className="topology-node"
                  cx={circleX}
                  cy={0}
                  r={10}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2 : 1.25}
                />

                {/* Epistemic Glyph */}
                <text
                  x={circleX}
                  y={3.5}
                  textAnchor="middle"
                  fill={colors.badge}
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {isDisproven ? '✕' : node.category[0].toUpperCase()}
                </text>

                {/* Full Legible Content Text inside Capsule */}
                <text
                  x={circleX + 16}
                  y={3.5}
                  textAnchor="start"
                  fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  fontSize="11"
                  fontFamily="var(--font-sans)"
                  fontWeight="500"
                  letterSpacing="-0.01em"
                  pointerEvents="none"
                >
                  {node.content.length > 26 ? `${node.content.substring(0, 24)}…` : node.content}
                </text>

                {/* Confidence Percentage Tag */}
                <text
                  x={pillWidth / 2 - 10}
                  y={3.5}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fontWeight="500"
                  pointerEvents="none"
                >
                  {node.confidence}%
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* 3. Interactive Glass Tooltip Popover on Hover */}
      {hoveredNode && hoveredNode.x != null && hoveredNode.y != null && (
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
    </div>
  );
}

