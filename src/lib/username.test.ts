import { describe, expect, it } from 'vitest';
import { USERNAME_RE, generateUsername, isValidUsername, normalizeUsername } from './username';

describe('USERNAME_RE', () => {
  it.each(['abc', 'a_b', 'user_123', '___', '0123456789', 'a'.repeat(20)])('accepts %j', (name) => {
    expect(USERNAME_RE.test(name)).toBe(true);
  });

  it.each(['', 'ab', 'a'.repeat(21), 'Abc', 'ab c', 'ab-c', 'béla', 'ab.c', ' abc', 'abc '])('rejects %j', (name) => {
    expect(USERNAME_RE.test(name)).toBe(false);
  });
});

describe('normalizeUsername', () => {
  it('trims and lowercases', () => {
    expect(normalizeUsername('  Foo_Bar ')).toBe('foo_bar');
    expect(normalizeUsername('')).toBe('');
  });
});

describe('isValidUsername', () => {
  it('validates after normalizing', () => {
    expect(isValidUsername(' Foo_Bar ')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(21))).toBe(false);
    expect(isValidUsername('foo-bar')).toBe(false);
  });
});

describe('generateUsername', () => {
  const displayNames = [
    '',
    'Árvíztűrő Tükörfúrógép',
    'user',
    'John Smith',
    'Kovács Béla',
    'Jo',
    'A Very Long Display Name That Exceeds Everything',
    '李小龙',
    '!!!',
    'O\'Brien-Smith',
    'MiXeD CaSe 42',
    '   ',
    'émile zola',
    'x_y',
  ];
  const rands = [0.1234, 0.5, 0.999999, 0.0421, 0.9];

  it('produces names matching USERNAME_RE', () => {
    for (const name of displayNames) {
      for (const r of rands) {
        const generated = generateUsername(name, () => r);
        expect(generated, `${name} / ${r}`).toMatch(USERNAME_RE);
      }
      for (let i = 0; i < 50; i++) {
        expect(generateUsername(name)).toMatch(USERNAME_RE);
      }
    }
  });

  it('uses the display name base and the rand suffix', () => {
    expect(generateUsername('Árvíztűrő Tükörfúrógép', () => 0.5)).toBe('rvztrtkrfrgp500000');
    expect(generateUsername('', () => 0.123456)).toBe('user123456');
    expect(generateUsername('A Very Long Display Name', () => 0.000042)).toBe('averylongdis42');
  });
});
