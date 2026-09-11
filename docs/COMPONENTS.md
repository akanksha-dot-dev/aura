# AURA — Component Catalog
## Every UI Component | Exact Props, Behavior, CSS, Accessibility
## "Operational Calm" Design System Implementation

> [!IMPORTANT]
> This document specifies EVERY visual component in the AURA Command Center Dashboard.
> Each component includes: exact TypeScript interface, visual specification, behavior rules,
> CSS class names, and accessibility requirements. A developer implements EXACTLY what is
> described — no creative interpretation needed.

---

## Component Index

| # | Component | Grid Area | Always Visible | Description |
|---|---|---|---|---|
| 1 | `StatusBar` | `status` | ✅ | Top bar: title, severity, OODA phase, cost counter, IC lock, timer |
| 2 | `SpeakerPanel` | `speakers` | ✅ | Left column: responder roster with voice indicators |
| 3 | `ConflictBanner` | `conflict` | ⚠️ Conditional | Sticky red banner when conflict is active |
| 4 | `MainView` | `main` | ✅ | Tab container: TimelineFeed OR IncidentTopology |
| 5 | `TimelineFeed` | inside MainView | ✅ (tab) | Chronological event cards |
| 6 | `TimelineCard` | inside TimelineFeed | ✅ | Individual classified event card |
| 7 | `IncidentTopology` | inside MainView | ✅ (tab) | Force-directed event graph |
| 8 | `ActionTracker` | `actions` | ✅ | Right column: checkable task list |
| 9 | `IncidentStats` | `stats` | ✅ | Right column bottom: count summary |
| 10 | `NarrativeBar` | `narrative` | ✅ | Bottom bar: tension sparkline + OODA detail |
| 11 | `LiveCaptions` | `captions` | ✅ | Bottom strip: real-time speech transcript |
| 12 | `PostmortemModal` | overlay | ❌ On trigger | Full incident report modal |
| 13 | `TranscriptDrawer` | overlay | ❌ On toggle | Slide-out full transcript |
| 14 | `AgoraAnalyticsOverlay` | floating | ✅ | Bottom-right: connection quality metrics |
| 15 | `LobbyScreen` | full page | ✅ (lobby route) | Pre-join persona selection |
| 16 | `CostCounter` | inside StatusBar | ✅ | Live dollar counter |
| 17 | `OODA Phase Bar` | inlined in StatusBar | ✅ | OBSERVE → ORIENT → DECIDE → ACT phase bar |
| 18 | `CognitiveLoadMeter` | inside SpeakerPanel | ✅ | Sweller CLT cognitive load gauge (0-100) |
| 19 | `TempoIndicator` | inside SpeakerPanel | ✅ | 5-dot pulse rate and war room cadence indicator |
| 20 | `SilenceCounter` | inside SpeakerPanel | ✅ | Smart silence duration monitoring timer |
| 21 | `VoiceBadge` | inside SpeakerPanel/Timeline | ✅ | Speaker avatar badge with active voice pulse ring |
| 22 | `SmartPlaybook` | inside MainView | ✅ (tab) | Scenario runbook steps with progress tracking |
| 23 | `ResolveIncidentModal` | overlay | ❌ On trigger | Incident resolution & root cause categorization |
| 24 | `SimilarIncidentBanner` | banner | ⚠️ Conditional | Historical incident matching & fix tips |
| 25 | `WarRoomInvite` | overlay | ❌ On trigger | Engineer war room invitation modal & QR code |
| 26 | `KeyboardShortcutsModal` | overlay | ❌ On trigger | Hotkey cheatsheet (? key) |
| 27 | `QuickCapture` | overlay | ❌ On trigger | Cmd+K fast-logging command bar |
| 28 | `AnalyticsDashboard` | inside MainView | ✅ (tab) | Deep MTTR metrics & operational charts |
| 29 | `NotificationToast` | toast | ⚠️ Ephemeral | Epistemic state change notifications |
| 30 | `WarRoomSummaryCard` | floating | ⚠️ Ephemeral | Floating summary chip in bottom-right corner |
| 31 | `ErrorBoundary` | root wrapper | ✅ | React crash guard & diagnostic fallback |

---

## 1. StatusBar

```typescript
interface StatusBarProps {
  incidentTitle: string;         // e.g., "Payment Service Checkout Outage"
  severity: Severity;            // 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3'
  status: IncidentStatus;        // 'investigating' | 'identified' | 'monitoring' | 'resolved'
  openedAt: number;              // Unix ms
  resolvedAt?: number;           // Unix ms
  currentOODAPhase: OODAPhase;   // 'OBSERVE' | 'ORIENT' | 'DECIDE' | 'ACT' | 'RESOLVED'
  icName: string | null;         // Current IC display name, or null if unclaimed
  connectionQuality: 'excellent' | 'good' | 'poor';
}
```

**Visual Specification:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● SEV-1  Payment Service Checkout Outage  │  OBSERVE → ORIENT → DECIDE → ACT  │  $13,500  ⏱ 1:30  │
│   ▬▬▬▬▬                                   │  ●●●●●    ○○○○○    ○○○○○   ○○○○○  │  🔒 Sarah (IC)      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Height**: 48px
- **Background**: `var(--bg-surface)` with bottom border `var(--border-default)`
- **Layout**: CSS flexbox, `justify-content: space-between`, 3 sections (left, center, right)
- **Left section**: Severity badge (colored by severity level) + incident title (`var(--text-lg)`, `var(--weight-semibold)`)
- **Center section**: `<OODAIndicator />` component
- **Right section**: `<CostCounter />` + elapsed timer + IC lock badge
- **Elapsed timer**: `var(--font-mono)`, `var(--text-sm)`, updates every second
- **IC Lock badge**: Shows `🔒 {icName} (IC)` when claimed, `[Claim IC]` button when unclaimed

### CSS
```css
.status-bar {
  grid-area: status;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  height: 48px;
  z-index: var(--z-sticky);
}

.status-bar__severity {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px 8px;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
}

.status-bar__severity--sev0 { background: var(--color-sev0); color: var(--text-inverse); }
.status-bar__severity--sev1 { background: var(--color-sev1); color: var(--text-inverse); }
.status-bar__severity--sev2 { background: var(--color-sev2); color: var(--text-inverse); }
.status-bar__severity--sev3 { background: var(--color-sev3); color: var(--text-primary); }

.status-bar__title {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-left: var(--space-3);
}

.status-bar__timer {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
```

---

## 2. CostCounter (inside StatusBar)

```typescript
interface CostCounterProps {
  incidentStatus: IncidentStatus;
  openedAt: number;
  resolvedAt?: number;
}
```

**Visual Specification:**
- Active: `$13,500` in `var(--color-conflict)` (red), `var(--font-mono)`, `var(--text-2xl)`, `var(--weight-bold)`
- Resolved: `$130,680` in `var(--color-fact)` (green) + subtext `Saved: ~$68,000` in `var(--text-xs)`
- CSS `font-variant-numeric: tabular-nums` for stable digit width (no layout shift as numbers change)
- Subtle glow animation while active: `text-shadow: 0 0 8px var(--color-conflict-dim)`

**Behavior:**
```typescript
function useCostCounter(status: IncidentStatus, openedAt: number, resolvedAt?: number) {
  const [cost, setCost] = useState(0);

  useEffect(() => {
    if (status === 'resolved') return;

    const ratePerSecond = {
      investigating: 150,  // $9,000/min
      identified: 75,      // $4,500/min (team oriented, partially mitigated)
      monitoring: 25,       // $1,500/min (fix deployed, validating)
    }[status] ?? 150;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - openedAt) / 1000;
      setCost(Math.round(elapsed * ratePerSecond));
    }, 100); // Update 10x/sec for smooth counting animation

    return () => clearInterval(interval);
  }, [status, openedAt]);

  return cost;
}
```

---

## 3. OODA Phase Bar (Integrated in StatusBar)

> [!NOTE]
> In the production implementation, the 4-phase OODA progression bar (`OBSERVE → ORIENT → DECIDE → ACT → RESOLVED`) is inlined directly inside [`StatusBar.tsx`](file:///d:/dev/mmc/aura-hack/aura/components/StatusBar.tsx) (lines 450–485) and scoped via [`StatusBar.module.css`](file:///d:/dev/mmc/aura-hack/aura/components/StatusBar.module.css) for zero-overhead layout and atomic status updates.

```typescript
interface OODAIndicatorProps {
  currentPhase: OODAPhase;
}
```

**Visual Specification:**
```
  [● OBSERVE]  [○ ORIENT]  [○ DECIDE]  [○ ACT]
```

- 4 phase buttons rendered horizontally with `→` arrows between them
- Current phase: filled background (`var(--color-{phase})`), white text, `var(--weight-semibold)`
- Inactive phases: transparent background, `var(--text-muted)`, `var(--weight-regular)`
- When `RESOLVED`: all 4 dim, a 5th badge `✓ RESOLVED` appears in `var(--color-resolved)` (green)
- Transition between phases: `var(--duration-normal)` `var(--ease-standard)` background color change

```css
.ooda-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.ooda-phase {
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.05em;
  transition: background var(--duration-normal) var(--ease-standard),
              color var(--duration-normal) var(--ease-standard);
  color: var(--text-muted);
  background: transparent;
}

.ooda-phase--active {
  font-weight: var(--weight-semibold);
  color: var(--text-inverse);
}

.ooda-phase--active[data-phase="OBSERVE"] { background: var(--color-observe); }
.ooda-phase--active[data-phase="ORIENT"] { background: var(--color-orient); }
.ooda-phase--active[data-phase="DECIDE"] { background: var(--color-decide); }
.ooda-phase--active[data-phase="ACT"] { background: var(--color-act); }
.ooda-phase--active[data-phase="RESOLVED"] { background: var(--color-resolved); }

.ooda-arrow {
  color: var(--text-disabled);
  font-size: var(--text-xs);
}
```

---

## 4. SpeakerPanel

```typescript
interface SpeakerPanelProps {
  participants: Record<string, Participant>;
  localVolumeLevel: Record<string, number>;  // UID → 0-100 volume level
  agentUid: string;                           // "aura_agent"
  agentLastSpokeAt: number;                   // Unix ms
  agentIsSpeaking: boolean;
  cognitiveLoadScore: number;                 // 0-100
  tempoLevel: number;                         // 1-5
}
```

**Visual Specification:**
```
┌─────────────────────┐
│  RESPONDERS          │
│                      │
│  ● Sarah (IC) 🔒     │
│    ██████████ 3m12s  │ ← green engagement bar (speaking time / total time)
│                      │
│  ○ Marcus (SRE)      │
│    ██████░░░░ 1m45s  │
│                      │
│  ○ Priya (PM)        │
│    ██░░░░░░░░ 0m38s  │
│                      │
│  ● AURA ⏸ 47s        │ ← golden glow border, silence counter
│    ████████░░         │
│                      │
│  ─────────────────── │
│  TEMPO: ◉◉◉○○        │
│  LOAD:  ████████░░ 74%│
└─────────────────────┘
```

- **Width**: 220px fixed
- **Background**: `var(--bg-surface)`
- **Each participant row**:
  - Circle indicator: `●` = speaking (pulsing), `○` = silent
  - Name + role in parentheses
  - IC gets `🔒` lock icon
  - Below name: engagement heatbar (ratio of speaking time to elapsed time, rendered as a horizontal bar)
  - Speaking time formatted as `Xm Xs`
  - AURA's row has a golden amber left border (`var(--color-aura)`) and shows silence counter or "🔊 Speaking"
- **Volume glow**: When a participant is speaking (volume > 20), their row gets a subtle left-border glow in their role color
- **Engagement bar colors**: >50% green, 20-50% amber, <20% red (at-risk for disengagement)

**AURA Silence Counter:**
```typescript
function useAuraSilenceCounter(agentLastSpokeAt: number, agentIsSpeaking: boolean) {
  const [display, setDisplay] = useState('⏸ 0s');

  useEffect(() => {
    if (agentIsSpeaking) {
      setDisplay('🔊 Speaking');
      return;
    }

    const interval = setInterval(() => {
      const silentSec = Math.round((Date.now() - agentLastSpokeAt) / 1000);
      if (silentSec < 60) {
        setDisplay(`⏸ ${silentSec}s`);
      } else {
        const min = Math.floor(silentSec / 60);
        const sec = silentSec % 60;
        setDisplay(`⏸ ${min}m ${sec}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [agentLastSpokeAt, agentIsSpeaking]);

  return display;
}
```

---

## 5. ConflictBanner

```typescript
interface ConflictBannerProps {
  isActive: boolean;
  hypothesisA: string;
  speakerAName: string;
  hypothesisB: string;
  speakerBName: string;
  decidingMetric: string;
}
```

**Visual Specification:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ⚠ ACTIVE CONFLICT   Marcus: "DB connection pool"  vs  Sarah: "Load balancer"           │
│                       Deciding metric: Database query latency logs                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Height**: 52px when active, 0px when inactive (CSS transition)
- **Background**: `var(--color-conflict-dim)` with left border 3px solid `var(--color-conflict)`
- **Pulsing animation**: Entire banner background pulses between `var(--color-conflict-dim)` and a slightly brighter shade on `var(--duration-pulse)` cycle
- **Text**: `var(--text-sm)`, `var(--weight-medium)`, `var(--text-primary)`
- **"vs" separator**: `var(--color-conflict)`, `var(--weight-bold)`
- **Deciding metric**: `var(--text-muted)`, displayed on second line

```css
.conflict-banner {
  grid-area: conflict;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 var(--space-4);
  background: var(--color-conflict-dim);
  border-left: 3px solid var(--color-conflict);
  overflow: hidden;
  transition: height var(--duration-normal) var(--ease-arrive);
}

.conflict-banner--active {
  height: 52px;
  animation: conflict-pulse var(--duration-pulse) ease-in-out infinite;
}

.conflict-banner--inactive {
  height: 0;
  padding: 0;
}

@keyframes conflict-pulse {
  0%, 100% { background: var(--color-conflict-dim); }
  50% { background: rgba(232, 84, 84, 0.18); }
}
```

---

## 6. TimelineCard

```typescript
interface TimelineCardProps {
  item: EvidenceItem;
  displayConfidence: number;  // After temporal decay
}
```

**Visual Specification:**
```
┌──────────────────────────────────────────────────────┐
│  ● FACT  ·  Sarah  ·  14:23:05                       │
│  Error rate spiked to 42% on payment services         │
│  Confidence: ████████░░ 80%                           │
│  Related: evt-002, evt-003                            │
└──────────────────────────────────────────────────────┘
```

- **Width**: fills parent container
- **Background**: `var(--bg-surface-raised)`
- **Left border**: 3px solid, colored by classification type
- **Top line**: Badge (`.badge-{type}`) + speaker name (`var(--text-secondary)`) + timestamp (`var(--font-mono)`, `var(--text-muted)`)
- **Content**: `var(--text-base)`, `var(--text-primary)`, max 3 lines with ellipsis overflow
- **Confidence bar**: Thin horizontal bar, width proportional to `displayConfidence / 85`, colored by type
- **Margin bottom**: `var(--space-2)`
- **Arrival animation**: `translateY(12px) → translateY(0)`, `opacity: 0 → 1`, `var(--duration-normal)` `var(--ease-arrive)`

**Hypothesis Confidence Decay Visual:**
- Fresh hypothesis (0-2 min): Full opacity, sharp border
- Aging hypothesis (2-5 min): Opacity 0.85, border starts fading
- Stale hypothesis (5-10 min): Opacity 0.6, border dashed, label shows `(stale)`
- At 10 min+: Opacity 0.4, border dotted, confidence bar nearly empty

**Disproven Hypothesis Animation:**
When `status` changes from `active` to `disproven`:
1. Red flash: `box-shadow: 0 0 16px var(--color-conflict)` for 300ms
2. Strikethrough: `text-decoration: line-through` with `text-decoration-color: var(--color-conflict)` applied to content text
3. Scale down: `transform: scale(0.92)` over 400ms
4. Opacity reduce: `opacity: 0.5` over 400ms
5. After animation: card remains visible but visually diminished

```css
.timeline-card {
  background: var(--bg-surface-raised);
  border-left: 3px solid var(--border-default); /* Overridden by type class */
  padding: var(--space-3);
  margin-bottom: var(--space-2);
  border-radius: var(--radius-sm);
  animation: card-arrive var(--duration-normal) var(--ease-arrive) both;
}

.timeline-card--fact { border-left-color: var(--color-fact); }
.timeline-card--hypothesis { border-left-color: var(--color-hypothesis); }
.timeline-card--decision { border-left-color: var(--color-decision); }
.timeline-card--action { border-left-color: var(--color-action); }
.timeline-card--conflict { border-left-color: var(--color-conflict); }

.timeline-card--disproven {
  animation: card-disprove 400ms var(--ease-standard) forwards;
}

@keyframes card-arrive {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes card-disprove {
  0% { box-shadow: 0 0 16px var(--color-conflict); }
  30% { box-shadow: none; }
  100% { transform: scale(0.92); opacity: 0.5; }
}

.timeline-card--disproven .timeline-card__content {
  text-decoration: line-through;
  text-decoration-color: var(--color-conflict);
}

/* Hypothesis temporal decay */
.timeline-card--stale {
  opacity: 0.6;
  border-left-style: dashed;
}
```

---

## 7. IncidentTopology (Force-Directed Graph)

```typescript
interface IncidentTopologyProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeHover: (nodeId: string | null) => void;
  onNodeClick: (nodeId: string) => void;
}
```

**Implementation Approach:**
- Library: `d3-force` for simulation, React SVG for rendering
- Container: fills the `main` grid area
- Responsive: `ResizeObserver` to track container dimensions

**Node Rendering:**
- Shape: circle (all types)
- Size: `radius = Math.max(8, Math.min(24, confidence / 85 * 24))`
- Color fill: type-specific color at 80% opacity
- Stroke: type-specific color at 100%, 1.5px width
- Label: truncated content (30 chars max), rendered below node in `var(--text-xs)`, `var(--text-secondary)`
- Hover: tooltip with full content, speaker name, timestamp, confidence
- Disproven nodes: filled with `var(--color-conflict)` at 30% opacity, strikethrough text label, radius shrinks to 60%

**Edge Rendering:**
- Causal/supports: 1px solid `var(--border-default)`, arrowhead marker
- Conflict: 2px dashed `var(--color-conflict)`, no arrowhead, bidirectional
- Contradicts: 1px dashed `var(--color-conflict)`, arrowhead

**Force Simulation:**
```typescript
const simulation = d3.forceSimulation<TopologyNode>(nodes)
  .force('charge', d3.forceManyBody().strength(-120))
  .force('link', d3.forceLink<TopologyNode, TopologyEdge>(edges)
    .id(d => d.id)
    .distance(80)
    .strength(0.3))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(30))
  .force('x', d3.forceX(width / 2).strength(0.05))
  .force('y', d3.forceY(height / 2).strength(0.05))
  .alphaDecay(0.02)  // Slower decay for smoother settling
  .on('tick', () => { /* update node/edge positions */ });

// When new nodes are added:
// 1. Add node at the position of its most recent related_to node (if any)
//    or at a random position near center
// 2. Restart simulation with alpha 0.3 (gentle re-layout, not full reset)
```

---

## 8. ActionTracker

```typescript
interface ActionTrackerProps {
  actions: EvidenceItem[];  // Filtered to category === 'action'
  onStatusChange: (actionId: string, newStatus: ActionStatus) => void;
}
```

**Visual Specification:**
```
┌──────────────────────────────┐
│  ACTIONS                     │
│                              │
│  ✓ Rollback PR #492          │
│    @Sarah · Done ✅           │
│                              │
│  ◉ Check connection pool     │
│    @Marcus · In Progress 🔄   │
│                              │
│  ○ Notify enterprise accts   │
│    @Priya · Pending ⏳        │
│                              │
│  ✕ Restart load balancer     │
│    @Marcus · Blocked 🚫       │
└──────────────────────────────┘
```

- **Width**: 240px fixed (right column)
- **Header**: "ACTIONS" in `var(--text-sm)`, `var(--weight-semibold)`, `var(--text-secondary)`, `letter-spacing: 0.1em`
- **Each action row**:
  - Status icon: `○` pending, `◉` in progress (amber pulse), `✓` done (green), `✕` blocked (red)
  - Task description: `var(--text-base)`, `var(--text-primary)`, max 2 lines
  - Assigned to: `@{name}` in `var(--text-secondary)`, `var(--text-sm)`
  - Status chip: colored badge matching status
- **Clickable**: Status toggles through `pending → in_progress → done` on click (publishes RTM event)

---

## 9. IncidentStats

```typescript
interface IncidentStatsProps {
  factCount: number;
  hypothesisCount: number;   // Active only
  decisionCount: number;
  actionCompletedCount: number;
  actionTotalCount: number;
  conflictCount: number;     // Active only
}
```

**Visual Specification:**
```
┌──────────────────────────────┐
│  ● 4 Facts                   │
│  ◆ 2 Hypotheses              │
│  ▲ 1 Decision                │
│  ■ 2/4 Actions               │
│  ⚠ 1 Conflict                │
└──────────────────────────────┘
```

- **Each row**: icon (colored by type) + count + label
- **Font**: `var(--font-mono)`, `var(--text-sm)`
- **Actions**: show `completed/total` format
- **Conflicts**: pulse icon when > 0

---

## 10. NarrativeBar

```typescript
interface NarrativeBarProps {
  tensionHistory: { timestamp: number; value: number }[];  // 0-100 tension over time
  oodaPhase: OODAPhase;
  inflectionPoints: { timestamp: number; label: string }[]; // Named events on sparkline
}
```

**Visual Specification:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  TENSION: ___/‾‾‾\___/‾‾‾‾‾‾‾‾\___   ◆ Conflict detected   ▲ IC decided   ✓ Resolved   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Height**: 64px
- **Sparkline**: SVG path, stroke `var(--color-aura)`, fill gradient from `var(--color-aura-dim)` to transparent
- **Inflection markers**: Small vertical lines with labels above in `var(--text-xs)`
- **X-axis**: time since incident opened
- **Y-axis**: implicit (0-100 tension score)

**Tension Calculation:**
```typescript
function calculateTension(state: IncidentState): number {
  const activeConflicts = state.evidenceItems.filter(e => e.category === 'conflict' && e.status === 'active').length;
  const pendingActions = state.evidenceItems.filter(e => e.category === 'action' && e.actionStatus !== 'done').length;
  const cogLoad = calculateCognitiveLoad(state);
  
  // Tension rises with conflicts and load, falls as actions complete
  const raw = (activeConflicts * 30) + (pendingActions * 10) + (cogLoad * 0.4);
  return Math.min(100, Math.max(0, raw));
}
```

---

## 11. LiveCaptions

```typescript
interface LiveCaptionsProps {
  currentSpeakerName: string | null;
  currentTranscript: string;  // Live ASR partial transcript
  onToggleTranscriptDrawer: () => void;
}
```

**Visual Specification:**
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  🔊 Marcus: "I'm checking connection count now, showing 98% utilization..."  [▼ Full]    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Height**: 40px
- **Background**: `var(--bg-surface)`
- **Top border**: `var(--border-subtle)`
- **Speaker name**: `var(--weight-semibold)`, `var(--color-aura)`
- **Transcript text**: `var(--text-base)`, `var(--text-secondary)`, italic when partial (ASR still processing)
- **Toggle button**: `[▼ Full Transcript]` opens `TranscriptDrawer`

---

## 12. PostmortemModal

```typescript
interface PostmortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentState;
  evidenceChainEdges: TopologyEdge[];  // For evidence chain graph
  recordingUrl?: string;    // Cloud Recording URL
  transcriptUrl?: string;   // STT .vtt download URL
}
```

**Visual Specification:**
- **Overlay**: `var(--bg-overlay)` (85% opacity dark)
- **Modal**: `max-width: 800px`, `max-height: 90vh`, centered, `var(--shadow-modal)`
- **Background**: `var(--bg-surface-raised)`
- **Border radius**: `var(--radius-xl)`

**Modal Content Sections (Scrollable):**

```
┌────────────────────────────────────────────────────────────────────────┐
│  ✕ Close                          POST-INCIDENT REPORT                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  INCIDENT SUMMARY                                                      │
│  Title: Payment Service Checkout Outage                                │
│  Severity: SEV-1 | Duration: 14m 32s | Status: RESOLVED               │
│  Root Cause: DB connection pool exhaustion from PR #492                │
│  IC: Sarah                                                             │
│                                                                        │
│  EVIDENCE CHAIN                                                        │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │  [evt-001 FACT] ──→ [evt-003 HYPOTHESIS] ──→ [evt-007 FACT]│       │
│  │       ↘ [evt-004 HYPOTHESIS ✕] (disproven)                 │       │
│  │  [evt-007 FACT] ──→ [evt-008 DECISION] ──→ [evt-009 ACTION]│       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                        │
│  CLASSIFIED TIMELINE                                                   │
│  14:23:05  ● FACT   Error rate 42% on payment services (Sarah)         │
│  14:23:48  ◆ HYPO   DB connection pool exhaustion (Marcus, 72%)        │
│  14:23:55  ◆ HYPO   Load balancer misconfiguration (Sarah, 65%)        │
│  14:24:02  ⚠ CONFL  DB pool vs Load balancer (deciding: query logs)    │
│  14:25:30  ● FACT   Connection count at 98% utilization (Marcus)       │
│  14:25:45  ▲ DEC    Rollback PR #492 (Sarah, IC)                       │
│  14:25:50  ■ ACT    Check connection pool logs → Marcus [Done]         │
│  14:25:52  ■ ACT    Notify enterprise accounts → Priya [Done]          │
│  14:37:37  ● FACT   Error rates normalized (Sarah)                     │
│                                                                        │
│  DISPROVEN HYPOTHESES                                                  │
│  ✕ Load balancer misconfiguration (Sarah) — disproven by DB query logs │
│                                                                        │
│  METRICS                                                               │
│  Facts: 4 | Confirmed: 1 | Disproven: 1 | Decisions: 1 | Actions: 2/2│
│  Cognitive Load Peak: 74% | Tempo Peak: 3/5                           │
│  Estimated Cost: $130,680 | Estimated Savings: ~$68,000                │
│                                                                        │
│  MEDIA                                                                 │
│  [▶ Play Compliance Recording]  [📥 Download .vtt Transcript]          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Evidence Chain Mini-Graph:**
- Simplified left-to-right flow diagram (NOT the full force topology)
- Nodes as small colored circles with event IDs
- Arrows showing causal flow from earliest fact to final resolution
- Disproven hypotheses shown with `✕` and red dashed connection
- Implementation: SVG, manually laid out left-to-right based on `relatedTo` edges

---

## 13. AgoraAnalyticsOverlay

```typescript
interface AgoraAnalyticsOverlayProps {
  mos: number;        // Mean Opinion Score 1.0-5.0
  jitter: number;     // Milliseconds
  rtt: number;        // Round-trip time ms
  packetLoss: number; // Percentage 0-100
  // AGENT_METRICS pipeline latency (from ConvAI Engine via RTM)
  sttLatencyMs: number | null;   // Speech-to-Text latency
  llmLatencyMs: number | null;   // LLM inference latency
  ttsLatencyMs: number | null;   // Text-to-Speech latency
  isCollapsed: boolean;
  onToggle: () => void;
}
```

**Visual Specification:**
```
┌──────────────────────────────┐
│  AGORA QUALITY               │
│  MOS: 4.2  Jitter: 12ms     │
│  RTT: 45ms  Loss: 0.1%      │
├──────────────────────────────┤
│  AI PIPELINE                 │
│  STT:  42ms  ████████░░     │
│  LLM: 180ms  ██████░░░░     │
│  TTS:  95ms  ███████░░░     │
└──────────────────────────────┘
```

- **Position**: `fixed`, `bottom: 12px`, `right: 12px`
- **Width**: 220px expanded, 32px collapsed (icon only)
- **Background**: `var(--bg-surface)` with `var(--border-default)` border
- **Border radius**: `var(--radius-lg)`
- **Z-index**: `var(--z-surface)`
- **Font**: `var(--font-mono)`, `var(--text-xs)`
- **MOS color**: >3.5 green, 2.5-3.5 amber, <2.5 red
- **Pipeline bars**: Horizontal bars colored by threshold:
  - STT: green <100ms, amber <300ms, red >300ms
  - LLM: green <500ms, amber <1000ms, red >1000ms
  - TTS: green <200ms, amber <500ms, red >500ms
- **Collapsed state**: Shows only a small `📊` icon button
- **Data sources**:
  - Quality metrics: `agoraRtcClient.getLocalAudioStats()` and `getRemoteAudioStats()` polled every 2 seconds
  - Pipeline metrics: RTM `AGENT_METRICS` events from ConvAI Engine (parsed in `useAgoraRTM.ts`)

---

## 14. LobbyScreen

```typescript
interface LobbyScreenProps {
  onJoin: (persona: PersonaConfig) => void;
  isConnecting: boolean;
}

interface PersonaConfig {
  uid: string;
  displayName: string;
  role: string;
  avatarColor: string;
}
```

**Visual Specification:**
- Full-page view at `/lobby` route
- Centered content, `max-width: 640px`
- Title: "AURA" in `var(--text-3xl)`, `var(--weight-bold)`, `var(--color-aura)` (golden amber)
- Subtitle: "Incident Command Center" in `var(--text-lg)`, `var(--text-secondary)`
- Below: scenario card explaining the demo scenario (Payment Service Checkout Outage)
- 3 persona buttons (one click = join as that role):

```
  ┌─────────────────────────────────────────────────────────┐
  │                         AURA                             │
  │              Incident Command Center                     │
  │                                                          │
  │  ┌─────────────────────────────────────────────────────┐ │
  │  │  SCENARIO: Payment Service Checkout Outage          │ │
  │  │  Error rates spiked to 42% on payment services.     │ │
  │  │  Checkout page is frozen for customers.             │ │
  │  │  Suspected: PR #492 deployed 15 minutes ago.        │ │
  │  └─────────────────────────────────────────────────────┘ │
  │                                                          │
  │  JOIN AS:                                                │
  │                                                          │
  │  [🔴 Sarah — Incident Commander]                         │
  │  [🟢 Marcus — Senior SRE]                                │
  │  [🔵 Priya — Product Manager]                            │
  │                                                          │
  │  ┌─────────────────────────────────────────────────────┐ │
  │  │  💡 AURA will join automatically after the first    │ │
  │  │     participant connects. Speak naturally.           │ │
  │  └─────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────┘
```

**Persona Button Styles:**
- Height: 56px
- Width: 100%
- Background: `var(--bg-surface-raised)` with left border 4px solid persona color
- Hover: `var(--bg-surface-hover)` with scale `1.01`
- Persona colors: Sarah = `var(--color-conflict)`, Marcus = `var(--color-fact)`, Priya = `var(--color-decision)`
- Font: `var(--text-md)`, `var(--weight-medium)`
- Click: triggers `onJoin(personaConfig)` and navigates to main dashboard

**Persona Configurations:**
```typescript
const PERSONAS: PersonaConfig[] = [
  { uid: 'sarah_ic',    displayName: 'Sarah',  role: 'Incident Commander', avatarColor: '#E85454' },
  { uid: 'marcus_sre',  displayName: 'Marcus', role: 'Senior SRE',        avatarColor: '#3BD4A2' },
  { uid: 'priya_pm',    displayName: 'Priya',  role: 'Product Manager',   avatarColor: '#7B8CFF' },
];
```

---

## 15. CognitiveLoadMeter (inside SpeakerPanel)

```typescript
interface CognitiveLoadMeterProps {
  score: number; // 0-100
}
```

**Visual Specification:**
```
  LOAD: ████████░░ 74%
```

- Horizontal bar, 100% width of SpeakerPanel minus padding
- Height: 6px with `border-radius: 3px`
- Fill color: `score < 40 ? var(--color-load-normal) : score < 70 ? var(--color-load-heavy) : var(--color-load-critical)`
- Label: `LOAD: {score}%` in `var(--font-mono)`, `var(--text-xs)`, `var(--text-muted)`
- Transition: fill width animates with `var(--duration-normal)` `var(--ease-standard)`

---

## 16. TempoIndicator (inside SpeakerPanel)

```typescript
interface TempoIndicatorProps {
  level: number; // 1-5
}
```

**Visual Specification:**
```
  TEMPO: ◉◉◉○○
```

- 5 dots in a row
- Filled dots (`◉`): `var(--color-aura)`
- Empty dots (`○`): `var(--text-disabled)`
- Label: "TEMPO:" in `var(--font-mono)`, `var(--text-xs)`, `var(--text-muted)`

**Tempo Calculation:**
```typescript
function calculateTempo(state: IncidentState): number {
  const now = Date.now();
  const windowMs = 60_000; // 1-minute window
  const recentEvents = state.evidenceItems.filter(e => e.timestamp > now - windowMs).length;
  const recentSpeakers = new Set(
    state.evidenceItems.filter(e => e.timestamp > now - windowMs).map(e => e.speakerUid)
  ).size;
  
  // Heuristic: more events + more speakers = higher tempo
  const raw = Math.min(5, Math.ceil((recentEvents * 0.5) + (recentSpeakers * 0.8)));
  return Math.max(1, raw);
}
```

---

## Resolution Celebration Moment

When `incidentStatus` changes to `'resolved'`:

1. **Cost counter** stops and transitions:
   - Color: `var(--color-conflict)` → `var(--color-fact)` over 500ms
   - Subtext appears: `Estimated savings: ~$68,000`

2. **OODA indicator** snaps to `RESOLVED` badge (green)

3. **Narrative arc** sparkline freezes, resolution marker (✓) appears at current position

4. **Subtle green pulse** radiates from center of main view:
   ```css
   @keyframes resolve-pulse {
     0% { box-shadow: inset 0 0 0 0 var(--color-fact-dim); }
     50% { box-shadow: inset 0 0 60px 20px var(--color-fact-dim); }
     100% { box-shadow: inset 0 0 0 0 transparent; }
   }
   /* Apply once on resolution */
   .main-view--resolved { animation: resolve-pulse 1.5s ease-out forwards; }
   ```

5. **PostmortemModal** opens automatically after 2-second delay

---

## Voice Attribution Badge (on Timeline Cards)

Every TimelineCard includes a small speaker avatar circle:
- Size: 20px × 20px circle
- Background: persona color (`sarah=#E85454`, `marcus=#3BD4A2`, `priya=#7B8CFF`, `aura=#D4A853`)
- Content: First letter of display name (S, M, P, A) in `var(--text-inverse)`, `var(--text-xs)`, `var(--weight-bold)`
- Position: inline, before the speaker name text
- When the speaker's RTC audio is active: circle has a `box-shadow: 0 0 0 2px {persona_color}` glow ring that pulses

```css
.voice-badge {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  color: var(--text-inverse);
  flex-shrink: 0;
}

.voice-badge--speaking {
  animation: voice-pulse 1s ease-in-out infinite;
}

@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; }
  50% { box-shadow: 0 0 0 3px currentColor; }
}
```

---

## 22. SmartPlaybook (inside MainView)

```typescript
export interface SmartPlaybookProps {
  scenarioTitle: string;
  runbookSteps: Array<{
    id: string;
    title: string;
    command?: string;
    isCompleted: boolean;
    executedBy?: string;
  }>;
  onExecuteStep?: (stepId: string) => void;
}
```
Interactive runbook view rendering automated mitigation commands with click-to-copy, step completion badges, and command verification.

---

## 23. ResolveIncidentModal (overlay)

```typescript
export interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmResolve: (resolution: {
    rootCauseCategory: 'infrastructure' | 'code' | 'config' | 'third_party';
    summary: string;
    mitigationApplied: string;
  }) => void;
  incidentTitle: string;
  durationFormatted: string;
}
```
Modal triggered when the Incident Commander concludes the war room. Prompts for formal root-cause categorization, generates resolution audit log, and triggers postmortem transition.

---

## 24. SimilarIncidentBanner (banner)

```typescript
export interface SimilarIncidentBannerProps {
  similarIncident: {
    id: string;
    title: string;
    similarityScore: number; // 0-100
    matchedKeywords: string[];
    resolutionSummary: string;
    resolvedInMinutes: number;
  } | null;
  onDismiss: () => void;
  onApplyResolution?: () => void;
}
```
Non-intrusive amber slide-down banner that notifies responders when historical incidents match current symptoms via TF-IDF analysis, suggesting past proven runbooks.

---

## 25. WarRoomInvite (overlay)

```typescript
export interface WarRoomInviteProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  onSimulateJoin?: (role: string, name: string) => void;
}
```
Invite dialog providing shareable war room links, instant QR codes for mobile responders joining via Agora SD-RTN, and simulation bots for demo presentation.

---

## 26. KeyboardShortcutsModal (overlay)

```typescript
export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```
Quick cheatsheet overlay triggered by the `?` hotkey, mapping all flight deck navigation shortcuts (`Cmd+K` Quick Capture, `Space` PTT, `1-4` Tab Switching, `Esc` Close).

---

## 27. QuickCapture (overlay)

```typescript
export interface QuickCapturePayload {
  type: 'fact' | 'hypothesis' | 'action';
  text: string;
  speaker: string;
}
export interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: QuickCapturePayload) => void;
  speakerName?: string;
}
```
Spotlight / Command palette (`Cmd+K`) allowing hands-on-keyboard responders to rapidly post facts, root cause theories, or action items into the live incident bus.

---

## 28. AnalyticsDashboard (inside MainView)

```typescript
export interface AnalyticsDashboardProps {
  incident: IncidentState;
  costRate: number;
}
```
Detailed performance telemetry tab visualizing Mean Time to Detect (MTTD), Mean Time to Resolve (MTTR), hypothesis confirmation ratio, and participant speaking distribution.

---

## 29. NotificationToast (toast manager)

```typescript
export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}
```
Non-blocking epistemic state notifications appearing at top-right for live fact validations, conflict flags, and SBAR brief deliveries.

---

## 30. WarRoomSummaryCard (floating)

```typescript
export interface WarRoomSummaryCardProps {
  incident: IncidentState;
  actions: ActionItem[];
  onDismiss: () => void;
}
```
Floating glassmorphism chip in bottom-right corner summarizing active hypotheses, completed action counts, and current burn rate.

---

## 31. ErrorBoundary (root wrapper)

```typescript
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}
```
Defensive React component wrapping the application to capture unexpected exceptions during high-stakes demonstrations, displaying an operational calm error card with stack trace and refresh action.
```
