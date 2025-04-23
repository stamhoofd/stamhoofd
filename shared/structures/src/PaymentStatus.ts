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
            case PaymentStatus.Pending: return $t(`f694cb61-e5f0-4f43-ae4d-729300f76738`);
            case PaymentStatus.Created: return $t(`f694cb61-e5f0-4f43-ae4d-729300f76738`);
            case PaymentStatus.Succeeded: return $t(`704d592c-e76c-422a-a03e-18db474771c0`);
            case PaymentStatus.Failed: return $t(`eb41b92a-a064-4c1a-8220-39b03e4cc4cc`);
        }
    }

    static getNameCapitalized(method: PaymentStatus): string {
        return Formatter.capitalizeFirstLetter(PaymentStatusHelper.getName(method));
    }
}
