import { afterEach, describe, expect, test, vi } from 'vitest';
import { RateLimiter, RateLimitWindow } from './RateLimiter.js';

afterEach(() => vi.useRealTimers());

describe('RateLimitWindow category limits', () => {
    test('uses category limits, including zero, and the empty-string fallback', () => {
        const window = new RateLimitWindow({ limit: new Map([['', 2], ['high', 4], ['disabled', 0]]), duration: 1000 });
        expect(window.getLimit('high')).toBe(4);
        expect(window.getLimit('disabled')).toBe(0);
        expect(window.getLimit('unknown')).toBe(2);
        expect(window.getLimit('')).toBe(2);
        expect(window.getLimit()).toBe(2);
    });

    test('defaults to zero without a fallback and supports numeric limits', () => {
        expect(new RateLimitWindow({ limit: new Map(), duration: 1000 }).getLimit('unknown')).toBe(0);
        expect(new RateLimitWindow({ limit: 3, duration: 1000 }).getLimit('unknown')).toBe(3);
    });

    test('tracks weighted requests and resets expired windows', () => {
        vi.useFakeTimers();
        const window = new RateLimitWindow({ limit: new Map([['', 2], ['high', 4]]), duration: 1000 });
        window.track('key', 4, 'high');
        expect(() => window.track('key', 1, 'high')).toThrow();
        vi.advanceTimersByTime(1001);
        expect(() => window.track('key', 2)).not.toThrow();
        expect(window.windows.get('key')).toBe(2);
    });

    test('applies every configured window', () => {
        const limiter = new RateLimiter({ limits: [{ limit: 3, duration: 1000 }, { limit: new Map([['', 1]]), duration: 2000 }] });
        limiter.track('key');
        expect(() => limiter.track('key')).toThrow();
    });
});
