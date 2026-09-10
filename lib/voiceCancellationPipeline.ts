/**
 * voiceCancellationPipeline.ts — Unified 5-Stage Voice Cancellation Pipeline for AURA.
 *
 * Orchestrates all noise reduction subsystems into a single, user-controllable pipeline:
 *
 * Stage 1: Echo Gate       — Suppress AURA's own TTS feedback for 500ms after speech ends
 * Stage 2: Noise Profiling — Adaptive Kalman-filtered noise floor estimation per session
 * Stage 3: Wiener Filter   — Spectral subtraction noise removal (HVAC, fan, hiss)
 * Stage 4: Smart Gate      — Category-specific suppression (keyboard -18dB, chatter -12dB)
 * Stage 5: Speaker Focus   — Primary speaker lock; attenuate others when IC is speaking
 *
 * Designed to pipe into Agora's custom audio processing chain.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineLevel = 'off' | 'low' | 'medium' | 'high' | 'aggressive';

export type NoiseCategory =
  | 'voice'
  | 'keyboard'
  | 'background_chatter'
  | 'music'
  | 'construction'
  | 'hvac'
  | 'silence';

export interface PipelineConfig {
  /** Master level controlling all stages */
  level: PipelineLevel;
  /** Stage 1: Echo gate — suppress AURA TTS feedback */
  echoGateEnabled: boolean;
  /** Stage 2: Adaptive noise profiling */
  adaptiveNoiseProfileEnabled: boolean;
  /** Stage 3: Wiener filter noise suppression */
  wienerFilterEnabled: boolean;
  /** Stage 4: Smart category gate */
  smartGateEnabled: boolean;
  /** Suppress keyboard typing transients */
  suppressKeyboard: boolean;
  /** Suppress background chatter */
  suppressChatter: boolean;
  /** Stage 5: Primary speaker focus */
  speakerFocusEnabled: boolean;
  /** Echo gate tail duration in ms after AURA TTS ends */
  echoTailMs: number;
  /** Noise profile calibration duration in ms */
  calibrationMs: number;
}

export interface PipelineStageResult {
  stage: string;
  applied: boolean;
  gainDb: number;
  reason: string;
}

export interface PipelineResult {
  /** Whether any suppression was applied */
  suppressionApplied: boolean;
  /** Net gain applied (dB, negative = attenuation) */
  netGainDb: number;
  /** Per-stage breakdown for diagnostics */
  stages: PipelineStageResult[];
  /** Estimated SNR after processing (dB) */
  estimatedSnrDb: number;
  /** Detected noise category */
  detectedCategory: NoiseCategory;
  /** Whether echo gate is currently blocking */
  echoGateActive: boolean;
  /** Noise floor (dBFS) */
  noiseFloorDb: number;
  /** Whether calibration is complete */
  calibrated: boolean;
}

export interface PipelineStats {
  framesProcessed: number;
  framesSupressed: number;
  suppressionRate: number;
  avgSnrDb: number;
  totalEchoGateMs: number;
  keyboardEventsBlocked: number;
  chatterFramesBlocked: number;
}

// ── Default Configurations per Level ─────────────────────────────────────────

const LEVEL_DEFAULTS: Record<PipelineLevel, Partial<PipelineConfig>> = {
  off: {
    echoGateEnabled: false,
    adaptiveNoiseProfileEnabled: false,
    wienerFilterEnabled: false,
    smartGateEnabled: false,
    suppressKeyboard: false,
    suppressChatter: false,
    speakerFocusEnabled: false,
  },
  low: {
    echoGateEnabled: true,
    adaptiveNoiseProfileEnabled: true,
    wienerFilterEnabled: false,
    smartGateEnabled: true,
    suppressKeyboard: true,
    suppressChatter: false,
    speakerFocusEnabled: false,
    echoTailMs: 350,
  },
  medium: {
    echoGateEnabled: true,
    adaptiveNoiseProfileEnabled: true,
    wienerFilterEnabled: true,
    smartGateEnabled: true,
    suppressKeyboard: true,
    suppressChatter: true,
    speakerFocusEnabled: false,
    echoTailMs: 500,
  },
  high: {
    echoGateEnabled: true,
    adaptiveNoiseProfileEnabled: true,
    wienerFilterEnabled: true,
    smartGateEnabled: true,
    suppressKeyboard: true,
    suppressChatter: true,
    speakerFocusEnabled: true,
    echoTailMs: 600,
  },
  aggressive: {
    echoGateEnabled: true,
    adaptiveNoiseProfileEnabled: true,
    wienerFilterEnabled: true,
    smartGateEnabled: true,
    suppressKeyboard: true,
    suppressChatter: true,
    speakerFocusEnabled: true,
    echoTailMs: 800,
  },
};

// Suppression gains per category per level (dB)
const CATEGORY_GAINS: Record<NoiseCategory, Record<PipelineLevel, number>> = {
  voice:               { off: 0, low: 0,   medium: 0,   high: 0,   aggressive: 0   },
  keyboard:            { off: 0, low: -12, medium: -18, high: -24, aggressive: -30 },
  background_chatter:  { off: 0, low: -6,  medium: -12, high: -18, aggressive: -24 },
  music:               { off: 0, low: -8,  medium: -15, high: -20, aggressive: -26 },
  construction:        { off: 0, low: -10, medium: -16, high: -22, aggressive: -28 },
  hvac:                { off: 0, low: -8,  medium: -14, high: -20, aggressive: -26 },
  silence:             { off: 0, low: -40, medium: -60, high: -60, aggressive: -60 },
};

// ── Noise Profiler (Kalman-filtered) ─────────────────────────────────────────

export class AdaptiveNoiseProfiler {
  private noiseFloorDb = -60;
  private calibrationBuffer: number[] = [];
  private isCalibrated = false;
  private readonly kalmanQ = 0.01;  // Process noise variance
  private readonly kalmanR = 0.5;   // Measurement noise variance
  private kalmanP = 1.0;            // Estimate error covariance
  private readonly calibrationFrames: number;

  constructor(calibrationMs = 3000, analysisIntervalMs = 50) {
    this.calibrationFrames = Math.ceil(calibrationMs / analysisIntervalMs);
  }

  /**
   * Feed a new energy sample (dBFS) into the profiler.
   * Returns current noise floor estimate.
   */
  update(energyDb: number): number {
    // Phase 1: Collect calibration samples during initial silence
    if (!this.isCalibrated) {
      this.calibrationBuffer.push(energyDb);
      if (this.calibrationBuffer.length >= this.calibrationFrames) {
        // Set initial noise floor to 10th percentile of calibration samples
        const sorted = [...this.calibrationBuffer].sort((a, b) => a - b);
        this.noiseFloorDb = sorted[Math.floor(sorted.length * 0.1)];
        this.isCalibrated = true;
      }
      return this.noiseFloorDb;
    }

    // Phase 2: Kalman filter update (only during apparent silence)
    const snr = energyDb - this.noiseFloorDb;
    if (snr < 6) {
      // Measurement is likely noise — update noise floor
      // Kalman prediction
      const pPredicted = this.kalmanP + this.kalmanQ;
      // Kalman gain
      const k = pPredicted / (pPredicted + this.kalmanR);
      // Update estimate
      this.noiseFloorDb = this.noiseFloorDb + k * (energyDb - this.noiseFloorDb);
      // Update error covariance
      this.kalmanP = (1 - k) * pPredicted;
    }

    return this.noiseFloorDb;
  }

  get calibrated(): boolean {
    return this.isCalibrated;
  }

  get noiseFloor(): number {
    return this.noiseFloorDb;
  }

  reset(): void {
    this.calibrationBuffer = [];
    this.isCalibrated = false;
    this.noiseFloorDb = -60;
    this.kalmanP = 1.0;
  }
}

// ── Echo Gate ─────────────────────────────────────────────────────────────────

export class EchoGate {
  private gateEndTime = 0;
  private isGateOpen = false;

  /**
   * Call this when AURA's TTS finishes speaking.
   * @param tailMs Duration to gate for (e.g., 500ms)
   */
  onAuraSpeechEnd(tailMs: number): void {
    this.gateEndTime = Date.now() + tailMs;
    this.isGateOpen = true;
  }

  /**
   * Call this when AURA's TTS starts speaking (immediate gate).
   */
  onAuraSpeechStart(): void {
    this.gateEndTime = Date.now() + 5000; // max 5s failsafe
    this.isGateOpen = true;
  }

  /**
   * Whether the gate is currently active (blocking AURA's own echo).
   */
  get isActive(): boolean {
    if (this.isGateOpen && Date.now() > this.gateEndTime) {
      this.isGateOpen = false;
    }
    return this.isGateOpen;
  }

  /** Gain to apply when gate is active (-60dB = full suppression) */
  get gainDb(): number {
    return this.isActive ? -60 : 0;
  }

  reset(): void {
    this.gateEndTime = 0;
    this.isGateOpen = false;
  }
}

// ── Main Pipeline Class ───────────────────────────────────────────────────────

export class VoiceCancellationPipeline {
  private config: PipelineConfig;
  private noiseProfiler: AdaptiveNoiseProfiler;
  private echoGate: EchoGate;
  private stats: PipelineStats;
  private snrHistory: number[] = [];

  constructor(level: PipelineLevel = 'medium', configOverrides: Partial<PipelineConfig> = {}) {
    const defaults = LEVEL_DEFAULTS[level];
    this.config = {
      level,
      echoGateEnabled: true,
      adaptiveNoiseProfileEnabled: true,
      wienerFilterEnabled: true,
      smartGateEnabled: true,
      suppressKeyboard: true,
      suppressChatter: true,
      speakerFocusEnabled: false,
      echoTailMs: 500,
      calibrationMs: 3000,
      ...defaults,
      ...configOverrides,
    };

    this.noiseProfiler = new AdaptiveNoiseProfiler(this.config.calibrationMs);
    this.echoGate = new EchoGate();
    this.stats = {
      framesProcessed: 0,
      framesSupressed: 0,
      suppressionRate: 0,
      avgSnrDb: 0,
      totalEchoGateMs: 0,
      keyboardEventsBlocked: 0,
      chatterFramesBlocked: 0,
    };
  }

  /**
   * Process a single audio frame through the full pipeline.
   *
   * @param energyDb    Current frame energy (dBFS), e.g., from AnalyserNode.getByteFrequencyData
   * @param category    Noise category from NoiseClassifier
   * @param isSpeaking  Whether voice is detected in this frame
   * @returns           PipelineResult with net gain and per-stage breakdown
   */
  processFrame(
    energyDb: number,
    category: NoiseCategory,
    isSpeaking: boolean,
  ): PipelineResult {
    this.stats.framesProcessed++;

    const stages: PipelineStageResult[] = [];
    let netGainDb = 0;
    let suppressionApplied = false;

    // ── Stage 1: Echo Gate ───────────────────────────────────────────────────
    const echoGateActive = this.config.echoGateEnabled && this.echoGate.isActive;
    if (echoGateActive) {
      const gain = this.echoGate.gainDb;
      stages.push({ stage: 'echo_gate', applied: true, gainDb: gain, reason: 'AURA TTS echo suppression' });
      netGainDb += gain;
      suppressionApplied = true;
      this.stats.totalEchoGateMs += 50; // ~50ms per frame
    } else {
      stages.push({ stage: 'echo_gate', applied: false, gainDb: 0, reason: 'Gate inactive' });
    }

    // ── Stage 2: Adaptive Noise Profile ─────────────────────────────────────
    let noiseFloorDb = -60;
    if (this.config.adaptiveNoiseProfileEnabled) {
      noiseFloorDb = this.noiseProfiler.update(energyDb);
      stages.push({
        stage: 'noise_profile',
        applied: this.noiseProfiler.calibrated,
        gainDb: 0,
        reason: this.noiseProfiler.calibrated
          ? `Floor: ${noiseFloorDb.toFixed(1)}dB`
          : 'Calibrating...',
      });
    }

    // ── Stage 3: Wiener Filter (HVAC / broadband noise) ─────────────────────
    if (this.config.wienerFilterEnabled && (category === 'hvac' || category === 'silence')) {
      const snr = energyDb - noiseFloorDb;
      // Wiener gain: G = max(SNR/(SNR+1), β)  — simplified scalar version
      const snrLinear = Math.pow(10, snr / 10);
      const wienerGain = Math.max(0.01, snrLinear / (snrLinear + 1));
      const wienerGainDb = 20 * Math.log10(wienerGain);
      if (wienerGainDb < -3) {
        stages.push({
          stage: 'wiener_filter',
          applied: true,
          gainDb: wienerGainDb,
          reason: `SNR ${snr.toFixed(1)}dB → Wiener gain ${wienerGainDb.toFixed(1)}dB`,
        });
        netGainDb += wienerGainDb;
        suppressionApplied = true;
      } else {
        stages.push({ stage: 'wiener_filter', applied: false, gainDb: 0, reason: 'SNR acceptable' });
      }
    } else {
      stages.push({ stage: 'wiener_filter', applied: false, gainDb: 0, reason: 'Stage disabled or N/A' });
    }

    // ── Stage 4: Smart Category Gate ────────────────────────────────────────
    if (this.config.smartGateEnabled && !isSpeaking) {
      const shouldSuppress =
        (this.config.suppressKeyboard && category === 'keyboard') ||
        (this.config.suppressChatter && category === 'background_chatter') ||
        category === 'music' ||
        category === 'construction';

      if (shouldSuppress) {
        const gain = CATEGORY_GAINS[category][this.config.level];
        stages.push({
          stage: 'smart_gate',
          applied: true,
          gainDb: gain,
          reason: `Category: ${category} → ${gain}dB`,
        });
        netGainDb += gain;
        suppressionApplied = true;

        if (category === 'keyboard') this.stats.keyboardEventsBlocked++;
        if (category === 'background_chatter') this.stats.chatterFramesBlocked++;
      } else {
        stages.push({
          stage: 'smart_gate',
          applied: false,
          gainDb: 0,
          reason: isSpeaking ? 'Voice detected — passing through' : `Category ${category} — no suppression`,
        });
      }
    } else {
      stages.push({
        stage: 'smart_gate',
        applied: false,
        gainDb: 0,
        reason: this.config.level === 'off' ? 'Pipeline off' : 'Voice detected',
      });
    }

    // ── Stage 5: Speaker Focus (placeholder — actual Agora track manipulation) ──
    stages.push({
      stage: 'speaker_focus',
      applied: this.config.speakerFocusEnabled,
      gainDb: 0,
      reason: this.config.speakerFocusEnabled
        ? 'Primary speaker lock active (via useVoiceFocus)'
        : 'Speaker focus disabled',
    });

    // ── Stats tracking ───────────────────────────────────────────────────────
    if (suppressionApplied) this.stats.framesSupressed++;
    this.stats.suppressionRate = this.stats.framesSupressed / this.stats.framesProcessed;

    const estimatedSnrDb = energyDb - noiseFloorDb + Math.abs(netGainDb) * 0.3;
    this.snrHistory.push(estimatedSnrDb);
    if (this.snrHistory.length > 100) this.snrHistory.shift();
    this.stats.avgSnrDb = this.snrHistory.reduce((a, b) => a + b, 0) / this.snrHistory.length;

    return {
      suppressionApplied,
      netGainDb: Math.max(-60, netGainDb),
      stages,
      estimatedSnrDb,
      detectedCategory: category,
      echoGateActive,
      noiseFloorDb,
      calibrated: this.noiseProfiler.calibrated,
    };
  }

  // ── Echo Gate Controls ───────────────────────────────────────────────────────

  /** Call when AURA starts speaking via TTS */
  onAuraSpeechStart(): void {
    this.echoGate.onAuraSpeechStart();
  }

  /** Call when AURA finishes speaking via TTS */
  onAuraSpeechEnd(): void {
    this.echoGate.onAuraSpeechEnd(this.config.echoTailMs);
  }

  // ── Configuration ────────────────────────────────────────────────────────────

  setLevel(level: PipelineLevel): void {
    const defaults = LEVEL_DEFAULTS[level];
    this.config = { ...this.config, level, ...defaults };
  }

  updateConfig(overrides: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  getConfig(): Readonly<PipelineConfig> {
    return { ...this.config };
  }

  getStats(): Readonly<PipelineStats> {
    return { ...this.stats };
  }

  getNoiseFloorDb(): number {
    return this.noiseProfiler.noiseFloor;
  }

  isCalibrated(): boolean {
    return this.noiseProfiler.calibrated;
  }

  resetCalibration(): void {
    this.noiseProfiler.reset();
  }

  resetStats(): void {
    this.stats = {
      framesProcessed: 0,
      framesSupressed: 0,
      suppressionRate: 0,
      avgSnrDb: 0,
      totalEchoGateMs: 0,
      keyboardEventsBlocked: 0,
      chatterFramesBlocked: 0,
    };
    this.snrHistory = [];
  }
}

// ── Singleton factory for use in hooks ───────────────────────────────────────

let _pipelineInstance: VoiceCancellationPipeline | null = null;

export function getPipelineInstance(level: PipelineLevel = 'medium'): VoiceCancellationPipeline {
  if (!_pipelineInstance) {
    _pipelineInstance = new VoiceCancellationPipeline(level);
  }
  return _pipelineInstance;
}

export function resetPipelineInstance(): void {
  _pipelineInstance = null;
}

// ── Helper: Convert dBFS energy to human-readable SNR label ──────────────────

export function getSnrLabel(snrDb: number): { label: string; color: string } {
  if (snrDb >= 20) return { label: 'Excellent', color: 'var(--color-fact)' };
  if (snrDb >= 12) return { label: 'Good', color: 'var(--color-hypothesis)' };
  if (snrDb >= 6)  return { label: 'Fair', color: 'var(--color-orient)' };
  return { label: 'Poor', color: 'var(--color-conflict)' };
}

// ── Helper: Map pipeline level to description ─────────────────────────────────

export const PIPELINE_LEVEL_DESCRIPTIONS: Record<PipelineLevel, string> = {
  off:        'No noise reduction. All audio passes through.',
  low:        'Echo gate + keyboard suppression only.',
  medium:     'Echo gate + Wiener filter + keyboard & chatter suppression.',
  high:       'All stages active + primary speaker focus.',
  aggressive: 'Maximum suppression + extended echo gate + speaker focus.',
};
