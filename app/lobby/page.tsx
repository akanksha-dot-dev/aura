'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LobbyScreen } from '@/components/LobbyScreen';
import { PersonaConfig } from '@/lib/constants';

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get('channel') || 'incident-sev1-checkout';
  const [isConnecting, setIsConnecting] = useState(false);

  const handleJoin = (persona: PersonaConfig) => {
    setIsConnecting(true);
    const params = new URLSearchParams({
      uid: persona.uid,
      name: persona.displayName,
      role: persona.role,
      channel,
    });
    router.push(`/?${params.toString()}`);
  };

  return <LobbyScreen onJoin={handleJoin} isConnecting={isConnecting} />;
}

export default function LobbyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} />}>
      <LobbyContent />
    </Suspense>
  );
}
