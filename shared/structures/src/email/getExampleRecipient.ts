import { MemberDetails } from '../members/MemberDetails.js';
import { MemberWithRegistrationsBlob } from '../members/MemberWithRegistrationsBlob.js';
import type { EmailRecipientFilterType } from './EmailRecipientFilterType.js';

export function getExampleRecipient(type: EmailRecipientFilterType | null = null) {
    return MemberWithRegistrationsBlob.create({
        details: MemberDetails.create({
            firstName: $t(`%13h`),
            lastName: $t(`%13i`),
            email: $t(`%13a`),
        }),
    }).getEmailRecipients(['member'])[0];
}
