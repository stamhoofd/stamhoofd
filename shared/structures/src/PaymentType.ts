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
            case PaymentType.Payment: return $t(`e739f15a-d80a-4d12-9b3f-e672a773c406`);
            case PaymentType.Refund: return $t(`cfd5d1ac-6997-45b5-bba5-3629695f4a8b`);
            case PaymentType.Chargeback: return $t(`b15e330d-589f-4709-b34a-a3c29389650c`);
            case PaymentType.Reallocation: return $t(`01225a70-b108-4f12-ad86-46e7b23a1043`);
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
