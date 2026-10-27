import { CookieHelper } from './CookieHelper.js';

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
