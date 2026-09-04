# AURA — Voice AI Incident Commander

Real-time Voice AI Incident Commander that joins live IT war rooms as an active voice participant over Agora SD-RTN™ and Conversational AI Engine.

Deployed at: [aura.akanksha.dev](https://aura.akanksha.dev)

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Voice & Real-Time:** Agora RTC SDK (WebRTC), Agora Conversational AI Engine, Agora Signaling (RTM 2.x)
- **Animation & Physics:** Motion (`motion/react`)
- **Visuals:** Vanilla CSS Design System ("Operational Calm"), D3-Force (`d3-force`)
- **Testing:** Vitest, React Testing Library, JSDOM
- **Type Safety:** TypeScript 5, Zod

---

## Getting Started

### Prerequisites

- Node.js 20+
- Agora Developer Account (App ID, Certificate, Customer REST Key/Secret)

### Environment Setup

Copy `.env.example` to `.env.local` and populate credentials:

```bash
cp .env.example .env.local
```

Required environment variables:
```bash
# Agora RTC & RTM Configuration
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_CUSTOMER_KEY=your_agora_customer_key
AGORA_CUSTOMER_SECRET=your_agora_customer_secret

# Agora Conversational AI Agent ID
NEXT_PUBLIC_AGORA_AGENT_ID=your_agora_agent_id

# Optional Integrations
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Testing & Quality Assurance

### Run Automated Test Suite

AURA features comprehensive unit, component, API route, and integration test suites:

```bash
npm test
```

To run tests in interactive watch mode:
```bash
npm run test:watch
```

### Production Build

```bash
npm run build
```

---

## License

MIT
