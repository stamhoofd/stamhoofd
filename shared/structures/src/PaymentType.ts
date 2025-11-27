/**
 * Types of payment:
 * - Payment (default) = positive amount or zero
 * - Refund = negative amount
 * - Chargeback = negative amount due to reversed payment
 * - Reallocation = zero payment due to automatic reallocation (pay an amount of an open balance using a negative or canceled balance)
 */
export enum PaymentType {
    /**
     * payment for some items - positive amount or zero
     * can contain both positive and negative items
     */
    Payment = 'Payment',

    /**
     * negative amount to refund earlier items
     * -> created by the creditor
     * can only contain negative items
     */
    Refund = 'Refund',

    /**
     * negative amount due to reversed payment
     * -> created by the debtor without permission of the creditor
     * can only contain negative items
     */
    Chargeback = 'Chargeback',

    /**
     * funds are automatically moved to offset balances without any net change in the overall payment amount
     * Contains both negative and positive items
     */
    Reallocation = 'Reallocation',
}

export class PaymentTypeHelper {
    static getName(type: PaymentType): string {
        switch (type) {
            case PaymentType.Payment: return $t(`bc90ce0a-2273-4942-9ce9-45fead8f928c`);
            case PaymentType.Refund: return $t(`48d1c259-80aa-461a-b5dc-f3a54f498bc5`);
            case PaymentType.Chargeback: return $t(`61ab73b5-ab85-4cfd-829f-3ffbbf502e3b`);
            case PaymentType.Reallocation: return $t(`fb3fe84c-55d4-4507-adc9-85a3a36a589f`);
        }
    }

    static getDescription(type: PaymentType): string {
        switch (type) {
            case PaymentType.Payment: return $t(`Een betaling van een lid of supporter aan jouw vereniging`);
            case PaymentType.Refund: return $t(`Een terugbetaling van jouw vereniging richting een lid of supporter`);
            case PaymentType.Chargeback: return $t(`Een terugvordering maakt een eerder gelukte betaling van een lid of supporter ongedaan, zonder enige tussenkomst van jouw vereniging. Bv. bij een laattijdig mislukte betaling of een terugvordering via de creditcard of bank.`);
            case PaymentType.Reallocation: return $t(`Positieve en negatieve openstaande bedragen worden samengebracht zodat het totaal op 0 euro uitkomt, zodat die items elkaar opheffen.`);
        }
    }

    static getIcon(type: PaymentType): string {
        switch (type) {
            case PaymentType.Payment: return 'card';
            case PaymentType.Refund: return 'undo';
            case PaymentType.Chargeback: return 'declined';
            case PaymentType.Reallocation: return 'wand';
        }
    }
}
