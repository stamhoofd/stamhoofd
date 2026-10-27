import crypto from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { BuckarooHelper } from './BuckarooHelper.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

it('uses distinct signed nonces even when Math.random repeats within the same second', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const helper = new BuckarooHelper('merchant-id', 'test-signing-key', false);
    const first = helper.calculateHMAC('POST', 'https://checkout.buckaroo.nl/json/Transaction', '{}');
    const second = helper.calculateHMAC('POST', 'https://checkout.buckaroo.nl/json/Transaction', '{}');

    expect(first).not.toBe(second);
    const [key, signature, nonce, timestamp] = first.slice('hmac '.length).split(':');
    const rawData = key + 'POST' + encodeURIComponent('checkout.buckaroo.nl/json/Transaction').toLowerCase() + timestamp + nonce + helper.getEncodedContent('{}');
    expect(signature).toBe(crypto.createHmac('sha256', helper.secret).update(rawData).digest('base64'));
});
