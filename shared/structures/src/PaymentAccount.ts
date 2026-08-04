import { Formatter } from '@stamhoofd/utility';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import type { PaymentGeneral } from './members/PaymentGeneral.js';
import { PaymentMethod, PaymentMethodHelper } from './PaymentMethod.js';
import { getPaymentProviderName, PaymentProvider } from './PaymentProvider.js';
import type { StripeAccount } from './StripeAccount.js';

/**
 * An account number that was never filled in. Old payments store this as an empty string and newer ones
 * as nothing at all, and both mean the same thing, so a filter has to accept the two.
 */
const NO_ACCOUNT_NUMBER = { $in: [null, ''] };

/**
 * Where the money of a payment arrived: a bank account for transfers, a Stripe account, or otherwise
 * the payment provider or method that handled it.
 */
export class PaymentAccount {
    /**
     * Stable identifier, used to add payments that arrived in the same place together.
     */
    id: string;
    name: string;
    description: string;
    icon: string;

    /**
     * Selects the payments that arrived here, so a breakdown can be narrowed down to this account.
     */
    filter: StamhoofdFilter;

    constructor({ id, name, description, icon, filter }: { id: string; name: string; description?: string; icon: string; filter: StamhoofdFilter }) {
        this.id = id;
        this.name = name;
        this.description = description ?? '';
        this.icon = icon;
        this.filter = filter;
    }
}

/**
 * Determines where the money of a payment arrived.
 *
 * @param stripeAccounts The Stripe accounts of the organization, so a Stripe payment can be named
 * after the account it was paid out to. Payments of deleted accounts stay grouped by their id.
 */
export function getPaymentAccount(payment: PaymentGeneral, stripeAccounts: StripeAccount[] = []): PaymentAccount {
    if (payment.provider === PaymentProvider.Stripe) {
        const account = stripeAccounts.find(a => a.id === payment.stripeAccountId);
        const holder = account ? (account.meta.business_profile?.name || account.meta.company?.name || account.meta.bank_account_bank_name) : '';

        return new PaymentAccount({
            id: 'stripe-' + (payment.stripeAccountId ?? 'unknown'),
            name: holder || getPaymentProviderName(PaymentProvider.Stripe),
            description: account
                ? (account.meta.bank_account_last4 ? `xxxx ${account.meta.bank_account_last4}` : '')
                : $t('%Zia'),
            icon: 'card',
            // Every payment that was not made via Stripe has no Stripe account either, so the provider
            // has to be part of the filter
            filter: {
                $and: [
                    { provider: PaymentProvider.Stripe },
                    { stripeAccountId: payment.stripeAccountId },
                ],
            },
        });
    }

    if (payment.method === PaymentMethod.Transfer && (payment.transferSettings?.iban || payment.transferSettings?.creditor)) {
        // An empty account number is the same as none at all, so it never ends up in an id or a filter
        const iban = payment.transferSettings.iban || null;
        const creditor = payment.transferSettings.creditor || null;

        return new PaymentAccount({
            // The account number itself, not a slug of it: two accounts that look alike are still two
            id: iban ? 'iban-' + iban : 'creditor-' + creditor,
            name: creditor ?? iban ?? PaymentMethodHelper.getNameCapitalized(PaymentMethod.Transfer),
            description: creditor && iban ? iban : '',
            icon: 'bank',
            // A payment keeps its account number when its method is changed afterwards, so the method
            // has to be part of the filter: only transfers arrived on this account
            filter: {
                $and: [
                    { method: PaymentMethod.Transfer },
                    ...(iban
                        ? [{ transferSettings: { iban } }]
                    // Transfers that also name an account number are their own group, so a payment to
                    // the same holder with an account number shouldn't be selected here too
                        : [
                                { transferSettings: { creditor } },
                                { transferSettings: { iban: NO_ACCOUNT_NUMBER } },
                            ]),
                ],
            },
        });
    }

    if (payment.provider) {
        return new PaymentAccount({
            id: 'provider-' + payment.provider,
            name: getPaymentProviderName(payment.provider),
            description: $t('%Ziu'),
            icon: 'card',
            filter: {
                provider: payment.provider,
            },
        });
    }

    return new PaymentAccount({
        id: 'method-' + payment.method,
        name: PaymentMethodHelper.getNameCapitalized(payment.method),
        description: '',
        icon: payment.method === PaymentMethod.Transfer ? 'bank' : 'card',
        filter: {
            method: payment.method,
            provider: null,
            // Transfers to a known account are their own group, so they shouldn't be selected here too
            ...(payment.method === PaymentMethod.Transfer
                ? { transferSettings: { iban: NO_ACCOUNT_NUMBER, creditor: NO_ACCOUNT_NUMBER } }
                : {}),
        },
    });
}
