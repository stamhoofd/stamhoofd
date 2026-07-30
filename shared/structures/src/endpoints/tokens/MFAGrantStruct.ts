import type { Data } from '@simonbackx/simple-encoding';

import { MFAMethodType, WebauthnAuthenticationCredential } from '../../MFA.js';

/// Only used as input. Completes a login that requires a second factor.
export class MFAGrantStruct {
    grantType: 'mfa';

    /**
     * The short-lived MFA session token received in the `require_mfa` error.
     */
    mfaToken: string;

    /**
     * Which factor the user is using to complete the login.
     */
    method: MFAMethodType;

    /**
     * A TOTP code or a recovery code (depending on `method`).
     */
    code: string | null = null;

    /**
     * The WebAuthn authentication assertion (when `method` is Passkey), decoded and
     * validated as a structure.
     */
    assertion: WebauthnAuthenticationCredential | null = null;

    static decode(data: Data): MFAGrantStruct {
        const struct = new MFAGrantStruct();
        struct.grantType = data.field('grant_type').equals('mfa');
        struct.mfaToken = data.field('mfa_token').string;
        struct.method = data.field('method').enum(MFAMethodType);
        struct.code = data.optionalField('code')?.string ?? null;

        const assertionData = data.optionalField('assertion');
        struct.assertion = assertionData ? WebauthnAuthenticationCredential.decode(assertionData) : null;

        return struct;
    }
}
