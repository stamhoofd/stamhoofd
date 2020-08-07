export enum PaymentStatus {
    Pending = "Pending",
    Failed = "Failed",
    Succeeded = "Succeeded",
    Created = "Created" // The payment is created, but a payment method should be selected now
}