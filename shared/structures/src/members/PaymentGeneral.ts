import { ArrayDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { BalanceItemRelationType } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { BaseOrganization } from '../Organization.js';
import { Payment, Settlement } from './Payment.js';

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

    /**
     * Only set for administrators with the correct permissions
     */
    @field({ decoder: BaseOrganization, nullable: true, version: 344 })
    payingOrganization: BaseOrganization | null = null;

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
            const id = p.balanceItem.relations.get(BalanceItemRelationType.Member)?.name.toString();
            return id ? [id] : [];
        });

        return Formatter.joinLast(Formatter.uniqueArray(ids), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
    }

    getDetailsHTMLTable(): string {
        let str = '';
        str += `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><thead><tr><th>${$t('3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d')}</th><th>${$t('52bff8d2-52af-4d3f-b092-96bcfa4c0d03')}</th></tr></thead><tbody>`;

        for (const balanceItemPayment of this.balanceItemPayments) {
            str += `<tr><td><h4>${Formatter.escapeHtml(balanceItemPayment.balanceItem.description)}</h4></td><td class="price">${Formatter.escapeHtml(Formatter.price(balanceItemPayment.price))}</td></tr>`;
        }

        return str + '</tbody></table>';
    }

    getShortDescription() {
        const shortDescriptions = this.balanceItemPayments.filter(p => p.price !== 0).map(p => p.balanceItem.paymentShortDescription!).filter(p => p !== null);

        // Count the number of times each description occurs and add prefix if more than 1
        const counts: { [key: string]: number } = {};
        for (const shortDescription of shortDescriptions) {
            counts[shortDescription] = (counts[shortDescription] || 0) + 1;
        }

        // Add prefix if more than 1
        const arr: string[] = [];
        for (const shortDescription of Object.keys(counts)) {
            if (counts[shortDescription] > 1) {
                arr.push(counts[shortDescription] + ' x ' + shortDescription);
            }
            else {
                arr.push(shortDescription);
            }
        }

        return Formatter.capitalizeFirstLetter(Formatter.joinLast(arr, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '));
    }
}
