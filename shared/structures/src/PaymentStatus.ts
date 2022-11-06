import { Formatter } from "@stamhoofd/utility";

export enum PaymentStatus {
    Pending = "Pending",
    Failed = "Failed",
    Succeeded = "Succeeded",
    Created = "Created" // The payment is created, but a payment method should be selected now
}

export class PaymentStatusHelper {
    static getName(method: PaymentStatus): string {
        switch(method) {
            case PaymentStatus.Pending: return "wacht op betaling";
            case PaymentStatus.Created: return "wacht op betaling";
            case PaymentStatus.Succeeded: return "ontvangen";
            case PaymentStatus.Failed: return "mislukt/geannuleerd";
        }
    }

    static getNameCapitalized(method: PaymentStatus): string {
        return Formatter.capitalizeFirstLetter(PaymentStatusHelper.getName(method))
    }
}