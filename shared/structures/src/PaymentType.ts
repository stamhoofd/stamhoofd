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
            case PaymentType.Payment: return $t(`%14a`);
            case PaymentType.Refund: return $t(`%mx`);
            case PaymentType.Chargeback: return $t(`%my`);
            case PaymentType.Reallocation: return $t(`%mz`);
        }
    }

    static getDescription(type: PaymentType): string {
        switch (type) {
            case PaymentType.Payment: return $t(`%1IB`);
            case PaymentType.Refund: return $t(`%1IC`);
            case PaymentType.Chargeback: return $t(`%1ID`);
            case PaymentType.Reallocation: return $t(`%1IE`);
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
