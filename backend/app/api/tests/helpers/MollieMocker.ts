import { Request } from '@simonbackx/simple-endpoints';
import type { Organization } from '@stamhoofd/models';
import { MollieToken } from '@stamhoofd/models';
import { Version } from '@stamhoofd/structures';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';

import { ExchangePaymentEndpoint } from '../../src/endpoints/organization/shared/ExchangePaymentEndpoint.js';
import { testServer } from './TestServer.js';
import { resetNock } from './resetNock.js';

/**
 * In-memory representation of a Mollie payment (transaction).
 * Only the fields the backend (MollieService / PaymentService) actually reads are kept.
 */
export type MollieMockPayment = {
    id: string;
    status: 'open' | 'paid' | 'failed' | 'canceled' | 'expired' | 'pending';
    amount: { currency: string; value: string };
    /** The internal Stamhoofd payment id (from metadata.paymentId), used to drive the exchange */
    internalPaymentId: string | null;
    redirectUrl: string | null;
    sequenceType: 'oneoff' | 'first' | 'recurring';
    customerId: string | null;
    mandateId: string | null;
    isCancelable: boolean;
    details: Record<string, unknown> | null;
};

export type MollieMockMandate = {
    id: string;
    customerId: string;
    status: 'valid' | 'pending' | 'invalid';
    method: 'creditcard' | 'directdebit';
    details: Record<string, unknown>;
    createdAt: string;
};

export type MollieMockChargeback = {
    id: string;
    paymentId: string;
    amount: { currency: string; value: string };
    createdAt: string;
};

export type MollieMockRefund = {
    id: string;
    paymentId: string;
    amount: { currency: string; value: string };
    status: 'queued' | 'pending' | 'canceled' | 'processing' | 'failed' | 'refunded';
    description: string;
    createdAt: string;
    metadata: Record<string, unknown> | null;
};

export type MollieMockSettlement = {
    id: string;
    reference: string;
    status: 'open' | 'pending' | 'paidout' | 'failed';
    amount: { currency: string; value: string };
    createdAt: string;
    /** null for the still-open settlement, a date once it has been paid out */
    settledAt: string | null;
    /** Mollie payment ids (tr_...) settled in this settlement */
    paymentIds: string[];
    /** Mollie refund ids (re_...) settled in this settlement */
    refundIds: string[];
    /** Mollie chargeback ids (chb_...) settled in this settlement */
    chargebackIds: string[];
};

const MOLLIE_CHECKOUT_URL = 'https://molliecheckout/';

/**
 * Mirrors the StripeMocker (tests/helpers/StripeMocker.ts) but for Mollie.
 *
 * The Mollie node client (@mollie/api-client v4) performs its HTTP requests through node-fetch v2,
 * which uses Node's http/https module under the hood. nock can therefore intercept every call to
 * https://api.mollie.com - exactly like the StripeMocker does for Stripe.
 *
 * Usage:
 *   const mollieMocker = new MollieMocker();
 *   mollieMocker.start();
 *   await mollieMocker.setupToken(membershipOrganization);
 *   ... drive a checkout in the UI ...
 *   await mollieMocker.succeedPayment(); // marks the last payment paid + creates a mandate
 *   mollieMocker.stop();
 */
export class MollieMocker {
    payments: MollieMockPayment[] = [];
    customers: { id: string }[] = [];
    mandates: MollieMockMandate[] = [];
    chargebacks: MollieMockChargeback[] = [];
    refunds: MollieMockRefund[] = [];
    settlements: MollieMockSettlement[] = [];

    #forceFailure = false;

    reset() {
        this.payments = [];
        this.customers = [];
        this.mandates = [];
        this.chargebacks = [];
        this.refunds = [];
        this.settlements = [];
        this.#forceFailure = false;
    }

    /**
     * Make every newly created payment fail immediately when it is exchanged.
     */
    forceFailure() {
        this.#forceFailure = true;
    }

    createId(prefix: string) {
        return prefix + '_' + uuidv4().replaceAll('-', '');
    }

    /**
     * Create a Mollie OAuth token for the selling organization so MollieService.create() works.
     * Without a token, MollieService.create() returns null and no Mollie request is ever made.
     */
    async setupToken(organization: Organization) {
        // Drop any cached token for this organization (the cache survives between tests within a worker)
        MollieToken.knownTokens.delete(organization.id);

        const existing = await MollieToken.where({ organizationId: organization.id });
        const token = existing[0] ?? new MollieToken();
        token.organizationId = organization.id;
        token.accessToken = 'access_test_' + uuidv4().replaceAll('-', '');
        token.refreshToken = 'refresh_test_' + uuidv4().replaceAll('-', '');
        // Far in the future so getAccessToken() never tries to refresh (which would hit the real Mollie OAuth API)
        token.expiresOn = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
        await token.save();

        MollieToken.knownTokens.set(organization.id, token);
        return token;
    }

    start() {
        const matcher = /\/v2\/.*/;

        const interceptor = nock('https://api.mollie.com').persist();

        interceptor.get(matcher).reply((uri) => {
            return this.#handle('GET', uri, undefined);
        });

        interceptor.post(matcher).reply((uri, body) => {
            return this.#handle('POST', uri, body);
        });

        interceptor.delete(matcher).reply((uri, body) => {
            return this.#handle('DELETE', uri, body);
        });
    }

    stop() {
        resetNock();
    }

    /**
     * Route a request to the correct in-memory handler based on its path.
     * Returns a nock-style [statusCode, body] tuple.
     */
    #handle(method: string, uri: string, body: unknown): [number, unknown?] {
        const path = uri.split('?')[0].replace(/^\/v2\//, '');
        const parts = path.split('/').filter(p => p.length > 0);
        const decoded = this.#decodeBody(body);

        // payments
        if (parts[0] === 'payments') {
            if (method === 'POST' && parts.length === 1) {
                return this.#createPayment(decoded);
            }
            if (method === 'GET' && parts.length === 2) {
                return this.#getPayment(parts[1]);
            }
            if (method === 'DELETE' && parts.length === 2) {
                return this.#cancelPayment(parts[1]);
            }
            if (method === 'POST' && parts.length === 3 && parts[2] === 'refunds') {
                return this.#createRefund(parts[1], decoded);
            }
            if (method === 'GET' && parts.length === 4 && parts[2] === 'refunds') {
                return this.#getRefund(parts[1], parts[3]);
            }
        }

        if (parts[0] === 'refunds' && method === 'GET') {
            // The cron iterates newest first (sort desc)
            const sorted = this.refunds.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return this.#listResource('refunds', sorted.map(r => this.#refundResource(r)));
        }

        // customers + nested mandates
        if (parts[0] === 'customers') {
            if (method === 'POST' && parts.length === 1) {
                return this.#createCustomer(decoded);
            }
            if (method === 'GET' && parts.length === 2) {
                return this.#getCustomer(parts[1]);
            }
            if (parts[2] === 'mandates') {
                if (method === 'GET' && parts.length === 3) {
                    return this.#listMandates(parts[1]);
                }
                if (method === 'DELETE' && parts.length === 4) {
                    return this.#revokeMandate(parts[3]);
                }
            }
        }

        if (parts[0] === 'profiles' && method === 'GET') {
            return this.#listResource('profiles', [this.#profile()]);
        }

        if (parts[0] === 'onboarding' && method === 'GET') {
            return [200, this.#onboarding()];
        }

        if (parts[0] === 'chargebacks' && method === 'GET') {
            return this.#listResource('chargebacks', this.chargebacks.map(c => this.#chargebackResource(c)));
        }

        // settlements + nested payments/refunds (drives the settlements cron)
        if (parts[0] === 'settlements' && method === 'GET') {
            if (parts.length === 1) {
                return this.#listResource('settlements', this.settlements.map(s => this.#settlementResource(s)));
            }
            const settlement = this.settlements.find(s => s.id === parts[1]);
            if (settlement && parts.length === 3 && parts[2] === 'payments') {
                const items = this.payments.filter(p => settlement.paymentIds.includes(p.id));
                return this.#listResource('payments', items.map(p => this.#paymentResource(p)));
            }
            if (settlement && parts.length === 3 && parts[2] === 'refunds') {
                const items = this.refunds.filter(r => settlement.refundIds.includes(r.id));
                return this.#listResource('refunds', items.map(r => this.#refundResource(r)));
            }
            if (settlement && parts.length === 3 && parts[2] === 'chargebacks') {
                const items = this.chargebacks.filter(c => settlement.chargebackIds.includes(c.id));
                return this.#listResource('chargebacks', items.map(c => this.#chargebackResource(c)));
            }
        }

        console.error('MollieMocker: unhandled request', method, uri);
        return [500, { detail: 'MollieMocker: unhandled request ' + method + ' ' + uri }];
    }

    // ---- Payments ---------------------------------------------------------

    #createPayment(body: Record<string, any>): [number, unknown] {
        const id = this.createId('tr');
        const payment: MollieMockPayment = {
            id,
            status: 'open',
            amount: body.amount ?? { currency: 'EUR', value: '0.00' },
            // The webshop checkout (PlaceOrderEndpoint) uses the 'payment' metadata key,
            // other flows (MollieService.createPayment) use 'paymentId'
            internalPaymentId: body.metadata?.paymentId ?? body.metadata?.payment ?? null,
            redirectUrl: body.redirectUrl ?? null,
            sequenceType: body.sequenceType ?? 'oneoff',
            customerId: body.customerId ?? null,
            mandateId: body.mandateId ?? null,
            isCancelable: true,
            details: null,
        };
        this.payments.push(payment);
        return [201, this.#paymentResource(payment)];
    }

    #getPayment(id: string): [number, unknown] {
        const payment = this.payments.find(p => p.id === id);
        if (!payment) {
            return [404, { detail: 'Payment not found' }];
        }
        return [200, this.#paymentResource(payment)];
    }

    #cancelPayment(id: string): [number, unknown] {
        const payment = this.payments.find(p => p.id === id);
        if (!payment) {
            return [404, { detail: 'Payment not found' }];
        }
        payment.status = 'canceled';
        return [200, this.#paymentResource(payment)];
    }

    #paymentResource(payment: MollieMockPayment) {
        return {
            resource: 'payment',
            id: payment.id,
            mode: 'test',
            status: payment.status,
            isCancelable: payment.isCancelable,
            amount: payment.amount,
            sequenceType: payment.sequenceType,
            customerId: payment.customerId ?? undefined,
            mandateId: payment.mandateId ?? undefined,
            details: payment.details ?? undefined,
            metadata: payment.internalPaymentId ? { paymentId: payment.internalPaymentId } : undefined,
            _links: {
                self: { href: 'https://api.mollie.com/v2/payments/' + payment.id, type: 'application/hal+json' },
                checkout: { href: MOLLIE_CHECKOUT_URL, type: 'text/html' },
            },
        };
    }

    // ---- Customers --------------------------------------------------------

    #createCustomer(body: Record<string, any>): [number, unknown] {
        const id = this.createId('cst');
        this.customers.push({ id });
        return [201, this.#customerResource(id, body)];
    }

    #getCustomer(id: string): [number, unknown] {
        // Always return a valid test-mode customer (mirrors a real, previously created customer)
        if (!this.customers.find(c => c.id === id)) {
            this.customers.push({ id });
        }
        return [200, this.#customerResource(id, {})];
    }

    #customerResource(id: string, body: Record<string, any>) {
        return {
            resource: 'customer',
            id,
            mode: 'test',
            name: body.name ?? 'Test',
            email: body.email ?? undefined,
            metadata: body.metadata ?? undefined,
            _links: { self: { href: 'https://api.mollie.com/v2/customers/' + id, type: 'application/hal+json' } },
        };
    }

    // ---- Mandates ---------------------------------------------------------

    /**
     * Register a (valid) mandate for a customer, simulating a saved card.
     */
    addMandate(options: { customerId: string; cardNumber?: string; cardLabel?: string; cardHolder?: string }): MollieMockMandate {
        const mandate: MollieMockMandate = {
            id: this.createId('mdt'),
            customerId: options.customerId,
            status: 'valid',
            method: 'creditcard',
            details: {
                cardHolder: options.cardHolder ?? 'John Doe',
                cardNumber: options.cardNumber ?? '1234',
                cardLabel: options.cardLabel ?? 'Visa',
                cardExpiryDate: '2030-12-31',
            },
            createdAt: new Date().toISOString(),
        };
        this.mandates.push(mandate);
        return mandate;
    }

    #listMandates(customerId: string): [number, unknown] {
        const mandates = this.mandates.filter(m => m.customerId === customerId).map(m => this.#mandateResource(m));
        return this.#listResource('mandates', mandates);
    }

    #revokeMandate(mandateId: string): [number, unknown] {
        this.mandates = this.mandates.filter(m => m.id !== mandateId);
        return [204, undefined];
    }

    #mandateResource(mandate: MollieMockMandate) {
        return {
            resource: 'mandate',
            id: mandate.id,
            mode: 'test',
            status: mandate.status,
            method: mandate.method,
            details: mandate.details,
            customerId: mandate.customerId,
            createdAt: mandate.createdAt,
            _links: { self: { href: 'https://api.mollie.com/v2/customers/' + mandate.customerId + '/mandates/' + mandate.id, type: 'application/hal+json' } },
        };
    }

    // ---- Profiles / onboarding -------------------------------------------

    #profile() {
        const id = 'pfl_test';
        return {
            resource: 'profile',
            id,
            mode: 'test',
            name: 'Stamhoofd',
            website: 'https://www.stamhoofd.be',
            status: 'verified',
            _links: { self: { href: 'https://api.mollie.com/v2/profiles/' + id, type: 'application/hal+json' } },
        };
    }

    #onboarding() {
        return {
            resource: 'onboarding',
            name: 'Stamhoofd',
            status: 'completed',
            canReceivePayments: true,
            canReceiveSettlements: true,
            _links: { self: { href: 'https://api.mollie.com/v2/onboarding/me', type: 'application/hal+json' } },
        };
    }

    // ---- Chargebacks ------------------------------------------------------

    /**
     * Register a chargeback for a (succeeded) Mollie payment. Used to drive the mollie-chargebacks cron.
     * The amount must equal the original payment price (PaymentService.registerChargeback enforces this).
     */
    createChargeback(payment: MollieMockPayment): MollieMockChargeback {
        const chargeback: MollieMockChargeback = {
            id: this.createId('chb'),
            paymentId: payment.id,
            amount: payment.amount,
            createdAt: new Date().toISOString(),
        };
        this.chargebacks.push(chargeback);
        return chargeback;
    }

    #chargebackResource(chargeback: MollieMockChargeback) {
        return {
            resource: 'chargeback',
            id: chargeback.id,
            amount: chargeback.amount,
            paymentId: chargeback.paymentId,
            createdAt: chargeback.createdAt,
            _links: { self: { href: 'https://api.mollie.com/v2/payments/' + chargeback.paymentId + '/chargebacks/' + chargeback.id, type: 'application/hal+json' } },
        };
    }

    // ---- Refunds ----------------------------------------------------------

    /**
     * The remaining refundable amount for a payment (in euro), like Mollie's amountRemaining.
     */
    getRemainingAmount(payment: MollieMockPayment): number {
        const refunded = this.refunds
            .filter(r => r.paymentId === payment.id && r.status !== 'canceled' && r.status !== 'failed')
            .reduce((total, r) => total + parseFloat(r.amount.value), 0);
        return parseFloat(payment.amount.value) - refunded;
    }

    /**
     * Handle POST /payments/:id/refunds like Mollie: refuse refunds on unpaid payments and
     * refunds that are higher than the remaining refundable amount.
     */
    #createRefund(paymentId: string, body: Record<string, any>): [number, unknown] {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) {
            return [404, { status: 404, title: 'Not Found', detail: 'No payment exists with token ' + paymentId }];
        }

        if (payment.status !== 'paid') {
            return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The payment is not paid; you can only refund paid payments' }];
        }

        const value = parseFloat(String(body.amount?.value ?? '0'));
        if (!(value > 0)) {
            return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The amount is invalid', field: 'amount' }];
        }

        if (value > this.getRemainingAmount(payment) + 0.000001) {
            return [422, { status: 422, title: 'Unprocessable Entity', detail: 'The amount is higher than the remaining payment amount', field: 'amount' }];
        }

        const refund: MollieMockRefund = {
            id: this.createId('re'),
            paymentId: payment.id,
            amount: body.amount,
            status: 'pending',
            description: body.description ?? '',
            createdAt: new Date().toISOString(),
            metadata: body.metadata ?? null,
        };
        this.refunds.push(refund);
        return [201, this.#refundResource(refund)];
    }

    #getRefund(paymentId: string, refundId: string): [number, unknown] {
        const refund = this.refunds.find(r => r.id === refundId && r.paymentId === paymentId);
        if (!refund) {
            return [404, { status: 404, title: 'Not Found', detail: 'No refund exists with token ' + refundId }];
        }
        return [200, this.#refundResource(refund)];
    }

    /**
     * Register a refund directly (simulating a refund created in the Mollie dashboard).
     * Used to drive the mollie-refunds cron.
     */
    createRefund(payment: MollieMockPayment, options: { value?: string; status?: MollieMockRefund['status']; createdAt?: Date; metadata?: Record<string, unknown> } = {}): MollieMockRefund {
        const refund: MollieMockRefund = {
            id: this.createId('re'),
            paymentId: payment.id,
            amount: { currency: payment.amount.currency, value: options.value ?? payment.amount.value },
            status: options.status ?? 'pending',
            description: '',
            createdAt: (options.createdAt ?? new Date()).toISOString(),
            metadata: options.metadata ?? null,
        };
        this.refunds.push(refund);
        return refund;
    }

    /**
     * Mark a refund as executed by Mollie and trigger the webhook of the original payment
     * (like Mollie does when the status of a refund changes).
     */
    async settleRefund(refund: MollieMockRefund = this.refunds[this.refunds.length - 1]) {
        refund.status = 'refunded';
        await this.#exchangeRefund(refund);
    }

    /**
     * Mark a refund as failed at Mollie (e.g. the bank refused the transfer) and trigger the
     * webhook of the original payment.
     */
    async failRefund(refund: MollieMockRefund = this.refunds[this.refunds.length - 1]) {
        refund.status = 'failed';
        await this.#exchangeRefund(refund);
    }

    async #exchangeRefund(refund: MollieMockRefund) {
        const payment = this.payments.find(p => p.id === refund.paymentId);
        if (payment) {
            await this.#exchange(payment);
        }
    }

    #refundResource(refund: MollieMockRefund) {
        return {
            resource: 'refund',
            id: refund.id,
            mode: 'test',
            amount: refund.amount,
            status: refund.status,
            description: refund.description,
            paymentId: refund.paymentId,
            createdAt: refund.createdAt,
            metadata: refund.metadata ?? undefined,
            _links: { self: { href: 'https://api.mollie.com/v2/payments/' + refund.paymentId + '/refunds/' + refund.id, type: 'application/hal+json' } },
        };
    }

    // ---- Settlements ------------------------------------------------------

    /**
     * Register a settled (paid out) settlement that groups the given payments and refunds.
     * Used to drive the settlements cron (CheckSettlements).
     */
    createSettlement(options: { payments?: MollieMockPayment[]; refunds?: MollieMockRefund[]; chargebacks?: MollieMockChargeback[]; value?: string; settledAt?: Date } = {}): MollieMockSettlement {
        const settlement: MollieMockSettlement = {
            id: this.createId('stl'),
            reference: '1234567.' + (this.settlements.length + 1).toString().padStart(4, '0') + '.01',
            status: 'paidout',
            amount: { currency: 'EUR', value: options.value ?? '0.00' },
            createdAt: new Date().toISOString(),
            settledAt: (options.settledAt ?? new Date()).toISOString(),
            paymentIds: (options.payments ?? []).map(p => p.id),
            refundIds: (options.refunds ?? []).map(r => r.id),
            chargebackIds: (options.chargebacks ?? []).map(c => c.id),
        };
        this.settlements.push(settlement);
        return settlement;
    }

    #settlementResource(settlement: MollieMockSettlement) {
        return {
            resource: 'settlement',
            id: settlement.id,
            reference: settlement.reference,
            status: settlement.status,
            amount: settlement.amount,
            createdAt: settlement.createdAt,
            settledAt: settlement.settledAt ?? null,
            _links: { self: { href: 'https://api.mollie.com/v2/settlements/' + settlement.id, type: 'application/hal+json' } },
        };
    }

    // ---- List helper ------------------------------------------------------

    #listResource(binderName: string, items: unknown[]): [number, unknown] {
        return [200, {
            count: items.length,
            _embedded: { [binderName]: items },
            _links: {
                self: { href: 'https://api.mollie.com/v2/' + binderName, type: 'application/hal+json' },
                documentation: { href: 'https://docs.mollie.com', type: 'text/html' },
                next: null,
                previous: null,
            },
        }];
    }

    // ---- Driving payment status ------------------------------------------

    getLastPayment(): MollieMockPayment {
        return this.payments[this.payments.length - 1];
    }

    /**
     * Mark a payment as paid. For first/recurring-setup payments this also creates a valid mandate
     * for the payment's customer (simulating Mollie creating the mandate after the first payment),
     * and links it on the payment so the backend stores it as the default mandate.
     *
     * Finally it triggers the payment exchange (like Mollie's webhook) so the backend processes the
     * status change: marking balance items paid, activating packages and saving the default mandate.
     */
    async succeedPayment(payment: MollieMockPayment = this.getLastPayment(), options: { cardNumber?: string; cardLabel?: string } = {}) {
        if (this.#forceFailure) {
            return this.failPayment(payment);
        }

        payment.status = 'paid';
        payment.isCancelable = false;

        if ((payment.sequenceType === 'first') && payment.customerId && !payment.mandateId) {
            const mandate = this.addMandate({
                customerId: payment.customerId,
                cardNumber: options.cardNumber,
                cardLabel: options.cardLabel,
            });
            payment.mandateId = mandate.id;
        }

        payment.details = {
            cardHolder: 'John Doe',
            cardNumber: options.cardNumber ?? '1234',
            cardLabel: options.cardLabel ?? 'Visa',
        };

        await this.#exchange(payment);
    }

    async failPayment(payment: MollieMockPayment = this.getLastPayment()) {
        payment.status = 'failed';
        payment.isCancelable = false;
        await this.#exchange(payment);
    }

    /**
     * Trigger the payment exchange endpoint (the equivalent of a Mollie webhook), so the backend
     * polls the (now updated) Mollie status and processes it.
     */
    async #exchange(payment: MollieMockPayment) {
        if (!payment.internalPaymentId) {
            return;
        }
        const endpoint = new ExchangePaymentEndpoint();
        const request = Request.buildJson('POST', `/v${Version}/payments/${encodeURIComponent(payment.internalPaymentId)}?exchange=true`, undefined, undefined);
        await testServer.test(endpoint, request);
    }

    #decodeBody(body: unknown): Record<string, any> {
        if (!body) {
            return {};
        }
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch {
                return {};
            }
        }
        return body as Record<string, any>;
    }
}
