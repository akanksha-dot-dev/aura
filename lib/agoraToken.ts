/**
 * agoraToken.ts — ARCHIVED (Google Ecosystem Edition)
 *
 * This file previously implemented Agora Token007 generation using pako (zlib).
 * Token generation now uses Firebase Auth custom tokens (firebase-admin).
 * See: lib/firebaseAdmin.ts + app/api/token/route.ts
 *
 * Stubs are exported to prevent TypeScript errors in any files that still import
 * from this module during the transition period.
 */

export enum RtcRole {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

export class UniversalRtcTokenBuilder {
  static async buildTokenWithUserAccount(
    _appId: string,
    _appCertificate: string,
    _channelName: string,
    _account: string,
    _role: RtcRole,
    _tokenExpireSeconds: number
  ): Promise<string> {
    throw new Error('Agora token generation removed. Use Firebase Auth custom tokens instead.');
  }

  static async buildTokenWithRtm(
    _appId: string,
    _appCertificate: string,
    _channelName: string,
    _account: string,
    _role: RtcRole,
    _tokenExpireSeconds: number
  ): Promise<string> {
    throw new Error('Agora token generation removed. Use Firebase Auth custom tokens instead.');
  }
}

export class UniversalRtmTokenBuilder {
  static async buildToken(
    _appId: string,
    _appCertificate: string,
    _account: string,
    _tokenExpireSeconds: number
  ): Promise<string> {
    throw new Error('Agora token generation removed. Use Firebase Auth custom tokens instead.');
  }
}
