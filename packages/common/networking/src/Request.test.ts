import { Request } from './Request';

describe('Request', () => {
    describe('parseHeaders', () => {
        it('Returns all headers', () => {
            const headers = Request.parseHeaders(`date: Fri, 08 Dec 2017 21:04:30 GMT\r\ncontent-encoding: gzip\r\nx-content-type-options: nosniff\r\nserver: meinheld/0.6.1\r\nx-frame-options: DENY\r\ncontent-type: text/html; charset=utf-8\r\nconnection: keep-alive\r\nstrict-transport-security: max-age=63072000\r\nvary: Cookie, Accept-Encoding\r\ncontent-length: 6502\r\nx-xss-protection: 1; mode=block\r\n`);
            expect(headers).toEqual({
                'date': 'Fri, 08 Dec 2017 21:04:30 GMT',
                'content-encoding': 'gzip',
                'x-content-type-options': 'nosniff',
                'server': 'meinheld/0.6.1',
                'x-frame-options': 'DENY',
                'content-type': 'text/html; charset=utf-8',
                'connection': 'keep-alive',
                'strict-transport-security': 'max-age=63072000',
                'vary': 'Cookie, Accept-Encoding',
                'content-length': '6502',
                'x-xss-protection': '1; mode=block',
            });
        });

        it('Skips empty lines', () => {
            const headers = Request.parseHeaders(`date: Fri, 08 Dec 2017 21:04:30 GMT\r\n\r\ncontent-encoding: gzip\r\nx-content-type-options: nosniff\r\nserver: meinheld/0.6.1\r\nx-frame-options: DENY\r\ncontent-type: text/html; charset=utf-8\r\nconnection: keep-alive\r\nstrict-transport-security: max-age=63072000\r\nvary: Cookie, Accept-Encoding\r\ncontent-length: 6502\r\nx-xss-protection: 1; mode=block`);
            expect(headers).toEqual({
                'date': 'Fri, 08 Dec 2017 21:04:30 GMT',
                'content-encoding': 'gzip',
                'x-content-type-options': 'nosniff',
                'server': 'meinheld/0.6.1',
                'x-frame-options': 'DENY',
                'content-type': 'text/html; charset=utf-8',
                'connection': 'keep-alive',
                'strict-transport-security': 'max-age=63072000',
                'vary': 'Cookie, Accept-Encoding',
                'content-length': '6502',
                'x-xss-protection': '1; mode=block',
            });
        });

        it('Lowercases headers', () => {
            const headers = Request.parseHeaders(`Date: Fri, 08 Dec 2017 21:04:30 GMT\r\nContent-Encoding: gzip\r\nX-Content-Type-Options: nosniff\r\nServer: meinheld/0.6.1\r\nX-Frame-Options: DENY\r\nContent-Type: text/html; charset=utf-8\r\nConnection: keep-alive\r\nStrict-Transport-Security: max-age=63072000\r\nVary: Cookie, Accept-Encoding\r\nContent-Length: 6502\r\nX-XSS-Protection: 1; mode=block`);
            expect(headers).toEqual({
                'date': 'Fri, 08 Dec 2017 21:04:30 GMT',
                'content-encoding': 'gzip',
                'x-content-type-options': 'nosniff',
                'server': 'meinheld/0.6.1',
                'x-frame-options': 'DENY',
                'content-type': 'text/html; charset=utf-8',
                'connection': 'keep-alive',
                'strict-transport-security': 'max-age=63072000',
                'vary': 'Cookie, Accept-Encoding',
                'content-length': '6502',
                'x-xss-protection': '1; mode=block',
            });
        });

        it('Handles single header', () => {
            const headers = Request.parseHeaders(`date: Fri, 08 Dec 2017 21:04:30 GMT`);
            expect(headers).toEqual({
                date: 'Fri, 08 Dec 2017 21:04:30 GMT',
            });
        });
    });
});
