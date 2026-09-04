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
      fill: 'rgba(232, 84, 84, 0.08)',
      stroke: 'rgba(232, 84, 84, 0.4)',
      text: 'var(--color-conflict)',
      badge: 'var(--color-conflict)',
      glow: 'rgba(232, 84, 84, 0.2)',
    };
  }

  switch (category) {
    case 'fact':
      return {
        fill: 'rgba(59, 212, 162, 0.12)',
        stroke: 'var(--color-fact)',
        text: 'var(--color-fact)',
        badge: 'var(--color-fact)',
        glow: 'rgba(59, 212, 162, 0.35)',
      };
    case 'hypothesis':
      return {
        fill: 'rgba(232, 168, 56, 0.12)',
        stroke: 'var(--color-hypothesis)',
        text: 'var(--color-hypothesis)',
        badge: 'var(--color-hypothesis)',
        glow: 'rgba(232, 168, 56, 0.35)',
      };
    case 'decision':
      return {
        fill: 'rgba(123, 140, 255, 0.12)',
        stroke: 'var(--color-decision)',
        text: 'var(--color-decision)',
        badge: 'var(--color-decision)',
        glow: 'rgba(123, 140, 255, 0.35)',
      };
    case 'action':
      return {
        fill: 'rgba(232, 125, 62, 0.12)',
        stroke: 'var(--color-action)',
        text: 'var(--color-action)',
        badge: 'var(--color-action)',
        glow: 'rgba(232, 125, 62, 0.35)',
      };
    case 'conflict':
      return {
        fill: 'rgba(232, 84, 84, 0.12)',
        stroke: 'var(--color-conflict)',
        text: 'var(--color-conflict)',
        badge: 'var(--color-conflict)',
        glow: 'rgba(232, 84, 84, 0.45)',
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

function getNodeRadius(confidence: number, status?: string): number {
  const base = Math.max(12, Math.min(22, (confidence / 85) * 22));
  return status === 'disproven' ? base * 0.75 : base;
}

export function IncidentTopology({
  nodes,
  edges,
  onNodeHover,
  onNodeClick,
}: IncidentTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
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

      // Position near center with small jitter
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 40;
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
        .force('charge', forceManyBody<SimulationNode>().strength(-260))
        .force(
          'link',
          forceLink<SimulationNode, SimulationLink>(newSimLinks)
            .id((d) => d.id)
            .distance(130)
            .strength(0.4)
        )
        .force('center', forceCenter<SimulationNode>(width / 2, height / 2))
        .force(
          'collision',
          forceCollide<SimulationNode>().radius((d) => Math.max(50, getNodeRadius(d.confidence, d.status) + 30))
        )
        .force('x', forceX<SimulationNode>(width / 2).strength(0.06))
        .force('y', forceY<SimulationNode>(height / 2).strength(0.08))
        .alphaDecay(0.025);

      let rafId: number;
      sim.on('tick', () => {
        // Enforce safe boundary clamping
        for (const node of sim.nodes()) {
          const r = getNodeRadius(node.confidence, node.status);
          const padX = Math.max(80, r + 45);
          const padY = Math.max(50, r + 40);
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
        linkForce.links(newSimLinks).distance(130);
      }

      const chargeForce = sim.force('charge') as ReturnType<
        typeof forceManyBody<SimulationNode>
      >;
      if (chargeForce) {
        chargeForce.strength(-260);
      }

      const collideForce = sim.force('collision') as ReturnType<
        typeof forceCollide<SimulationNode>
      >;
      if (collideForce) {
        collideForce.radius((d) => Math.max(50, getNodeRadius(d.confidence, d.status) + 30));
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
          <marker
            id="topo-arrowhead"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(255, 255, 255, 0.25)" />
          </marker>
          <marker
            id="topo-arrowhead-conflict"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(232, 84, 84, 0.7)" />
          </marker>
        </defs>

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

        {/* 2. Precision Causal Nodes */}
        <g className="topology-nodes">
          {simNodes.map((node) => {
            if (node.x == null || node.y == null) return null;
            const radius = getNodeRadius(node.confidence, node.status);
            const colors = getNodeColors(node.category, node.status);
            const isDisproven = node.status === 'disproven';
            const isHovered = node.id === hoveredNodeId;

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
                {/* Node Outer Halo Glow */}
                <circle
                  r={radius + (isHovered ? 7 : 4)}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeDasharray={isHovered ? '3 3' : undefined}
                  opacity={isHovered ? 0.85 : 0.25}
                />

                {/* Main Circular Surface */}
                <circle
                  className="topology-node"
                  r={radius}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isDisproven ? 0.4 : 1}
                />

                {/* Inner Epistemic Category Glyph */}
                <text
                  textAnchor="middle"
                  dy="3.5"
                  fill={colors.badge}
                  fontSize={Math.max(9, Math.round(radius * 0.6))}
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {isDisproven ? '✕' : node.category[0].toUpperCase()}
                </text>

                {/* Node Label Capsule */}
                <g transform={`translate(0, ${radius + 14})`} pointerEvents="none">
                  <rect
                    x={-(Math.min(node.content.length, 20) * 3.2 + 8)}
                    y="-8"
                    width={(Math.min(node.content.length, 20) * 6.4 + 16)}
                    height="16"
                    rx="4"
                    fill="rgba(8, 9, 12, 0.85)"
                    stroke={isHovered ? colors.stroke : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth={isHovered ? '1' : '0.5'}
                  />
                  <text
                    className={`topology-label ${isDisproven ? 'topology-label--disproven' : ''}`}
                    y="3"
                    textAnchor="middle"
                    fill={isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    fontSize="10"
                    fontFamily="var(--font-sans)"
                    letterSpacing="-0.01em"
                  >
                    {node.content.length > 20
                      ? `${node.content.substring(0, 18)}…`
                      : node.content}
                  </text>
                </g>
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
            left: Math.min(dimensions.width - 250, Math.max(10, hoveredNode.x + 15)),
            top: Math.min(dimensions.height - 140, Math.max(10, hoveredNode.y - 40)),
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
