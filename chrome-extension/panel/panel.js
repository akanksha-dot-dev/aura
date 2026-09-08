/**
 * AURA Chrome Extension — Side Panel JS
 *
 * Manages:
 * - Activation / deactivation of AURA via service worker
 * - Receiving real-time state from AURA SSE stream (/api/meet/status)
 * - Rendering timeline evidence, action items, participants, transcript
 * - Settings persistence in chrome.storage.local
 * - Tab switching, OODA phase rendering
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let config = getDefaultConfig();
let eventSource = null;
let activeTab = 'timeline';
let transcriptEntries = [];
let isActive = false;

// HUD live cost ticker
let hudCostInterval = null;
let hudStartMs = 0;
let hudCostRate = 0; // per hour

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const statusDot = $('status-dot');
const statusText = $('status-text');
const statusBadge = $('status-badge');
const activateSection = $('activate-section');
const dashboardSection = $('dashboard-section');
const settingsSection = $('settings-section');
const oodaBar = $('ooda-bar');

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function init() {
  // Load config
  config = await loadConfig();

  // Populate settings form
  $('cfg-base-url').value = config.auraBaseUrl;
  $('cfg-name').value = config.speakerName;
  $('cfg-channel').value = config.channelName;
  $('cfg-voice').checked = config.voiceEnabled !== false;
  $('cfg-auto').checked = config.autoActivate === true;
  $('open-dashboard-btn').href = config.auraBaseUrl;

  // Check current capture state
  const stateRes = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (stateRes?.captureState === 'capturing') {
    showDashboard();
    connectSSE();
  }

  // Wire buttons
  $('activate-btn').addEventListener('click', onActivate);
  $('deactivate-btn').addEventListener('click', onDeactivate);
  $('settings-btn').addEventListener('click', () => toggleSettings(true));
  $('close-settings-btn').addEventListener('click', () => toggleSettings(false));
  $('save-settings-btn').addEventListener('click', onSaveSettings);

  // Wire tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Listen for service worker messages
  chrome.runtime.onMessage.addListener(handleServiceWorkerMessage);
})();

// ── Activation ────────────────────────────────────────────────────────────────
async function onActivate() {
  if (!config.auraBaseUrl || config.auraBaseUrl.includes('localhost') === false) {
    // Show warning if server might not be reachable
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  $('activate-btn').textContent = 'Activating…';
  $('activate-btn').disabled = true;

  const res = await chrome.runtime.sendMessage({ type: 'ACTIVATE_AURA', tabId: tab.id });
  if (res?.ok) {
    showDashboard();
    connectSSE();
  } else {
    $('activate-btn').textContent = 'Retry Activation';
    $('activate-btn').disabled = false;
  }
}

async function onDeactivate() {
  await chrome.runtime.sendMessage({ type: 'DEACTIVATE_AURA' });
  disconnectSSE();
  stopHudTicker();
  showActivateScreen();
}

// ── Service Worker Message Handler ───────────────────────────────────────────
function handleServiceWorkerMessage(message) {
  if (message.target !== 'panel' && message.target !== undefined) return;

  switch (message.type) {
    case 'DEACTIVATED':
      showActivateScreen();
      disconnectSSE();
      break;

    case 'TRANSCRIPT':
      addTranscriptEntry(message.speaker || 'Participant', message.text, false);
      break;

    case 'AURA_RESPONSE':
      addTranscriptEntry('AURA', message.text, true);
      showAuraSpeech(message.text);
      break;

    case 'PARTICIPANTS_UPDATE':
      renderMeetParticipants(message.participants);
      break;

    case 'ERROR':
      console.error('[AURA Panel] Error:', message.message);
      break;
  }
}

// ── SSE Connection to AURA backend ───────────────────────────────────────────
function connectSSE() {
  disconnectSSE();
  const url = `${config.auraBaseUrl}/api/meet/status?channel=${encodeURIComponent(config.channelName)}`;

  try {
    eventSource = new EventSource(url);

    eventSource.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data);
        renderState(data);
      } catch {}
    });

    eventSource.addEventListener('connected', () => {
      setStatus('active', 'Live');
    });

    eventSource.addEventListener('idle', () => {
      setStatus('waiting', 'Waiting for incident…');
    });

    eventSource.onerror = () => {
      setStatus('error', 'Reconnecting…');
    };
  } catch (err) {
    console.error('[AURA Panel] SSE error:', err);
  }
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

// ── State Rendering ───────────────────────────────────────────────────────────
function renderState(data) {
  // Stats
  $('stat-severity').textContent = data.severity || '—';
  $('stat-evidence').textContent = data.evidenceCount || 0;
  $('stat-actions').textContent = data.actionItems?.length || 0;
  $('stat-participants').textContent = Object.keys(data.participants || {}).length || 0;

  // ── HUD: Cost Ticker ──
  if (data.costRate != null && data.openedAt != null) {
    hudCostRate = data.costRate;
    hudStartMs = data.openedAt;
    startHudTicker();
  }

  // ── HUD: Cognitive Load Gauge ──
  if (data.cognitiveLoadScore != null) {
    updateGauge(data.cognitiveLoadScore);
  }

  // OODA Phase
  setOODAPhase(data.oodaPhase);

  // Conflict
  const conflictBanner = $('conflict-banner');
  if (data.activeConflict) {
    conflictBanner.style.display = 'flex';
    $('conflict-text').textContent = data.activeConflict;
  } else {
    conflictBanner.style.display = 'none';
  }

  // Evidence timeline
  if (data.recentEvidence?.length > 0) {
    renderEvidence(data.recentEvidence);
  }

  // Actions
  if (data.actionItems?.length > 0) {
    renderActions(data.actionItems);
  }

  // Participants
  if (data.participants) {
    const parts = Array.isArray(data.participants) ? data.participants : Object.values(data.participants);
    if (parts.length > 0) renderParticipants(parts);
  }
}

// ── HUD Helpers ───────────────────────────────────────────────────────────────
function startHudTicker() {
  if (hudCostInterval) return; // already running
  const costEl = $('hud-cost-value');
  const rateEl = $('hud-cost-rate');
  const timerEl = $('hud-timer');
  if (rateEl) rateEl.textContent = `$${Math.round(hudCostRate)}/hr`;
  if (costEl) costEl.classList.add('ticking');

  hudCostInterval = setInterval(() => {
    const elapsedSec = (Date.now() - hudStartMs) / 1000;
    const cost = (hudCostRate / 3600) * elapsedSec;
    if (costEl) costEl.textContent = `$${cost.toFixed(2)}`;

    // Timer
    const m = Math.floor(elapsedSec / 60);
    const s = Math.floor(elapsedSec % 60);
    if (timerEl) timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

function stopHudTicker() {
  if (hudCostInterval) {
    clearInterval(hudCostInterval);
    hudCostInterval = null;
  }
}

function updateGauge(score) {
  const fill = $('gauge-fill');
  const pct = $('gauge-pct');
  if (!fill || !pct) return;

  // Arc path: from left (M 8 48) sweeping right, up to score/100 fraction
  const frac = Math.min(1, Math.max(0, score / 100));
  const angle = Math.PI * frac; // 0..PI
  const r = 32;
  const cx = 40, cy = 48;
  const x = cx + r * Math.cos(Math.PI - angle);
  const y = cy - r * Math.sin(Math.PI - angle);
  const largeArc = frac > 0.5 ? 1 : 0;
  fill.setAttribute('d', `M 8 48 A 32 32 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);

  // Color based on load
  const color = score >= 70 ? '#F43F5E' : score >= 40 ? '#F59E0B' : '#10B981';
  fill.setAttribute('stroke', color);
  pct.textContent = `${Math.round(score)}%`;
  pct.setAttribute('fill', color);
}

function setOODAPhase(phase) {
  const phaseMap = { observe: 'ooda-observe', orient: 'ooda-orient', decide: 'ooda-decide', act: 'ooda-act' };
  document.querySelectorAll('.ooda-phase').forEach((el) => el.classList.remove('ooda-phase--active'));
  const target = phase && document.getElementById(phaseMap[phase.toLowerCase()]);
  if (target) target.classList.add('ooda-phase--active');
}

function renderEvidence(items) {
  const list = $('evidence-list');
  // Only add new cards (avoid full re-render flicker)
  const existingIds = new Set([...list.querySelectorAll('.evidence-card')].map((el) => el.dataset.id));
  items.forEach((item) => {
    if (existingIds.has(item.id)) return;
    const card = document.createElement('div');
    card.className = 'evidence-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <span class="evidence-category cat-${item.category}">${item.category.slice(0, 4).toUpperCase()}</span>
      <div class="evidence-body">
        <div class="evidence-content">${escapeHtml(item.content)}</div>
        <div class="evidence-meta">${item.speakerName || ''} · ${timeAgo(item.timestamp)}</div>
      </div>`;
    // Remove empty state if present
    list.querySelector('.empty-state')?.remove();
    list.prepend(card);
  });
}

function renderActions(items) {
  const list = $('action-list');
  const existingIds = new Set([...list.querySelectorAll('.action-card')].map((el) => el.dataset.id));
  items.forEach((item) => {
    if (existingIds.has(item.id)) return;
    const card = document.createElement('div');
    card.className = 'action-card';
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="action-status-dot action-status-dot--${item.status || 'open'}"></div>
      <div>
        <div class="action-title">${escapeHtml(item.title)}</div>
        <div class="action-owner">${item.owner || 'Unassigned'}</div>
      </div>`;
    list.querySelector('.empty-state')?.remove();
    list.prepend(card);
  });
}

function renderParticipants(participants) {
  const list = $('participant-list');
  list.innerHTML = '';
  participants.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'participant-card';
    const initial = (p.displayName || p.name || '?')[0].toUpperCase();
    card.innerHTML = `
      <div class="participant-avatar">${initial}</div>
      <div>
        <div class="participant-name">${escapeHtml(p.displayName || p.name || 'Participant')}</div>
        <div class="participant-role">${escapeHtml(p.role || 'Responder')}</div>
      </div>
      ${p.isActive !== false ? '<div class="participant-active-dot"></div>' : ''}`;
    list.appendChild(card);
  });
  $('tab-participants').textContent = `People (${participants.length})`;
}

function renderMeetParticipants(meetParticipants) {
  const list = $('participant-list');
  const existingNames = new Set([...list.querySelectorAll('.participant-name')].map((el) => el.textContent));
  meetParticipants.forEach((p) => {
    if (!p.name || existingNames.has(p.name)) return;
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `
      <div class="participant-avatar">${p.name[0].toUpperCase()}</div>
      <div>
        <div class="participant-name">${escapeHtml(p.name)}</div>
        <div class="participant-role">Meet Participant</div>
      </div>
      <div class="participant-active-dot"></div>`;
    list.querySelector('.empty-state')?.remove();
    list.appendChild(card);
  });
}

function addTranscriptEntry(speaker, text, isAura) {
  const entry = { speaker, text, isAura, ts: Date.now() };
  transcriptEntries.push(entry);

  const list = $('transcript-list');
  list.querySelector('.empty-state')?.remove();

  const el = document.createElement('div');
  el.className = 'transcript-entry';
  el.innerHTML = `
    <span class="transcript-speaker ${isAura ? 'transcript-speaker--aura' : ''}">${escapeHtml(speaker)}</span>
    <span class="transcript-time">${formatTime(entry.ts)}</span>
    <div class="transcript-text">${escapeHtml(text)}</div>`;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

function showAuraSpeech(text) {
  const box = $('aura-speech-box');
  $('aura-speech-text').textContent = text;
  box.style.display = 'block';
  clearTimeout(box._hideTimer);
  box._hideTimer = setTimeout(() => { box.style.display = 'none'; }, 8000);
}

// ── UI State Management ────────────────────────────────────────────────────────
function showDashboard() {
  isActive = true;
  activateSection.style.display = 'none';
  dashboardSection.style.display = 'flex';
  settingsSection.style.display = 'none';
  setStatus('active', 'AURA Active');
}

function showActivateScreen() {
  isActive = false;
  activateSection.style.display = 'flex';
  dashboardSection.style.display = 'none';
  settingsSection.style.display = 'none';
  setStatus('idle', 'Standby');
  $('activate-btn').textContent = 'Activate AURA in This Call';
  $('activate-btn').disabled = false;
}

function toggleSettings(show) {
  if (show) {
    activateSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    settingsSection.style.display = 'flex';
  } else {
    settingsSection.style.display = 'none';
    if (isActive) showDashboard();
    else showActivateScreen();
  }
}

function setStatus(state, label) {
  statusText.textContent = label;
  statusDot.className = `status-dot${state === 'active' ? ' status-dot--active' : ''}`;
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach((c) => { c.style.display = 'none'; });
  const content = document.getElementById(`content-${tabId}`);
  if (content) content.style.display = 'flex', content.style.flexDirection = 'column';
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function onSaveSettings() {
  config = {
    auraBaseUrl: $('cfg-base-url').value.trim().replace(/\/$/, '') || 'http://localhost:3000',
    speakerName: $('cfg-name').value.trim() || 'Meet Participant',
    channelName: $('cfg-channel').value.trim() || 'meet-war-room',
    speakerUid: ($('cfg-name').value.trim() || 'meet_participant').toLowerCase().replace(/\s+/g, '_'),
    voiceEnabled: $('cfg-voice').checked,
    autoActivate: $('cfg-auto').checked,
    language: 'en-US',
  };

  await chrome.runtime.sendMessage({ type: 'CONFIG_SAVE', config });
  $('open-dashboard-btn').href = config.auraBaseUrl;
  $('settings-status').textContent = '✓ Saved!';
  setTimeout(() => { $('settings-status').textContent = ''; toggleSettings(false); }, 1200);
}

async function loadConfig() {
  const res = await chrome.runtime.sendMessage({ type: 'CONFIG_GET' });
  return res?.config || getDefaultConfig();
}

function getDefaultConfig() {
  return {
    auraBaseUrl: 'http://localhost:3000',
    channelName: 'meet-war-room',
    speakerName: 'Meet Participant',
    speakerUid: 'meet_participant',
    voiceEnabled: true,
    autoActivate: false,
    language: 'en-US',
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
