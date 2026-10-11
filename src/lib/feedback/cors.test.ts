import { describe, expect, it } from 'vitest';
import { corsHeaders } from './cors';

describe('feedback CORS', () => {
  it('allows only the apps', () => {
    expect(corsHeaders('capacitor://localhost')['Access-Control-Allow-Origin']).toBe('capacitor://localhost');
    expect(corsHeaders('https://localhost')['Access-Control-Allow-Origin']).toBe('https://localhost');
    expect(corsHeaders('https://evil.example')).toEqual({});
    expect(corsHeaders(null)).toEqual({});
  });
});
