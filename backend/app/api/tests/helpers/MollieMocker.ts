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

    #forceFailure = false;

    reset() {
        this.payments = [];
        this.customers = [];
        this.mandates = [];
        this.chargebacks = [];
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
            internalPaymentId: body.metadata?.paymentId ?? null,
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
