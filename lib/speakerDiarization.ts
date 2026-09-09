/**
 * speakerDiarization.ts — Client-side speaker diarization engine for AURA.
 *
 * Provides real-time speaker identification and separation using:
 * 1. Enhanced MFCC Feature Extraction — 20 Mel-Frequency Cepstral Coefficients (up from 13)
 * 2. Delta + Delta-Delta Features — First & second derivatives for temporal dynamics
 * 3. Spectral Contrast — Voice texture distinction across frequency sub-bands
 * 4. Speaker Embedding — 66-dimensional compact vector fingerprint per speaker
 * 5. Cosine Similarity Matching — Maps audio segments to known speakers
 * 6. Voice Enrollment — High-confidence calibration from spoken phrase
 * 7. Embedding Persistence — Serialize/deserialize for cross-session recognition
 * 8. Per-Track Identification — Leverages Agora's separate audio streams per user
 * 9. Multi-Speaker Overlap Resolution — Identifies dominant + secondary speakers
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpeakerProfile {
  uid: string;
  displayName: string;
  /** Full embedding vector (MFCC + delta + delta-delta + spectral contrast) */
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
  /** Whether this speaker completed voice enrollment */
  isEnrolled: boolean;
  /** Role in the incident (for priority speaker logic) */
  role: string;
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
  /** Secondary speaker during overlap (if detected) */
  secondarySpeakerUid: string | null;
  /** Confidence of secondary speaker match */
  secondaryConfidence: number;
}

export interface SpeakerTimelineEntry {
  uid: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

/** Serializable embedding for database persistence */
export interface SerializedEmbedding {
  uid: string;
  displayName: string;
  embedding: number[];
  frameCount: number;
  identityConfidence: number;
  isEnrolled: boolean;
  role: string;
  serializedAt: number;
}

/** Result of a voice enrollment calibration */
export interface EnrollmentResult {
  success: boolean;
  confidence: number;
  framesCaptured: number;
  message: string;
}

// ── Enhanced MFCC Feature Extraction ─────────────────────────────────────────

/** Increased from 13 to 20 for better speaker discrimination */
const NUM_MFCC_COEFFICIENTS = 20;
/** Spectral contrast computed across 6 sub-bands → 6 values */
const NUM_SPECTRAL_CONTRAST_BANDS = 6;
/**
 * Total embedding dimensionality:
 * 20 MFCC + 20 delta-MFCC + 20 delta-delta-MFCC + 6 spectral contrast = 66
 */
const EMBEDDING_DIM = NUM_MFCC_COEFFICIENTS * 3 + NUM_SPECTRAL_CONTRAST_BANDS;

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

/**
 * Extract spectral contrast features across sub-bands.
 *
 * Spectral contrast measures the difference between peaks and valleys
 * in each sub-band, capturing voice texture characteristics.
 */
export function extractSpectralContrast(
  powerSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  numBands: number = NUM_SPECTRAL_CONTRAST_BANDS,
): Float32Array {
  const contrast = new Float32Array(numBands);
  const binCount = powerSpectrum.length;
  const binWidth = sampleRate / fftSize;

  // Define sub-band boundaries (logarithmically spaced)
  const bandEdges = [0, 200, 400, 800, 1600, 3200, 8000].map(
    f => Math.min(binCount - 1, Math.floor(f / binWidth))
  );

  for (let b = 0; b < numBands && b + 1 < bandEdges.length; b++) {
    const startBin = bandEdges[b];
    const endBin = bandEdges[b + 1];
    if (endBin <= startBin) continue;

    // Collect power values in this band
    const bandValues: number[] = [];
    for (let i = startBin; i <= endBin && i < binCount; i++) {
      bandValues.push(powerSpectrum[i]);
    }

    if (bandValues.length === 0) continue;

    // Sort to find peaks (top 20%) and valleys (bottom 20%)
    bandValues.sort((a, b) => a - b);
    const bottomCount = Math.max(1, Math.floor(bandValues.length * 0.2));
    const topCount = Math.max(1, Math.floor(bandValues.length * 0.2));

    let valleySum = 0;
    for (let i = 0; i < bottomCount; i++) valleySum += bandValues[i];
    const valleyMean = valleySum / bottomCount;

    let peakSum = 0;
    for (let i = bandValues.length - topCount; i < bandValues.length; i++) peakSum += bandValues[i];
    const peakMean = peakSum / topCount;

    // Contrast = log(peak / valley)
    const safeValley = Math.max(valleyMean, 1e-10);
    contrast[b] = Math.log(Math.max(peakMean, 1e-10) / safeValley);
  }

  return contrast;
}

// ── Speaker Embedding & Matching ─────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
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
  const len = Math.min(existing.length, newFrame.length);
  const result = new Float32Array(existing.length);
  const alpha = frameCount < 10 ? 1 / (frameCount + 1) : (1 - smoothingFactor);

  for (let i = 0; i < len; i++) {
    result[i] = existing[i] * (1 - alpha) + newFrame[i] * alpha;
  }

  return result;
}

/**
 * Build the full 66-dimensional feature vector from MFCC + delta + spectral contrast.
 */
function buildFullFeatureVector(
  currentMfcc: Float32Array,
  prevMfcc: Float32Array | null,
  prevPrevMfcc: Float32Array | null,
  spectralContrast: Float32Array,
): Float32Array {
  const features = new Float32Array(EMBEDDING_DIM);
  let offset = 0;

  // 1. MFCC coefficients (20 dims)
  for (let i = 0; i < NUM_MFCC_COEFFICIENTS; i++) {
    features[offset++] = currentMfcc[i];
  }

  // 2. Delta MFCC — first-order derivatives (20 dims)
  for (let i = 0; i < NUM_MFCC_COEFFICIENTS; i++) {
    features[offset++] = prevMfcc ? (currentMfcc[i] - prevMfcc[i]) : 0;
  }

  // 3. Delta-delta MFCC — second-order derivatives (20 dims)
  if (prevMfcc && prevPrevMfcc) {
    for (let i = 0; i < NUM_MFCC_COEFFICIENTS; i++) {
      const deltaCurrent = currentMfcc[i] - prevMfcc[i];
      const deltaPrev = prevMfcc[i] - prevPrevMfcc[i];
      features[offset++] = deltaCurrent - deltaPrev;
    }
  } else {
    offset += NUM_MFCC_COEFFICIENTS;
  }

  // 4. Spectral contrast (6 dims)
  for (let i = 0; i < NUM_SPECTRAL_CONTRAST_BANDS; i++) {
    features[offset++] = i < spectralContrast.length ? spectralContrast[i] : 0;
  }

  return features;
}

// ── Diarization Engine ──────────────────────────────────────────────────────

/**
 * Enhanced Speaker Diarization Engine.
 *
 * Maintains a registry of speaker profiles and matches incoming audio
 * frames to known speakers using 66-dimensional embeddings (MFCC + delta
 * + delta-delta + spectral contrast).
 *
 * Supports voice enrollment, embedding persistence, per-track identification,
 * and multi-speaker overlap resolution.
 */
export class SpeakerDiarizationEngine {
  private profiles = new Map<string, SpeakerProfile>();
  private filterBank: Float32Array[] | null = null;
  private timeline: SpeakerTimelineEntry[] = [];
  private readonly maxTimelineEntries = 1000;

  /** Per-speaker MFCC history for delta computation */
  private prevMfcc = new Map<string, Float32Array>();
  private prevPrevMfcc = new Map<string, Float32Array>();

  /** Enrollment calibration buffers */
  private enrollmentBuffers = new Map<string, Float32Array[]>();

  /** Minimum cosine similarity to consider a match */
  private readonly matchThreshold = 0.75;
  /** Below this threshold, speaker is considered unknown */
  private readonly unknownThreshold = 0.55;
  /** Enrolled speakers get a lower threshold (better embeddings) */
  private readonly enrolledMatchThreshold = 0.70;
  private readonly enrolledUnknownThreshold = 0.50;

  /**
   * Register a known speaker (from Agora participant list).
   */
  registerSpeaker(uid: string, displayName: string, role = 'participant'): void {
    if (this.profiles.has(uid)) {
      // Update display name and role only
      const existing = this.profiles.get(uid)!;
      existing.displayName = displayName;
      existing.role = role;
      return;
    }

    this.profiles.set(uid, {
      uid,
      displayName,
      embedding: new Float32Array(EMBEDDING_DIM),
      frameCount: 0,
      totalSpeakingMs: 0,
      lastActiveAt: 0,
      identityConfidence: 0,
      isConfirmed: false,
      isEnrolled: false,
      role,
    });
  }

  /**
   * Remove a speaker from the registry (e.g., when they leave the room).
   */
  unregisterSpeaker(uid: string): void {
    this.profiles.delete(uid);
    this.prevMfcc.delete(uid);
    this.prevPrevMfcc.delete(uid);
    this.enrollmentBuffers.delete(uid);
  }

  // ── Voice Enrollment ─────────────────────────────────────────────────────

  /**
   * Start enrollment calibration for a speaker.
   * The speaker should say a calibration phrase (e.g., "My name is X, I'm the Y role").
   */
  startEnrollment(uid: string): void {
    this.enrollmentBuffers.set(uid, []);
  }

  /**
   * Feed an audio frame during enrollment. Call this at ~50ms intervals while
   * the speaker is saying their calibration phrase.
   *
   * @returns Progress (0-100) — 100 = enough frames collected
   */
  feedEnrollmentFrame(
    uid: string,
    frequencyData: Float32Array,
    sampleRate: number,
    fftSize: number,
  ): number {
    const buffer = this.enrollmentBuffers.get(uid);
    if (!buffer) return 0;

    if (!this.filterBank) {
      this.filterBank = createMelFilterBank(NUM_MEL_FILTERS, fftSize, sampleRate);
    }

    // Convert dB to power spectrum
    const powerSpectrum = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      powerSpectrum[i] = Math.pow(10, frequencyData[i] / 10);
    }

    const mfcc = extractMFCC(powerSpectrum, sampleRate, fftSize, this.filterBank);
    const contrast = extractSpectralContrast(powerSpectrum, sampleRate, fftSize);

    // Build full feature vector (use previous frames for delta)
    const prevFrames = buffer.length >= 1 ? buffer[buffer.length - 1] : null;
    const prevPrevFrames = buffer.length >= 2 ? buffer[buffer.length - 2] : null;
    // For enrollment, we store simplified MFCC-only and build full features from the buffer
    const fullFeature = buildFullFeatureVector(
      mfcc,
      prevFrames ? prevFrames.slice(0, NUM_MFCC_COEFFICIENTS) : null,
      prevPrevFrames ? prevPrevFrames.slice(0, NUM_MFCC_COEFFICIENTS) : null,
      contrast,
    );

    buffer.push(fullFeature);

    // Need ~60 frames (~3 seconds at 50ms/frame) for good enrollment
    const TARGET_FRAMES = 60;
    return Math.min(100, Math.round((buffer.length / TARGET_FRAMES) * 100));
  }

  /**
   * Finish enrollment and build the high-confidence embedding.
   * Averages all collected frames for a stable embedding.
   */
  finishEnrollment(uid: string): EnrollmentResult {
    const buffer = this.enrollmentBuffers.get(uid);
    const profile = this.profiles.get(uid);

    if (!buffer || !profile) {
      return { success: false, confidence: 0, framesCaptured: 0, message: 'Speaker not found or enrollment not started.' };
    }

    if (buffer.length < 20) {
      return { success: false, confidence: 0, framesCaptured: buffer.length, message: 'Not enough audio captured. Please speak for at least 2 seconds.' };
    }

    // Average all frames to create a stable embedding
    const avgEmbedding = new Float32Array(EMBEDDING_DIM);
    for (const frame of buffer) {
      for (let i = 0; i < Math.min(frame.length, EMBEDDING_DIM); i++) {
        avgEmbedding[i] += frame[i];
      }
    }
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      avgEmbedding[i] /= buffer.length;
    }

    profile.embedding = avgEmbedding;
    profile.frameCount = buffer.length;
    profile.isEnrolled = true;
    profile.isConfirmed = true;
    profile.identityConfidence = Math.min(98, 70 + Math.round((buffer.length / 60) * 28));

    this.enrollmentBuffers.delete(uid);

    return {
      success: true,
      confidence: profile.identityConfidence,
      framesCaptured: buffer.length,
      message: `Voice enrollment complete for ${profile.displayName}. Confidence: ${profile.identityConfidence}%`,
    };
  }

  /**
   * Cancel an in-progress enrollment.
   */
  cancelEnrollment(uid: string): void {
    this.enrollmentBuffers.delete(uid);
  }

  /**
   * Check if enrollment is in progress for a speaker.
   */
  isEnrolling(uid: string): boolean {
    return this.enrollmentBuffers.has(uid);
  }

  // ── Embedding Persistence ────────────────────────────────────────────────

  /**
   * Serialize a speaker's embedding for database persistence.
   */
  serializeEmbedding(uid: string): SerializedEmbedding | null {
    const profile = this.profiles.get(uid);
    if (!profile || profile.frameCount < 10) return null;

    return {
      uid: profile.uid,
      displayName: profile.displayName,
      embedding: Array.from(profile.embedding),
      frameCount: profile.frameCount,
      identityConfidence: profile.identityConfidence,
      isEnrolled: profile.isEnrolled,
      role: profile.role,
      serializedAt: Date.now(),
    };
  }

  /**
   * Serialize all speaker embeddings.
   */
  serializeAllEmbeddings(): SerializedEmbedding[] {
    const results: SerializedEmbedding[] = [];
    for (const uid of this.profiles.keys()) {
      const serialized = this.serializeEmbedding(uid);
      if (serialized) results.push(serialized);
    }
    return results;
  }

  /**
   * Restore a speaker's embedding from a serialized form.
   * Used to recognize returning participants across sessions.
   */
  deserializeEmbedding(data: SerializedEmbedding): void {
    const embedding = new Float32Array(data.embedding);
    this.profiles.set(data.uid, {
      uid: data.uid,
      displayName: data.displayName,
      embedding,
      frameCount: data.frameCount,
      totalSpeakingMs: 0,
      lastActiveAt: 0,
      identityConfidence: Math.max(data.identityConfidence - 10, 50), // Slight decay for loaded embeddings
      isConfirmed: data.isEnrolled,
      isEnrolled: data.isEnrolled,
      role: data.role,
    });
  }

  /**
   * Try to match an audio frame against stored embeddings to auto-identify
   * a returning participant before they register.
   */
  tryAutoIdentify(
    frequencyData: Float32Array,
    sampleRate: number,
    fftSize: number,
  ): { matchedUid: string | null; confidence: number } {
    const result = this.identify(frequencyData, sampleRate, fftSize);
    if (result.speakerUid && result.confidence > 70 && !result.isUnknown) {
      return { matchedUid: result.speakerUid, confidence: result.confidence };
    }
    return { matchedUid: null, confidence: 0 };
  }

  // ── Training & Identification ────────────────────────────────────────────

  /**
   * Process an audio frame from a known speaker UID.
   * Builds/refines their voice embedding using full feature vector.
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
    const contrast = extractSpectralContrast(powerSpectrum, sampleRate, fftSize);

    // Get previous MFCC frames for delta computation
    const prevMfcc = this.prevMfcc.get(uid) || null;
    const prevPrevMfcc = this.prevPrevMfcc.get(uid) || null;

    // Build 66-dimensional feature vector
    const fullFeature = buildFullFeatureVector(mfcc, prevMfcc, prevPrevMfcc, contrast);

    // Update MFCC history
    if (prevMfcc) this.prevPrevMfcc.set(uid, prevMfcc);
    this.prevMfcc.set(uid, new Float32Array(mfcc));

    // Blend into existing embedding (skip for enrolled speakers with high confidence)
    if (profile.isEnrolled && profile.identityConfidence > 90) {
      // For enrolled speakers, use very slow blending to maintain enrollment quality
      profile.embedding = blendEmbedding(profile.embedding, fullFeature, profile.frameCount, 0.99);
    } else {
      profile.embedding = blendEmbedding(profile.embedding, fullFeature, profile.frameCount);
    }

    profile.frameCount++;
    profile.lastActiveAt = Date.now();
    profile.totalSpeakingMs += 50; // ~50ms per frame

    // Update identity confidence (grows with more frames)
    if (!profile.isEnrolled) {
      profile.identityConfidence = Math.min(95, Math.round(
        50 + (profile.frameCount / 100) * 45
      ));
    }
  }

  /**
   * Identify who is speaking from a raw audio frame.
   * Returns the best match among registered speakers.
   * Enhanced with secondary speaker detection for overlapping speech.
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
    const frameContrast = extractSpectralContrast(powerSpectrum, sampleRate, fftSize);

    // Build full feature vector for matching (use global prev frames if no per-speaker context)
    const fullFeature = buildFullFeatureVector(frameMfcc, null, null, frameContrast);

    // Score against all registered profiles
    const matchScores: Array<{ uid: string; score: number }> = [];

    for (const [uid, profile] of this.profiles) {
      if (profile.frameCount < 3) continue; // Not enough training data

      const score = cosineSimilarity(fullFeature, profile.embedding);
      matchScores.push({ uid, score });
    }

    // Sort by score descending
    matchScores.sort((a, b) => b.score - a.score);

    // Determine best match
    const best = matchScores[0];
    const secondBest = matchScores[1];

    // Check for overlap: if multiple UIDs have high volume simultaneously
    const isOverlapping = activeUids ? activeUids.size > 1 : false;

    // Determine thresholds based on enrollment status
    const bestProfile = best ? this.profiles.get(best.uid) : null;
    const unknownThreshold = bestProfile?.isEnrolled ? this.enrolledUnknownThreshold : this.unknownThreshold;
    const matchThreshold = bestProfile?.isEnrolled ? this.enrolledMatchThreshold : this.matchThreshold;

    if (!best || best.score < unknownThreshold) {
      return {
        speakerUid: null,
        confidence: 0,
        isUnknown: true,
        isOverlapping,
        matchScores,
        secondarySpeakerUid: null,
        secondaryConfidence: 0,
      };
    }

    // If active UIDs are provided, prefer the match that's also in the active set
    let selectedUid = best.uid;
    let selectedScore = best.score;

    if (activeUids && activeUids.size > 0 && !activeUids.has(best.uid)) {
      const activeMatch = matchScores.find(m => activeUids.has(m.uid) && m.score > unknownThreshold);
      if (activeMatch) {
        selectedUid = activeMatch.uid;
        selectedScore = activeMatch.score;
      }
    }

    const confidence = Math.round(selectedScore * 100);

    // Detect secondary speaker during overlap
    let secondarySpeakerUid: string | null = null;
    let secondaryConfidence = 0;
    if (isOverlapping && secondBest && secondBest.score > unknownThreshold) {
      secondarySpeakerUid = secondBest.uid;
      secondaryConfidence = Math.round(secondBest.score * 100);
    }

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
      isUnknown: selectedScore < matchThreshold,
      isOverlapping,
      matchScores,
      secondarySpeakerUid,
      secondaryConfidence,
    };
  }

  /**
   * Identify a speaker from their isolated Agora audio track.
   * More accurate than mixed-audio identification because each remote user
   * has a separate audio stream in Agora RTC.
   *
   * @param uid Agora UID of the remote user whose track this is
   * @param frequencyData Frequency data from the user's dedicated AnalyserNode
   * @param sampleRate Audio sample rate
   * @param fftSize FFT size
   */
  identifyFromSeparateTrack(
    uid: string,
    frequencyData: Float32Array,
    sampleRate: number,
    fftSize: number,
  ): { isMatch: boolean; confidence: number } {
    const profile = this.profiles.get(uid);
    if (!profile || profile.frameCount < 3) {
      // Auto-train if we know who this is (Agora gives us per-user tracks)
      this.trainSpeaker(uid, frequencyData, sampleRate, fftSize);
      return { isMatch: true, confidence: 60 };
    }

    const powerSpectrum = new Float32Array(frequencyData.length);
    for (let i = 0; i < frequencyData.length; i++) {
      powerSpectrum[i] = Math.pow(10, frequencyData[i] / 10);
    }

    if (!this.filterBank) {
      this.filterBank = createMelFilterBank(NUM_MEL_FILTERS, fftSize, sampleRate);
    }

    const mfcc = extractMFCC(powerSpectrum, sampleRate, fftSize, this.filterBank);
    const contrast = extractSpectralContrast(powerSpectrum, sampleRate, fftSize);
    const prevMfcc = this.prevMfcc.get(uid) || null;
    const prevPrevMfcc = this.prevPrevMfcc.get(uid) || null;
    const fullFeature = buildFullFeatureVector(mfcc, prevMfcc, prevPrevMfcc, contrast);

    const score = cosineSimilarity(fullFeature, profile.embedding);
    const confidence = Math.round(score * 100);

    // Also train as we identify (continuous learning)
    this.trainSpeaker(uid, frequencyData, sampleRate, fftSize);

    return {
      isMatch: score > (profile.isEnrolled ? this.enrolledUnknownThreshold : this.unknownThreshold),
      confidence,
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
   * Get the embedding dimensionality (for UI display).
   */
  getEmbeddingDim(): number {
    return EMBEDDING_DIM;
  }

  /**
   * Reset the engine (e.g., when starting a new incident).
   */
  reset(): void {
    this.profiles.clear();
    this.timeline = [];
    this.filterBank = null;
    this.prevMfcc.clear();
    this.prevPrevMfcc.clear();
    this.enrollmentBuffers.clear();
  }
}
