import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('API Route: /api/health (app/api/health/route.ts)', () => {
  it('returns 200 status with health payload and valid timestamp', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('1.0.0');
    expect(typeof data.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false);
  });
});
