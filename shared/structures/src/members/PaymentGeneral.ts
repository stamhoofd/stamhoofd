import { ArrayDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { Sorter } from '@stamhoofd/utility';
import { BalanceItemRelationType, BalanceItemStatus } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { BaseOrganization } from '../Organization.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';
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
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    transferFee = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeePayout = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeeManual = 0;

    @field({ decoder: IntegerDecoder, optional: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, optional: true })
    serviceFeeManualCharged = 0;

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

    getBalanceItemPaymentsHtmlTable() {
        const payments = this.balanceItemPayments.slice().sort((a, b) => {
            return Sorter.stack(
                Sorter.byNumberValue(a.price, b.price),
                Sorter.byStringValue(a.itemDescription ?? a.balanceItem.description, b.itemDescription ?? b.balanceItem.description),
            );
        });

        let str = '';
        str += `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

        for (const payment of payments) {
            const title = payment.itemTitle;
            let description = Formatter.escapeHtml(payment.itemDescription ?? '');
            const item = payment.balanceItem;

            let prefix = '';
            let prefixClass = '';

            if (item.dueAt && item.payablePriceWithVAT >= 0) {
                prefix = `Te betalen tegen ${Formatter.date(item.dueAt)}`;

                if (item.isOverDue) {
                    prefixClass = 'error';
                }
            }

            if (item.status === BalanceItemStatus.Canceled) {
                prefix = $t(`72fece9f-e932-4463-9c2b-6e8b22a98f15`);
                prefixClass = 'error';
            }
            else if (item.priceOpen < 0 && item.pricePaid > item.payablePriceWithVAT && item.pricePaid > 0) {
                prefix = $t(`0c39a71f-be73-4404-8af0-cd9f238d2060`);
            }
            else if (item.payablePriceWithVAT >= 0 && item.priceOpen < 0) {
                // todo: is this correct?
                prefix = $t(`bdf22906-037e-4221-8d3e-113bc62da28e`);
            }

            if (payment.quantity !== 1) {
                if (description) {
                    description += `\n`;
                }
                description += `${Formatter.escapeHtml(Formatter.float(payment.quantity))} x ${Formatter.escapeHtml(Formatter.price(payment.unitPrice))}`;
            }

            let prefixHtml = '';

            if (prefix) {
                const prefixClassHtml = prefixClass ? ' ' + prefixClass : '';
                prefixHtml = `<p class="email-style-title-prefix-list${prefixClassHtml}">${Formatter.escapeHtml(prefix)}</p>`;
            }

            const descriptionText = description ? `<p class="email-style-description-small pre-wrap">${description}</p>` : '';
            const titleColumn = `<td>${prefixHtml}<h4 class="email-style-title-list">${Formatter.escapeHtml(title)}</h4>${descriptionText}</td>`;

            const price = payment.price === 0 ? $t('Gratis') : Formatter.price(payment.price);
            const priceColumn = `<td>${Formatter.escapeHtml(price)}</td>`;

            str += `<tr>${titleColumn}${priceColumn}</tr>`;
        }

        return str + '</tbody></table>';
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
