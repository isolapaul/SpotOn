import { describe, expect, it } from 'vitest';
import { standaloneDocumentHeight } from './appViewport';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const base = { standalone: true, userAgent: IPHONE, safeAreaTop: 47, screenWidth: 390, screenHeight: 844 };

describe('standaloneDocumentHeight', () => {
  it('installed iPhone app under a see-through status bar: the screen height', () => {
    expect(standaloneDocumentHeight(base)).toBe(844);
    // screen.* can report landscape order; the app is portrait-only, so the long side wins
    expect(standaloneDocumentHeight({ ...base, screenWidth: 844, screenHeight: 390 })).toBe(844);
  });

  it('leaves everything else alone', () => {
    expect(standaloneDocumentHeight({ ...base, standalone: false })).toBeNull();
    expect(standaloneDocumentHeight({ ...base, safeAreaTop: 0 })).toBeNull();
    expect(standaloneDocumentHeight({ ...base, userAgent: IPHONE.replaceAll('iPhone', 'iPad') })).toBeNull();
  });
});
