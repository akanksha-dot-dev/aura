# AURA — Canonical Decision Registry (D-001 to D-028)
## Complete Locked Architectural & Strategic Decisions | Post-Transformation Canonical | 2026-09-01

> [!IMPORTANT]
> This registry contains the 28 canonical decisions formulated, researched, and locked across research sessions T1-01 through T1-08, synthesized in `research/SYN-01-FOUNDING-ARCHITECTURE.md`, and upgraded during the First-Principles Hackathon Transformation.
> Every decision includes evidence grades, door classifications (1-Way Irreversible vs. 2-Way Reversible), and clear rationales.

---

## Non-Negotiable Project Constraints

| Constraint | Specification & Boundary |
|---|---|
| **$0 Budget** | Absolute zero spend on external APIs. No paid ElevenLabs/Fly.io/database tiers. All operations fit within Agora & Cloudflare free allocations. |
| **Hosting & Edge Deployment** | Cloudflare Pages with primary domain `aura.akanksha.dev` (stateless edge serverless control plane). |
| **Zero Audio Proxying** | Media streams run 100% peer-to-peer/SD-RTN™ via Agora WebRTC; serverless tier handles only JSON signaling and tokens. |
| **Real-Time Latency Target** | Sub-second voice telemetry and dashboard updates (<100ms RTM, <800ms conversational turn-around). |

---

## Summary Matrix of Locked Decisions (D-001 to D-028)

| D-ID | Area | Chosen Decision | Door | Conf. | Evidence |
|---|---|---|---|---|---|
| **D-001** | Voice Agent Runtime | Agora Conversational AI Engine (Managed Mode) | 🚪 1-way | High | T1-01 §2.1, T1-06 §1.1 `[A]` |
| **D-002** | Multi-Speaker Ingestion | Wildcard `remote_rtc_uids: ["*"]` + `enable_string_uid: true` | 🚪 1-way | High | T1-01 §3.1 `[A]` |
| **D-003** | ASR Provider | Deepgram nova-3 (Managed, free under ConvAI allocation) | 🔄 2-way | High | T1-01 §2.2, T1-06 §1.1 `[A]` |
| **D-004** | LLM Provider | GPT-4.1-mini via Managed Mode (temperature: `0.1`) | 🔄 2-way | High | T1-01 §2.2, T1-03 §4 `[A]` |
| **D-005** | TTS Provider | MiniMax speech-2.8-turbo (Managed Mode, $0 cost) | 🚪 1-way | High | T1-01 §2.2, T1-06 §1.1 `[A]` |
| **D-006** | Primary Hosting | Cloudflare Pages ($0, domain on CF); Vercel fallback | 🔄 2-way | High | T1-07 §1.1, §4.1 `[A]` |
| **D-007** | Dashboard Transport | Agora Signaling RTM 2.x Message Channels (`<100ms`) | 🚪 1-way | High | T1-05 §1.1–1.3 `[A]` |
| **D-008** | Epistemic Schema | 5-type: Fact, Hypothesis, Decision, Action, Conflict | 🚪 1-way | High | T1-03 §2.1, T1-05 §3.1 `[A]` |
| **D-009** | UI Design System | "Operational Calm" — IBM Plex Sans/Mono, warm charcoal, golden amber | 🚪 1-way | High | Anti-Slop Audit `[A]` |
| **D-010** | Demo Narrative | 5-minute payment outage; 40s opening silence; conflict WOW at 1:15; 3-tier failover | 🔄 2-way | Med | T1-04 §7, T1-07 §7.2 `[D]` |
| **D-011** | Tool Architecture | Custom LLM Proxy (`llm.vendor: "custom"`) + MCP Server | 🚪 1-way | High | T1-01 §3.2, T1-06 §3.3 `[A]` |
| **D-012** | Deployment Model | Stateless serverless control plane; zero audio proxying | 🚪 1-way | High | T1-07 §1.3 `[A]` |
| **D-013** | Domain & Branding | `aura.akanksha.dev` with automatic SSL and QR presentation | 🔄 2-way | High | T1-07 §4 `[A]` |
| **D-014** | Token Authentication | Combined RTC+RTM token via `buildTokenWithUserAccount` | 🚪 1-way | High | T1-01 §3.3 `[A]` |
| **D-015** | Channel Topology | Single RTM Message Channel with `customType` discriminator | 🔄 2-way | High | T1-05 §1.3 `[A]` |
| **D-016** | Behavioral Mode | Shadow Monitor Mode default; strict interjection gating | 🚪 1-way | High | T1-03 §1, §6 `[A]` |
| **D-017** | Latency Performance | Sub-second latency via Agora SD-RTN™ (mean ~780ms) | 🔄 2-way | High | T1-05 §2.2, T1-07 §2 `[A/C]` |
| **D-018** | Confidence Cap | Hard programmatic ceiling at 85% on all classifications | 🚪 1-way | High | T1-03 §2.1 `[D]` |
| **D-019** | IC Role Ownership | Agora Signaling RTM Distributed Locks (`acquireLock`) | 🚪 1-way | High | T1-06 §3.6 `[A]` |
| **D-020** | Operational Tiers | Agora Managed Mode primary ($0); Enterprise BYOK extension | 🚪 1-way | High | T1-01 §2, T1-06 §1 `[A]` |
| **D-021** | Platform Identity | Standalone Web Application over Native Agora RTC (V2: Adapters) | 🚪 1-way | High | T1-07 §4, Mentor Review `[Grade A]` |
| **D-022** | Spoken Summary Format | SBAR Protocol (Situation, Background, Assessment, Recommendation) | 🔄 2-way | High | Emergency Medicine CRM `[A]` |
| **D-023** | Action Confirmation | Verbal Readback Protocol after critical decisions & actions | 🔄 2-way | High | Air Traffic Control CRM `[A]` |
| **D-024** | Incident Phase Tracking | OODA Loop Visualization (Observe-Orient-Decide-Act) | 🔄 2-way | High | Boyd Decision Science `[A]` |
| **D-025** | Event Relationships | Causal Graph via `related_to` parameter on logging tools | 🔄 2-way | High | Knowledge Graph Engine `[A]` |
| **D-026** | Hypothesis Lifecycle | Temporal Confidence Decay (confidence decays over time) | 🔄 2-way | High | Bayesian Epistemics `[A]` |
| **D-027** | Cost Visualization | Cost-of-Silence Live Counter ($9,000/min baseline rate) | 🔄 2-way | High | ITIC 2025 Downtime Data `[A]` |
| **D-028** | Proxy Silence Control | `NO_RESPONSE` Token Suppression in Custom LLM Proxy | 🚪 1-way | High | Agora ConvAI Architecture `[A]` |

---

## Detailed Decision Specifications

### D-001: Voice Agent Runtime — Agora Conversational AI Engine (Managed Mode)
- **Choice:** Agora Conversational AI Engine operating in Managed Mode.
- **Door:** 🚪 One-Way (Architecture depends on engine's TEN runtime graph).
- **Rationale:** Integrates ASR, LLM, and TTS with built-in voice activity detection (AIVAD), interruption handling, and SD-RTN edge delivery. Eliminates manual audio piping.
- **Evidence:** T1-01 §2.1, T1-06 §1.1 `[Grade A]`.

### D-002: Multi-Speaker Listening — Wildcard `remote_rtc_uids: ["*"]`
- **Choice:** Wildcard subscription with `enable_string_uid: true`.
- **Door:** 🚪 One-Way (Core voice ingestion model).
- **Rationale:** Subscribes agent to all participants on the RTC bridge. Agora RTC delivers independent audio streams per UID, providing speaker attribution for free without complex acoustic diarization.
- **Risk Mitigation:** If selective attention locking occurs on Day 1, fall back to explicit UID list or server-side mixer bot.
- **Evidence:** T1-01 §3.1 `[Grade A]`.

### D-003: ASR Engine — Deepgram nova-3 (Managed)
- **Choice:** Deepgram nova-3 with `asr.keywords` boosting for incident vocabulary.
- **Door:** 🔄 Two-Way (Can change ASR vendor in start payload).
- **Rationale:** Best-in-class technical terminology recognition (`p99`, `SEV-1`, `Kubernetes`, `rollback`). Zero API keys required under Managed Mode.
- **Evidence:** T1-01 §2.2 `[Grade A]`.

### D-004: LLM Reasoning — Multi-Provider Cascade (Gemini 2.0 Flash / GPT-4o-mini / Agora Managed OpenAI)
- **Choice:** 3-tier automated LLM cascade: (1) Gemini 2.0 Flash via Custom Proxy when `GEMINI_API_KEY` is present; (2) GPT-4o-mini via Custom Proxy when `OPENAI_API_KEY` is present; (3) Agora Managed OpenAI (`gpt-4o-mini`, `credential_mode: 'managed'`) on localhost or as zero-config $0 fallback.
- **Door:** 🔄 Two-Way (Dynamic runtime config at session launch).
- **Rationale:** Guarantees zero friction and zero external tunnels during local development, while leveraging Gemini 2.0 Flash's sub-250ms reasoning speed, massive context window, and superior tool precision in edge production.
- **Evidence:** T1-01 §2.2, T1-03 §4 `[Grade A]`.

### D-005: TTS Engine — MiniMax speech-2.8-turbo (Managed Mode)
- **Choice:** MiniMax speech-2.8-turbo (speed: `0.92`).
- **Door:** 🚪 One-Way (Budget constraint enforcement).
- **Rationale:** ElevenLabs requires a paid tier. MiniMax is included free under Agora's 300 min/mo allocation and delivers an authoritative, calm persona.
- **Evidence:** T1-01 §2.2, T1-06 §1.1 `[Grade A]`.

### D-006: Primary Hosting — Cloudflare Pages with Vercel Fallback
- **Choice:** Cloudflare Pages for primary deployment; Vercel as instant CNAME fallback.
- **Door:** 🔄 Two-Way (DNS CNAME pivot takes <5 min).
- **Rationale:** User's root domain `akanksha.dev` is already hosted on Cloudflare DNS. Cloudflare Pages provides free edge compute and SSL.
- **Evidence:** T1-07 §1.1, §4.1 `[Grade A]`.

### D-007: Real-Time Dashboard Transport — Agora Signaling RTM 2.x
- **Choice:** Agora Signaling RTM 2.x Message Channels (NOT SSE, WebSockets, or polling).
- **Door:** 🚪 One-Way (Frontend state reducer is built around RTM event bus).
- **Rationale:** Sub-100ms in-region latency. RTM is already native to the Agora stack, eliminating secondary real-time transport infrastructure.
- **Evidence:** T1-05 §1.1–1.3 `[Grade A]`.

### D-008: Epistemic Classification Schema — 5-Type Taxonomy
- **Choice:** Categorize all war room speech into `Fact`, `Hypothesis`, `Decision`, `Action`, and `Conflict`.
- **Door:** 🚪 One-Way (Data model and UI rendering spine).
- **Rationale:** Replaces unstructured chat with operational clarity. Directly satisfies Track 4 problem statement.
- **Evidence:** T1-03 §2.1, T1-05 §3.1 `[Grade A]`.

### D-009: UI Design Language — "Operational Calm" Aesthetic
- **Choice:** "Operational Calm" design philosophy — IBM Plex Sans / IBM Plex Mono typography, warm charcoal canvas (`#0C0B0F`), golden amber agent identity (`#D4A853`), semantic epistemic classification tokens, and Motion (`motion/react`) `popLayout` spring physics.
- **Door:** 🚪 One-Way (Design tokens, accessibility contrast, and visual identity).
- **Rationale:** Eliminates generic AI-slop visual cues (Inter/Roboto, cyan/teal accents, blue-black containers). Engineered for information density and cognitive offloading during high-stress 2 AM incident response.
- **Evidence:** Anti-Slop First-Principles Audit `[Grade A]`.

### D-010: Demo Strategy — 5-Minute Vignette + 3-Tier Failover
- **Choice:** Payment outage scenario with 40s opening shadow silence; conflict WOW at 1:15; visible Slack/Jira receipts; Tier 1 live demo, Tier 2 MP4 backup, Tier 3 client replay script.
- **Door:** 🔄 Two-Way.
- **Rationale:** Eliminates dead air risk; delivers maximum impact within judges' short evaluation window.
- **Evidence:** T1-04 §7, T1-07 §7.2 `[Grade D]`.

### D-011: Tool Calling Architecture — Custom LLM Proxy + MCP Server (11 Tools) & Dual-Transport Telemetry
- **Choice:** Custom LLM Proxy (`llm.vendor: "custom"`) as primary gatekeeper; MCP Server (SSE transport) for 11 tools; and real-time bracketed tag parsing in `useAgoraRTM.ts` as the zero-latency in-stream telemetry fallback.
- **Door:** 🚪 One-Way (Core telemetry and action safety plane).
- **Rationale:** Custom Proxy enables programmatic interception for the 2-Phase Action Confirmation flow, while the Dual-Transport protocol guarantees sub-200ms dashboard updates on localhost without external tunnel dependencies.
- **Evidence:** T1-01 §3.2, T1-05 §3.2, T1-06 §3.3 `[Grade A]`.

### D-012: Serverless Plane — Stateless Next.js API Routes
- **Choice:** Serverless Route Handlers (`runtime = 'nodejs'`); media stays 100% on Agora SD-RTN.
- **Door:** 🚪 One-Way.
- **Rationale:** Zero server management overhead, zero egress bandwidth costs, instant scaling.
- **Evidence:** T1-07 §1.3 `[Grade A]`.

### D-013: Domain & Branding — `aura.akanksha.dev`
- **Choice:** Custom subdomain with HTTPS and QR code presentation.
- **Door:** 🔄 Two-Way.
- **Rationale:** Professional credibility signal for evaluators and judges.
- **Evidence:** T1-07 §4 `[Grade A]`.

### D-014: Authentication — Combined RTC+RTM Token Generation
- **Choice:** Server-side `RtcTokenBuilder.buildTokenWithUserAccount` granting both RTC audio and RTM signaling privileges.
- **Door:** 🚪 One-Way (RTC-only tokens fail RTM authentication).
- **Rationale:** Mandatory for multi-modal operation. Secrets remain strictly on backend (`NEXT_PUBLIC_` forbidden).
- **Evidence:** T1-01 §3.3 `[Grade A]`.

### D-015: Channel Topology — Single RTM Channel with Discriminators
- **Choice:** Single channel `incident-{id}` using `customType: "dashboard_event"` vs `"transcript"`.
- **Door:** 🔄 Two-Way.
- **Rationale:** Simplifies subscription lifecycle and minimizes connection overhead.
- **Evidence:** T1-05 §1.3 `[Grade A]`.

### D-016: Behavioral Gating — Shadow Monitor Mode by Default
- **Choice:** AURA remains silent unless directly addressed, conflict detected, conversation loops >90s, or hostile sentiment occurs.
- **Door:** 🚪 One-Way (System prompt directive).
- **Rationale:** Avoids chatty AI fatigue in high-stress war rooms.
- **Evidence:** T1-03 §1, §6 `[Grade A]`.

### D-017: Latency Standard — Sub-Second Total Cascade (~780ms Mean)
- **Choice:** Target 456ms–1157ms voice-to-voice latency via Agora SD-RTN edge routing.
- **Door:** 🔄 Two-Way.
- **Rationale:** Sub-second response feels natural for incident command turn-taking.
- **Evidence:** T1-05 §2.2, T1-07 §2 `[Grade A/C]`.

### D-018: Epistemic Honesty — 85% Programmatic Confidence Cap
- **Choice:** Cap all classification confidence scores at 85%; flag uncorroborated assertions as hypotheses.
- **Door:** 🚪 One-Way (Domain modeling rule).
- **Rationale:** Differentiates AURA from over-confident AI tools; builds trust with senior SREs.
- **Evidence:** T1-03 §2.1 `[Grade D]`.

### D-019: Incident Commander Role — Agora Signaling Distributed Locks
- **Choice:** Use Agora RTM Distributed Locks (`acquireLock`) for atomic IC role claiming.
- **Door:** 🚪 One-Way (RTM primitive integration).
- **Rationale:** Prevents multi-responder authority conflicts and ties Agora platform features directly to SRE incident command protocol.
- **Evidence:** T1-06 §3.6 `[Grade A]`.

### D-020: Operational Tiers — Managed Primary ($0) with Enterprise BYOK
- **Choice:** Default to Agora Managed Mode; position BYOK as enterprise architecture option.
- **Door:** 🚪 One-Way.
- **Rationale:** $0 budget execution for hackathon while demonstrating enterprise commercial viability.
- **Evidence:** T1-01 §2, T1-06 §1 `[Grade A]`.

### D-021: Platform Identity — Standalone Web Application over Native Agora RTC (V2 Platform Adapters)
- **Choice:** Build AURA as a complete, turnkey standalone web application hosted at `aura.akanksha.dev` using native Agora RTC for audio transport. Position external meeting adapters (Google Meet, Microsoft Teams, Zoom) explicitly as V2 roadmap extensions.
- **Door:** 🚪 One-Way (Focuses dev velocity and eliminates third-party platform API failure points).
- **Rationale:** Aligns with mentor guidance: *"Scope your solution to build the backend completely end-to-end first, and make the pluggability your V2 extension."* Eliminates fragile meeting-bot scraping dependencies (e.g. Recall.ai) and ensures 100% native Agora SD-RTN performance and RTM state sync.
- **Evidence:** T1-07 §4, Mentor Review `[Grade A]`.

### D-022: Spoken Summary Format — SBAR Protocol
- **Choice:** Structure all proactive status summaries using SBAR (Situation, Background, Assessment, Recommendation) from emergency medicine.
- **Door:** 🔄 Two-Way (System prompt directive).
- **Rationale:** Standardized crisis communication protocol proven to reduce communication errors by 30%+ in high-stakes environments.
- **Evidence:** Emergency Medicine Crisis Communication Standards `[Grade A]`.

### D-023: Action Confirmation — Verbal Readback Protocol
- **Choice:** Perform verbal readback of all critical decisions and action assignments following Air Traffic Control (ATC) protocols.
- **Door:** 🔄 Two-Way (System prompt directive).
- **Rationale:** Prevents "I thought you said X" misattributions by repeating assignments back to the team for explicit verification.
- **Evidence:** FAA / NASA Aviation Safety Reporting System `[Grade A]`.

### D-024: Incident Phase Tracking — OODA Loop Visualization
- **Choice:** Map the incident's cognitive state progression through the OODA loop (`OBSERVE` → `ORIENT` → `DECIDE` → `ACT` → `RESOLVED`) with automatic classification from event distribution.
- **Door:** 🔄 Two-Way (Client-side state machine).
- **Rationale:** Gives the Incident Commander meta-awareness of the decision cycle velocity (Boyd, 1987).
- **Evidence:** John Boyd Strategic Decision Theory `[Grade A]`.

### D-025: Event Relationships — Causal Graph via `related_to` Field
- **Choice:** Add an optional `related_to: string[]` parameter to all passive logging tool calls to build an in-memory directed event causal graph.
- **Door:** 🔄 Two-Way (Schema extension).
- **Rationale:** Enables both the Force-Directed Incident Topology dashboard view and the Postmortem Evidence Chain forensic graph.
- **Evidence:** Knowledge Graph Engineering Standards `[Grade A]`.

### D-026: Hypothesis Lifecycle — Temporal Confidence Decay
- **Choice:** Implement temporal confidence decay on unverified hypotheses (`Math.min(85, initialConfidence * (1 - elapsedMinutes/10))`).
- **Door:** 🔄 Two-Way (Data model function).
- **Rationale:** Reflects Bayesian epistemics — uncorroborated hypotheses naturally lose plausibility over time, preventing zombie theories from cluttering the war room.
- **Evidence:** Bayesian Epistemic Calibration `[Grade A]`.

### D-027: Cost Visualization — Cost-of-Silence Live Counter
- **Choice:** Real-time dollar counter ticking at `$150/sec` ($9,000/min baseline per ITIC 2025), decelerating upon identification, and stopping upon resolution to show calculated savings.
- **Door:** 🔄 Two-Way (Client component).
- **Rationale:** Converts abstract MTTR statistics into immediate, visceral urgency for judges and responders.
- **Evidence:** ITIC 2025 Global Reliability Survey `[Grade A]`.

### D-028: Proxy Silence Control — `NO_RESPONSE` Token Suppression
- **Choice:** Custom LLM Proxy intercepts `NO_RESPONSE` token emitted during Shadow Monitor Mode and suppresses downstream TTS generation.
- **Door:** 🚪 One-Way (Proxy layer architecture).
- **Rationale:** Ensures true bridge silence without generating empty audio artifacts or pauses.
- **Evidence:** Agora ConvAI Engine TTS Pipe Behavior `[Grade A]`.
