/**
 * AURA Chrome Extension — Service Worker (Manifest V3)
 *
 * This is the persistent orchestration hub. It:
 *  1. Opens the AURA side panel when the extension icon is clicked
 *  2. Manages tab capture state machine (idle → starting → capturing → stopping)
 *  3. Creates/destroys the offscreen document for audio processing
 *  4. Bridges messages between content script ↔ offscreen ↔ side panel
 *  5. Handles keyboard shortcut activation
 *
 * IMPORTANT: Service workers are ephemeral. ALL state is stored in
 * chrome.storage.session (survives SW restart, cleared on browser close).
 */

// ── Side Panel: Open on extension icon click ──────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Keyboard shortcut: Ctrl+Shift+A to activate AURA in current Meet tab ─
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-aura') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.url?.includes('meet.google.com')) {
      await toggleCapture(tab);
    }
  }
});

// ── Message Hub: bridge content script ↔ offscreen ↔ panel ───────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATE': {
        const state = await chrome.storage.session.get(['captureState', 'auraConfig', 'activeTabId']);
        sendResponse({ ok: true, ...state });
        break;
      }

      case 'ACTIVATE_AURA': {
        const tabId = sender.tab?.id || message.tabId;
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          await toggleCapture(tab);
          sendResponse({ ok: true });
        }
        break;
      }

      case 'DEACTIVATE_AURA': {
        await stopCapture();
        sendResponse({ ok: true });
        break;
      }

      case 'AUDIO_TRANSCRIPT': {
        // Forward transcript from offscreen → all panels
        await chrome.storage.session.set({
          lastTranscript: {
            text: message.text,
            speaker: message.speaker,
            ts: Date.now(),
          },
        });
        // Forward to side panel
        sendToPanel({ type: 'TRANSCRIPT', text: message.text, speaker: message.speaker });
        sendResponse({ ok: true });
        break;
      }

      case 'AURA_RESPONSE': {
        // Forward AURA's response text to panel and trigger TTS
        sendToPanel({ type: 'AURA_RESPONSE', text: message.text, source: message.source });
        sendResponse({ ok: true });
        break;
      }

      case 'MEET_PARTICIPANTS': {
        await chrome.storage.session.set({ meetParticipants: message.participants });
        sendToPanel({ type: 'PARTICIPANTS_UPDATE', participants: message.participants });
        sendResponse({ ok: true });
        break;
      }

      case 'CONFIG_SAVE': {
        await chrome.storage.local.set({ auraConfig: message.config });
        sendResponse({ ok: true });
        break;
      }

      case 'CONFIG_GET': {
        const { auraConfig } = await chrome.storage.local.get('auraConfig');
        sendResponse({ ok: true, config: auraConfig || getDefaultConfig() });
        break;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});

// ── Tab Capture State Machine ─────────────────────────────────────────────

async function toggleCapture(tab) {
  const { captureState = 'idle' } = await chrome.storage.session.get('captureState');

  // Prevent race conditions
  if (captureState === 'starting' || captureState === 'stopping') return;

  if (captureState === 'idle') {
    await startCapture(tab);
  } else {
    await stopCapture();
  }
}

async function startCapture(tab) {
  if (!tab?.id) return;
  await chrome.storage.session.set({ captureState: 'starting', activeTabId: tab.id });

  try {
    // Get the media stream ID for the tab's audio
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });

    // Ensure offscreen document exists
    await ensureOffscreen();

    // Send stream ID to offscreen document to start capture
    const { auraConfig } = await chrome.storage.local.get('auraConfig');
    const config = auraConfig || getDefaultConfig();

    await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      target: 'offscreen',
      streamId,
      tabId: tab.id,
      config,
    });

    await chrome.storage.session.set({ captureState: 'capturing' });

    // Notify content script
    await chrome.tabs.sendMessage(tab.id, { type: 'AURA_ACTIVATED' }).catch(() => {});

    // Show badge
    await chrome.action.setBadgeText({ text: '●', tabId: tab.id });
    await chrome.action.setBadgeBackgroundColor({ color: '#4ECDC4', tabId: tab.id });

  } catch (err) {
    console.error('[AURA SW] startCapture failed:', err);
    await chrome.storage.session.set({ captureState: 'idle' });
    sendToPanel({ type: 'ERROR', message: String(err) });
  }
}

async function stopCapture() {
  const { activeTabId } = await chrome.storage.session.get('activeTabId');
  await chrome.storage.session.set({ captureState: 'stopping' });

  try {
    // Tell offscreen to stop
    await chrome.runtime.sendMessage({
      type: 'STOP_CAPTURE',
      target: 'offscreen',
    }).catch(() => {});

    // Close offscreen document
    const hasOffscreen = await chrome.offscreen.hasDocument();
    if (hasOffscreen) {
      await chrome.offscreen.closeDocument();
    }

    if (activeTabId) {
      await chrome.tabs.sendMessage(activeTabId, { type: 'AURA_DEACTIVATED' }).catch(() => {});
      await chrome.action.setBadgeText({ text: '', tabId: activeTabId });
    }
  } finally {
    await chrome.storage.session.set({ captureState: 'idle', activeTabId: null });
    sendToPanel({ type: 'DEACTIVATED' });
  }
}

async function ensureOffscreen() {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Capture and process Google Meet audio for AURA AI incident analysis',
    });
  }
}

function sendToPanel(message) {
  // Broadcast to all extension pages (side panel receives it)
  chrome.runtime.sendMessage({ ...message, target: 'panel' }).catch(() => {});
}

function getDefaultConfig() {
  return {
    auraBaseUrl: 'http://localhost:3000',
    channelName: 'meet-war-room',
    speakerName: 'Meeting Participant',
    speakerUid: 'meet_participant',
    voiceEnabled: true,
    autoActivate: false,
    language: 'en-US',
  };
}
