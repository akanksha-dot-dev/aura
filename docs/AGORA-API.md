# Agora Conversational AI & Real-Time Platform — Technical Reference
## Extracted from docs.agora.io & Engineering Specifications | Verified 31 Aug 2026

---

## 1. Overview & Architectural Stack

Agora's platform powers AURA across **6 interlocking product families** comprising **13 distinct load-bearing integration touchpoints**:
1. **Agora RTC SDK (SD-RTN™):** Multi-user voice transport (`remote_rtc_uids: ["*"]`, string UIDs) + Edge AI Noise Suppression (AINS).
2. **Conversational AI Engine:** Managed ASR (Deepgram nova-3), LLM (GPT-4.1-mini), and TTS (MiniMax speech-2.8-turbo) on the TEN framework runtime graph.
3. **Signaling (RTM 2.x):** Sub-100ms message channels, Distributed Locks (`acquireLock`), User Presence context injection, and Storage metadata hydration.
4. **Custom LLM Proxy & MCP:** Two-Phase Action Confirmation gatekeeping and MCP tool execution over SSE.
5. **Real-Time Speech Ingestion & Injection:** `/think` REST alert injection and `/speak` direct TTS broadcast.
6. **Compliance Archival:** Cloud Recording (`audio_scenario: "chorus"`) and Standalone STT cross-talk `.vtt` extraction.

---

## 2. Core REST API Endpoints

### Conversational AI Agent Management (`/api/conversational-ai-agent/v2/projects/:appid`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/join` | POST | Launch voice AI agent into RTC channel |
| `/leave` | POST | Terminate voice AI agent session |
| `/update` | POST | Dynamically update prompt/tokens mid-session |
| `/query` | GET | Query agent health and metrics |
| `/list` | GET | List all active agents |
| `/think` | POST | Inject external alert/message mid-sentence |
| `/speak` | POST | Broadcast direct TTS speech bypassing LLM |

### Signaling RTM 2.x Stateless REST API (`/dev/v2/project/:appid/rtm`)

Used by serverless backend route handlers (`lib/rtmPublisher.ts`) to publish dashboard events without maintaining a WebSocket client:

```http
POST https://api.agora.io/dev/v2/project/{appId}/rtm/users/{botUid}/channel_messages
Authorization: Basic {Base64(appKey:appSecret)}
Content-Type: application/json

{
  "destination": "incident-sev1-4821",
  "payload": "{\"customType\":\"dashboard_event\",\"type\":\"fact\",...}"
}
```

### Standalone STT REST API (`/v1/projects/:appid/cloud-recording`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/acquire` | POST | Acquire STT resource token |
| `/start` | POST | Start multi-user stream transcription |
| `/stop` | POST | Stop transcription and generate final `.vtt` |

### Cloud Recording REST API (`/v1/projects/:appid/cloud-recording`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/acquire` | POST | Acquire recording resource |
| `/mode/mix/start` | POST | Start composite audio recording (`audio_scenario: "chorus"`) |
| `/mode/mix/stop` | POST | Stop recording and flush MP4 to storage |

---

## 3. Production Conversational AI Start Configuration

```json
{
  "name": "aura-incident-commander",
  "properties": {
    "channel": "incident-sev1-4821",
    "token": "{{COMBINED_RTC_RTM_TOKEN}}",
    "agent_rtc_uid": "aura_agent",
    "remote_rtc_uids": ["*"],
    "enable_string_uid": true,
    "idle_timeout": 600,
    "advanced_features": {
      "enable_rtm": true,
      "enable_tools": true,
      "enable_aivad": true,
      "enable_bhvs": true
    },
    "parameters": {
      "audio_scenario": "chorus",
      "data_channel": "rtm",
      "enable_metrics": true,
      "enable_error_message": true
    },
    "asr": {
      "credential_mode": "managed",
      "vendor": "deepgram",
      "model": "nova-3",
      "language": "en-US",
      "keywords": [
        { "word": "AURA", "boost": 3 },
        { "word": "rollback", "boost": 2 },
        { "word": "connection pool", "boost": 2 },
        { "word": "p99 latency", "boost": 2 },
        { "word": "Kubernetes", "boost": 1 },
        { "word": "SEV-1", "boost": 2 },
        { "word": "Datadog", "boost": 1 },
        { "word": "PagerDuty", "boost": 1 }
      ]
    },
    "llm": {
      "url": "https://aura.akanksha.dev/api/llm/proxy",
      "api_key": "{{INTERNAL_PROXY_SECRET}}",
      "system_messages": [
        {
          "role": "system",
          "content": "You are AURA, a Voice AI Incident Commander. Maintain Shadow Monitor Mode by default. Intervene on direct address, conflicts, or conversation loops >90s."
        }
      ],
      "greeting_message": "AURA online. Standing by on incident channel.",
      "failure_message": "AURA lost connection to reasoning engine. Standing by.",
      "max_history": 40,
      "params": {
        "model": "gpt-4.1-mini",
        "temperature": 0.1
      },
      "mcp_servers": [
        {
          "name": "aura-incident-mcp",
          "endpoint": "https://aura.akanksha.dev/api/mcp/sse",
          "protocol": "sse",
          "timeout_ms": 4000
        }
      ]
    },
    "tts": {
      "credential_mode": "managed",
      "vendor": "minimax",
      "model": "speech-2.8-turbo",
      "params": {
        "speed": 0.92,
        "pitch": 0
      },
      "skip_patterns": ["\\[.*?\\]", "https?://\\S+"]
    },
    "turn_detection": {
      "type": "agora_vad",
      "interrupt_mode": "append",
      "config": {
        "silence_duration_ms": 800,
        "interrupt_duration_ms": 250
      }
    },
    "filler_words": {
      "enable": true,
      "response_wait_ms": 800,
      "words": [
        "Analyzing incident telemetry...",
        "Cross-referencing database metrics...",
        "Logging action item to timeline..."
      ]
    }
  }
}
```

---

## 4. Client-Side WebRTC Voice & AINS Initialization

```typescript
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { AIDenoiserExtension } from "agora-extension-ai-denoiser";

export class AuraVoiceClient {
  private client: IAgoraRTCClient;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private denoiserExtension: AIDenoiserExtension | null = null;

  constructor() {
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  }

  public async joinIncidentBridge(
    appId: string,
    channelName: string,
    token: string,
    userUid: string,
    onTelemetry: (stats: { uplinkQuality: number; downlinkQuality: number }) => void
  ): Promise<void> {
    // 1. Join RTC channel with string UID
    await this.client.join(appId, channelName, token, userUid);

    // 2. Initialize Edge AI Noise Suppression Extension (AINS)
    this.denoiserExtension = new AIDenoiserExtension({ assetsPath: "/assets/exts/denoiser" });
    AgoraRTC.registerExtensions([this.denoiserExtension]);

    // 3. Create microphone audio track with AEC, AGC, ANS
    this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      AGC: true,
      ANS: true
    });

    // 4. Attach AI denoiser processor
    const processor = this.denoiserExtension.createProcessor();
    await this.localAudioTrack.pipe(processor).pipe(this.localAudioTrack.processorDestination);
    await processor.enable();

    // 5. Publish local microphone track
    await this.client.publish([this.localAudioTrack]);

    // 6. Network quality telemetry
    this.client.on("network-quality", (stats) => {
      onTelemetry({
        uplinkQuality: stats.uplinkNetworkQuality,
        downlinkQuality: stats.downlinkNetworkQuality
      });
    });

    // 7. Subscribe to remote audio streams
    this.client.on("user-published", async (user, mediaType) => {
      await this.client.subscribe(user, mediaType);
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    });
  }

  public async leave(): Promise<void> {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
    }
    await this.client.leave();
  }
}
```

---

## 5. Free-Tier Budget Allocations

| Service Layer | Free Allocation | AURA Hackathon Consumption | Net Cost |
|---|---|---|---|
| **Agora Conversational AI** | 300 min/mo free | ~40–60 min total | **$0.00** |
| **Agora RTC Audio** | 10,000 min/mo free | ~120 min multi-user | **$0.00** |
| **Agora Signaling (RTM 2.x)** | Free tier PCU | <10 concurrent users | **$0.00** |
| **Deepgram nova-3 (ASR)** | Included in ConvAI | Zero API key needed | **$0.00** |
| **GPT-4.1-mini (LLM)** | Included in ConvAI | Zero API key needed | **$0.00** |
| **MiniMax 2.8-turbo (TTS)** | Included in ConvAI | Zero API key needed | **$0.00** |
| **Cloudflare Pages & Workers** | Unlimited free requests | Static assets + API routes | **$0.00** |
| **Total Project Cost** | — | — | **$0.00** |

