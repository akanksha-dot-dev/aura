import { NextRequest, NextResponse } from 'next/server';
import { addEvidenceToIncident } from '@/lib/incidentStore';
import { EvidenceItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channelName = 'incident-war-room', item } = body;

    if (!item || !item.content) {
      return NextResponse.json(
        { error: 'Missing evidence item or content' },
        { status: 400 }
      );
    }

    const updatedState = addEvidenceToIncident(channelName, item as EvidenceItem);

    return NextResponse.json({
      success: true,
      evidenceCount: updatedState.evidenceItems.length,
      currentOODAPhase: updatedState.currentOODAPhase,
    });
  } catch (err) {
    console.error('[/api/incident/event] Error recording evidence:', err);
    return NextResponse.json(
      { error: 'Internal server error recording evidence' },
      { status: 500 }
    );
  }
}
