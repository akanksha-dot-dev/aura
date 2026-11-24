'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { speakLine, stopSpeech } from '@/lib/tts';
import { playPitchStepEarcon, playConflictEarcon, playActionCompletedEarcon, playResolutionEarcon } from '@/lib/audioCues';
import { springs } from '@/lib/springs';

export interface PitchTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateOutage?: () => void;
  onFocusTopology?: () => void;
  onTriggerConflict?: () => void;
  onExecuteAction?: () => void;
  onOpenPostmortem?: () => void;
}

interface TourStep {
  stepNumber: number;
  badge: string;
  title: string;
  subtitle: string;
  highlightStat: string;
  description: string;
  whyJudgesCare: string;
  actionLabel: string;
  voiceScript: string;
  triggerType: 'outage' | 'topology' | 'conflict' | 'action' | 'postmortem';
}

const TOUR_STEPS: TourStep[] = [
  {
    stepNumber: 1,
    badge: 'STAGE 1: THE CRISIS',
    title: 'Outage Influx & Financial Burn Rate',
    subtitle: 'SEV-1 Payment Gateway Checkout Failure',
    highlightStat: '$150 / sec ($540,000 / hr)',
    description:
      'When an outage strikes, chaos reigns. Systems throw 504 gateway timeouts and customer revenue drops by the second. Responders need instant crisis orientation without 15 minutes of confusion.',
    whyJudgesCare:
      'Quantifies live enterprise financial impact in real-time, instantly establishing ROI for C-suite buyers.',
    actionLabel: '🚨 Ingest Crisis Telemetry',
    voiceScript:
      'Welcome to AURA 2.0. A SEV-1 payment gateway incident is active. Financial burn rate is 150 dollars per second. Telemetry shows customer checkout degradation.',
    triggerType: 'outage',
  },
  {
    stepNumber: 2,
    badge: 'STAGE 2: COGNITIVE CLARITY',
    title: 'Epistemic Causal Knowledge Graph',
    subtitle: 'Real-Time D3 Directed Evidence Mesh',
    highlightStat: '100% Causal Traceability',
    description:
      'Instead of messy Slack chats where critical clues get lost, AURA parses human voice and server logs into structured epistemic events: Facts, Hypotheses, Decisions, and Actions on a live D3 graph.',
    whyJudgesCare:
      'Eliminates the "fog of war." Judges see ideas connected dynamically as engineers speak, preventing repeated work.',
    actionLabel: '🔍 View Causal Topology',
    voiceScript:
      'AURA automatically synthesizes spoken engineer conversation and system logs into an epistemic knowledge graph, categorizing facts, hypotheses, and decisions in real time.',
    triggerType: 'topology',
  },
  {
    stepNumber: 3,
    badge: 'STAGE 3: ARBITRATION',
    title: 'Contradiction & Consensus Radar',
    subtitle: 'Zero Dead-Ends via Deciding Metrics',
    highlightStat: 'Sub-250ms Epistemic Arbitration',
    description:
      'Engineers frequently argue over conflicting theories: is it database connection pool exhaustion or external API rate limits? AURA flags the contradiction immediately and identifies the single deciding metric.',
    whyJudgesCare:
      'Slashes MTTR by stopping 45-minute engineer arguments dead in their tracks with data-backed arbitration.',
    actionLabel: '⚡ Trigger Conflict Arbitration',
    voiceScript:
      'Contradiction detected. Sarah posits API gateway rate limiting, while Marcus points to database connection pool exhaustion. AURA arbitrates the conflict by measuring P99 query latency against 429 response codes.',
    triggerType: 'conflict',
  },
  {
    stepNumber: 4,
    badge: 'STAGE 4: MITIGATION',
    title: 'Autonomous SRE Playbook Execution',
    subtitle: 'Harmonic Earcon Action Feedback',
    highlightStat: '3 Playbook Steps Automated',
    description:
      'AURA identifies the culprit: PR #492 introduced an unindexed query. A rollback action item is dispatched to the Action Tracker. As engineers complete steps, harmonic 540Hz earcons confirm execution.',
    whyJudgesCare:
      'Transforms passive monitoring into proactive incident resolution with instant audio-tactile feedback.',
    actionLabel: '🛡️ Execute Rollback Playbook',
    voiceScript:
      'Mitigation playbook engaged. Pull request 492 rollback initiated. Action item completed with harmonic audio confirmation.',
    triggerType: 'action',
  },
  {
    stepNumber: 5,
    badge: 'STAGE 5: BUSINESS VALUE',
    title: 'Executive Postmortem & Cost Savings',
    subtitle: 'Automated Multi-Audience Comms',
    highlightStat: '~$18,700 Downtime Saved',
    description:
      'The incident is resolved in 3 minutes instead of 45. AURA automatically calculates downtime dollars saved, generates Markdown/PDF postmortems, drafts executive advisories, and recaps the audit aloud.',
    whyJudgesCare:
      'Proves immediate enterprise bottom-line value with verifiable financial savings and zero manual report writing.',
    actionLabel: '🏆 Open Postmortem & Debrief',
    voiceScript:
      'Incident resolved. Mean time to recovery reduced by 78 percent. Over 18,000 dollars in downtime cost saved. Postmortem report compiled and ready for leadership review.',
    triggerType: 'postmortem',
  },
];

export function PitchTourModal({
  isOpen,
  onClose,
  onSimulateOutage,
  onFocusTopology,
  onTriggerConflict,
  onExecuteAction,
  onOpenPostmortem,
}: PitchTourModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const step = TOUR_STEPS[currentStepIndex];

  // Stop speech on close
  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
      setIsVoiceActive(false);
      setIsAutoPlaying(false);
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    }
  }, [isOpen]);

  // Handle step keyboard shortcuts (Left/Right arrow, Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentStepIndex < TOUR_STEPS.length - 1) {
        goToStep(currentStepIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        goToStep(currentStepIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  const goToStep = useCallback(
    (index: number) => {
      stopSpeech();
      setIsVoiceActive(false);
      playPitchStepEarcon();
      setCurrentStepIndex(index);
    },
    []
  );

  const handleExecuteTrigger = () => {
    playPitchStepEarcon();
    switch (step.triggerType) {
      case 'outage':
        onSimulateOutage?.();
        break;
      case 'topology':
        onFocusTopology?.();
        break;
      case 'conflict':
        playConflictEarcon();
        onTriggerConflict?.();
        break;
      case 'action':
        playActionCompletedEarcon();
        onExecuteAction?.();
        break;
      case 'postmortem':
        playResolutionEarcon();
        onOpenPostmortem?.();
        onClose();
        break;
    }
  };

  const handleSpeakStep = () => {
    if (isVoiceActive) {
      stopSpeech();
      setIsVoiceActive(false);
      return;
    }
    setIsVoiceActive(true);
    speakLine(step.voiceScript, true, 1.05, () => {
      setIsVoiceActive(false);
    });
  };

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      stopSpeech();
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    } else {
      setIsAutoPlaying(true);
      runAutoPlayStep(currentStepIndex);
    }
  };

  const runAutoPlayStep = (index: number) => {
    if (index >= TOUR_STEPS.length) {
      setIsAutoPlaying(false);
      return;
    }
    setCurrentStepIndex(index);
    playPitchStepEarcon();
    const current = TOUR_STEPS[index];
    speakLine(current.voiceScript, true, 1.1, () => {
      autoPlayTimerRef.current = setTimeout(() => {
        if (index + 1 < TOUR_STEPS.length) {
          runAutoPlayStep(index + 1);
        } else {
          setIsAutoPlaying(false);
        }
      }, 1500);
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="pitch-modal-backdrop" onClick={onClose}>
        <motion.div
          className="pitch-modal-container"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={springs.card}
          role="dialog"
          aria-label="AURA 2.0 Buildathon Pitch Tour"
        >
          {/* Header */}
          <div className="pitch-modal-header">
            <div className="pitch-header-left">
              <span className="pitch-sparkle">✨</span>
              <div>
                <h2 className="pitch-modal-title">AURA 2.0 • 60-Second Buildathon Pitch Tour</h2>
                <span className="pitch-modal-subtitle">Autonomous Incident Commander • Powered by Google Gemini & Firebase</span>
              </div>
            </div>

            <div className="pitch-header-right">
              <button
                type="button"
                className={`pitch-autoplay-btn ${isAutoPlaying ? 'pitch-autoplay-btn--active' : ''}`}
                onClick={toggleAutoPlay}
                title="Automatically advance through all 5 demo steps with voice narration"
              >
                <span>{isAutoPlaying ? '⏸ Pause Auto-Pitch' : '▶ Auto-Play Pitch'}</span>
              </button>

              <button
                type="button"
                className="pitch-close-btn"
                onClick={onClose}
                aria-label="Close walkthrough"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Stepper Strip */}
          <div className="pitch-stepper">
            {TOUR_STEPS.map((s, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <button
                  key={s.stepNumber}
                  type="button"
                  className={`pitch-step-pill ${isActive ? 'pitch-step-pill--active' : ''} ${
                    isPast ? 'pitch-step-pill--completed' : ''
                  }`}
                  onClick={() => goToStep(idx)}
                >
                  <span className="pitch-step-num">{isPast ? '✓' : s.stepNumber}</span>
                  <span className="pitch-step-label">{s.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Card */}
          <div className="pitch-content-body">
            <div className="pitch-step-meta">
              <span className="pitch-stage-badge">{step.badge}</span>
              <span className="pitch-stat-badge">⚡ {step.highlightStat}</span>
            </div>

            <h3 className="pitch-step-heading">{step.title}</h3>
            <h4 className="pitch-step-subheading">{step.subtitle}</h4>

            <p className="pitch-step-prose">{step.description}</p>

            <div className="pitch-judge-callout">
              <strong style={{ color: '#D4A853' }}>💡 Why Judges & SREs Love This:</strong>
              <span>{step.whyJudgesCare}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pitch-modal-footer">
            <div className="pitch-footer-left">
              <button
                type="button"
                className={`pitch-voice-btn ${isVoiceActive ? 'pitch-voice-btn--speaking' : ''}`}
                onClick={handleSpeakStep}
                title="Listen to AURA explain this capability"
              >
                <span>{isVoiceActive ? '⏹ Stop Voice' : '🔊 Listen to AURA'}</span>
              </button>
              <span className="pitch-step-indicator">
                Step {currentStepIndex + 1} of {TOUR_STEPS.length}
              </span>
            </div>

            <div className="pitch-footer-right">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  className="pitch-nav-btn"
                  onClick={() => goToStep(currentStepIndex - 1)}
                >
                  ← Back
                </button>
              )}

              <button
                type="button"
                className="pitch-action-trigger"
                onClick={handleExecuteTrigger}
                title="Execute the live incident action for this step"
              >
                <span>{step.actionLabel}</span>
              </button>

              {currentStepIndex < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  className="pitch-nav-btn pitch-nav-btn--next"
                  onClick={() => goToStep(currentStepIndex + 1)}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  className="pitch-nav-btn pitch-nav-btn--done"
                  onClick={onClose}
                >
                  Complete Tour ✓
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        .pitch-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .pitch-modal-container {
          background: #0f141c;
          border: 1px solid rgba(212, 168, 83, 0.35);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(212, 168, 83, 0.12);
          border-radius: 12px;
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: var(--font-sans);
          color: #f1f5f9;
        }

        .pitch-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pitch-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pitch-sparkle {
          font-size: 20px;
          color: #d4a853;
          animation: pitch-glow 2s infinite alternate;
        }

        @keyframes pitch-glow {
          0% { transform: scale(0.95); opacity: 0.8; }
          100% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 8px #d4a853); }
        }

        .pitch-modal-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #f8fafc;
        }

        .pitch-modal-subtitle {
          font-size: 10.5px;
          color: #94a3b8;
          font-family: var(--font-mono);
          display: block;
        }

        .pitch-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pitch-autoplay-btn {
          background: rgba(212, 168, 83, 0.12);
          border: 1px solid rgba(212, 168, 83, 0.4);
          color: #d4a853;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-mono);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pitch-autoplay-btn:hover {
          background: rgba(212, 168, 83, 0.22);
          border-color: #d4a853;
        }

        .pitch-autoplay-btn--active {
          background: #d4a853;
          color: #0f141c;
          box-shadow: 0 0 12px rgba(212, 168, 83, 0.4);
        }

        .pitch-close-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .pitch-close-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.06);
        }

        .pitch-stepper {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          overflow-x: auto;
        }

        .pitch-step-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          font-size: 11px;
          font-family: var(--font-mono);
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .pitch-step-pill:hover {
          border-color: rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
        }

        .pitch-step-pill--active {
          background: rgba(212, 168, 83, 0.15);
          border-color: #d4a853;
          color: #d4a853;
          font-weight: 700;
          box-shadow: 0 0 8px rgba(212, 168, 83, 0.2);
        }

        .pitch-step-pill--completed {
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.3);
        }

        .pitch-step-num {
          font-size: 10px;
          font-weight: 700;
        }

        .pitch-content-body {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 220px;
        }

        .pitch-step-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .pitch-stage-badge {
          font-size: 10px;
          font-family: var(--font-mono);
          font-weight: 700;
          color: #d4a853;
          letter-spacing: 0.06em;
        }

        .pitch-stat-badge {
          font-size: 11px;
          font-family: var(--font-mono);
          font-weight: 700;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.1);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .pitch-step-heading {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.015em;
        }

        .pitch-step-subheading {
          margin: 0 0 6px 0;
          font-size: 12px;
          font-weight: 500;
          color: #94a3b8;
          font-family: var(--font-mono);
        }

        .pitch-step-prose {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.55;
          color: #cbd5e1;
        }

        .pitch-judge-callout {
          margin-top: 10px;
          padding: 10px 14px;
          background: rgba(212, 168, 83, 0.08);
          border-left: 3px solid #d4a853;
          border-radius: 0 6px 6px 0;
          font-size: 12px;
          color: #e2e8f0;
          line-height: 1.45;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .pitch-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          gap: 12px;
        }

        .pitch-footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pitch-voice-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pitch-voice-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .pitch-voice-btn--speaking {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
          color: #ef4444;
        }

        .pitch-step-indicator {
          font-size: 11px;
          font-family: var(--font-mono);
          color: #64748b;
        }

        .pitch-footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pitch-action-trigger {
          background: linear-gradient(135deg, #d4a853 0%, #b8860b 100%);
          color: #0f141c;
          border: none;
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-sans);
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.15s ease;
          box-shadow: 0 2px 10px rgba(212, 168, 83, 0.3);
        }

        .pitch-action-trigger:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(212, 168, 83, 0.45);
        }

        .pitch-nav-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #cbd5e1;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pitch-nav-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #f8fafc;
        }

        .pitch-nav-btn--next {
          background: rgba(56, 189, 248, 0.15);
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .pitch-nav-btn--next:hover {
          background: rgba(56, 189, 248, 0.25);
        }

        .pitch-nav-btn--done {
          background: rgba(16, 185, 129, 0.2);
          border-color: #10b981;
          color: #10b981;
        }
      `}</style>
    </AnimatePresence>
  );
}
