import { base64ToBytes, looksLikeFinger } from '@/lib/finger';

describe('base64ToBytes', () => {
  it('round-trips arbitrary bytes', () => {
    const original = Uint8Array.from([0, 1, 2, 250, 255, 127, 64, 33, 7]);
    const b64 = Buffer.from(original).toString('base64');
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(original));
  });

  it('handles padding variants', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd', 'hello world!']) {
      const b64 = Buffer.from(text).toString('base64');
      expect(Buffer.from(base64ToBytes(b64)).toString()).toBe(text);
    }
  });
});

describe('looksLikeFinger', () => {
  it('recognizes the torch-through-tissue signature', () => {
    expect(looksLikeFinger({ r: 235, g: 70, b: 55 })).toBe(true);
    expect(looksLikeFinger({ r: 140, g: 80, b: 60 })).toBe(true);
  });

  it('rejects ordinary scenes', () => {
    expect(looksLikeFinger({ r: 120, g: 115, b: 108 })).toBe(false); // desk
    expect(looksLikeFinger({ r: 30, g: 28, b: 26 })).toBe(false); // dark room
    expect(looksLikeFinger({ r: 90, g: 40, b: 35 })).toBe(false); // too dim to trust
  });
});
