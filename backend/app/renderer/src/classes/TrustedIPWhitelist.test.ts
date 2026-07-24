import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import fs from 'fs/promises';
import path from 'path';
import { TrustedIPWhitelist } from './TrustedIPWhitelist.js';

describe('TrustedIPWhitelist', () => {
    const whitelist = TrustedIPWhitelist.shared;

    afterEach(() => {
        whitelist.setFromText('');
    });

    describe('when disabled (no URL configured, non-deployment environment)', () => {
        test('enabled is false and assertAllowed is a no-op', () => {
            expect(whitelist.enabled).toBe(false);
            expect(whitelist.url).toBeUndefined();
            expect(() => whitelist.assertAllowed('8.8.8.8')).not.toThrow();
            expect(() => whitelist.assertAllowed('?')).not.toThrow();
        });
    });

    describe('default URL in real deployments', () => {
        test('production defaults to the built-in list URL', () => {
            TestUtils.setEnvironment('environment', 'production');
            expect(whitelist.enabled).toBe(true);
            expect(whitelist.url).toBe(TrustedIPWhitelist.DEFAULT_URL);
        });

        test('staging defaults to the built-in list URL', () => {
            TestUtils.setEnvironment('environment', 'staging');
            expect(whitelist.url).toBe(TrustedIPWhitelist.DEFAULT_URL);
        });

        test('an explicit URL overrides the default', () => {
            TestUtils.setEnvironment('environment', 'production');
            TestUtils.setEnvironment('PRERENDER_IP_WHITELIST_URL', 'https://example.com/list.txt');
            expect(whitelist.url).toBe('https://example.com/list.txt');
        });
    });

    describe('when enabled', () => {
        beforeEach(() => {
            TestUtils.setEnvironment('PRERENDER_IP_WHITELIST_URL', 'https://example.com/list.txt');
        });

        test('enabled reflects the configured URL', () => {
            expect(whitelist.enabled).toBe(true);
            expect(whitelist.url).toBe('https://example.com/list.txt');
        });

        test('setFromText parses entries and skips comments/blank lines', () => {
            const count = whitelist.setFromText('# a comment\n1.2.3.4\n\n10.0.0.0/8\n  \nnot-an-ip\n');
            // '1.2.3.4' and '10.0.0.0/8' are valid; the comment, blanks and 'not-an-ip' are ignored
            expect(count).toBe(2);
            expect(whitelist.count).toBe(2);
        });

        test('allows whitelisted IPs and blocks the rest', () => {
            whitelist.setFromText('1.2.3.4\n10.0.0.0/8');

            expect(whitelist.isWhitelisted('1.2.3.4')).toBe(true);
            expect(whitelist.isWhitelisted('10.255.255.255')).toBe(true);
            expect(whitelist.isWhitelisted('8.8.8.8')).toBe(false);

            expect(() => whitelist.assertAllowed('10.1.2.3')).not.toThrow();
            expect(() => whitelist.assertAllowed('8.8.8.8')).toThrow(
                STExpect.simpleError({ code: 'ip_not_whitelisted', statusCode: 403 }),
            );
        });

        test('blocks everything when no list is loaded (fail-closed)', () => {
            expect(whitelist.count).toBe(0);
            expect(() => whitelist.assertAllowed('1.2.3.4')).toThrow(
                STExpect.simpleError({ code: 'ip_not_whitelisted', statusCode: 403 }),
            );
        });

        test('blocks unknown/unparseable IPs', () => {
            whitelist.setFromText('1.2.3.4');
            expect(() => whitelist.assertAllowed('?')).toThrow(
                STExpect.simpleError({ code: 'ip_not_whitelisted', statusCode: 403 }),
            );
        });
    });

    describe('load', () => {
        const cacheFile = () => path.join(STAMHOOFD.CACHE_PATH, TrustedIPWhitelist.CACHE_FILE_NAME);

        const removeCache = () => fs.rm(cacheFile(), { force: true });

        function stubFetch(impl: () => Promise<unknown>) {
            vi.stubGlobal('fetch', vi.fn(impl));
        }

        const okBody = (body: string) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });

        beforeEach(async () => {
            TestUtils.setEnvironment('PRERENDER_IP_WHITELIST_URL', 'https://example.com/list.txt');
            await removeCache();
        });

        afterEach(async () => {
            vi.unstubAllGlobals();
            await removeCache();
        });

        test('fetches from the remote, installs the list and writes the cache', async () => {
            stubFetch(() => okBody('1.2.3.4\n10.0.0.0/8'));

            await whitelist.load();

            expect(whitelist.count).toBe(2);
            expect(whitelist.isWhitelisted('10.1.2.3')).toBe(true);
            expect(await fs.readFile(cacheFile(), 'utf-8')).toBe('1.2.3.4\n10.0.0.0/8');
        });

        test('falls back to the disk cache when the remote fetch fails', async () => {
            // A first successful load populates the disk cache.
            stubFetch(() => okBody('5.6.7.8'));
            await whitelist.load();
            expect(whitelist.isWhitelisted('5.6.7.8')).toBe(true);

            // The remote now fails: we keep serving the cached copy rather than dropping the list.
            stubFetch(() => Promise.reject(new Error('network down')));
            await whitelist.load();
            expect(whitelist.count).toBe(1);
            expect(whitelist.isWhitelisted('5.6.7.8')).toBe(true);
        });

        test('an empty remote response falls back to the disk cache', async () => {
            stubFetch(() => okBody('9.9.9.9'));
            await whitelist.load();

            stubFetch(() => okBody('   \n# nothing useful\n'));
            await whitelist.load();
            expect(whitelist.isWhitelisted('9.9.9.9')).toBe(true);
        });

        test('blocks everything (fail-closed) when the remote fails and there is no cache', async () => {
            stubFetch(() => Promise.reject(new Error('network down')));

            await whitelist.load();

            expect(whitelist.count).toBe(0);
            expect(() => whitelist.assertAllowed('1.2.3.4')).toThrow(
                STExpect.simpleError({ code: 'ip_not_whitelisted', statusCode: 403 }),
            );
        });

        test('is a no-op (no fetch) when whitelisting is disabled', async () => {
            TestUtils.setEnvironment('PRERENDER_IP_WHITELIST_URL', undefined);
            const fetchSpy = vi.fn(() => okBody('1.2.3.4'));
            vi.stubGlobal('fetch', fetchSpy);

            await whitelist.load();

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(whitelist.count).toBe(0);
        });
    });
});
