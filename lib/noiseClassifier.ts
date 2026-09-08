/**
 * noiseClassifier.ts — Multi-stage spectral noise classification engine for AURA.
 *
 * Classifies audio frames into categories using spectral features:
 * - Spectral Centroid (brightness)
 * - Zero-Crossing Rate (noisiness)
 * - Spectral Flatness (tonality vs noise)
 * - Spectral Roll-off (energy distribution)
 * - Transient Detection (impulsive sounds like typing)
 *
 * Each 50ms frame is classified into one of:
 * voice | keyboard | background_chatter | music | construction | hvac | silence
 */

export type NoiseCategory =
  | 'voice'
  | 'keyboard'
  | 'background_chatter'
  | 'music'
  | 'construction'
  | 'hvac'
  | 'silence';

export interface AudioFrameFeatures {
  /** Weighted mean of the frequency spectrum (Hz) */
  spectralCentroid: number;
  /** Rate of sign-changes per second in time-domain signal */
  zeroCrossingRate: number;
  /** 0 = tonal, 1 = noise-like (geometric / arithmetic mean ratio) */
  spectralFlatness: number;
  /** Frequency below which 85% of spectral energy is concentrated */
  spectralRolloff: number;
  /** Peak-to-average ratio — high for impulsive sounds (typing, clicks) */
  crestFactor: number;
  /** RMS energy in dBFS */
  rmsDb: number;
  /** Ratio of voice-band energy (85Hz–3kHz) to total energy */
  voiceBandRatio: number;
  /** Whether a sharp transient was detected in this frame */
  hasTransient: boolean;
}

export interface ClassificationResult {
  category: NoiseCategory;
  confidence: number; // 0-100
  features: AudioFrameFeatures;
  shouldSuppress: boolean;
}

// ── Feature Extraction ──────────────────────────────────────────────────────

/**
 * Extracts spectral features from a Float32Array of frequency-domain data (dB).
 */
export function extractFeatures(
  frequencyData: Float32Array,
  timeData: Float32Array,
  sampleRate: number,
  fftSize: number,
): AudioFrameFeatures {
  const binCount = frequencyData.length;
  const binWidth = sampleRate / fftSize;

  // ─── Spectral Centroid ─────────────────────────────────────────────────
  // Weighted average of frequencies, where each weight is the magnitude
  let magnitudeSum = 0;
  let weightedSum = 0;

  for (let i = 1; i < binCount; i++) {
    // Convert from dB to linear magnitude
    const mag = Math.pow(10, frequencyData[i] / 20);
    const freq = i * binWidth;
    weightedSum += freq * mag;
    magnitudeSum += mag;
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;

  // ─── Zero-Crossing Rate ────────────────────────────────────────────────
  let crossings = 0;
  for (let i = 1; i < timeData.length; i++) {
    if ((timeData[i] >= 0 && timeData[i - 1] < 0) || (timeData[i] < 0 && timeData[i - 1] >= 0)) {
      crossings++;
    }
  }
  const zeroCrossingRate = crossings / timeData.length * sampleRate;

  // ─── Spectral Flatness (Wiener entropy) ────────────────────────────────
  // Ratio of geometric mean to arithmetic mean of power spectrum
  let logSum = 0;
  let linearSum = 0;
  let validBins = 0;

  for (let i = 1; i < binCount; i++) {
    const power = Math.pow(10, frequencyData[i] / 10);
    if (power > 1e-10) {
      logSum += Math.log(power);
      linearSum += power;
      validBins++;
    }
  }

  let spectralFlatness = 0;
  if (validBins > 0 && linearSum > 0) {
    const geometricMean = Math.exp(logSum / validBins);
    const arithmeticMean = linearSum / validBins;
    spectralFlatness = Math.min(1, geometricMean / arithmeticMean);
  }

  // ─── Spectral Roll-off (85th percentile) ───────────────────────────────
  const totalEnergy = linearSum;
  const rolloffThreshold = totalEnergy * 0.85;
  let cumulativeEnergy = 0;
  let rolloffBin = binCount - 1;

  for (let i = 1; i < binCount; i++) {
    cumulativeEnergy += Math.pow(10, frequencyData[i] / 10);
    if (cumulativeEnergy >= rolloffThreshold) {
      rolloffBin = i;
      break;
    }
  }
  const spectralRolloff = rolloffBin * binWidth;

  // ─── Crest Factor (peak-to-RMS ratio) ─────────────────────────────────
  let rmsSum = 0;
  let peak = 0;
  for (let i = 0; i < timeData.length; i++) {
    const abs = Math.abs(timeData[i]);
    rmsSum += timeData[i] * timeData[i];
    if (abs > peak) peak = abs;
  }
  const rms = Math.sqrt(rmsSum / timeData.length);
  const crestFactor = rms > 0 ? peak / rms : 0;

  // ─── RMS Energy in dBFS ────────────────────────────────────────────────
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -90;

  // ─── Voice Band Ratio ──────────────────────────────────────────────────
  const voiceLowBin = Math.max(1, Math.floor(85 / binWidth));
  const voiceHighBin = Math.min(binCount - 1, Math.ceil(3000 / binWidth));
  let voiceBandEnergy = 0;

  for (let i = voiceLowBin; i <= voiceHighBin; i++) {
    voiceBandEnergy += Math.pow(10, frequencyData[i] / 10);
  }
  const voiceBandRatio = totalEnergy > 0 ? voiceBandEnergy / totalEnergy : 0;

  // ─── Transient Detection ───────────────────────────────────────────────
  // Look for sharp amplitude rise (>12dB in <5ms)
  const samplesIn5ms = Math.floor(sampleRate * 0.005);
  let hasTransient = false;
  for (let i = samplesIn5ms; i < timeData.length; i++) {
    const currentAmp = Math.abs(timeData[i]);
    const prevAmp = Math.abs(timeData[i - samplesIn5ms]);
    if (prevAmp > 0.001 && currentAmp / prevAmp > 4) { // >12dB rise
      hasTransient = true;
      break;
    }
  }

  return {
    spectralCentroid,
    zeroCrossingRate,
    spectralFlatness,
    spectralRolloff,
    crestFactor,
    rmsDb,
    voiceBandRatio,
    hasTransient,
  };
}

// ── Classification Rules ────────────────────────────────────────────────────

/**
 * Classifies an audio frame based on extracted spectral features.
 *
 * Classification priority (highest to lowest):
 * 1. Silence — if RMS is below noise floor
 * 2. Keyboard — if transient detected + high-frequency energy + short duration
 * 3. HVAC — low spectral centroid + high flatness + steady energy
 * 4. Music — moderate flatness + harmonic content + moderate centroid
 * 5. Construction — broadband noise + high crest factor + high energy
 * 6. Background chatter — voice-band energy present but low confidence
 * 7. Voice — voice-band energy dominant + low flatness (tonal)
 */
export function classifyFrame(
  features: AudioFrameFeatures,
  noiseFloorDb: number = -55,
): ClassificationResult {
  const { spectralCentroid, zeroCrossingRate, spectralFlatness, crestFactor, rmsDb, voiceBandRatio, hasTransient } = features;

  // ── 1. Silence ─────────────────────────────────────────────────────────
  if (rmsDb < noiseFloorDb - 5) {
    return {
      category: 'silence',
      confidence: 95,
      features,
      shouldSuppress: false, // Don't actively suppress silence
    };
  }

  // ── 2. Keyboard / Typing ───────────────────────────────────────────────
  // Characteristics: sharp transient, high-frequency energy, high crest factor
  if (
    hasTransient &&
    crestFactor > 5 &&
    spectralCentroid > 2000 &&
    voiceBandRatio < 0.4
  ) {
    return {
      category: 'keyboard',
      confidence: Math.min(95, 60 + Math.round(crestFactor * 3)),
      features,
      shouldSuppress: true,
    };
  }

  // ── 3. HVAC / Steady Hum ──────────────────────────────────────────────
  // Characteristics: low centroid (<300Hz), high flatness, steady energy
  if (
    spectralCentroid < 350 &&
    spectralFlatness > 0.6 &&
    voiceBandRatio < 0.35 &&
    !hasTransient
  ) {
    return {
      category: 'hvac',
      confidence: Math.min(90, 50 + Math.round(spectralFlatness * 40)),
      features,
      shouldSuppress: true,
    };
  }

  // ── 4. Construction / Broadband Impulsive Noise ───────────────────────
  if (
    spectralFlatness > 0.7 &&
    crestFactor > 4 &&
    rmsDb > noiseFloorDb + 15 &&
    hasTransient
  ) {
    return {
      category: 'construction',
      confidence: Math.min(85, 50 + Math.round(crestFactor * 5)),
      features,
      shouldSuppress: true,
    };
  }

  // ── 5. Music ──────────────────────────────────────────────────────────
  // Characteristics: harmonic content (low flatness), moderate centroid, steady
  if (
    spectralFlatness < 0.3 &&
    spectralCentroid > 300 && spectralCentroid < 4000 &&
    voiceBandRatio > 0.3 && voiceBandRatio < 0.65 &&
    !hasTransient &&
    zeroCrossingRate < 3000
  ) {
    return {
      category: 'music',
      confidence: 65,
      features,
      shouldSuppress: true,
    };
  }

  // ── 6. Voice (primary target) ─────────────────────────────────────────
  // Characteristics: voice band dominant, tonal (low flatness), moderate ZCR
  if (
    voiceBandRatio > 0.5 &&
    spectralFlatness < 0.5 &&
    rmsDb > noiseFloorDb + 6 &&
    spectralCentroid > 100 && spectralCentroid < 4000
  ) {
    const voiceConfidence = Math.min(95,
      40 +
      Math.round(voiceBandRatio * 30) +
      Math.round((1 - spectralFlatness) * 20) +
      (rmsDb > noiseFloorDb + 12 ? 10 : 0)
    );
    return {
      category: 'voice',
      confidence: voiceConfidence,
      features,
      shouldSuppress: false,
    };
  }

  // ── 7. Background Chatter ─────────────────────────────────────────────
  // Voice-band energy present but not dominant enough for primary voice
  if (voiceBandRatio > 0.3 && rmsDb > noiseFloorDb) {
    return {
      category: 'background_chatter',
      confidence: 55,
      features,
      shouldSuppress: true,
    };
  }

  // ── Default: treat as ambient noise → suppress ────────────────────────
  return {
    category: 'silence',
    confidence: 50,
    features,
    shouldSuppress: rmsDb > noiseFloorDb,
  };
}

// ── Aggregated Classification (smoothed over multiple frames) ───────────────

export class FrameClassifier {
  private history: ClassificationResult[] = [];
  private readonly historySize: number;

  constructor(historySize = 5) {
    this.historySize = historySize;
  }

  /**
   * Classify a frame and return smoothed result based on recent history.
   * Prevents flicker between categories by requiring consistency.
   */
  classify(
    frequencyData: Float32Array,
    timeData: Float32Array,
    sampleRate: number,
    fftSize: number,
    noiseFloorDb?: number,
  ): ClassificationResult {
    const features = extractFeatures(frequencyData, timeData, sampleRate, fftSize);
    const result = classifyFrame(features, noiseFloorDb);

    this.history.push(result);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }

    // Smoothing: if the majority of recent frames agree, return that category
    const categoryCounts = new Map<NoiseCategory, number>();
    for (const r of this.history) {
      categoryCounts.set(r.category, (categoryCounts.get(r.category) || 0) + 1);
    }

    let dominantCategory = result.category;
    let maxCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = cat;
      }
    }

    // Only switch category if >50% of recent history agrees
    if (maxCount >= Math.ceil(this.historySize / 2)) {
      return {
        ...result,
        category: dominantCategory,
        shouldSuppress: dominantCategory !== 'voice' && dominantCategory !== 'silence',
      };
    }

    return result;
  }

  /** Reset history (e.g., when audio source changes) */
  reset(): void {
    this.history = [];
  }

  /** Get the current dominant category */
  getDominantCategory(): NoiseCategory {
    if (this.history.length === 0) return 'silence';
    const counts = new Map<NoiseCategory, number>();
    for (const r of this.history) {
      counts.set(r.category, (counts.get(r.category) || 0) + 1);
    }
    let best: NoiseCategory = 'silence';
    let bestCount = 0;
    for (const [cat, count] of counts) {
      if (count > bestCount) {
        best = cat;
        bestCount = count;
      }
    }
    return best;
  }
}
