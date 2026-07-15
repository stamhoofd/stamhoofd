export enum PaymentProvider {
    Mollie = 'Mollie',
    Payconiq = 'Payconiq',
    Buckaroo = 'Buckaroo',
    Stripe = 'Stripe',
}

export function getPaymentProviderName(type: PaymentProvider) {
    if (type === PaymentProvider.Payconiq) {
        return $t(`%1cA`);
    }
    return type.toString();
}
