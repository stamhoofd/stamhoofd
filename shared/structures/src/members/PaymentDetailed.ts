import { ArrayDecoder,field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { Payment } from './Payment';
import { RegistrationWithMember } from './RegistrationWithMember';


export class PaymentDetailed extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[]

    getMemberNamesArray() {
        return Formatter.uniqueArray(this.registrations.map(r => r.member.name))
    }

    getMemberNames() {
        return Formatter.joinLast(this.getMemberNamesArray(), ", ", " en ")
    }

    getMemberFirstNames() {
        return Formatter.joinLast(Formatter.uniqueArray(this.registrations.map(r => r.member.firstName)), ", ", " en ")
    }

    getMemberLastNames() {
        return Formatter.uniqueArray(this.registrations.map(r => r.member.lastName ?? "Onbekend")).join(", ")
    }

    getRegistrationList() {
        return this.registrations.map(r => (r.member?.name ?? "Onbekend")+" voor "+r.group.settings.name).join(", ")
    }

    /**
     * @deprecated
     */
    override matchQuery(query: string): boolean {
        return false;
    }

    getDetailsHTMLTable(): string {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Naam</th><th>Ingeschreven voor</th></tr></thead><tbody>`
        
        for (const registration of this.registrations) {
            str += `<tr><td><h4>${Formatter.escapeHtml(registration.member.name)}</h4></td><td>${Formatter.escapeHtml(registration.group.settings.name)}</td></tr>`
        }
        
        return str+"</tbody></table>";
    }
}
