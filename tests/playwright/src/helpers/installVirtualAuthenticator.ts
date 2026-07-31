import type { Page } from '@playwright/test';

/**
 * Give this page a software authenticator, so the passkey flows can run unattended:
 * Chromium answers navigator.credentials itself instead of handing the ceremony to the
 * operating system. It behaves like a phone that is already unlocked, and it keeps the
 * passkeys it creates across navigations of this page.
 *
 * Chromium only, which is the only browser these tests run in.
 */
export async function installVirtualAuthenticator(page: Page): Promise<void> {
    const client = await page.context().newCDPSession(page);
    await client.send('WebAuthn.enable');
    await client.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    });
}
