import { Platform } from '@stamhoofd/structures';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { reactive } from 'vue';
import { LoginHelper } from './LoginHelper.ts';
import { SessionContext } from './SessionContext.ts';

describe('LoginHelper.verifyMfaPasskey', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('options reached through a reactive object can be cloned by password manager extensions', async () => {
        // Password manager extensions wrap navigator.credentials.get and postMessage the options to their content script.
        const get = vi.spyOn(navigator.credentials, 'get').mockImplementation((options) => {
            structuredClone(options!.publicKey);
            return Promise.reject(new DOMException('Cancelled', 'NotAllowedError'));
        });

        const challenge = reactive({
            webauthnAuthenticationOptions: {
                rpId: 'localhost',
                challenge: 'Y2hhbGxlbmdl',
                allowCredentials: [{ id: 'Y3JlZGVudGlhbA', type: 'public-key', transports: ['internal', 'hybrid'] }],
                userVerification: 'preferred',
                extensions: {},
            },
        });

        const session = new SessionContext(null, Platform.create({}));
        await expect(LoginHelper.verifyMfaPasskey(session, 'mfa-token', challenge.webauthnAuthenticationOptions)).resolves.toBe(false);
        expect(get).toHaveBeenCalledOnce();
    });
});
