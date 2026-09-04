import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConflictBanner } from '@/components/ConflictBanner';

describe('ConflictBanner Component (components/ConflictBanner.tsx)', () => {
  it('renders active dual-hypothesis conflict with speaker attribution and deciding metric', () => {
    render(
      <ConflictBanner
        isActive={true}
        hypothesisA="Postgres connection pool exhaustion"
        speakerAName="Marcus"
        hypothesisB="Payment gateway rate limiting"
        speakerBName="Sarah"
        decidingMetric="Database active connection count vs HTTP 429 response codes"
      />
    );

    expect(screen.getByText('ACTIVE CONFLICT')).toBeInTheDocument();
    expect(screen.getByText('Marcus')).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText(/Postgres connection pool exhaustion/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment gateway rate limiting/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Database active connection count vs HTTP 429 response codes'
      )
    ).toBeInTheDocument();
  });

  it('renders inactive state when isActive is false', () => {
    const { container } = render(
      <ConflictBanner
        isActive={false}
        hypothesisA="H1"
        speakerAName="Marcus"
        hypothesisB="H2"
        speakerBName="Sarah"
        decidingMetric="Metric"
      />
    );

    const banner = container.querySelector('.conflict-banner--inactive');
    expect(banner).toBeInTheDocument();
  });
});
