/**
 * Every charge in a settlement (= payout) that is not a payment. Provider-independent: Stripe and
 * Mollie map their own concepts onto these types, unknown input should throw instead of falling
 * back to a catch-all type.
 */
export enum SettlementChargeType {
    /**
     * Service part of an application fee, deducted from an organization payout (negative).
     */
    ApplicationFeeService = 'ApplicationFeeService',

    /**
     * Transaction/transfer part of an application fee, deducted from an organization payout (negative).
     */
    ApplicationFeeTransfer = 'ApplicationFeeTransfer',

    /**
     * The provider's own transaction fee, excluding VAT (Stripe: fee_details entries,
     * Mollie: settlement cost lines).
     */
    ProviderTransactionFee = 'ProviderTransactionFee',

    /**
     * Recurring account fees the provider bills us (Stripe: stripe_fee / network_cost transactions).
     */
    ProviderAccountFee = 'ProviderAccountFee',

    /**
     * VAT on provider fees (Stripe: tax fee details, Mollie: amountVat of a cost line).
     */
    Tax = 'Tax',

    /**
     * Funds the provider holds back (reserve_transaction, reserved_funds, reserve_hold,
     * reserve_release).
     */
    Reserve = 'Reserve',

    /**
     * Money moving in or out of the balance outside a payment: a payout that came back
     * (payout_failure, payout_cancel), a top-up, or something the provider settled against the
     * balance directly.
     */
    BalanceMovement = 'BalanceMovement',

    /**
     * Dispute adjustments.
     */
    Adjustment = 'Adjustment',
}
