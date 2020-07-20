import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment';
import { RegistrationWithMember } from './RegistrationWithMember';


export class PaymentDetailed extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[]

    getMemberNames() {
        return this.registrations.map(r => r.member.details?.name ?? "Onbekend").join(", ")
    }

    getPaymentPeriod() {
        let minYear = new Date().getFullYear();
        let maxYear = 0;
        for (const registration of this.registrations) {
            if (registration.group.settings.startDate.getFullYear() < minYear) {
                minYear = registration.group.settings.startDate.getFullYear()
            }
            if (registration.group.settings.endDate.getFullYear() > maxYear) {
                maxYear = registration.group.settings.endDate.getFullYear()
            }
        }

        return minYear+" - "+maxYear
    }
}