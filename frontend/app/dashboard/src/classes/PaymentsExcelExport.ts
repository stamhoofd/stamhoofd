import { Toast } from '@stamhoofd/components';
import { AppManager } from '@stamhoofd/networking';
import { BalanceItemPaymentDetailed, Group, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentProvider, StripeAccount, WebshopPreview } from '@stamhoofd/structures';
import XLSX from "xlsx";

import { ExcelHelper, RowValue } from './ExcelHelper';

export class PaymentsExcelExport {
    webshops: WebshopPreview[] = [];
    groups: Group[] = [];
    stripeAccounts: StripeAccount[] = [];
    filterBalanceItems: ((payment: BalanceItemPaymentDetailed) => boolean) | null

    constructor({webshops, stripeAccounts, groups, filterBalanceItems}: {webshops: WebshopPreview[], stripeAccounts: StripeAccount[], groups: Group[], filterBalanceItems?: ((payment: BalanceItemPaymentDetailed) => boolean) | null}) {
        this.webshops = webshops;
        this.stripeAccounts = stripeAccounts;
        this.groups = groups;
        this.filterBalanceItems = filterBalanceItems ?? null
    }

    createPayments(payments: PaymentGeneral[]): XLSX.WorkSheet {
        // Columns
        const wsData: RowValue[][] = [
            [
                "ID",
                "Omschrijving",
                "Bestelnummer",
                "Betaalmethode",
                "Betaalprovider",
                "Bestemming",
                "IBAN bestemming",
                "Aangemaakt op",
                "Betaald op",
                "Bedrag",
                "Transactiekosten",
                "Uitbetaald op",
                "Uitbetalingsbedrag",
                "Referentie",
            ],
        ];

        for (const payment of payments) {
            let destination = 'Onbekend';
            let iban = 'Onbekend';
            let reference = '';
            let webshop = '';
            const groups: string[] = [];

            if (payment.transferSettings && payment.method === PaymentMethod.Transfer) {
                destination = payment.transferSettings?.creditor ?? 'Rekeningnummer';
                iban = payment.transferSettings?.iban ?? 'Onbekend';
                reference = payment.transferDescription ?? '';
            }

            if (payment.settlement) {
                reference = payment.settlement.reference
            }

            if (payment.provider === PaymentProvider.Stripe) {
                if (payment.stripeAccountId) {
                    const stripeAccount = this.stripeAccounts.find(s => s.id === payment.stripeAccountId)
                    if (stripeAccount) {
                        destination = stripeAccount.meta.business_profile?.name || stripeAccount.meta.company?.name || stripeAccount.meta.bank_account_bank_name
                        if (stripeAccount.meta.bank_account_last4) {
                            iban = `xxxx ${stripeAccount.meta.bank_account_last4}`
                        }
                    } else {
                        destination = payment.stripeAccountId + ' (Verwijderd)'
                    }
                }
            }

            for (const item of payment.balanceItemPayments) {
                if (item.balanceItem.order) {
                    const webshopId = item.balanceItem.order.webshopId
                    webshop = this.webshops.find(w => w.id === webshopId)?.meta.name ?? 'Verwijderd';
                    break;
                }

                if (item.balanceItem.registration) {
                    const groupId = item.balanceItem.registration.groupId
                    const name = this.groups.find(g => g.id === groupId)?.settings.name

                    if (name) {
                        groups.push(name)
                    }
                }
            }

            wsData.push([
                payment.id,
                webshop ? webshop : (groups.length ? groups.join(', ') : payment.balanceItemPayments.map(bip => bip.balanceItem.description).join(", ")),
                {
                    value: (payment.balanceItemPayments[0]?.balanceItem?.order?.number ?? '/'),
                    format: '0'
                },
                PaymentMethodHelper.getNameCapitalized(payment.method),
                (payment.provider ?? '/'),
                destination,
                iban,
                {
                    value: payment.createdAt,
                    format: 'dd/mm/yyyy hh:mm'
                },
                {
                    value: payment.paidAt ?? '',
                    format: 'dd/mm/yyyy hh:mm'
                },
                {
                    value: payment.price / 100,
                    format: "€0.00"
                },
                {
                    value: payment.transferFee / 100,
                    format: "€0.00"
                },
                {
                    value: payment.settlement?.settledAt ?? '/',
                    format: 'dd/mm/yyyy hh:mm'
                },
                {
                    value: payment.settlement?.amount ? (payment.settlement.amount / 100) : '/',
                    format: "€0.00"
                },
                reference ?? '/'
            ]);
        }

        return ExcelHelper.buildWorksheet(wsData, {
            keepLastColumns: 0,
            defaultColumnWidth: 20
        })
    }

    createItems(payments: PaymentGeneral[]): XLSX.WorkSheet {
        const wsData: RowValue[][] = [
            [
                "Betaling ID",
                "Context",
                "Aantal",
                "Naam",
                "Omschrijving",
                "Prijs"
            ],
        ];

        for (const payment of payments) {
            for (const item of payment.balanceItemPayments) {
                if (this.filterBalanceItems && !this.filterBalanceItems(item)) {
                    continue;
                }

                const balanceItem = item.balanceItem

                if (balanceItem.order) {
                    for (const orderItem of balanceItem.order.data.cart.items) {
                        wsData.push([
                            payment.id,
                            balanceItem.description,
                            orderItem.amount,
                            orderItem.product.name,
                            orderItem.description,
                            {
                                value: (orderItem.price ?? 0) / 100,
                                format: "€0.00"
                            }
                        ]);
                    }

                    // Delivery cost
                    if (balanceItem.order.data.deliveryPrice) {
                        wsData.push([
                            payment.id,
                            balanceItem.description,
                            1,
                            'Leveringskosten',
                            '',
                            {
                                value: (balanceItem.order.data.deliveryPrice ?? 0) / 100,
                                format: "€0.00"
                            }
                        ]);
                    }

                    // Delivery cost
                    if (balanceItem.order.data.administrationFee) {
                        wsData.push([
                            payment.id,
                            balanceItem.description,
                            1,
                            'Administratiekosten',
                            '',
                            {
                                value: (balanceItem.order.data.administrationFee ?? 0) / 100,
                                format: "€0.00"
                            }
                        ]);
                    }

                    // Check difference in price from payments, and add a correction for it
                    const totalOrderPrice = balanceItem.order.data.totalPrice
                    const difference = item.price - totalOrderPrice

                    if (difference !== 0) {
                        wsData.push([
                            payment.id,
                            balanceItem.description,
                            1,
                            'Gewijzigde bestelling, verschil in prijs - positief als teveel betaald',
                            '',
                            {
                                value: (difference ?? 0) / 100,
                                format: "€0.00"
                            }
                        ]);
                    }
                    continue;
                }

                if (balanceItem.registration) {
                    const memberName = balanceItem.member?.name ?? 'Onbekend lid'

                    // Add item
                    wsData.push([
                        payment.id,
                        "Ledenadministratie",
                        1,
                        balanceItem.description,
                        memberName,
                        {
                            value: (item.price ?? 0) / 100,
                            format: "€0.00"
                        }
                    ]);

                    continue;
                }

                // Add item
                wsData.push([
                    payment.id,
                    "Overige",
                    1,
                    balanceItem.description,
                    "",
                    {
                        value: (item.price ?? 0) / 100,
                        format: "€0.00"
                    }
                ]);
            }
        }

        return ExcelHelper.buildWorksheet(wsData, {
            keepLastColumns: 0,
            defaultColumnWidth: 20
        })
    }

    export(payments: PaymentGeneral[]) {
        const wb = XLSX.utils.book_new();

        /* Add the worksheet to the workbook */
        XLSX.utils.book_append_sheet(wb, this.createItems(payments), "Items");
        XLSX.utils.book_append_sheet(wb, this.createPayments(payments), "Betalingen");


        if (AppManager.shared.downloadFile) {
            const data = XLSX.write(wb, { type: 'base64' });
            AppManager.shared.downloadFile(data, "betalingen.xlsx").catch(e => {
                Toast.fromError(e).show()
            });
        } else {
            XLSX.writeFile(wb, "betalingen.xlsx");
        }
    }
}
