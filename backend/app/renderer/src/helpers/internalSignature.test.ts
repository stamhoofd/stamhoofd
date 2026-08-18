import { signInternal, verifyInternalSignature } from '@stamhoofd/backend-env';
import { TestUtils } from '@stamhoofd/test-utils';

describe('verifyInternalSignature', () => {
    const rendererKey = Buffer.from('renderer-own-secret').toString('base64');
    const platformKey = Buffer.from('other-platform-secret').toString('base64');
    const unknownKey = Buffer.from('unknown-secret').toString('base64');
    const content = ['cache-id', '1755500000000', '<html>test</html>'];

    function signWith(key: string, ...signedContent: string[]) {
        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', key);
        return signInternal(...signedContent);
    }

    beforeEach(() => {
        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', rendererKey);
        TestUtils.setEnvironment('EXTRA_INTERNAL_SECRET_KEYS', undefined);
    });

    test('Accepts a signature created with the own key', () => {
        const signature = signWith(rendererKey, ...content);

        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', rendererKey);
        expect(verifyInternalSignature(signature, ...content)).toBe(true);
    });

    test('Accepts a signature created with an extra accepted key', () => {
        const signature = signWith(platformKey, ...content);

        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', rendererKey);
        TestUtils.setEnvironment('EXTRA_INTERNAL_SECRET_KEYS', [platformKey]);
        expect(verifyInternalSignature(signature, ...content)).toBe(true);
    });

    test('Rejects a signature created with an unknown key', () => {
        const signature = signWith(unknownKey, ...content);

        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', rendererKey);
        TestUtils.setEnvironment('EXTRA_INTERNAL_SECRET_KEYS', [platformKey]);
        expect(verifyInternalSignature(signature, ...content)).toBe(false);
    });

    test('Rejects a signature from another key when no extra keys are configured', () => {
        const signature = signWith(platformKey, ...content);

        TestUtils.setEnvironment('INTERNAL_SECRET_KEY', rendererKey);
        expect(verifyInternalSignature(signature, ...content)).toBe(false);
    });

    test('Rejects a valid signature over different content', () => {
        const signature = signWith(rendererKey, ...content);

        expect(verifyInternalSignature(signature, 'cache-id', '1755500000000', '<html>altered</html>')).toBe(false);
    });

    test('Rejects a malformed signature without throwing', () => {
        expect(verifyInternalSignature('not-a-valid-signature', ...content)).toBe(false);
        expect(verifyInternalSignature('', ...content)).toBe(false);
    });
});
