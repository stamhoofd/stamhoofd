import { Formatter } from '@stamhoofd/utility';

export enum PaymentStatus {
    Pending = 'Pending',
    Failed = 'Failed',
    Succeeded = 'Succeeded',
    Created = 'Created', // The payment is created, but a payment method should be selected now
}

export class PaymentStatusHelper {
    static getName(method: PaymentStatus): string {
        switch (method) {
            case PaymentStatus.Pending: return $t(`%mu`);
            case PaymentStatus.Created: return $t(`%mu`);
            case PaymentStatus.Succeeded: return $t(`%mv`);
            case PaymentStatus.Failed: return $t(`%mw`);
        }
    }

    static getNameCapitalized(method: PaymentStatus): string {
        return Formatter.capitalizeFirstLetter(PaymentStatusHelper.getName(method));
    }
}
