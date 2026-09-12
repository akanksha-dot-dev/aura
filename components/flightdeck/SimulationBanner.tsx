'use client';

import React from 'react';

export interface SimulationBannerProps {
  isMockReplay: boolean;
  speedMultiplier?: number;
}

export function SimulationBanner({ isMockReplay, speedMultiplier = 1 }: SimulationBannerProps) {
  if (!isMockReplay) return null;

  const handleSpeedChange = (nextSpeed: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('speed', nextSpeed.toString());
    window.location.search = params.toString();
  };

  const handleRestart = () => {
    window.location.reload();
  };

  const handleSwitchToLive = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('__AURA_REPLAY_MOCK_STREAM');
    params.delete('speed');
    window.location.href = `/?${params.toString()}`;
  };

  return (
    <>
      <style>{`
        .simulation-replay-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 32px;
          background: var(--bg-surface);
          border-bottom: 1px solid rgba(212, 168, 83, 0.35);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 1000;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .simulation-banner__left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .simulation-banner__badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.4);
          color: var(--color-aura);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .simulation-banner__ping {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-aura);
          animation: banner-ping 1.5s ease-in-out infinite;
        }

        @keyframes banner-ping {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .simulation-banner__text {
          color: var(--text-secondary);
        }

        .simulation-banner__right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .simulation-banner__speed-group {
          display: flex;
          align-items: center;
          gap: 2px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          padding: 1px;
        }

        .simulation-banner__speed-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .simulation-banner__speed-btn:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.06);
        }

        .simulation-banner__speed-btn--active {
          background: var(--color-aura);
          color: #0C0B0F;
        }

        .simulation-banner__action-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .simulation-banner__action-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-default);
          background: rgba(255, 255, 255, 0.04);
        }

        .simulation-banner__switch-btn {
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.35);
          color: var(--color-aura);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .simulation-banner__switch-btn:hover {
          background: var(--color-aura);
          color: #0C0B0F;
        }
      `}</style>

      <aside className="simulation-replay-banner" aria-label="Scripted Replay Telemetry Banner">
        <div className="simulation-banner__left">
          <span className="simulation-banner__badge">
            <span className="simulation-banner__ping" aria-hidden="true" />
            SCRIPTED SIMULATION REPLAY
          </span>
          <span className="simulation-banner__text">
            Automated multi-speaker audio and telemetry stream active.
          </span>
        </div>

        <div className="simulation-banner__right">
          <div className="simulation-banner__speed-group" role="group" aria-label="Simulation Speed">
            {[1, 1.5, 2].map((s) => (
              <button
                key={s}
                type="button"
                className={`simulation-banner__speed-btn ${
                  Math.abs(speedMultiplier - s) < 0.05 ? 'simulation-banner__speed-btn--active' : ''
                }`}
                onClick={() => handleSpeedChange(s)}
                title={`Run replay at ${s}x speed`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            type="button"
            className="simulation-banner__action-btn"
            onClick={handleRestart}
            title="Restart simulation script from T=0"
          >
            ↺ Restart
          </button>

          <button
            type="button"
            className="simulation-banner__switch-btn"
            onClick={handleSwitchToLive}
          >
            🎙 Switch to Live Bridge →
          </button>
        </div>
      </aside>
    </>
  );
}
