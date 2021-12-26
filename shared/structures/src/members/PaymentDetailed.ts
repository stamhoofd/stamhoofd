import { ArrayDecoder,field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { Payment } from './Payment';
import { RegistrationWithMember } from './RegistrationWithMember';


export class PaymentDetailed extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[]

    getMemberNames() {
        return this.registrations.map(r => r.member.details?.name ?? "Onbekend").join(", ")
    }

    getMemberLastNames() {
        return Formatter.uniqueArray(this.registrations.map(r => r.member.details?.lastName ?? "Onbekend")).join(", ")
    }

    getRegistrationList() {
        return this.registrations.map(r => (r.member.details?.name ?? "Onbekend")+" voor "+r.group.settings.name).join(", ")
    }

    override matchQuery(query: string): boolean {
        if (
            super.matchQuery(query) ||
            this.registrations.find(r => r.member.details && r.member.details.matchQuery(query))
        ) {
            return true;
        }
        return false;
    }
}