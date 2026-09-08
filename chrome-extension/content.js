/**
 * AURA Chrome Extension — Content Script for Google Meet
 *
 * Injected into all meet.google.com/* pages.
 * Responsibilities:
 *  1. Detect active Meet call (join button disappears, grid appears)
 *  2. Inject the AURA activation button into Meet's bottom toolbar
 *  3. Scan and broadcast participant names from the participant panel
 *  4. Show AURA status overlay on the Meet grid
 *  5. Display transcript subtitles / AURA response toasts in Meet UI
 */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let auraActive = false;
let toolbarButton = null;
let statusOverlay = null;
let participantObserver = null;
let toastQueue = [];
let injectInterval = null;

// ── Init: wait for Meet call to start ────────────────────────────────────────
function init() {
  // Poll until Meet's call toolbar is present
  injectInterval = setInterval(tryInjectToolbar, 1500);

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(message) {
  switch (message.type) {
    case 'AURA_ACTIVATED':
      auraActive = true;
      updateToolbarButton(true);
      showStatusOverlay('AURA Monitoring');
      showToast('🤖 AURA is now monitoring your incident bridge', 'success');
      startParticipantObserver();
      break;

    case 'AURA_DEACTIVATED':
      auraActive = false;
      updateToolbarButton(false);
      removeStatusOverlay();
      showToast('AURA has left the call', 'info');
      stopParticipantObserver();
      break;

    case 'TRANSCRIPT':
      if (message.text) {
        showTranscriptToast(message.speaker || 'Participant', message.text);
      }
      break;

    case 'AURA_RESPONSE':
      if (message.text) {
        showAuraResponseToast(message.text);
      }
      break;
  }
}

// ── Toolbar Injection ─────────────────────────────────────────────────────────
function tryInjectToolbar() {
  // Google Meet bottom toolbar detection (multiple selectors for resilience)
  const toolbar =
    document.querySelector('[data-call-ended="false"] [class*="cntinuous"]') ||
    document.querySelector('[jsname="QSmrJb"]') ||
    document.querySelector('[class*="Tmb7Fd"]') ||
    document.querySelector('[data-tooltip-id="tt-c12"]')?.parentElement?.parentElement;

  if (!toolbar && !document.querySelector('.aura-meet-btn')) return;

  // Already injected?
  if (document.querySelector('.aura-meet-btn')) {
    // Just update state
    if (injectInterval) {
      clearInterval(injectInterval);
      injectInterval = null;
    }
    return;
  }

  // Find any button in the toolbar to clone its container
  const anyBtn = document.querySelector('[data-tooltip-id]');
  if (!anyBtn) return;

  clearInterval(injectInterval);
  injectInterval = null;

  injectButton();
}

function injectButton() {
  // Don't double-inject
  if (document.querySelector('.aura-meet-btn')) return;

  toolbarButton = document.createElement('button');
  toolbarButton.className = 'aura-meet-btn';
  toolbarButton.setAttribute('aria-label', 'Activate AURA Incident Commander');
  toolbarButton.setAttribute('title', 'Activate AURA (Ctrl+Shift+A)');
  toolbarButton.innerHTML = `
    <span class="aura-btn-icon">⚡</span>
    <span class="aura-btn-label">AURA</span>
  `;

  toolbarButton.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({
      type: auraActive ? 'DEACTIVATE_AURA' : 'ACTIVATE_AURA',
    });
    if (response?.ok) {
      auraActive = !auraActive;
      updateToolbarButton(auraActive);
    }
  });

  // Append to Meet's bottom bar — find the right icon group
  const meetBottomBar =
    document.querySelector('[class*="cntinuous"] [class*="HkgMc"]') ||
    document.querySelector('[class*="ZV4T2e"]') ||
    document.querySelector('[class*="wnPUne"]') ||
    document.body; // Last resort

  meetBottomBar.appendChild(toolbarButton);
}

function updateToolbarButton(active) {
  if (!toolbarButton) return;
  toolbarButton.className = `aura-meet-btn ${active ? 'aura-meet-btn--active' : ''}`;
  toolbarButton.innerHTML = active
    ? `<span class="aura-btn-icon aura-pulse">🛡️</span><span class="aura-btn-label">AURA ON</span>`
    : `<span class="aura-btn-icon">⚡</span><span class="aura-btn-label">AURA</span>`;
}

// ── Status Overlay ────────────────────────────────────────────────────────────
function showStatusOverlay(text) {
  removeStatusOverlay();
  statusOverlay = document.createElement('div');
  statusOverlay.className = 'aura-status-overlay';
  statusOverlay.innerHTML = `
    <div class="aura-status-dot"></div>
    <span class="aura-status-text">${text}</span>
    <div class="aura-status-wave">
      <span></span><span></span><span></span>
    </div>
  `;
  document.body.appendChild(statusOverlay);
}

function removeStatusOverlay() {
  statusOverlay?.remove();
  statusOverlay = null;
}

// ── Participant Observer ──────────────────────────────────────────────────────
function startParticipantObserver() {
  scanParticipants();
  participantObserver = new MutationObserver(scanParticipants);
  participantObserver.observe(document.body, { childList: true, subtree: true });
}

function stopParticipantObserver() {
  participantObserver?.disconnect();
  participantObserver = null;
}

function scanParticipants() {
  // Various selectors used by Google Meet for participant names
  const nameEls = document.querySelectorAll(
    '[data-participant-id] [class*="KF4T6"], ' +
    '[data-ssrc] [class*="zWfAib"], ' +
    '[class*="NzPR9b"] [class*="Gw17xb"], ' +
    '[data-requested-participant-id] [class*="d9Wx1e"]'
  );

  const participants = Array.from(nameEls)
    .map((el) => ({ name: el.textContent?.trim() || '' }))
    .filter((p) => p.name.length > 0);

  if (participants.length > 0) {
    chrome.runtime.sendMessage({
      type: 'MEET_PARTICIPANTS',
      participants,
    }).catch(() => {});
  }
}

// ── Toast Notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `aura-toast aura-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('aura-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('aura-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showTranscriptToast(speaker, text) {
  const toast = document.createElement('div');
  toast.className = 'aura-transcript-toast';
  toast.innerHTML = `<span class="aura-transcript-speaker">${escapeHtml(speaker)}</span> ${escapeHtml(text.slice(0, 100))}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('aura-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('aura-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showAuraResponseToast(text) {
  const toast = document.createElement('div');
  toast.className = 'aura-toast aura-toast--aura';
  toast.innerHTML = `<strong>🤖 AURA:</strong> ${escapeHtml(text.slice(0, 160))}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('aura-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('aura-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
