import { Response } from '@simonbackx/simple-endpoints';
import cookie from 'cookie';
import http from 'http';

export type ObjectWithHeaders = {
    headers: http.IncomingHttpHeaders;
};

type DecodedRequestWithCookies = ObjectWithHeaders & { cookies?: Record<string, string> };

export class CookieHelper {
    static getCookies(request: ObjectWithHeaders): Record<string, string> {
        const r = request as DecodedRequestWithCookies;
        if (r.cookies) {
            return r.cookies;
        }

        const header = r.headers.cookie;
        if (!header) {
            r.cookies = {};
            return r.cookies;
        }

        // Parse
        r.cookies = cookie.parse(header);
        return r.cookies;
    }

    static getCookie(request: ObjectWithHeaders, name: string): string | undefined {
        const cookies = this.getCookies(request);
        return cookies[name];
    }

    static setCookie(response: Response<any>, name: string, value: string, options?: cookie.CookieSerializeOptions) {
        const cookies = cookie.serialize(name, value, options);
        let currentCookies = response.headers['set-cookie'];
        if (!currentCookies) {
            response.headers['set-cookie'] = [
                cookies,
            ];
        }
        else {
            if (!Array.isArray(currentCookies)) {
                currentCookies = [currentCookies.toString()];
                response.headers['set-cookie'] = currentCookies;
            }

            (currentCookies).push(cookies);
        }
    }
}
