'use client';

import React from 'react';

export interface SimulationBannerProps {
  isMockReplay: boolean;
}

export function SimulationBanner({ isMockReplay }: SimulationBannerProps) {
  if (!isMockReplay) return null;

  return (
    <div className="simulation-replay-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px' }}>⚠</span>
        <span>
          <strong>SCRIPTED SIMULATION REPLAY MODE:</strong> Microphone input paused for automated script demo.
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          const params = new URLSearchParams(window.location.search);
          params.delete('__AURA_REPLAY_MOCK_STREAM');
          params.delete('speed');
          window.location.href = `/?${params.toString()}`;
        }}
        className="simulation-switch-btn"
      >
        🎙 SWITCH TO REAL-TIME VOICE BRIDGE →
      </button>
    </div>
  );
}
