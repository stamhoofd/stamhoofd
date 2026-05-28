import { BalanceItem, VATExcemptReason } from '../BalanceItem.js';
import { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { Invoice } from './Invoice.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';

describe('Invoice', () => {
    test('Rounding lots of items', () => {
        const payment = PaymentGeneral.create({
            method: PaymentMethod.Transfer,
        });

        {
            const balanceItem = new BalanceItem();
            balanceItem.id = '1';
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 1_00_00;
            balanceItem.quantity = 815;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;

            const item = InvoicedBalanceItem.createFor(balanceItem, 815_00_00);
            expect(item.unitPrice).toEqual(82_64);
            expect(item.quantity).toEqual(815_00_00);
            expect(item.totalWithoutVAT).toEqual(673_52_00); // rounded unit price * quantity

            payment.balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                balanceItem,
                price: 815_00_00,
            }));
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.id = '2';
            balanceItem.description = 'Test Item 2';
            balanceItem.unitPrice = 1_00_00;
            balanceItem.quantity = 2;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;

            const item = InvoicedBalanceItem.createFor(balanceItem, 2_00_00);
            expect(item.unitPrice).toEqual(82_64);
            expect(item.totalWithoutVAT).toEqual(1_65_00); // rounded

            payment.balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                balanceItem,
                price: 2_00_00,
            }));
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.id = '3';
            balanceItem.description = 'Test Item 3';
            balanceItem.unitPrice = 1_00_00;
            balanceItem.quantity = 2;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;

            const item = InvoicedBalanceItem.createFor(balanceItem, 2_00_00);
            expect(item.unitPrice).toEqual(82_64);
            expect(item.totalWithoutVAT).toEqual(1_65_00); // rounded

            payment.balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                balanceItem,
                price: 2_00_00,
            }));
        }
        payment.price = payment.balanceItemPayments.reduce((a, b) => a + b.price, 0);
        expect(payment.price).toEqual(819_00_00);

        const invoice = Invoice.create({
            payments: [payment],
        });
        invoice.buildFromPayments();
        expect(invoice.items.length).toEqual(3);
    });

    test('Rounding by adding extra item to the list because unable to correct', () => {
        const payment = PaymentGeneral.create({
            method: PaymentMethod.Transfer,
        });

        {
            const balanceItem = new BalanceItem();
            balanceItem.id = '1';
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 1_00_00;
            balanceItem.quantity = 815;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;

            payment.balanceItemPayments.push(BalanceItemPaymentDetailed.create({
                balanceItem,
                price: 815_00_00,
            }));
        }

        payment.price = payment.balanceItemPayments.reduce((a, b) => a + b.price, 0);
        expect(payment.price).toEqual(815_00_00);

        const invoice = Invoice.create({
            payments: [payment],
        });
        invoice.buildFromPayments();
        expect(invoice.totalWithoutVAT).toEqual(673_55_00);

        expect(invoice.items.length).toEqual(2);
        expect(invoice.items[1]).toMatchObject({
            quantity: 1_00_00,
            unitPrice: 3_00,
        });

        expect(invoice.items[0].totalWithoutVAT).toEqual(Math.round(82_64 * 815 / 100) * 100); // because we need to round per item to 4 decimals
        expect(invoice.items[1].totalWithoutVAT).toEqual(3_00); // because we need to round per item to 4 decimals
    });

    test('Multiple items with 21% VAT', () => {
        const invoice = Invoice.create({});

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 5;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 5 * 20_00 * 121 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(5 * 20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item 2';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00 * 121 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        // Check total price
        expect(invoice.items.length).toEqual(2);
        expect(invoice.totalWithoutVAT).toEqual(5 * 20_00 + 20_00);

        const VAT = Math.round((5 * 20_00 + 20_00) * 21 / 100 / 100) * 100;
        expect(invoice.VATTotalAmount).toEqual(VAT);
        expect(invoice.VATTotal.length).toEqual(1);
        expect(invoice.VATTotal[0].VAT).toEqual(VAT);
        expect(invoice.VATTotal[0].VATPercentage).toEqual(21);
        expect(invoice.VATTotal[0].taxablePrice).toEqual(5 * 20_00 + 20_00);
        expect(invoice.totalWithVAT).toEqual(5 * 20_00 + 20_00 + VAT);

        // Check difference
        const balanceTotal = (5 * 20_00 * 121 / 100 + 20_00 * 121 / 100); // 1_45_20
        expect(invoice.totalBalanceInvoicedAmount).toEqual(balanceTotal);
        const difference = invoice.totalWithVAT - balanceTotal;
        expect(difference).toEqual(-20); // 0,002 can't be shown on the invoice and is the difference
        expect(invoice.balanceRoundingAmount).toEqual(-20);
    });

    test('Combination of Tax excempt items with VAT applicable items should be grouped correctly per tax rate', () => {
        const invoice = Invoice.create({});

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 5;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 5 * 20_00 * 121 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(5 * 20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Tax free item 1';
            balanceItem.unitPrice = 20_00;
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunityServices;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Tax free item 2';
            balanceItem.unitPrice = 5_23_00;
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 6;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunityServices;

            const item = InvoicedBalanceItem.createFor(balanceItem, 5_23_00);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(5_23_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Tax free item 3';
            balanceItem.unitPrice = 5_23_00;
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunityServices;

            const item = InvoicedBalanceItem.createFor(balanceItem, 5_23_00);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(5_23_00);
        }

        // Check total price
        expect(invoice.items.length).toEqual(4);
        expect(invoice.totalWithoutVAT).toEqual(5 * 20_00 + 20_00 + 5_23_00 + 5_23_00);

        expect(invoice.VATTotal.length).toEqual(2); // 2 rates
        const VAT = Math.round(5 * 20_00 * 21 / 100 / 100) * 100;

        const excemptItem = invoice.VATTotal.find(d => d.VATExcempt);
        const notExemptItem = invoice.VATTotal.find(d => !d.VATExcempt);

        expect(excemptItem).not.toBeUndefined();
        expect(notExemptItem).not.toBeUndefined();

        expect(excemptItem?.VATPercentage).toEqual(0);
        expect(excemptItem?.taxablePrice).toEqual(20_00 + 5_23_00 + 5_23_00);
        expect(excemptItem?.VAT).toEqual(0);

        expect(notExemptItem?.VATPercentage).toEqual(21);
        expect(notExemptItem?.taxablePrice).toEqual(5 * 20_00);
        expect(notExemptItem?.VAT).toEqual(VAT);

        expect(invoice.VATTotalAmount).toEqual(VAT);
        expect(invoice.totalWithVAT).toEqual(invoice.totalWithoutVAT + VAT);

        // Check difference
        // const balanceTotal = 5_23_00 + 5_23_00 + 20_00 + 5 * 20_00 * 121 / 100; // 118700
        // -> round number, so should not introduce differences
        expect(invoice.balanceRoundingAmount).toEqual(0);
    });

    test('Combination of multiple tax rates are grouped', () => {
        const invoice = Invoice.create({});

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00 * 121 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item 1';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00 * 121 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Another';
            balanceItem.unitPrice = 20_00;
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 6;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00 * 106 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Another';
            balanceItem.unitPrice = 20_00;
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 6;
            balanceItem.VATIncluded = false;

            const item = InvoicedBalanceItem.createFor(balanceItem, 20_00 * 106 / 100);
            invoice.addItem(item);
            expect(item.totalWithoutVAT).toEqual(20_00);
        }

        // Check total price
        expect(invoice.items.length).toEqual(4);
        expect(invoice.totalWithoutVAT).toEqual(4 * 20_00);

        expect(invoice.VATTotal.length).toEqual(2); // 2 rates
        const VAT1 = Math.round(2 * 20_00 * 21 / 100 / 100) * 100;
        const VAT2 = Math.round(2 * 20_00 * 6 / 100 / 100) * 100;
        const VAT = VAT1 + VAT2;

        const item6 = invoice.VATTotal.find(d => d.VATPercentage === 6);
        const item21 = invoice.VATTotal.find(d => d.VATPercentage === 21);

        expect(item6).not.toBeUndefined();
        expect(item21).not.toBeUndefined();

        expect(item6?.VATPercentage).toEqual(6);
        expect(item6?.taxablePrice).toEqual(40_00);
        expect(item6?.VAT).toEqual(VAT2);

        expect(item21?.VATPercentage).toEqual(21);
        expect(item21?.taxablePrice).toEqual(40_00);
        expect(item21?.VAT).toEqual(VAT1);

        expect(invoice.VATTotalAmount).toEqual(VAT);
        expect(invoice.totalWithVAT).toEqual(invoice.totalWithoutVAT + VAT);

        // Check difference
        expect(invoice.balanceRoundingAmount).toEqual(-80); // const balanceTotal = 20_00 * 106 / 100 + 20_00 * 106 / 100 + 20_00 * 121 / 100 + 20_00 * 121 / 100; // 9080
    });
});
