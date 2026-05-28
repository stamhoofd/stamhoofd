import { ArrayDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';

import { Sorter } from '@stamhoofd/utility';
import { BalanceItemRelationType } from '../BalanceItem.js';
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

    get calculatedPrice() {
        return this.balanceItemPayments.reduce((total, item) => total + item.price, 0);
    }

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

        return Formatter.joinLast(Formatter.uniqueArray(ids), ', ', ' ' + $t(`%M1`) + ' ');
    }

    getBalanceItemPaymentsHtmlTable() {
        return getBalanceItemPaymentsHtmlTable(this.balanceItemPayments);
    }

    /**
     * Customer name, phone, payment method and total price
     */
    getPaymentDataHTMLTable() {
        let str = `<table width="100%" cellspacing="0" cellpadding="0" class="email-data-table"><tbody>`;

        const customer = this.customer;

        const replacements: { title: string; value: string }[] = [];

        if (customer) {
            if (customer.company) {
                replacements.push({
                    title: customer.company.VATNumber || customer.company.companyNumber ? $t(`%1JI`) : $t('%1PW'),
                    value: customer.company.name,
                });

                if (customer.company.address) {
                    replacements.push({
                        title: customer.company.VATNumber || customer.company.companyNumber ? $t(`%MW`) : $t('%1Sh'),
                        value: customer.company.address.toString(),
                    });
                }

                if (customer.company.VATNumber) {
                    replacements.push({
                        title: $t(`%1CK`),
                        value: customer.company.VATNumber,
                    });
                } else if (customer.company.companyNumber) {
                    replacements.push({
                        title: $t(`%wa`),
                        value: customer.company.companyNumber,
                    });
                } else {
                    replacements.push({
                        title: $t(`%wa`),
                        value: $t('%1FW') + ' (' + $t('%1QY') + ')',
                    });
                }
            } else {
                replacements.push({
                    title: $t(`%1Os`),
                    value: customer.dynamicName,
                });
            }

            if (customer.phone) {
                replacements.push({
                    title: $t(`%18Z`),
                    value: customer.phone,
                });
            }

            if (customer.email) {
                replacements.push({
                    title: $t(`%1FK`),
                    value: customer.email,
                });
            }
        } else {
            // Information missing - default to email recipient data
            replacements.push({
                title: $t(`%1Os`),
                value: '{{firstName}} {{lastName}}', // will get replaced automatically by the email template system
            });
        }

        for (const replacement of replacements) {
            if (replacement.value.length === 0) {
                continue;
            }
            str += `<tr><td><h4>${Formatter.escapeHtml(replacement.title)}</h4></td><td>${Formatter.escapeHtml(replacement.value)}</td></tr>`;
        }

        return str + '</tbody></table>';
    }

    getShortDescription() {
        let shortDescriptions = this.balanceItemPayments.filter(p => p.price !== 0).map(p => p.balanceItem.paymentShortDescription!).filter(p => p !== null);

        if (shortDescriptions.length === 0) {
            // Include free items
            shortDescriptions = this.balanceItemPayments.map(p => p.balanceItem.paymentShortDescription!).filter(p => p !== null);
        }

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
            } else {
                arr.push(shortDescription);
            }
        }

        return Formatter.capitalizeFirstLetter(Formatter.joinLast(arr, ', ', ' ' + $t(`%M1`) + ' '));
    }
}

export type BalanceItemPaymentsHtmlTableItem = { price: number; itemDescription: string | null; balanceItem: { description: string }; itemTitle: string; quantity: number; unitPrice: number };
export function getBalanceItemPaymentsHtmlTable(balanceItemPayments: BalanceItemPaymentsHtmlTableItem[]) {
    const payments = balanceItemPayments.slice().sort((a, b) => {
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

        if (payment.quantity !== 1) {
            if (description) {
                description += `\n`;
            }
            description += `${Formatter.escapeHtml(Formatter.float(payment.quantity))} x ${Formatter.escapeHtml(Formatter.price(payment.unitPrice))}`;
        }

        const descriptionText = description ? `<p class="email-style-description-small pre-wrap">${description}</p>` : '';
        const titleColumn = `<td><h4 class="email-style-title-list">${Formatter.escapeHtml(title)}</h4>${descriptionText}</td>`;

        const price = payment.price === 0 ? $t('%1Mn') : Formatter.price(payment.price);
        const priceColumn = `<td>${Formatter.escapeHtml(price)}</td>`;

        str += `<tr>${titleColumn}${priceColumn}</tr>`;
    }

    return str + '</tbody></table>';
}
