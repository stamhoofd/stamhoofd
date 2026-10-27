import type { Response } from '@node/endpoints';
import * as cookie from 'cookie';
import type http from 'http';

export type ObjectWithHeaders = {
    headers: http.IncomingHttpHeaders;
};

type DecodedRequestWithCookies = ObjectWithHeaders & { cookies?: Map<string, string | undefined> };

export class CookieHelper {
    /** Caches parsed cookie names as literal keys; HTTP headers remain transport objects. */
    static getCookies(request: ObjectWithHeaders): Map<string, string | undefined> {
        const r = request as DecodedRequestWithCookies;
        if (r.cookies) {
            return r.cookies;
        }

        const header = r.headers.cookie;
        if (!header) {
            r.cookies = new Map();
            return r.cookies;
        }

        // Parse
        r.cookies = new Map(Object.entries(cookie.parseCookie(header)));
        return r.cookies;
    }

    static getCookie(request: ObjectWithHeaders, name: string): string | undefined {
        const cookies = this.getCookies(request);
        return cookies.get(name);
    }

    static setCookie(response: Response<any>, name: string, value: string, options?: { httpOnly?: boolean; secure?: boolean; expires?: Date }) {
        const cookies = cookie.stringifySetCookie({ name, value, ...options });
        let currentCookies = response.headers['set-cookie'];
        if (!currentCookies) {
            response.headers['set-cookie'] = [
                cookies,
            ];
        } else {
            if (!Array.isArray(currentCookies)) {
                currentCookies = [currentCookies.toString()];
                response.headers['set-cookie'] = currentCookies;
            }

            (currentCookies).push(cookies);
        }
    }
}
