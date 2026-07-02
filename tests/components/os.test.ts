// @vitest-environment jsdom
import { detectMac } from '../../web/src/os.ts';

function fakeNav(overrides: Partial<Navigator & { userAgentData?: { platform?: string } }>): Navigator {
  return { userAgent: '', ...overrides } as Navigator;
}

describe('detectMac', () => {
  it('uses userAgentData.platform when present and Mac', () => {
    const nav = fakeNav({ userAgentData: { platform: 'macOS' }, userAgent: 'some unrelated string' });
    expect(detectMac(nav)).toBe(true);
  });

  it('uses userAgentData.platform when present and non-Mac', () => {
    const nav = fakeNav({ userAgentData: { platform: 'Windows' }, userAgent: 'Macintosh' });
    expect(detectMac(nav)).toBe(false);
  });

  it('falls back to userAgent regex when userAgentData is absent, matching Mac', () => {
    const nav = fakeNav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)' });
    expect(detectMac(nav)).toBe(true);
  });

  it('falls back to userAgent regex when userAgentData is absent, not matching', () => {
    const nav = fakeNav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(detectMac(nav)).toBe(false);
  });
});
