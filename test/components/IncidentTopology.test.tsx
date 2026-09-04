import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { IncidentTopology } from '@/components/IncidentTopology';
import { TopologyNode, TopologyEdge } from '@/lib/types';

describe('IncidentTopology Component (components/IncidentTopology.tsx)', () => {
  const mockNodes: TopologyNode[] = [
    {
      id: 'evt-1',
      category: 'fact',
      content: 'Checkout error rate at 42%',
      fullContent: 'Checkout error rate spiked to 42% on payment services',
      speakerUid: 'marcus_devops',
      speakerName: 'Marcus Vance',
      confidence: 85,
      timestamp: Date.now() - 60_000,
      status: 'confirmed',
      x: 100,
      y: 100,
    },
    {
      id: 'evt-2',
      category: 'hypothesis',
      content: 'Postgres connection pool exhaustion',
      fullContent: 'Postgres connection pool exhaustion causing thread starvation',
      speakerUid: 'marcus_devops',
      speakerName: 'Marcus Vance',
      confidence: 75,
      timestamp: Date.now() - 40_000,
      status: 'active',
      x: 250,
      y: 180,
    },
    {
      id: 'evt-3',
      category: 'decision',
      content: 'Rollback canary v2.14',
      fullContent: 'Rollback canary v2.14 to restore connection pool',
      speakerUid: 'sarah_oncall',
      speakerName: 'Sarah Chen',
      confidence: 85,
      timestamp: Date.now() - 20_000,
      status: 'confirmed',
      x: 400,
      y: 250,
    },
  ];

  const mockEdges: TopologyEdge[] = [
    {
      source: 'evt-1',
      target: 'evt-2',
      type: 'causal',
    },
    {
      source: 'evt-2',
      target: 'evt-3',
      type: 'supports',
    },
  ];

  it('renders SVG canvas, nodes, links, and category legend chips', async () => {
    const onNodeHover = vi.fn();
    const onNodeClick = vi.fn();

    const { container } = render(
      <IncidentTopology
        nodes={mockNodes}
        edges={mockEdges}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    );

    // Verify SVG container
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    // Verify category legend chips
    expect(screen.getByText('Fact')).toBeInTheDocument();
    expect(screen.getByText('Hypothesis')).toBeInTheDocument();
    expect(screen.getByText('Decision')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Conflict')).toBeInTheDocument();

    // Verify node circles rendered in SVG after simulation tick
    await waitFor(() => {
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(3);
    });
  });
});
