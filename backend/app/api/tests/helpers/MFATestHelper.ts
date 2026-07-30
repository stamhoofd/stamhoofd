import type { User } from '@stamhoofd/models';
import { MFATOTP } from '@stamhoofd/models';
import { authenticator } from 'otplib';

import { RecoveryCodeHelper } from '../../src/helpers/RecoveryCodeHelper.js';
import { TOTPHelper } from '../../src/helpers/TOTPHelper.js';

/**
 * Set up two-factor authentication in tests, without going through the enrollment flow.
 * Also used by the Playwright tests, which drive the real UI but need to know the secret
 * of an authenticator app to generate its codes.
 */
export const MFATestHelper = {
    /**
     * Enroll a confirmed authenticator app and return its plaintext secret.
     */
    async addConfirmedTOTP(user: User, name = 'Test authenticator'): Promise<{ id: string; secret: string }> {
        const totp = new MFATOTP();
        const secret = authenticator.generateSecret();
        totp.userId = user.id;
        totp.name = name;
        totp.secret = TOTPHelper.encrypt(secret);
        totp.confirmedAt = new Date();
        await totp.save();
        return { id: totp.id, secret };
    },

    /**
     * The code an authenticator app would show right now for this secret.
     */
    generateTOTPCode(secret: string): string {
        return authenticator.generate(secret);
    },

    /**
     * Whether this recovery code is one of the user's valid codes. Consumes it, just like
     * using it to log in would.
     */
    async useRecoveryCode(userId: string, code: string): Promise<boolean> {
        return await RecoveryCodeHelper.consume(userId, code);
    },
};
