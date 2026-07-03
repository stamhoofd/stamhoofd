import { AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { SecurityCodeSendMethod } from '../members/SecurityCodeSendMethod.js';

export class SendMemberSecurityCodeResponse extends AutoEncoder {
    @field({ decoder: new EnumDecoder(SecurityCodeSendMethod) })
    method: SecurityCodeSendMethod;

    /**
     * A masked description of where the code was sent to, safe to show to the user.
     * E.g. a masked phone number for SMS. Empty for email (sent to all known addresses).
     */
    @field({ decoder: StringDecoder })
    maskedRecipient = '';
}
