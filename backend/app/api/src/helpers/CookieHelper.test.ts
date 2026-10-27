import { CookieHelper } from './CookieHelper.js';

describe('cookie dictionary isolation', () => {
    test('absent cookies cannot resolve inherited object properties', () => {
        const request = { headers: {} };
        for (const name of ['constructor', '__proto__', 'prototype', 'toString']) {
            expect(CookieHelper.getCookie(request, name)).toBeUndefined();
        }
    });

    test('retains special cookie names as literal data', () => {
        const request = { headers: { cookie: '__proto__=first; constructor=second; prototype=third' } };
        expect(CookieHelper.getCookie(request, '__proto__')).toBe('first');
        expect(CookieHelper.getCookie(request, 'constructor')).toBe('second');
        expect(CookieHelper.getCookie(request, 'prototype')).toBe('third');
    });
});

describe('CookieHelper', () => {
    test('parses and caches cookies without changing decoding or duplicate-name behavior', () => {
        const request = { headers: { cookie: 'session=first; name=Jane%20Doe; session=second; empty=' } };
        const cookies = CookieHelper.getCookies(request);
        expect(cookies).toEqual(new Map([['session', 'first'], ['name', 'Jane Doe'], ['empty', '']]));
        expect(CookieHelper.getCookies(request)).toBe(cookies);
        expect(CookieHelper.getCookie(request, 'name')).toBe('Jane Doe');
        expect(CookieHelper.getCookie(request, 'missing')).toBeUndefined();
    });

    test('caches an independent empty Map for each request without a cookie header', () => {
        const first = { headers: {} };
        const second = { headers: {} };
        const cookies = CookieHelper.getCookies(first);
        expect(cookies).toEqual(new Map());
        expect(CookieHelper.getCookies(first)).toBe(cookies);
        expect(CookieHelper.getCookies(second)).not.toBe(cookies);
    });
});
