# AURA — Developer Testing & QA Guide

This guide covers both **automated verification** and **hands-on manual testing** for the AURA Voice AI Incident Commander.

---

## 1. Automated Test Suite (CI & Pre-Commit)

AURA maintains 100% test coverage across schemas, reducers, API endpoints, and UI components using Vitest, React Testing Library, and JSDOM.

```bash
# Run all 26 test suites (142 tests)
npm test

# Run tests in interactive watch mode
npm run test:watch

# TypeScript type check
npx tsc --noEmit

# ESLint verification
npm run lint

# Production bundle build
npm run build
```

> **Quality Gate:** All 4 commands must pass with exit code `0` before committing any code changes.

---

## 2. Fast Local Testing: Mock Replay Mode ($0 / No Keys Required)

You do **not** need Agora credentials to develop or test the UI flight deck. AURA includes an in-browser simulation engine ([`lib/mockReplay.ts`](file:///lib/mockReplay.ts)) that replays a full SEV-1 incident lifecycle with synthetic Web Speech audio.

### How to Run:
1. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000/lobby`.
3. Select any persona (e.g., **Sarah Chen**).
4. Click **"Start Demo (Mock Replay)"** or join the bridge without `.env.local` Agora keys.

### What to Verify:
- **Timeline Feed:** Facts, hypotheses, decisions, and action items render with correct category colors.
- **Topology Graph:** D3 force nodes animate into place as services and evidence are logged.
- **Conflict Arbitration:** Crimson Conflict Banner slides in when contradictory root causes are proposed.
- **Resolution Flow:** Clicking **Resolve Incident** opens the Google SRE Postmortem modal with full causal chain SVG visualization and Markdown export.

---

## 3. Live Voice Bridge Testing (With Agora Credentials)

To test real-time microphone capture, Agora WebRTC audio, and ConvAI voice responses:

### Prerequisites (`.env.local`):
```bash
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate
AGORA_CUSTOMER_KEY=your_rest_key
AGORA_CUSTOMER_SECRET=your_rest_secret
```

### Verification Steps:
1. **Microphone Authorization:**
   - Open `http://localhost:3000` in Chrome or Edge.
   - Click **"Join Incident Bridge"**. Allow microphone access when prompted.
   - Verify that the status bar displays `RTC: CONNECTED` and the volume indicator bounces when you speak.
2. **AURA Voice Interjection & Barge-In:**
   - Say aloud: *"Sarah reporting: checkout service latency just spiked to 450 milliseconds."*
   - Verify AURA logs a Mint-emerald Fact card silently and speaks a concise confirmation.
   - **Barge-In:** Speak over AURA while it is talking; verify AURA immediately stops speaking and listens.
3. **Silent Telemetry Sync:**
   - Say: *"Logging hypothesis: external payment gateway is rate limiting our requests."*
   - Verify AURA emits a bracket tag (`[LOG_HYPOTHESIS: ...]`), which the dashboard parses in <200ms to render an Amber Hypothesis card before AURA finishes speaking.

---

## 4. Multi-Speaker Bridge Testing (Multi-Persona)

To test multi-responder arbitration and perspective switching:

1. **Tab 1 (Incident Commander):** Open `http://localhost:3000` and join as **Sarah Chen** (`sarah_ic`).
2. **Tab 2 (Senior SRE):** Open `http://localhost:3000` in an Incognito window and join as **Marcus Vance** (`marcus_sre`).
3. **Verify Speaker Panel:** Both participants appear in the left-hand Speaker Panel with live volume meters.
4. **Test Facilitation Mode:**
   - In Tab 2, state a theory: *"Marcus here. I think it's the database connection pool."*
   - In Tab 1, state a conflict: *"Sarah here. CloudWatch shows ALB SSL timeout, not database."*
   - Verify AURA interjects to arbitrate: *"Contradiction detected between DB pool and ALB SSL timeout. What single metric distinguishes them?"*

---

## 5. Audio & Browser Gotchas

- **Click-to-Unlock Audio:** Modern browsers block audio playback until user interaction. Always click **"Join Incident Bridge"** to unlock the browser's `AudioContext`.
- **Windows Chromium Mic Contention:** Do not run offline Web Speech API concurrently with WebRTC microphone capture (`useAgoraRTC`). The Web Speech API is automatically gated to stand down when the RTC bridge is active (`isJoined === true`).
- **Headphone Recommendation:** When testing live full-duplex voice, wear headphones or ensure your operating system's acoustic echo cancellation (AEC) is enabled to prevent feedback loops.
