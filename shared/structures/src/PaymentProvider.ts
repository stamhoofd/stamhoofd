export enum PaymentProvider {
    Mollie = 'Mollie',
    Payconiq = 'Payconiq',
    Buckaroo = 'Buckaroo',
    Stripe = 'Stripe',
}

export function getPaymentProviderName(type: PaymentProvider) {
    return type.toString();
}
