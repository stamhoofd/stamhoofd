import { ArrayDecoder, field } from '@simonbackx/simple-encoding'
import { Formatter } from '@stamhoofd/utility'

import { BalanceItemPaymentDetailed } from '../BalanceItem'
import { Payment } from './Payment'

export class PaymentGeneral extends Payment {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentDetailed) })
    balanceItemPayments: BalanceItemPaymentDetailed[]

    get registrations() {
        return this.balanceItemPayments.flatMap(p => p.balanceItem.registration ? [p.balanceItem.registration] : [])
    }

    get members() {
        const members = this.registrations.map(r => r.member)

        // Remove duplicates by id
        return members.filter((m, index) => members.findIndex(m2 => m2.id == m.id) === index)
    }

    get memberNames() {
        return Formatter.joinLast(this.members.map(m => m.name), ", ", " en ")
    }

    get memberFirstNames() {
        return Formatter.joinLast(this.members.map(m => m.firstName), ", ", " en ")
    }

    get orders() {
        return this.balanceItemPayments.flatMap(p => p.balanceItem.order ? [p.balanceItem.order] : [])
    }

    override matchQuery(query: string): boolean {
        if (
            super.matchQuery(query) 
            || !!this.registrations.find(r => r.member.details.matchQuery(query))
            || !!this.orders.find(o => o.matchQuery(query))
        ) {
            return true;
        }
        return false;
    }

    getDetailsHTMLTable(): string {
        const filtered = this.balanceItemPayments.filter(p => !p.balanceItem.order)
        let str = '';
        if (filtered.length > 0) {
            str += `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Beschrijving</th><th>Prijs</th></tr></thead><tbody>`
    
            for (const balanceItemPayment of filtered) {
                str += `<tr><td><h4>${Formatter.escapeHtml(balanceItemPayment.balanceItem.description)}</h4></td><td>${Formatter.escapeHtml(Formatter.price(balanceItemPayment.price))}</td></tr>`
            }
            
            return str+"</tbody></table>";
        }

        for (const order of this.orders) {
            str += order.getHTMLTable()
        }

        return str;
    }
}