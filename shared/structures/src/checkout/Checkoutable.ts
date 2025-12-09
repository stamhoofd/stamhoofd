import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, URLDecoder } from '@simonbackx/simple-encoding';
import { BalanceItem } from '../BalanceItem.js';
import { PaymentCustomer } from '../PaymentCustomer.js';
import { PaymentMandate } from '../PaymentMandate.js';
import { PaymentMethod } from '../PaymentMethod.js';

export class PayBalanceItem extends AutoEncoder {
    @field({ decoder: BalanceItem })
    balanceItem: BalanceItem;

    /**
     * How much to pay for this specific balance item
     */
    @field({ decoder: IntegerDecoder })
    amount: number;
}

/**
 * We have multiple checkout flows in Stamhoofd. They all share a similar way of selecting a payment method,
 * and also allowing you to pay for already existing balances.
 *
 * This interface, streamlines this to a common interface that we should start using everywhere, so we can
 * make more general helpers in the backend and frontend for handling the payment flow.
 */
export abstract class Checkoutable<T> extends AutoEncoder {
    /**
     * This part is what you are paying for, new stuff. Can be empty if you are only paying
     * for existing balances.
     */
    abstract purchases: T;

    // A way to select existing balance items that you want to pay, and how much you want to pay
    @field({ decoder: new ArrayDecoder(PayBalanceItem) })
    balances: PayBalanceItem[] = [];

    /**
     * If null, mandate should be set instead.
     */
    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null;

    /**
     * Pay with an existing mandate instead of a payment method
     */
    @field({ decoder: PaymentMandate, nullable: true })
    mandate: PaymentMandate | null = null;

    /**
     * Invoice details. Will get saved into the created payment and/or invoice.
     */
    @field({ decoder: PaymentCustomer })
    customer = PaymentCustomer.create({});

    /**
     * Whether to set up a new mandate for this customer.
     * Only relevant when paymentMethod is not null.
     *
     * If this is set and the total price is zero, the total price might be increased to an arbitrary
     * number in order to link a payment method.
     *
     * Note: it might be required for subscription based purchases to set this to true if not paying with an existing mandate.
     */
    @field({ decoder: BooleanDecoder })
    createMandate = false;

    /**
     * The link we'll redirect the user back too after the payment page (either succeeded or failed!)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({ allowedProtocols: ['https:'] }), nullable: true })
    redirectUrl: URL | null = null;

    /**
     * The link we'll redirect the user back too after the user canceled a payment (not supported for all payment methods)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({ allowedProtocols: ['https:'] }), nullable: true })
    cancelUrl: URL | null = null;

    /**
     * In case we don't want to initiate a payment yet,
     * - want to use the backend to know the total expected price.
     * - want to know if we can generate an automated invoice or not (might not be available)
     *
     * When true, this will create an invoice (without number) in the response,
     * but won't create the payment yet.
     */
    @field({ decoder: BooleanDecoder, optional: true })
    proForma = false;

    /**
     * The price that the frontend displayed to the user. Can be null to skip verification.
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    totalPrice: number | null = null;
}
