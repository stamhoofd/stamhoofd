import { BalanceItem, VATExcemptReason } from '../BalanceItem.js';
import { InvoicedBalanceItem } from './InvoicedBalanceItem.js';

describe('InvoicedBalanceItem', () => {
    describe('createFor', () => {
        test('Create an invoice item for a balance item including VAT with quantity of 1', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 5_00_00; // 5 euro, including VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;
            balanceItem.VATExcempt = null;

            expect(balanceItem.priceWithVAT).toBe(5_00_00);
            expect(balanceItem.priceWithoutVAT).toBe(4_13_22); // 5 / 1.21 + rounding

            // Create an invoiced balance item for the full quantity
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 5_00_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(5_00_00);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(4_13_22); // should not be rounded to 1 cent
            expect(invoicedItem.VATPercentage).toBe(21);
            expect(invoicedItem.VATIncluded).toBe(true);
            expect(invoicedItem.VATExcempt).toBeNull();
            expect(invoicedItem.totalWithoutVAT).toBe(4_13_00); // rounded
        });

        test('Create an invoice item for a balance item including VAT with quantity of 3', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 5_00_00; // 5 euro, including VAT
            balanceItem.quantity = 3;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;
            balanceItem.VATExcempt = null;

            expect(balanceItem.priceWithVAT).toBe(15_00_00);
            expect(balanceItem.priceWithoutVAT).toBe(12_39_67); // 15 / 1.21 + rounding

            // Create an invoiced balance item for one item
            {
                const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 5_00_00);

                expect(invoicedItem.balanceInvoicedAmount).toBe(5_00_00);
                expect(invoicedItem.quantity).toBe(1_00_00);
                expect(invoicedItem.unitPrice).toBe(4_13_22); // not rounded
                expect(invoicedItem.VATPercentage).toBe(21);
                expect(invoicedItem.VATIncluded).toBe(true);
                expect(invoicedItem.VATExcempt).toBeNull();
                expect(invoicedItem.totalWithoutVAT).toBe(4_13_00); // rounded
            }

            // Create an invoiced balance item for two items
            {
                const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 10_00_00);

                expect(invoicedItem.balanceInvoicedAmount).toBe(10_00_00);
                expect(invoicedItem.quantity).toBe(2_00_00);
                expect(invoicedItem.unitPrice).toBe(4_13_22); // not rounded
                expect(invoicedItem.VATPercentage).toBe(21);
                expect(invoicedItem.VATIncluded).toBe(true);
                expect(invoicedItem.VATExcempt).toBeNull();
                expect(invoicedItem.totalWithoutVAT).toBe(8_26_00); // rounded
            }

            // Create an invoiced balance item for three items
            {
                const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 15_00_00);

                expect(invoicedItem.balanceInvoicedAmount).toBe(15_00_00);
                expect(invoicedItem.quantity).toBe(3_00_00);
                expect(invoicedItem.unitPrice).toBe(4_13_22); // not rounded
                expect(invoicedItem.VATPercentage).toBe(21);
                expect(invoicedItem.VATIncluded).toBe(true);
                expect(invoicedItem.VATExcempt).toBeNull();
                expect(invoicedItem.totalWithoutVAT).toBe(12_40_00); // rounded
            }

            // Create an invoiced balance item for half an item
            {
                const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 2_50_00);

                expect(invoicedItem.balanceInvoicedAmount).toBe(2_50_00);
                expect(invoicedItem.quantity).toBe(50_00); // 50% of an item
                expect(invoicedItem.unitPrice).toBe(4_13_22); // not rounded
                expect(invoicedItem.VATPercentage).toBe(21);
                expect(invoicedItem.VATIncluded).toBe(true);
                expect(invoicedItem.VATExcempt).toBeNull();
                expect(invoicedItem.totalWithoutVAT).toBe(2_07_00); // rounded
            }

            // Create an invoiced balance item for 1/3 of an item
            {
                const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 1_66_66);

                expect(invoicedItem.balanceInvoicedAmount).toBe(1_66_66);
                expect(invoicedItem.quantity).toBe(33_33); // 33.33% of an item
                expect(invoicedItem.unitPrice).toBe(4_13_25); // difference caused by rounding of quantity
                expect(invoicedItem.VATPercentage).toBe(21);
                expect(invoicedItem.VATIncluded).toBe(true);
                expect(invoicedItem.VATExcempt).toBeNull();
                expect(invoicedItem.totalWithoutVAT).toBe(1_38_00); // rounded
            }
        });

        test('Create an invoice item for a balance item excluding VAT with quantity of 1', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = null;

            expect(balanceItem.priceWithVAT).toBe(24_20); // 0,242 euro
            expect(balanceItem.priceWithoutVAT).toBe(20_00);

            // Create an invoiced balance item for the full quantity
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 24_20);

            expect(invoicedItem.balanceInvoicedAmount).toBe(24_20);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(20_00);
            expect(invoicedItem.VATPercentage).toBe(21);
            expect(invoicedItem.VATIncluded).toBe(false);
            expect(invoicedItem.VATExcempt).toBeNull();
            expect(invoicedItem.totalWithoutVAT).toBe(20_00);
        });

        test('Create an invoice item for a balance item excluding 0% VAT with quantity of 1', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 0;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = null;

            expect(balanceItem.priceWithVAT).toBe(20_00);
            expect(balanceItem.priceWithoutVAT).toBe(20_00);

            // Create an invoiced balance item for the full quantity
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 20_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(20_00);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(20_00);
            expect(invoicedItem.VATPercentage).toBe(0);
            expect(invoicedItem.VATIncluded).toBe(false);
            expect(invoicedItem.VATExcempt).toBeNull();
            expect(invoicedItem.totalWithoutVAT).toBe(20_00);
        });

        test('Create an invoice item for a balance item including 0% VAT with quantity of 1', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 0;
            balanceItem.VATIncluded = true;
            balanceItem.VATExcempt = null;

            expect(balanceItem.priceWithVAT).toBe(20_00);
            expect(balanceItem.priceWithoutVAT).toBe(20_00);

            // Create an invoiced balance item for the full quantity
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 20_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(20_00);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(20_00);
            expect(invoicedItem.VATPercentage).toBe(0);
            expect(invoicedItem.VATIncluded).toBe(true);
            expect(invoicedItem.VATExcempt).toBeNull();
            expect(invoicedItem.totalWithoutVAT).toBe(20_00);
        });

        test('Create an invoice item for a balance item excluding VAT with quantity of 1 that is excempt VAT', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 20_00; // 0,20 euro, excluding VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunity;

            expect(balanceItem.priceWithVAT).toBe(20_00);
            expect(balanceItem.priceWithoutVAT).toBe(20_00);

            // Create an invoiced balance item for the full quantity
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 20_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(20_00);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(20_00);
            expect(invoicedItem.VATPercentage).toBe(21);
            expect(invoicedItem.VATIncluded).toBe(false);
            expect(invoicedItem.VATExcempt).toBe(VATExcemptReason.IntraCommunity);
            expect(invoicedItem.totalWithoutVAT).toBe(20_00);
        });

        test('Create an invoice item for a balance item including VAT with quantity of 1 that is excempt VAT', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 24_20; // 0,242 euro, including VAT
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = true;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunity;

            expect(balanceItem.priceWithVAT).toBe(20_00);
            expect(balanceItem.priceWithoutVAT).toBe(20_00);

            // Create an invoiced balance item for the full quantity (0,20 is payable or invoiceable, the system should treat that as one item)
            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 20_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(20_00);
            expect(invoicedItem.quantity).toBe(1_00_00);
            expect(invoicedItem.unitPrice).toBe(20_00);
            expect(invoicedItem.VATPercentage).toBe(21);
            expect(invoicedItem.VATIncluded).toBe(true);
            expect(invoicedItem.VATExcempt).toBe(VATExcemptReason.IntraCommunity);
            expect(invoicedItem.totalWithoutVAT).toBe(20_00);
        });

        test('Paying 1/3 of a balance item causes 33.33% quantity', () => {
            const balanceItem = new BalanceItem();
            balanceItem.description = 'Test Item';
            balanceItem.unitPrice = 30_00; // = 0,30 euro
            balanceItem.quantity = 1;
            balanceItem.VATPercentage = 21;
            balanceItem.VATIncluded = false;
            balanceItem.VATExcempt = VATExcemptReason.IntraCommunity;

            expect(balanceItem.priceWithVAT).toBe(30_00);
            expect(balanceItem.priceWithoutVAT).toBe(30_00);

            const invoicedItem = InvoicedBalanceItem.createFor(balanceItem, 10_00);

            expect(invoicedItem.balanceInvoicedAmount).toBe(10_00);
            expect(invoicedItem.quantity).toBe(33_33);
            expect(invoicedItem.unitPrice).toBe(30_00); // = 0,30 euro
            expect(invoicedItem.VATPercentage).toBe(21);
            expect(invoicedItem.VATIncluded).toBe(false);
            expect(invoicedItem.VATExcempt).toBe(VATExcemptReason.IntraCommunity);
            expect(invoicedItem.totalWithoutVAT).toBe(10_00); // rounded
        });
    });
});
