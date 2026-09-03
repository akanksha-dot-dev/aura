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
      fill: 'var(--color-conflict-dim)',
      stroke: 'var(--color-conflict)',
      text: 'var(--color-conflict)',
      badge: 'var(--color-conflict)',
    };
  }

  switch (category) {
    case 'fact':
      return {
        fill: 'var(--color-fact-dim)',
        stroke: 'var(--color-fact)',
        text: 'var(--color-fact)',
        badge: 'var(--color-fact)',
      };
    case 'hypothesis':
      return {
        fill: 'var(--color-hypothesis-dim)',
        stroke: 'var(--color-hypothesis)',
        text: 'var(--color-hypothesis)',
        badge: 'var(--color-hypothesis)',
      };
    case 'decision':
      return {
        fill: 'var(--color-decision-dim)',
        stroke: 'var(--color-decision)',
        text: 'var(--color-decision)',
        badge: 'var(--color-decision)',
      };
    case 'action':
      return {
        fill: 'var(--color-action-dim)',
        stroke: 'var(--color-action)',
        text: 'var(--color-action)',
        badge: 'var(--color-action)',
      };
    case 'conflict':
      return {
        fill: 'var(--color-conflict-dim)',
        stroke: 'var(--color-conflict)',
        text: 'var(--color-conflict)',
        badge: 'var(--color-conflict)',
      };
    default:
      return {
        fill: 'var(--bg-surface-raised)',
        stroke: 'var(--text-secondary)',
        text: 'var(--text-secondary)',
        badge: 'var(--text-secondary)',
      };
  }
}

function getNodeRadius(confidence: number, status?: string): number {
  const base = Math.max(8, Math.min(24, (confidence / 85) * 24));
  return status === 'disproven' ? base * 0.6 : base;
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

  // Simulation state for React rendering (satisfies React 19 ref access rules)
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

    // Build new sim nodes, preserving positions of existing simulation nodes if available
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

      // New node: position near center with small jitter
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
        .force('charge', forceManyBody<SimulationNode>().strength(-380))
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
          forceCollide<SimulationNode>().radius((d) => Math.max(56, getNodeRadius(d.confidence, d.status) + 36))
        )
        .force('x', forceX<SimulationNode>(width / 2).strength(0.04))
        .force('y', forceY<SimulationNode>(height / 2).strength(0.04))
        .alphaDecay(0.025);

      let rafId: number;
      sim.on('tick', () => {
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
        chargeForce.strength(-380);
      }

      const collideForce = sim.force('collision') as ReturnType<
        typeof forceCollide<SimulationNode>
      >;
      if (collideForce) {
        collideForce.radius((d) => Math.max(56, getNodeRadius(d.confidence, d.status) + 36));
      }

      const centerForce = sim.force('center') as ReturnType<typeof forceCenter<SimulationNode>>;
      if (centerForce) {
        centerForce.x(width / 2).y(height / 2);
      }

      const xForce = sim.force('x') as ReturnType<typeof forceX<SimulationNode>>;
      if (xForce) xForce.x(width / 2);

      const yForce = sim.force('y') as ReturnType<typeof forceY<SimulationNode>>;
      if (yForce) yForce.y(height / 2);

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
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.2)" />
          </marker>
          <marker
            id="topo-arrowhead-conflict"
            viewBox="0 0 10 10"
            refX="22"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(232, 84, 84, 0.6)" />
          </marker>
        </defs>

        {/* 1. Render Edges */}
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

            return (
              <line
                key={`edge-${idx}-${sourceNode.id}-${targetNode.id}`}
                className={edgeClass}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
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

        {/* 2. Render Nodes */}
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
                {/* Node Outer Halo for Hover */}
                {isHovered && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  className="topology-node"
                  r={radius}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isDisproven ? 0.35 : 1}
                />

                {/* Inner Epistemic Category Glyph */}
                <text
                  textAnchor="middle"
                  dy="3.5"
                  fill={colors.badge}
                  fontSize={Math.max(9, Math.round(radius * 0.58))}
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {isDisproven ? '✕' : node.category[0].toUpperCase()}
                </text>

                {/* Node Label with Glass Capsule Backdrop */}
                <g transform={`translate(0, ${radius + 15})`} pointerEvents="none">
                  <rect
                    x={-(Math.min(node.content.length, 22) * 3.2 + 8)}
                    y="-9"
                    width={(Math.min(node.content.length, 22) * 6.4 + 16)}
                    height="17"
                    rx="6"
                    fill="var(--bg-glass-panel)"
                    stroke={isHovered ? colors.stroke : "var(--border-glass)"}
                    strokeWidth={isHovered ? "1" : "0.5"}
                  />
                  <text
                    className={`topology-label ${isDisproven ? 'topology-label--disproven' : ''}`}
                    y="3"
                    textAnchor="middle"
                    fill={isHovered ? "var(--text-primary)" : "var(--text-secondary)"}
                    fontSize="10"
                    fontFamily="var(--font-sans)"
                  >
                    {node.content.length > 22
                      ? `${node.content.substring(0, 20)}…`
                      : node.content}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* 3. Tooltip on Hover */}
      {hoveredNode && hoveredNode.x != null && hoveredNode.y != null && (
        <div
          className="topology-tooltip"
          style={{
            left: Math.min(dimensions.width - 240, Math.max(10, hoveredNode.x + 15)),
            top: Math.min(dimensions.height - 130, Math.max(10, hoveredNode.y - 40)),
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
