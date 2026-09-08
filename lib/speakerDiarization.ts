/**
 * speakerDiarization.ts — Client-side speaker diarization engine for AURA.
 *
 * Provides real-time speaker identification and separation using:
 * 1. MFCC Feature Extraction — Mel-Frequency Cepstral Coefficients
 * 2. Speaker Embedding — Compact vector fingerprint per speaker
 * 3. Cosine Similarity Matching — Maps audio segments to known speakers
 * 4. Unknown Speaker Detection — Flags unrecognized voice patterns
 * 5. Overlap Detection — Detects when multiple speakers talk simultaneously
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpeakerProfile {
  uid: string;
  displayName: string;
  /** Rolling MFCC embedding (averaged over recent frames) */
  embedding: Float32Array;
  /** Number of frames used to build this embedding */
  frameCount: number;
  /** Total speaking duration (ms) */
  totalSpeakingMs: number;
  /** Last time this speaker was detected (epoch ms) */
  lastActiveAt: number;
  /** Confidence in this speaker's identity (0-100) */
  identityConfidence: number;
  /** Whether this speaker was manually confirmed */
  isConfirmed: boolean;
}

export interface DiarizationResult {
  /** Most likely speaker UID */
  speakerUid: string | null;
  /** Confidence of the speaker match (0-100) */
  confidence: number;
  /** Whether this is an unknown/unregistered speaker */
  isUnknown: boolean;
  /** Whether multiple speakers are talking simultaneously */
  isOverlapping: boolean;
  /** All speaker match scores */
  matchScores: Array<{ uid: string; score: number }>;
}

export interface SpeakerTimelineEntry {
  uid: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// ── MFCC Feature Extraction ──────────────────────────────────────────────────

const NUM_MFCC_COEFFICIENTS = 13;
const NUM_MEL_FILTERS = 26;
const MEL_LOW_FREQ = 80;
const MEL_HIGH_FREQ = 7600;

/**
 * Convert frequency (Hz) to Mel scale.
 */
function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

/**
 * Convert Mel scale back to Hz.
 */
function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Create Mel-spaced filter bank.
 */
function createMelFilterBank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
): Float32Array[] {
  const lowMel = hzToMel(MEL_LOW_FREQ);
  const highMel = hzToMel(Math.min(MEL_HIGH_FREQ, sampleRate / 2));
  const melPoints: number[] = [];

  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(melToHz(lowMel + (i * (highMel - lowMel)) / (numFilters + 1)));
  }

  const binPoints = melPoints.map((freq) =>
    Math.floor(((fftSize + 1) * freq) / sampleRate)
  );

  const filterBank: Float32Array[] = [];
  const binCount = fftSize / 2 + 1;

  for (let i = 0; i < numFilters; i++) {
    const filter = new Float32Array(binCount);
    const startBin = binPoints[i];
    const peakBin = binPoints[i + 1];
    const endBin = binPoints[i + 2];

    for (let j = startBin; j < peakBin; j++) {
      if (j >= 0 && j < binCount) {
        filter[j] = (peakBin - startBin) > 0 ? (j - startBin) / (peakBin - startBin) : 0;
      }
    }
    for (let j = peakBin; j <= endBin; j++) {
      if (j >= 0 && j < binCount) {
        filter[j] = (endBin - peakBin) > 0 ? (endBin - j) / (endBin - peakBin) : 0;
      }
    }

    filterBank.push(filter);
  }

  return filterBank;
}

/**
 * Extract MFCC coefficients from a power spectrum.
 *
 * Process: Power Spectrum → Mel Filter Bank → Log → DCT → MFCC
 */
export function extractMFCC(
  powerSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  filterBank?: Float32Array[],
): Float32Array {
  const bank = filterBank || createMelFilterBank(NUM_MEL_FILTERS, fftSize, sampleRate);

  // Apply Mel filter bank
  const melEnergies = new Float32Array(bank.length);
  for (let i = 0; i < bank.length; i++) {
    let energy = 0;
    for (let j = 0; j < Math.min(powerSpectrum.length, bank[i].length); j++) {
      energy += powerSpectrum[j] * bank[i][j];
    }
    melEnergies[i] = Math.max(energy, 1e-10);
  }

  // Log compression
  const logEnergies = new Float32Array(melEnergies.length);
  for (let i = 0; i < melEnergies.length; i++) {
    logEnergies[i] = Math.log(melEnergies[i]);
  }

  // DCT-II (Type 2 Discrete Cosine Transform)
  const mfcc = new Float32Array(NUM_MFCC_COEFFICIENTS);
  const n = logEnergies.length;
  for (let k = 0; k < NUM_MFCC_COEFFICIENTS; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += logEnergies[i] * Math.cos((Math.PI * k * (2 * i + 1)) / (2 * n));
    }
    mfcc[k] = sum * Math.sqrt(2 / n);
  }

  return mfcc;
}

// ── Speaker Embedding & Matching ─────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Blend a new MFCC frame into an existing embedding using exponential moving average.
 */
function blendEmbedding(
  existing: Float32Array,
  newFrame: Float32Array,
  frameCount: number,
  smoothingFactor = 0.95,
): Float32Array {
  const result = new Float32Array(existing.length);
  const alpha = frameCount < 10 ? 1 / (frameCount + 1) : (1 - smoothingFactor);

  for (let i = 0; i < existing.length; i++) {
    result[i] = existing[i] * (1 - alpha) + newFrame[i] * alpha;
  }

  return result;
}

// ── Diarization Engine ──────────────────────────────────────────────────────

/**
 * Speaker Diarization Engine.
 *
 * Maintains a registry of speaker profiles and matches incoming audio
 * frames to known speakers using MFCC-based embeddings.
 */
export class SpeakerDiarizationEngine {
  private profiles = new Map<string, SpeakerProfile>();
  private filterBank: Float32Array[] | null = null;
  private timeline: SpeakerTimelineEntry[] = [];
  private readonly maxTimelineEntries = 1000;
  private lastOverlapCheckUids: string[] = [];

  /** Minimum cosine similarity to consider a match */
  private readonly matchThreshold = 0.75;
  /** Below this threshold, speaker is considered unknown */
  private readonly unknownThreshold = 0.55;

  /**
   * Register a known speaker (from Agora participant list).
   */
  registerSpeaker(uid: string, displayName: string): void {
    if (this.profiles.has(uid)) {
      // Update display name only
      const existing = this.profiles.get(uid)!;
      existing.displayName = displayName;
      return;
    }

    this.profiles.set(uid, {
      uid,
      displayName,
      embedding: new Float32Array(NUM_MFCC_COEFFICIENTS),
      frameCount: 0,
      totalSpeakingMs: 0,
      lastActiveAt: 0,
      identityConfidence: 0,
      isConfirmed: false,
    });
  }

  /**
   * Remove a speaker from the registry (e.g., when they leave the room).
   */
  unregisterSpeaker(uid: string): void {
    this.profiles.delete(uid);
  }

  /**
   * Process an audio frame from a known speaker UID.
   * Builds/refines their voice embedding.
   *
   * @param uid The Agora UID of the speaker
   * @param frequencyData Float32Array of frequency-domain data (from AnalyserNode)
   * @param sampleRate Audio sample rate
   * @param fftSize FFT size used by AnalyserNode
   */
  trainSpeaker(
    uid: string,
    frequencyData: Float32Array,
    sampleRate: number,
    fftSize: number,
  ): void {
    const profile = this.profiles.get(uid);
    if (!profile) return;

    // Convert dB to power spectrum
    const powerSpectrum = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      powerSpectrum[i] = Math.pow(10, frequencyData[i] / 10);
    }

    // Initialize filter bank if needed
    if (!this.filterBank) {
      this.filterBank = createMelFilterBank(NUM_MEL_FILTERS, fftSize, sampleRate);
    }

    const mfcc = extractMFCC(powerSpectrum, sampleRate, fftSize, this.filterBank);

    // Blend into existing embedding
    profile.embedding = blendEmbedding(profile.embedding, mfcc, profile.frameCount);
    profile.frameCount++;
    profile.lastActiveAt = Date.now();
    profile.totalSpeakingMs += 50; // ~50ms per frame

    // Update identity confidence (grows with more frames)
    profile.identityConfidence = Math.min(95, Math.round(
      50 + (profile.frameCount / 100) * 45
    ));
  }

  /**
   * Identify who is speaking from a raw audio frame.
   * Returns the best match among registered speakers.
   *
   * @param frequencyData Float32Array of frequency-domain data
   * @param sampleRate Audio sample rate
   * @param fftSize FFT size
   * @param activeUids Set of UIDs that have non-zero volume (from Agora volume indicator)
   */
  identify(
    frequencyData: Float32Array,
    sampleRate: number,
    fftSize: number,
    activeUids?: Set<string>,
  ): DiarizationResult {
    // Convert to power spectrum
    const powerSpectrum = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      powerSpectrum[i] = Math.pow(10, frequencyData[i] / 10);
    }

    if (!this.filterBank) {
      this.filterBank = createMelFilterBank(NUM_MEL_FILTERS, fftSize, sampleRate);
    }

    const frameMfcc = extractMFCC(powerSpectrum, sampleRate, fftSize, this.filterBank);

    // Score against all registered profiles
    const matchScores: Array<{ uid: string; score: number }> = [];

    for (const [uid, profile] of this.profiles) {
      if (profile.frameCount < 3) continue; // Not enough training data

      const score = cosineSimilarity(frameMfcc, profile.embedding);
      matchScores.push({ uid, score });
    }

    // Sort by score descending
    matchScores.sort((a, b) => b.score - a.score);

    // Determine best match
    const best = matchScores[0];
    const secondBest = matchScores[1];

    // Check for overlap: if multiple UIDs have high volume simultaneously
    const isOverlapping = activeUids ? activeUids.size > 1 : false;

    if (!best || best.score < this.unknownThreshold) {
      return {
        speakerUid: null,
        confidence: 0,
        isUnknown: true,
        isOverlapping,
        matchScores,
      };
    }

    // If active UIDs are provided, prefer the match that's also in the active set
    let selectedUid = best.uid;
    let selectedScore = best.score;

    if (activeUids && activeUids.size > 0 && !activeUids.has(best.uid)) {
      const activeMatch = matchScores.find(m => activeUids.has(m.uid) && m.score > this.unknownThreshold);
      if (activeMatch) {
        selectedUid = activeMatch.uid;
        selectedScore = activeMatch.score;
      }
    }

    const confidence = Math.round(selectedScore * 100);

    // Record in timeline
    const now = Date.now();
    const lastEntry = this.timeline[this.timeline.length - 1];
    if (lastEntry && lastEntry.uid === selectedUid && (now - lastEntry.endTime) < 200) {
      lastEntry.endTime = now;
    } else {
      this.timeline.push({
        uid: selectedUid,
        startTime: now,
        endTime: now,
        confidence,
      });
      if (this.timeline.length > this.maxTimelineEntries) {
        this.timeline.shift();
      }
    }

    return {
      speakerUid: selectedUid,
      confidence,
      isUnknown: selectedScore < this.matchThreshold,
      isOverlapping,
      matchScores,
    };
  }

  /**
   * Get the speaking timeline for the last N minutes.
   */
  getTimeline(windowMs = 5 * 60_000): SpeakerTimelineEntry[] {
    const cutoff = Date.now() - windowMs;
    return this.timeline.filter(e => e.endTime > cutoff);
  }

  /**
   * Get all registered speaker profiles.
   */
  getProfiles(): SpeakerProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get a specific speaker profile.
   */
  getProfile(uid: string): SpeakerProfile | undefined {
    return this.profiles.get(uid);
  }

  /**
   * Get per-speaker speaking time percentage for the given window.
   */
  getSpeakingDistribution(windowMs = 5 * 60_000): Record<string, number> {
    const timeline = this.getTimeline(windowMs);
    const totals: Record<string, number> = {};
    let totalMs = 0;

    for (const entry of timeline) {
      const duration = entry.endTime - entry.startTime;
      totals[entry.uid] = (totals[entry.uid] || 0) + duration;
      totalMs += duration;
    }

    const distribution: Record<string, number> = {};
    if (totalMs > 0) {
      for (const [uid, ms] of Object.entries(totals)) {
        distribution[uid] = Math.round((ms / totalMs) * 100);
      }
    }

    return distribution;
  }

  /**
   * Reset the engine (e.g., when starting a new incident).
   */
  reset(): void {
    this.profiles.clear();
    this.timeline = [];
    this.filterBank = null;
  }
}
