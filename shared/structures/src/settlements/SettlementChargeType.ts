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
     * Service part of an application fee arriving on our platform payout (positive).
     * These rows are the invoicing source.
     */
    ReceivedApplicationFeeService = 'ReceivedApplicationFeeService',

    /**
     * Transaction/transfer part of an application fee arriving on our platform payout (positive).
     * These rows are the invoicing source.
     */
    ReceivedApplicationFeeTransfer = 'ReceivedApplicationFeeTransfer',

    /**
     * A refunded application fee on our platform payout (negative), unsplit.
     */
    ApplicationFeeRefund = 'ApplicationFeeRefund',

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
     * Destination-charge transfer to the organization: minus gross on our platform payout.
     */
    Transfer = 'Transfer',

    /**
     * transfer_cancel / transfer_failure / transfer_refund.
     */
    TransferReversal = 'TransferReversal',

    /**
     * reserve_transaction: funds the provider holds back.
     */
    Reserve = 'Reserve',

    /**
     * Dispute adjustments.
     */
    Adjustment = 'Adjustment',
}
