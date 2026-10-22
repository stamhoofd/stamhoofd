import { MemberDetails } from '../members/MemberDetails.js';
import { MemberWithRegistrationsBlob } from '../members/MemberWithRegistrationsBlob.js';

export class EmailHelper {
    static getExampleRecipient() {
        return MemberWithRegistrationsBlob.create({
            details: MemberDetails.create({
                firstName: $t(`%13h`),
                lastName: $t(`%13i`),
                email: $t(`%13a`),
            }),
        }).getEmailRecipients(['member'])[0];
    }
}
