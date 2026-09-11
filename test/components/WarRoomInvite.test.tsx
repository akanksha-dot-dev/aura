import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WarRoomInvite } from '@/components/modals/WarRoomInvite';

const mockRoomInfo = {
  health: {
    agora: { appId: true, certificate: true, restApi: true },
    openAi: { key: true },
    proxy: { secret: true, url: true, mcpUrl: true },
    slack: { configured: false },
  },
  voiceReady: true,
  network: {
    localIps: ['192.168.1.101'],
    primaryLanIp: '192.168.1.101',
    lanOrigin: 'http://192.168.1.101:3000',
    publicOrigin: null,
    isPublic: false,
  },
  channel: 'incident-war-room',
  lobbyUrl: 'http://192.168.1.101:3000/lobby',
  personaLinks: [
    {
      uid: 'alex_ic',
      name: 'Alex',
      role: 'Incident Commander',
      emoji: '🎖️',
      color: '#6C5CE7',
      description: 'Leads the war room, makes final decisions',
      url: 'http://192.168.1.101:3000/lobby?prefill_uid=alex_ic',
      directUrl: 'http://192.168.1.101:3000/?uid=alex_ic',
    },
    {
      uid: 'marcus_sre',
      name: 'Marcus',
      role: 'DevOps / SRE',
      emoji: '🔧',
      color: '#00B4D8',
      description: 'Infrastructure, K8s, database diagnostics',
      url: 'http://192.168.1.101:3000/lobby?prefill_uid=marcus_sre',
      directUrl: 'http://192.168.1.101:3000/?uid=marcus_sre',
    },
  ],
  setupInstructions: null,
};

describe('WarRoomInvite (components/modals/WarRoomInvite.tsx)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/room/info')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRoomInfo),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      })
    );
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<WarRoomInvite isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and loads room info when isOpen is true', async () => {
    render(<WarRoomInvite isOpen={true} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: /War Room Invite/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Alex/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Marcus/i).length).toBeGreaterThan(0);
    });
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(<WarRoomInvite isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex/i).length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
