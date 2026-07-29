import { buildDayPrefix, buildObjectKey, buildStoragePrefix, isLegacyKey, parseDayFromKey } from './index.js';

describe('object storage keys', () => {
    test.each([
        [{ environment: 'production' }, ''],
        [{ environment: 'development' }, 'development/'],
        [{ spacesPrefix: 'tenant', environment: 'production' }, 'tenant/'],
        [{ spacesPrefix: '/tenant/staging/', environment: 'development' }, 'tenant/staging/development/'],
        [{ spacesPrefix: 'tenant/development', environment: 'development' }, 'tenant/development/'],
        [{ spacesPrefix: 'development', environment: 'development' }, 'development/'],
    ])('builds a normalized storage prefix', (options, expected) => {
        expect(buildStoragePrefix(options)).toBe(expected);
    });

    test('uses UTC dates in day prefixes', () => {
        const root = 'tenant/staging/';
        const beforeMidnight = new Date('2026-01-09T23:59:59.999Z');
        const midnight = new Date('2026-01-10T00:00:00.000Z');
        expect(buildDayPrefix(root, beforeMidnight)).toBe('tenant/staging/d/2026/01/09/');
        expect(buildDayPrefix(root, midnight)).toBe('tenant/staging/d/2026/01/10/');
    });

    test('builds public and private keys', () => {
        const root = 'development/';
        const date = new Date('2026-01-10T12:00:00.000Z');
        const publicKey = buildObjectKey({
            root,
            date,
            isPrivate: false,
            fileId: 'file-id',
            filename: 'image.png',
        });
        expect(publicKey).toBe('development/d/2026/01/10/p/file-id/image.png');
        expect(parseDayFromKey(publicKey, root)).toBe('2026-01-10');

        const privateKey = buildObjectKey({
            root,
            date,
            isPrivate: true,
            userId: 'user-id',
            fileId: 'file-id',
            filename: 'document.pdf',
        });
        expect(privateKey).toBe('development/d/2026/01/10/users/user-id/file-id/document.pdf');
        expect(parseDayFromKey(privateKey, root)).toBe('2026-01-10');
    });

    test('recognizes keys created before day folders were introduced', () => {
        const root = 'development/';
        expect(isLegacyKey('development/p/file/image.png', root)).toBe(true);
        expect(isLegacyKey('development/users/user/file/image.png', root)).toBe(true);
        expect(isLegacyKey('development/d/2026/07/28/p/file/image.png', root)).toBe(false);
        expect(isLegacyKey('development/_sync/cursor.json', root)).toBe(false);
        expect(isLegacyKey('other/p/file/image.png', root)).toBe(false);
        expect(parseDayFromKey('development/d/2026/02/30/p/file/image.png', root)).toBeNull();
        expect(parseDayFromKey('development/p/file/image.png', root)).toBeNull();
    });

    test('requires a user for private keys', () => {
        expect(() => buildObjectKey({
            root: '',
            date: new Date('2026-01-10T00:00:00.000Z'),
            isPrivate: true,
            fileId: 'file-id',
            filename: 'document.pdf',
        })).toThrow('A userId is required');
    });
});
