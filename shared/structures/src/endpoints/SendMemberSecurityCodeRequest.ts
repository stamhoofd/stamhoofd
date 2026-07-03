import { AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { SecurityCodeSendMethod } from '../members/SecurityCodeSendMethod.js';

/**
 * Request to send the security code of a member to the member (or its parents) via email or SMS.
 *
 * The member is looked up either by its id, or by the combination of first name, last name and birth day.
 */
export class SendMemberSecurityCodeRequest extends AutoEncoder {
    /**
     * Look up the member by id. When set, the name/birthDay fields are ignored.
     */
    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: new EnumDecoder(SecurityCodeSendMethod) })
    method: SecurityCodeSendMethod;

    /**
     * Optional phone number the user filled in. When it matches one of the phone numbers we know for the
     * member (or its parents), the SMS is only sent to that number. Otherwise we fall back to cycling
     * through the known phone numbers using tryCount. Only used when method is SMS.
     */
    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    /**
     * The number of times this method has already been tried by the client for this member.
     * Used to cycle through the available phone numbers when sending via SMS.
     */
    @field({ decoder: IntegerDecoder })
    tryCount = 0;
}
