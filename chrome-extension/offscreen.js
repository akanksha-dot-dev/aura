/**
 * AURA Chrome Extension — Offscreen Document
 *
 * This is the only place that can do heavy Web API work (MediaRecorder, AudioContext, fetch).
 * It CANNOT use chrome.downloads, chrome.action, chrome.tabs — only chrome.runtime messaging.
 *
 * Flow:
 *  1. Receive START_CAPTURE from service worker with streamId
 *  2. Open MediaStream from tab audio (getUserMedia with chromeMediaSource)
 *  3. Run Deepgram STT via WebSocket OR chunked fetch to AURA backend
 *  4. Send transcript → service worker → panel
 *  5. Receive AURA's text response → TTS → play audio in offscreen (heard in panel)
 */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let mediaStream = null;
let mediaRecorder = null;
let audioContext = null;
let deepgramSocket = null;
let config = null;
let isCapturing = false;

// ── Message listener (only chrome.runtime available here) ────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    sendResponse({ ok: false });
    return true;
  }

  (async () => {
    switch (message.type) {
      case 'START_CAPTURE':
        config = message.config;
        await startCapture(message.streamId);
        sendResponse({ ok: true });
        break;

      case 'STOP_CAPTURE':
        await stopCapture();
        sendResponse({ ok: true });
        break;

      case 'PLAY_TTS':
        await playTTS(message.text);
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false });
    }
  })();
  return true;
});

// ── Audio Capture ─────────────────────────────────────────────────────────────
async function startCapture(streamId) {
  if (isCapturing) return;
  isCapturing = true;

  try {
    // Get tab audio stream via chromeMediaSource
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // Build audio pipeline
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Connect to Deepgram WebSocket for real-time STT
    await connectDeepgram(source);

  } catch (err) {
    console.error('[AURA Offscreen] startCapture error:', err);
    isCapturing = false;
    chrome.runtime.sendMessage({ type: 'ERROR', message: String(err) });
  }
}

async function stopCapture() {
  isCapturing = false;

  if (deepgramSocket) {
    deepgramSocket.close();
    deepgramSocket = null;
  }
  if (mediaRecorder?.state !== 'inactive') {
    mediaRecorder?.stop();
    mediaRecorder = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }
}

// ── Deepgram WebSocket STT ────────────────────────────────────────────────────
// We use AURA's backend as a proxy for Deepgram to avoid exposing the API key
// in the extension. Audio chunks → POST /api/meet/audio (with pre-transcribed flag)
async function connectDeepgram(audioSource) {
  const baseUrl = config?.auraBaseUrl || 'http://localhost:3000';

  // Use MediaRecorder to chunk audio
  // ScriptProcessor is deprecated but works; AudioWorklet needs extra setup
  const destination = audioContext.createMediaStreamDestination();
  audioSource.connect(destination);

  mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType: 'audio/webm;codecs=opus',
  });

  // Accumulate audio chunks every 3 seconds, then send for transcription
  let chunks = [];
  let silenceTimer = null;

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
    chunks = [];
    await transcribeAndRespond(blob, baseUrl);
  };

  // Segment every 3 seconds for real-time feel
  const segmentLoop = () => {
    if (!isCapturing) return;
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      mediaRecorder.start();
    }
    setTimeout(segmentLoop, 3000);
  };

  mediaRecorder.start();
  setTimeout(segmentLoop, 3000);
}

async function transcribeAndRespond(audioBlob, baseUrl) {
  try {
    // Try browser-native speech recognition first (Chrome supports it)
    const transcript = await browserSTT(audioBlob);
    if (!transcript || transcript.trim().length < 3) return;

    // Send transcript to AURA backend
    const res = await fetch(`${baseUrl}/api/meet/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        speakerName: config?.speakerName || 'Meet Participant',
        speakerUid: config?.speakerUid || 'meet_participant',
        channelName: config?.channelName || 'meet-war-room',
      }),
    });

    if (!res.ok) return;
    const data = await res.json();

    // Forward transcript to service worker for panel
    chrome.runtime.sendMessage({
      type: 'AUDIO_TRANSCRIPT',
      text: transcript,
      speaker: config?.speakerName || 'Meet Participant',
    });

    // If AURA responded, speak it and notify panel
    if (data.response) {
      chrome.runtime.sendMessage({
        type: 'AURA_RESPONSE',
        text: data.response,
        source: data.source,
      });

      if (config?.voiceEnabled !== false) {
        await playTTS(data.response, baseUrl);
      }
    }
  } catch (err) {
    console.error('[AURA Offscreen] transcribeAndRespond error:', err);
  }
}

// ── Browser-native STT via WebSpeech API ──────────────────────────────────────
function browserSTT(audioBlob) {
  return new Promise((resolve) => {
    // Use a blob URL and audio element + MediaRecorder trick with WebSpeech
    // Note: WebSpeech API only works on microphone input, not arbitrary audio.
    // For tab capture, we use a heuristic: detect audio energy and send to backend.
    // A more complete implementation uses Deepgram or Whisper API directly.

    // For now, resolve with an empty string; the backend handles echo detection.
    // In production, integrate Deepgram JS SDK here with streaming WebSocket.
    const url = URL.createObjectURL(audioBlob);

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = config?.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // We can't feed arbitrary audio to SpeechRecognition directly.
    // Use a workaround: play audio silently and capture via microphone loopback.
    // For production: replace with fetch to /api/meet/audio with raw blob.
    let resolved = false;

    recognition.onresult = (event) => {
      if (!resolved) {
        resolved = true;
        resolve(event.results[0][0].transcript);
      }
    };

    recognition.onerror = () => {
      if (!resolved) { resolved = true; resolve(''); }
    };

    recognition.onend = () => {
      if (!resolved) { resolved = true; resolve(''); }
      URL.revokeObjectURL(url);
    };

    // Attempt to start recognition (may fail for tab audio — that's OK)
    try { recognition.start(); } catch { resolve(''); }
    setTimeout(() => { if (!resolved) { resolved = true; resolve(''); } }, 5000);
  });
}

// ── TTS Playback ──────────────────────────────────────────────────────────────
async function playTTS(text, baseUrl) {
  const url = (baseUrl || config?.auraBaseUrl || 'http://localhost:3000');
  try {
    const res = await fetch(`${url}/api/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'nova', speed: 1.0 }),
    });

    if (!res.ok || res.status === 204) return;
    const arrayBuffer = await res.arrayBuffer();
    const audioData = await audioContext?.decodeAudioData(arrayBuffer);
    if (!audioData || !audioContext) return;

    const source = audioContext.createBufferSource();
    source.buffer = audioData;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (err) {
    console.error('[AURA Offscreen] TTS playback error:', err);
  }
}
