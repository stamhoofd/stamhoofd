import { ArrayDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding'
import { Formatter } from '@stamhoofd/utility'

import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed'
import { Payment, Settlement } from './Payment'

export class PaymentGeneral extends Payment {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentDetailed) })
    balanceItemPayments: BalanceItemPaymentDetailed[] = []

    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null

    @field({ decoder: StringDecoder, nullable: true })
    ibanName: string | null = null

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: IntegerDecoder, version: 196 })
    transferFee = 0

     /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: StringDecoder, nullable: true, version: 198 })
    stripeAccountId: string|null = null

    get registrations() {
        const registrations = this.balanceItemPayments.flatMap(p => p.balanceItem.registration ? [p.balanceItem.registration] : [])

        // Remove duplicates by id
        return registrations.filter((r, index) => registrations.findIndex(r2 => r2.id == r.id) === index)
    }

    get members() {
        const members = this.balanceItemPayments.flatMap(p => p.balanceItem.registration?.member ? [p.balanceItem.registration?.member] : [])

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

    /**
     * @deprecated
     */
    override matchQuery(query: string): boolean {
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
