import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { MFATestHelper } from '@stamhoofd/backend/tests/helpers';

/**
 * Drives the two-factor authentication views:
 *  - passing a challenge with an authenticator app (login, password reset, ...)
 *  - the forced enrollment flow, including the recovery codes that are shown only once
 *
 * The tests act as the authenticator app: the secret is either known upfront (an
 * authenticator that was enrolled in the database) or read from the setup view, and the
 * codes are generated with the same library the backend verifies them with.
 */
export class TwoFactorFlow {
    readonly page: Page;

    constructor(options: { page: Page }) {
        this.page = options.page;
    }

    /**
     * Complete a two-factor challenge with an authenticator app.
     */
    async passTOTPChallenge(secret: string) {
        const chooseView = this.page.getByTestId('choose-mfa-method-view');
        await expect(chooseView).toBeVisible({ timeout: 20_000 });
        await chooseView.getByTestId('mfa-choose-totp').click();

        const verifyView = this.page.getByTestId('verify-totp-view');
        await expect(verifyView).toBeVisible();
        await this.fillCode(verifyView.getByTestId('mfa-totp-code'), secret);

        // The code is submitted automatically once all digits are filled in
        await expect(verifyView).toBeHidden({ timeout: 20_000 });
    }

    /**
     * Enroll an authenticator app in the forced enrollment view. Returns the secret of the
     * enrolled authenticator, so the test can log in with it afterwards.
     */
    async enrollTOTP(): Promise<string> {
        const setupView = this.page.getByTestId('setup-mfa-view');
        await expect(setupView).toBeVisible({ timeout: 20_000 });
        await setupView.getByTestId('mfa-setup-totp').click();

        return await this.confirmTOTPSetup();
    }

    /**
     * Complete the authenticator setup view itself. Reached either through the forced
     * enrollment choice (enrollTOTP) or straight from the two-factor settings.
     */
    async confirmTOTPSetup(): Promise<string> {
        const totpView = this.page.getByTestId('setup-totp-view');
        await expect(totpView).toBeVisible({ timeout: 20_000 });

        // The secret is shown next to the QR code, exactly what a user would scan or type
        // over into their authenticator app.
        const secret = (await totpView.locator('.totp-secret .secret').innerText()).trim();
        expect(secret).not.toBe('');

        await this.fillCode(totpView.getByTestId('mfa-setup-totp-code'), secret);
        await expect(totpView).toBeHidden({ timeout: 20_000 });

        return secret;
    }

    /**
     * The recovery codes of a first enrollment are shown once: check that they are all
     * visible, that they can be copied and acknowledge them. Returns the shown codes.
     */
    async saveRecoveryCodes({ expectedCount = 10 }: { expectedCount?: number } = {}): Promise<string[]> {
        const codesView = this.page.getByTestId('show-recovery-codes-view');
        await expect(codesView).toBeVisible({ timeout: 20_000 });

        const codeElements = codesView.getByTestId('recovery-codes').locator('code');
        await expect(codeElements).toHaveCount(expectedCount);

        const codes = (await codeElements.allInnerTexts()).map(code => code.trim());
        for (const code of codes) {
            expect(code).toMatch(/^[1-9A-Z]{4}(-[1-9A-Z]{4}){3}$/);
        }

        // The user must be able to take the codes with them
        await this.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await codesView.getByTestId('copy-recovery-codes').click();
        const clipboard = await this.page.evaluate(() => navigator.clipboard.readText());
        expect(clipboard).toBe(codes.join('\n'));

        await codesView.getByTestId('recovery-codes-done').click();

        // The codes are shown only once, so acknowledging them asks for a confirmation.
        await this.page.getByTestId('centered-message').getByRole('button', { name: 'Ja, ik heb ze bewaard' }).click();

        await expect(codesView).toBeHidden({ timeout: 20_000 });

        return codes;
    }

    /**
     * Enroll an authenticator app and save the recovery codes that are shown afterwards.
     */
    async completeForcedSetup(): Promise<{ secret: string; recoveryCodes: string[] }> {
        const secret = await this.enrollTOTP();
        const recoveryCodes = await this.saveRecoveryCodes();
        return { secret, recoveryCodes };
    }

    /**
     * Type the code an authenticator app would show right now into a code input.
     */
    private async fillCode(codeInput: ReturnType<Page['getByTestId']>, secret: string) {
        await codeInput.locator('input').fill(MFATestHelper.generateTOTPCode(secret));
    }
}
