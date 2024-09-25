import { ArrayDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed';
import { Payment, Settlement } from './Payment';
import { BalanceItemRelationType } from '../BalanceItem';

export class PaymentGeneral extends Payment {
    @field({ decoder: new ArrayDecoder(BalanceItemPaymentDetailed) })
    balanceItemPayments: BalanceItemPaymentDetailed[] = [];

    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    ibanName: string | null = null;

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: IntegerDecoder, version: 196 })
    transferFee = 0;

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: StringDecoder, nullable: true, version: 198 })
    stripeAccountId: string | null = null;

    get groupIds() {
        const ids = this.balanceItemPayments.flatMap((p) => {
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Group)?.id;
            return id ? [id] : [];
        });

        return Formatter.uniqueArray(ids);
    }

    get webshopIds() {
        const ids = this.balanceItemPayments.flatMap((p) => {
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Webshop)?.id;
            return id ? [id] : [];
        });

        return Formatter.uniqueArray(ids);
    }

    get memberNames() {
        const ids = this.balanceItemPayments.flatMap((p) => {
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Member)?.name;
            return id ? [id] : [];
        });

        return Formatter.joinLast(Formatter.uniqueArray(ids), ', ', ' en ');
    }

    getDetailsHTMLTable(): string {
        let str = '';
        str += `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>Beschrijving</th><th>Prijs</th></tr></thead><tbody>`;

        for (const balanceItemPayment of this.balanceItemPayments) {
            str += `<tr><td><h4>${Formatter.escapeHtml(balanceItemPayment.balanceItem.description)}</h4></td><td>${Formatter.escapeHtml(Formatter.price(balanceItemPayment.price))}</td></tr>`;
        }

        return str + '</tbody></table>';
    }

    getShortDescription() {
        return Formatter.capitalizeFirstLetter(Formatter.joinLast(Formatter.uniqueArray(this.balanceItemPayments.map(p => p.balanceItem.paymentShortDescription!).filter(p => p !== null)), ', ', ' en '));
    }
}
