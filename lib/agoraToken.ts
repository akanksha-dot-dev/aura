/**
 * agoraToken.ts — Universal, Edge-Compatible Agora Token007 Generator.
 *
 * Implements Agora AccessToken2 / Token007 spec using standard Web Crypto API (crypto.subtle)
 * and pure-JS zlib deflate (pako).
 *
 * Runs seamlessly in ALL environments:
 * 1. Next.js Edge Runtime local development (next dev) without Node 'crypto' module errors
 * 2. Cloudflare Pages / Workers (@cloudflare/next-on-pages)
 * 3. Node.js serverless runtimes
 * 4. Vitest test runner
 */

import { deflate } from 'pako';

function deflateBytes(data: Uint8Array): Uint8Array {
  return deflate(data);
}

export enum RtcRole {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

class ByteBuf {
  private buffer: Buffer;
  private position: number;

  constructor(initialCapacity = 1024) {
    this.buffer = Buffer.alloc(initialCapacity);
    this.position = 0;
  }

  private ensureCapacity(additionalLength: number): void {
    const requiredLength = this.position + additionalLength;
    if (requiredLength <= this.buffer.length) return;

    let capacity = this.buffer.length * 2;
    while (capacity < requiredLength) {
      capacity *= 2;
    }
    const expanded = Buffer.alloc(capacity);
    this.buffer.copy(expanded, 0, 0, this.position);
    this.buffer = expanded;
  }

  pack(): Buffer {
    const out = Buffer.alloc(this.position);
    this.buffer.copy(out, 0, 0, out.length);
    return out;
  }

  putUint16(v: number): this {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(v, this.position);
    this.position += 2;
    return this;
  }

  putUint32(v: number): this {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(v, this.position);
    this.position += 4;
    return this;
  }

  putBytes(bytes: Buffer | Uint8Array): this {
    this.putUint16(bytes.length);
    this.ensureCapacity(bytes.length);
    Buffer.from(bytes).copy(this.buffer, this.position);
    this.position += bytes.length;
    return this;
  }

  putString(str: string): this {
    return this.putBytes(Buffer.from(str, 'utf8'));
  }

  putTreeMapUInt32(map?: Record<number, number>): this {
    if (!map) {
      this.putUint16(0);
      return this;
    }
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    this.putUint16(keys.length);
    for (const k of keys) {
      this.putUint16(k);
      this.putUint32(map[k] ?? 0);
    }
    return this;
  }
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Buffer> {
  // 1. If Node crypto is available (Node.js, Vitest jsdom environment)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = typeof require !== 'undefined' ? require('crypto') : null;
    if (nodeCrypto?.createHmac) {
      const hmac = nodeCrypto.createHmac('sha256', Buffer.from(key));
      hmac.update(Buffer.from(data));
      return hmac.digest();
    }
  } catch {
    // Edge runtime / restricted environment
  }

  // 2. Standard Web Crypto API (Edge Runtime, Cloudflare Workers)
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const cryptoKey = await subtle.importKey(
      'raw',
      key as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await subtle.sign('HMAC', cryptoKey, data as unknown as BufferSource);
    return Buffer.from(signature);
  }

  throw new Error('No crypto implementation available in current runtime');
}

function packServiceRtc(channelName: string, account: string, expire: number, isPublisher: boolean): Buffer {
  const serviceBuf = new ByteBuf();
  serviceBuf.putUint16(1); // Service type 1: RTC

  const privileges: Record<number, number> = {
    1: expire, // kPrivilegeJoinChannel
  };
  if (isPublisher) {
    privileges[2] = expire; // kPrivilegePublishAudioStream
    privileges[3] = expire; // kPrivilegePublishVideoStream
    privileges[4] = expire; // kPrivilegePublishDataStream
  }
  serviceBuf.putTreeMapUInt32(privileges);

  const rtcParamBuf = new ByteBuf();
  rtcParamBuf.putString(channelName);
  rtcParamBuf.putString(account === '0' || !account ? '' : account);

  return Buffer.concat([serviceBuf.pack(), rtcParamBuf.pack()]);
}

function packServiceRtm(userId: string, expire: number): Buffer {
  const serviceBuf = new ByteBuf();
  serviceBuf.putUint16(2); // Service type 2: RTM
  serviceBuf.putTreeMapUInt32({ 1: expire }); // kPrivilegeLogin

  const rtmParamBuf = new ByteBuf();
  rtmParamBuf.putString(userId === '0' || !userId ? '' : userId);

  return Buffer.concat([serviceBuf.pack(), rtmParamBuf.pack()]);
}

async function buildToken(
  appId: string,
  appCertificate: string,
  services: Buffer[],
  expireTime: number
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 99999999) + 1;

  let signing = await hmacSha256(
    Buffer.from(appCertificate, 'utf8'),
    new ByteBuf().putUint32(issueTs).pack()
  );
  signing = await hmacSha256(
    signing,
    new ByteBuf().putUint32(salt).pack()
  );

  let signingInfo = new ByteBuf()
    .putString(appId)
    .putUint32(issueTs)
    .putUint32(expireTime)
    .putUint32(salt)
    .putUint16(services.length)
    .pack();

  for (const s of services) {
    signingInfo = Buffer.concat([signingInfo, s]);
  }

  const signature = await hmacSha256(signing, signingInfo);
  const content = Buffer.concat([
    new ByteBuf().putString(signature.toString('binary')).pack(),
    signingInfo,
  ]);

  const compressed = deflateBytes(content);
  return `007${Buffer.from(compressed).toString('base64')}`;
}

export class UniversalRtcTokenBuilder {
  static async buildTokenWithUserAccount(
    appId: string,
    appCertificate: string,
    channelName: string,
    account: string,
    role: RtcRole = RtcRole.PUBLISHER,
    tokenExpire = 3600,
    privilegeExpire = 0
  ): Promise<string> {
    const expire = privilegeExpire > 0 ? privilegeExpire : tokenExpire;
    const isPublisher = role === RtcRole.PUBLISHER;
    const services = [packServiceRtc(channelName, account, expire, isPublisher)];
    return buildToken(appId, appCertificate, services, tokenExpire);
  }

  static async buildTokenWithRtm(
    appId: string,
    appCertificate: string,
    channelName: string,
    account: string,
    role: RtcRole = RtcRole.PUBLISHER,
    tokenExpire = 3600,
    privilegeExpire = 0
  ): Promise<string> {
    const expire = privilegeExpire > 0 ? privilegeExpire : tokenExpire;
    const isPublisher = role === RtcRole.PUBLISHER;
    const services = [
      packServiceRtc(channelName, account, expire, isPublisher),
      packServiceRtm(account, expire),
    ];
    return buildToken(appId, appCertificate, services, tokenExpire);
  }
}

export class UniversalRtmTokenBuilder {
  static async buildToken(
    appId: string,
    appCertificate: string,
    userId: string,
    tokenExpire = 3600
  ): Promise<string> {
    const services = [packServiceRtm(userId, tokenExpire)];
    return buildToken(appId, appCertificate, services, tokenExpire);
  }
}
