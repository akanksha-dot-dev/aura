import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';

describe('KeyboardShortcutsModal (components/KeyboardShortcutsModal.tsx)', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <KeyboardShortcutsModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders hotkey groups and items when isOpen is true', () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Command Hotkeys')).toBeInTheDocument();
    expect(screen.getByText('OPERATIONAL CALM')).toBeInTheDocument();
    expect(screen.getByText('Panels & Layout')).toBeInTheDocument();
    expect(screen.getByText('Audio & Mission Control')).toBeInTheDocument();
    expect(screen.getByText('Investigation Canvas')).toBeInTheDocument();

    // Check specific hotkey descriptions and badges
    expect(screen.getByText('Toggle Left Voice Bridge Rail (48px / 280px)')).toBeInTheDocument();
    expect(screen.getByText('Push-to-Talk (Hold while speaking to stream audio)')).toBeInTheDocument();
    expect(screen.getByText('[ESC]')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /Close shortcuts/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
