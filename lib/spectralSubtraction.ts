/**
 * spectralSubtraction.ts — Professional-grade spectral noise removal for AURA.
 *
 * Implements a multi-stage noise removal pipeline:
 * 1. Noise Spectrum Estimation — Builds a noise profile during silence periods
 * 2. Wiener Filter — Optimal minimum mean-square-error noise suppression
 * 3. Spectral Subtraction — Per-bin subtraction with oversubtraction control
 * 4. Per-Band Adaptive Thresholds — Separate noise floors for low/mid/high bands
 * 5. Echo Cancellation Gate — Suppresses AURA's own TTS feedback
 * 6. Musical Noise Reduction — Smooths residual "musical noise" artifacts
 *
 * Audio pipeline: Raw → Echo Gate → Noise Estimate → Wiener Filter → Clean Output
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpectralSubtractionConfig {
  /** Oversubtraction factor α (1.0 = exact, 2.0-4.0 = aggressive). Default: 2.5 */
  alpha: number;
  /** Spectral floor β — minimum gain to prevent musical noise (0.01-0.1). Default: 0.03 */
  beta: number;
  /** Smoothing factor for noise estimate update (0.9-0.99). Default: 0.96 */
  noiseSmoothing: number;
  /** Number of silent frames needed to update noise estimate. Default: 10 */
  minSilenceFrames: number;
  /** Enable per-band adaptive thresholds. Default: true */
  perBandAdaptive: boolean;
  /** Enable Wiener filter (vs simpler spectral subtraction). Default: true */
  useWienerFilter: boolean;
  /** Enable echo cancellation gate. Default: true */
  echoCancellation: boolean;
  /** Echo gate suppression duration after TTS playback ends (ms). Default: 500 */
  echoTailMs: number;
}

export interface BandNoiseProfile {
  /** Low band: 0-300 Hz (HVAC, rumble) */
  low: Float32Array;
  /** Mid band: 300-3000 Hz (voice, speech) */
  mid: Float32Array;
  /** High band: 3000+ Hz (sibilance, keyboard clicks, hiss) */
  high: Float32Array;
}

export interface SubtractionResult {
  /** Cleaned power spectrum */
  cleanSpectrum: Float32Array;
  /** Per-bin gain factors applied (0-1) */
  gainMask: Float32Array;
  /** Estimated SNR for this frame (dB) */
  estimatedSnrDb: number;
  /** Whether noise estimate was updated this frame */
  noiseEstimateUpdated: boolean;
  /** Whether echo gate is active */
  echoGateActive: boolean;
  /** Per-band noise levels (dB) */
  bandNoiseLevels: { low: number; mid: number; high: number };
}

// ── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: SpectralSubtractionConfig = {
  alpha: 2.5,
  beta: 0.03,
  noiseSmoothing: 0.96,
  minSilenceFrames: 10,
  perBandAdaptive: true,
  useWienerFilter: true,
  echoCancellation: true,
  echoTailMs: 500,
};

// ── Spectral Subtraction Engine ──────────────────────────────────────────────

export class SpectralSubtractionEngine {
  private config: SpectralSubtractionConfig;

  /** Estimated noise power spectrum (smoothed over silence frames) */
  private noiseEstimate: Float32Array | null = null;
  /** Per-band noise estimates */
  private bandEstimates: BandNoiseProfile | null = null;
  /** Count of consecutive silence frames for noise estimation */
  private silenceFrameCount = 0;
  /** Total frames processed */
  private totalFrames = 0;
  /** Whether the initial noise estimate has been established */
  private isCalibrated = false;
  /** Previous frame's gain mask for temporal smoothing */
  private prevGainMask: Float32Array | null = null;
  /** Whether AURA TTS is currently playing (echo gate) */
  private isTTSPlaying = false;
  /** Timestamp when TTS playback stopped */
  private ttsStoppedAt = 0;

  /** Band boundary bins (computed once per sample rate) */
  private lowBandEnd = 0;
  private midBandEnd = 0;
  private binWidth = 0;

  constructor(config?: Partial<SpectralSubtractionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize band boundaries based on FFT parameters.
   */
  private initBands(fftSize: number, sampleRate: number): void {
    this.binWidth = sampleRate / fftSize;
    this.lowBandEnd = Math.ceil(300 / this.binWidth);
    this.midBandEnd = Math.ceil(3000 / this.binWidth);
  }

  /**
   * Mark TTS playback state (for echo cancellation gate).
   * Call this when AURA starts/stops speaking.
   */
  setTTSPlaying(isPlaying: boolean): void {
    if (this.isTTSPlaying && !isPlaying) {
      this.ttsStoppedAt = Date.now();
    }
    this.isTTSPlaying = isPlaying;
  }

  /**
   * Check if the echo gate should be active.
   */
  private isEchoGateActive(): boolean {
    if (!this.config.echoCancellation) return false;
    if (this.isTTSPlaying) return true;
    // Keep gate active for echoTailMs after TTS stops (for room reverb)
    return (Date.now() - this.ttsStoppedAt) < this.config.echoTailMs;
  }

  /**
   * Update the noise estimate from a silence frame.
   * Uses exponential moving average for smooth tracking.
   */
  private updateNoiseEstimate(powerSpectrum: Float32Array): void {
    const α = this.config.noiseSmoothing;

    if (!this.noiseEstimate) {
      // First frame: initialize directly
      this.noiseEstimate = new Float32Array(powerSpectrum.length);
      this.noiseEstimate.set(powerSpectrum);
    } else {
      // EMA update: N_new = α·N_old + (1-α)·current
      for (let i = 0; i < powerSpectrum.length; i++) {
        this.noiseEstimate[i] = α * this.noiseEstimate[i] + (1 - α) * powerSpectrum[i];
      }
    }

    // Update per-band estimates
    if (this.config.perBandAdaptive && this.lowBandEnd > 0) {
      if (!this.bandEstimates) {
        this.bandEstimates = {
          low: new Float32Array(this.lowBandEnd),
          mid: new Float32Array(this.midBandEnd - this.lowBandEnd),
          high: new Float32Array(powerSpectrum.length - this.midBandEnd),
        };
      }

      for (let i = 0; i < this.lowBandEnd && i < powerSpectrum.length; i++) {
        this.bandEstimates.low[i] = α * this.bandEstimates.low[i] + (1 - α) * powerSpectrum[i];
      }
      for (let i = this.lowBandEnd; i < this.midBandEnd && i < powerSpectrum.length; i++) {
        const bi = i - this.lowBandEnd;
        this.bandEstimates.mid[bi] = α * this.bandEstimates.mid[bi] + (1 - α) * powerSpectrum[i];
      }
      for (let i = this.midBandEnd; i < powerSpectrum.length; i++) {
        const bi = i - this.midBandEnd;
        if (bi < this.bandEstimates.high.length) {
          this.bandEstimates.high[bi] = α * this.bandEstimates.high[bi] + (1 - α) * powerSpectrum[i];
        }
      }
    }

    this.isCalibrated = true;
  }

  /**
   * Compute Wiener filter gain for a single frequency bin.
   *
   * G(f) = max(β, 1 - α · (N(f) / S(f)))
   *
   * Where:
   *   S(f) = noisy signal power at frequency f
   *   N(f) = estimated noise power at frequency f
   *   α = oversubtraction factor
   *   β = spectral floor (minimum gain)
   */
  private wienerGain(signalPower: number, noisePower: number): number {
    if (signalPower <= 0) return this.config.beta;

    if (this.config.useWienerFilter) {
      // Wiener filter: G = S_clean / S_noisy ≈ 1 - N/S (when SNR > 0)
      const snr = signalPower / Math.max(noisePower, 1e-10);
      const gain = snr / (snr + 1); // Wiener filter formula
      return Math.max(this.config.beta, gain);
    } else {
      // Simple spectral subtraction: G = 1 - α·(N/S)
      const ratio = noisePower / signalPower;
      const gain = 1 - this.config.alpha * ratio;
      return Math.max(this.config.beta, gain);
    }
  }

  /**
   * Process a single audio frame through the spectral subtraction pipeline.
   *
   * @param powerSpectrum Float32Array of power spectrum values (from FFT)
   * @param isSpeechDetected Whether VAD indicates speech in this frame
   * @param sampleRate Audio sample rate
   * @param fftSize FFT size
   */
  process(
    powerSpectrum: Float32Array,
    isSpeechDetected: boolean,
    sampleRate: number,
    fftSize: number,
  ): SubtractionResult {
    // Initialize band boundaries if needed
    if (this.binWidth === 0) {
      this.initBands(fftSize, sampleRate);
    }

    this.totalFrames++;

    // Check echo gate
    const echoGateActive = this.isEchoGateActive();

    // If echo gate is active, treat entire frame as noise
    if (echoGateActive) {
      this.silenceFrameCount++;
      if (this.silenceFrameCount >= 3) {
        this.updateNoiseEstimate(powerSpectrum);
      }

      // Suppress everything during echo gate
      const cleanSpectrum = new Float32Array(powerSpectrum.length);
      const gainMask = new Float32Array(powerSpectrum.length);
      gainMask.fill(this.config.beta);
      for (let i = 0; i < powerSpectrum.length; i++) {
        cleanSpectrum[i] = powerSpectrum[i] * this.config.beta;
      }

      return {
        cleanSpectrum,
        gainMask,
        estimatedSnrDb: -10,
        noiseEstimateUpdated: true,
        echoGateActive: true,
        bandNoiseLevels: this.getBandNoiseLevels(),
      };
    }

    // Update noise estimate during silence
    let noiseEstimateUpdated = false;
    if (!isSpeechDetected) {
      this.silenceFrameCount++;
      if (this.silenceFrameCount >= this.config.minSilenceFrames) {
        this.updateNoiseEstimate(powerSpectrum);
        noiseEstimateUpdated = true;
      }
    } else {
      this.silenceFrameCount = 0;
    }

    // If not yet calibrated, pass through
    if (!this.isCalibrated || !this.noiseEstimate) {
      // During calibration period, update noise estimate aggressively
      if (!isSpeechDetected) {
        this.updateNoiseEstimate(powerSpectrum);
      }
      return {
        cleanSpectrum: new Float32Array(powerSpectrum),
        gainMask: new Float32Array(powerSpectrum.length).fill(1),
        estimatedSnrDb: 0,
        noiseEstimateUpdated,
        echoGateActive: false,
        bandNoiseLevels: { low: -60, mid: -60, high: -60 },
      };
    }

    // ── Apply spectral subtraction / Wiener filter ─────────────────────────
    const cleanSpectrum = new Float32Array(powerSpectrum.length);
    const gainMask = new Float32Array(powerSpectrum.length);

    let signalEnergy = 0;
    let noiseEnergy = 0;

    for (let i = 0; i < powerSpectrum.length; i++) {
      let noiseEst = this.noiseEstimate[i];

      // Per-band adaptive: use band-specific estimate if available
      if (this.config.perBandAdaptive && this.bandEstimates) {
        if (i < this.lowBandEnd) {
          noiseEst = this.bandEstimates.low[i] ?? noiseEst;
        } else if (i < this.midBandEnd) {
          noiseEst = this.bandEstimates.mid[i - this.lowBandEnd] ?? noiseEst;
        } else if (i - this.midBandEnd < this.bandEstimates.high.length) {
          noiseEst = this.bandEstimates.high[i - this.midBandEnd] ?? noiseEst;
        }
      }

      const gain = this.wienerGain(powerSpectrum[i], noiseEst);
      gainMask[i] = gain;
      cleanSpectrum[i] = powerSpectrum[i] * gain;

      signalEnergy += powerSpectrum[i];
      noiseEnergy += noiseEst;
    }

    // ── Temporal smoothing of gain mask (reduces musical noise) ───────────
    if (this.prevGainMask) {
      const temporalSmoothing = 0.7;
      for (let i = 0; i < gainMask.length; i++) {
        gainMask[i] = temporalSmoothing * this.prevGainMask[i] + (1 - temporalSmoothing) * gainMask[i];
        cleanSpectrum[i] = powerSpectrum[i] * gainMask[i];
      }
    }
    this.prevGainMask = new Float32Array(gainMask);

    // Compute estimated SNR
    const avgSignal = signalEnergy / Math.max(powerSpectrum.length, 1);
    const avgNoise = noiseEnergy / Math.max(powerSpectrum.length, 1);
    const snrLinear = avgNoise > 0 ? avgSignal / avgNoise : 100;
    const estimatedSnrDb = 10 * Math.log10(Math.max(snrLinear, 1e-10));

    return {
      cleanSpectrum,
      gainMask,
      estimatedSnrDb: Math.round(estimatedSnrDb * 10) / 10,
      noiseEstimateUpdated,
      echoGateActive: false,
      bandNoiseLevels: this.getBandNoiseLevels(),
    };
  }

  /**
   * Get per-band noise levels in dB.
   */
  private getBandNoiseLevels(): { low: number; mid: number; high: number } {
    if (!this.bandEstimates) return { low: -60, mid: -60, high: -60 };

    const avgDb = (arr: Float32Array) => {
      if (arr.length === 0) return -60;
      let sum = 0;
      for (let i = 0; i < arr.length; i++) sum += arr[i];
      const avg = sum / arr.length;
      return avg > 0 ? 10 * Math.log10(avg) : -60;
    };

    return {
      low: Math.round(avgDb(this.bandEstimates.low)),
      mid: Math.round(avgDb(this.bandEstimates.mid)),
      high: Math.round(avgDb(this.bandEstimates.high)),
    };
  }

  /**
   * Force recalibration (e.g., when environment changes).
   */
  recalibrate(): void {
    this.noiseEstimate = null;
    this.bandEstimates = null;
    this.isCalibrated = false;
    this.silenceFrameCount = 0;
    this.prevGainMask = null;
  }

  /**
   * Check if the engine has been calibrated.
   */
  getIsCalibrated(): boolean {
    return this.isCalibrated;
  }

  /**
   * Get the current noise estimate for visualization.
   */
  getNoiseEstimate(): Float32Array | null {
    return this.noiseEstimate ? new Float32Array(this.noiseEstimate) : null;
  }

  /**
   * Reset the entire engine.
   */
  reset(): void {
    this.noiseEstimate = null;
    this.bandEstimates = null;
    this.silenceFrameCount = 0;
    this.totalFrames = 0;
    this.isCalibrated = false;
    this.prevGainMask = null;
    this.isTTSPlaying = false;
    this.ttsStoppedAt = 0;
    this.binWidth = 0;
  }

  /**
   * Update configuration at runtime.
   */
  updateConfig(overrides: Partial<SpectralSubtractionConfig>): void {
    Object.assign(this.config, overrides);
  }
}

// ── Volume Normalization Utilities ───────────────────────────────────────────

/**
 * Per-speaker volume normalization.
 * Tracks each speaker's average RMS and applies gain to normalize
 * everyone to a target level.
 */
export class VolumeNormalizer {
  private speakerRms = new Map<string, { avg: number; frameCount: number }>();
  private readonly targetRmsDb: number;
  private readonly smoothing: number;
  private readonly maxGainDb: number;

  constructor(targetRmsDb = -25, smoothing = 0.95, maxGainDb = 12) {
    this.targetRmsDb = targetRmsDb;
    this.smoothing = smoothing;
    this.maxGainDb = maxGainDb;
  }

  /**
   * Update the running average RMS for a speaker.
   */
  updateSpeakerLevel(uid: string, rmsDb: number): void {
    const existing = this.speakerRms.get(uid);
    if (!existing) {
      this.speakerRms.set(uid, { avg: rmsDb, frameCount: 1 });
    } else {
      existing.avg = this.smoothing * existing.avg + (1 - this.smoothing) * rmsDb;
      existing.frameCount++;
    }
  }

  /**
   * Get the recommended gain (in dB) to normalize a speaker's volume.
   */
  getGainDb(uid: string): number {
    const existing = this.speakerRms.get(uid);
    if (!existing || existing.frameCount < 20) return 0; // Not enough data

    const gainNeeded = this.targetRmsDb - existing.avg;
    // Clamp to prevent extreme amplification
    return Math.max(-this.maxGainDb, Math.min(this.maxGainDb, gainNeeded));
  }

  /**
   * Get the linear gain multiplier for a speaker.
   */
  getGainMultiplier(uid: string): number {
    const gainDb = this.getGainDb(uid);
    return Math.pow(10, gainDb / 20);
  }

  /**
   * Get all tracked speakers and their levels.
   */
  getAllLevels(): Record<string, { avgRmsDb: number; gainDb: number }> {
    const result: Record<string, { avgRmsDb: number; gainDb: number }> = {};
    for (const [uid, data] of this.speakerRms) {
      result[uid] = {
        avgRmsDb: Math.round(data.avg),
        gainDb: Math.round(this.getGainDb(uid) * 10) / 10,
      };
    }
    return result;
  }

  /**
   * Remove a speaker (e.g., when they leave).
   */
  removeSpeaker(uid: string): void {
    this.speakerRms.delete(uid);
  }

  reset(): void {
    this.speakerRms.clear();
  }
}

/**
 * Priority speaker audio boost.
 * Applies +3dB boost to the Incident Commander when multiple people are talking.
 */
export class PrioritySpeakerBoost {
  private incidentCommanderUid: string | null = null;
  private readonly boostDb: number;
  private readonly duckDb: number;

  /**
   * @param boostDb Gain boost for IC when others are talking. Default: +3 dB
   * @param duckDb Volume reduction for non-IC speakers during overlap. Default: -4 dB
   */
  constructor(boostDb = 3, duckDb = -4) {
    this.boostDb = boostDb;
    this.duckDb = duckDb;
  }

  setIncidentCommander(uid: string | null): void {
    this.incidentCommanderUid = uid;
  }

  /**
   * Get the gain adjustment for a speaker based on overlap state.
   *
   * @param uid Speaker UID
   * @param isOverlapping Whether multiple people are talking
   * @returns Gain in dB (positive = boost, negative = duck)
   */
  getGainDb(uid: string, isOverlapping: boolean): number {
    if (!isOverlapping || !this.incidentCommanderUid) return 0;
    if (uid === this.incidentCommanderUid) return this.boostDb;
    return this.duckDb;
  }

  /**
   * Get the linear gain multiplier.
   */
  getGainMultiplier(uid: string, isOverlapping: boolean): number {
    const db = this.getGainDb(uid, isOverlapping);
    return Math.pow(10, db / 20);
  }
}
