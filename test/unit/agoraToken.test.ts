import { describe, it, expect } from 'vitest';
import { UniversalRtcTokenBuilder, UniversalRtmTokenBuilder, RtcRole } from '@/lib/agoraToken';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AccessToken2 } = require('agora-token/src/AccessToken2');

describe('Universal Agora Token Generator (lib/agoraToken.ts)', () => {
  const appId = '19799ac757954cee89d3088b3ace282c';
  const cert = '25013048c4ab44dcb681572658bda440';

  it('generates an RTC token with account that passes Agora signature verification', async () => {
    const token = await UniversalRtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      cert,
      'incident-sev1-checkout',
      'priya_pm',
      RtcRole.PUBLISHER,
      3600
    );

    expect(token.startsWith('007')).toBe(true);

    const parser = new AccessToken2('', '');
    expect(parser.from_string(token)).toBe(true);
    expect(parser.appId.toString()).toBe(appId);
    expect(parser.verifySignature(cert)).toBe(true);
  });

  it('generates an RTC + RTM combined token that passes Agora signature verification', async () => {
    const token = await UniversalRtcTokenBuilder.buildTokenWithRtm(
      appId,
      cert,
      'incident-sev1-checkout',
      '0',
      RtcRole.PUBLISHER,
      3600
    );

    expect(token.startsWith('007')).toBe(true);

    const parser = new AccessToken2('', '');
    expect(parser.from_string(token)).toBe(true);
    expect(parser.appId.toString()).toBe(appId);
    expect(parser.verifySignature(cert)).toBe(true);
  });

  it('generates an RTM token that passes Agora signature verification', async () => {
    const token = await UniversalRtmTokenBuilder.buildToken(
      appId,
      cert,
      'priya_pm',
      3600
    );

    expect(token.startsWith('007')).toBe(true);

    const parser = new AccessToken2('', '');
    expect(parser.from_string(token)).toBe(true);
    expect(parser.appId.toString()).toBe(appId);
    expect(parser.verifySignature(cert)).toBe(true);
  });
});
