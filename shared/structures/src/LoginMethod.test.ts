import { LoginMethodConfig } from './LoginMethod.js';

describe('LoginMethodConfig.isEnabledForEmail', () => {
    test('a blocklisted domain cannot be bypassed by spelling it differently', () => {
        const config = LoginMethodConfig.create({ blocklist: ['example.com'] });

        // All of these resolve to the same account as victim@example.com, because users.email
        // is compared case and accent insensitively (and ignoring trailing spaces where the
        // column is still utf8mb4_unicode_ci)
        for (const email of [
            'victim@example.com',
            'victim@example.com ',
            'victim@éxample.com',
            'victim@exámple.com',
            'victim@EXAMPLE.COM',
            'victim@exampłe.com',
        ]) {
            expect(config.isEnabledForEmail(email)).toBe(false);
        }
    });

    test('a blocklisted domain with a sharp s cannot be bypassed by writing it out', () => {
        const config = LoginMethodConfig.create({ blocklist: ['straße.com'] });

        expect(config.isEnabledForEmail('victim@straße.com')).toBe(false);
        expect(config.isEnabledForEmail('victim@strasse.com')).toBe(false);
    });

    test('an allowlist matches the same spellings', () => {
        const config = LoginMethodConfig.create({ allowlist: ['example.com'] });

        expect(config.isEnabledForEmail('user@example.com')).toBe(true);
        expect(config.isEnabledForEmail('user@éxample.com')).toBe(true);
        expect(config.isEnabledForEmail('user@example.com ')).toBe(true);
        expect(config.isEnabledForEmail('user@other.com')).toBe(false);
    });

    test('the lists are matched on the domain, not on a subdomain or the local part', () => {
        const config = LoginMethodConfig.create({ blocklist: ['example.com'] });

        expect(config.isEnabledForEmail('victim@mail.example.com')).toBe(true);
        expect(config.isEnabledForEmail('example.com@other.com')).toBe(true);
    });

    test('an address with more than one at sign is matched on the last part', () => {
        const config = LoginMethodConfig.create({ blocklist: ['example.com'] });

        expect(config.isEnabledForEmail('victim@other.com@example.com')).toBe(false);
    });

    test('an address without an at sign is not enabled', () => {
        const config = LoginMethodConfig.create({});

        expect(config.isEnabledForEmail('b5f0e2d4-0000-0000-0000-000000000000.api')).toBe(false);
        expect(config.isEnabledForEmail('')).toBe(false);
    });

    test('an address without a domain is not enabled', () => {
        const config = LoginMethodConfig.create({});

        expect(config.isEnabledForEmail('victim@')).toBe(false);
        expect(config.isEnabledForEmail('victim@ ')).toBe(false);
    });

    test('every domain is enabled when both lists are empty', () => {
        const config = LoginMethodConfig.create({});

        expect(config.isEnabledForEmail('user@example.com')).toBe(true);
    });
});
